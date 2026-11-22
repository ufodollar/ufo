import React, { useState, useEffect, useMemo, useRef } from 'react';
import { walletList, openInWallet, isMobile, autoconnectUrl } from '../wallets';
import { getWcUri } from '../wclink';

const FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif' };

/**
 * 钱包选择面板。
 *
 * 移动端：7 个钱包图标墙，点了直接跳进该 App 的内置浏览器，
 *        落地时页面里已有注入，自动就是已连接状态 —— 没有二维码、没有配对。
 * 桌面端：优先列出 EIP-6963 发现到的扩展（一列，图标+名字），
 *        一个扩展都没有时才给二维码，让用户用手机接着走上面的流程。
 */
export default function WalletPicker({ open, onClose, injectedWallets, onPick, onOkxConnect, onWcConnect, wcReady, busy, error }) {
  const [opening, setOpening] = useState('');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [hint, setHint] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  // 底部「复制链接」按钮自己的状态。它和点钱包图标触发的那次复制是两件事，
  // 共用一个 state 会让按钮在别处复制后也显示 Link copied。
  const [linkCopied, setLinkCopied] = useState(false);
  // WalletConnect 的「手动打开」链接。只在自动跳转不可靠时出现 ——
  // 用户点它是一个全新的用户手势，浏览器不会再拦。
  const [manualOpen, setManualOpen] = useState(null);
  const mobile = useMemo(() => isMobile(), []);
  const wallets = useMemo(() => walletList(), []);
  // 某条 WalletConnect 入口真机接不住时记下来，同一个会话里不再重试，
  // 直接退回该钱包的内置浏览器 —— 否则用户每点一次都要白等一轮。
  const wcBroken = useRef(new Set());

  useEffect(() => {
    if (!open) { setOpening(''); setCopied(false); setNotice(''); setHint(''); setPasteUrl(''); setLinkCopied(false); setManualOpen(null); return; }
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleApp = async (wallet) => {
    // 这个钱包能不能走 WalletConnect：配了 Project ID、有入口前缀、
    // 且这条入口不在本会话的失败名单里。
    const useWc = !!(wcReady && wallet.wcPrefix && wallet.connect !== 'okx' && !wcBroken.current.has(wallet.id));

    // iOS 上 Trust Wallet 已经没有内置浏览器，跳转只会把 App 拉到首页，
    // 用户回来时看到的是「什么都没发生」。与其演一次失败的跳转，不如直接说清。
    // 但它支持 WalletConnect，所以有 WC 通道时这条限制不适用。
    if (wallet.noBrowser && !useWc) {
      setOpening('');
      setCopied(false);
      setNotice(`${wallet.name} removed its in-app browser on iOS in June 2025. Open this page in another wallet, or copy the link below and paste it into a DApp browser.`);
      return;
    }

    setNotice('');
    setOpening(wallet.name);
    setCopied(false);
    setHint('');
    setPasteUrl('');
    setManualOpen(null);

    // WalletConnect：页面留在 Chrome，App 只负责确认。
    // 和 OKX 那条是同一种体验，区别只是中继不同。
    if (useWc && onWcConnect) {
      const prefix = wallet.wcPrefix;

      // ★ 必须在这一次点击的同步调用栈里完成跳转。
      //
      //   Chrome 只承认 5 秒内的用户手势发起的导航；而 WalletConnect 要先生成
      //   pairing URI（首次还要下 400KB），在 await 之后导航会被静默丢弃 ——
      //   表现就是「点了图标，卡在原地」。
      //
      //   URI 是钱包墙打开时 warmWc() 预生成的，这里只是同步读出来。
      const uri = getWcUri();
      if (uri) {
        const href = prefix + encodeURIComponent(uri);
        const at = Date.now();
        try { location.href = href; } catch (e) { /* 交给下面的兜底按钮 */ }

        // 跳过去后本页会进后台。1.5 秒还留在前台，说明系统没接住这条入口
        // （App 没装 / App Links 未注册），把链接亮出来让用户再点一次 ——
        // 那是一次全新的手势，一定会被放行。
        //
        // 两个条件缺一不可：页面离开过（计时器被后台挂起）时现在才执行，
        // 差值会远大于 2.5 秒 —— 那说明跳转是成功的，不能拿按钮误导用户。
        setTimeout(() => {
          if (document.visibilityState !== 'visible') return;
          if (Date.now() - at > 2500) return;
          setManualOpen({ href, name: wallet.name });
        }, 1500);
      }

      setHint(
        uri
          ? `Approve the request in ${wallet.name}. You will come back here to continue.`
          : 'Preparing a secure connection to your wallet…'
      );

      try {
        await onWcConnect(wallet, {
          launched: !!uri,
          // 预热还没完成就点了：URI 到位后已经不在手势里，只能给一个真链接
          onUri: (value) => {
            const href = prefix + encodeURIComponent(value);
            setManualOpen({ href, name: wallet.name });
            setHint(`Tap the button below to open ${wallet.name} and approve the request.`);
          }
        });
        // 成功后 useWallet 写入账户并关面板，这里不用再做什么
      } catch (e) {
        const code = e && e.code;
        const msg = String((e && (e.message || e.reason)) || '');
        // 4001 / reject 是用户自己取消，不报错、不退回内置浏览器
        const cancelled = code === 4001 || code === 'ACTION_REJECTED' || /reject|cancel|denied/i.test(msg);
        if (!cancelled) {
          // 这条入口真机没接住（scheme 不对 / App 没注册）：
          // 记下它，同一个会话里不再重试，直接改用内置浏览器打开。
          wcBroken.current.add(wallet.id);
          setManualOpen(null);
          setNotice(`${wallet.name} could not complete the WalletConnect request. Opening its in-app browser instead.`);
          setTimeout(() => { openInWallet(wallet); }, 900);
        }
      } finally {
        setOpening('');
      }
      return;
    }

    // OKX 走官方 Connect 协议，而不是把网址塞进它内置浏览器 ——
    // 后者已用真机证明不可能（见 wallets.js 的 OKX 注释）。
    // 这里的 await 会一直挂到用户在 App 里点完「连接」，页面在后台，
    // 回来时才 resolve。
    if (wallet.connect === 'okx' && onOkxConnect) {
      setHint('Approve the request in OKX Wallet. This page continues when you come back.');
      setPasteUrl(wallet.target);
      try {
        await onOkxConnect();
        // 成功后 useWallet 会写入账户并关闭面板，这里不用再做什么
      } catch (e) {
        const code = e && e.code;
        const msg = String((e && (e.message || e.reason)) || '');
        // 4001 / reject 都是用户主动取消，不该报错打扰他
        const cancelled = code === 4001 || code === 'ACTION_REJECTED' || /reject|cancel|denied/i.test(msg);
        if (!cancelled) {
          setNotice(`OKX Connect did not complete: ${msg || 'unknown error'}. You can still paste the link into OKX manually.`);
        }
        // 兜底：把链接放进剪贴板，并给出「探索 → 粘贴」的路径
        try {
          await navigator.clipboard.writeText(wallet.target);
          setCopied(true);
        } catch (err) { /* 剪贴板不可用时，下面的完整链接仍可手动复制 */ }
        if (wallet.pasteHint) setHint(wallet.pasteHint);
      } finally {
        setOpening('');
      }
      return;
    }

    // direct:false 的钱包只能拉起 App，不能自带 URL（Trust 属于这一类）。
    // 它需要用户粘贴一次，所以先把链接放进剪贴板。
    //
    // 不加 await：复制是异步的，但跳转不能等它 —— 用户点完要立刻有反应。
    // 复制必须在手势的同步调用栈里发起，浏览器才认为这是用户意图。
    if (!wallet.direct) {
      setPasteUrl(wallet.target);
      // 指引立刻显示，不等复制结果。clipboard 在部分 WebView 里会静默失败，
      // 若只在 then 里设 hint，用户就只剩一句 Opening…，不知道该干什么。
      if (wallet.pasteHint) setHint(wallet.pasteHint);
      try {
        navigator.clipboard.writeText(wallet.target)
          .then(() => setCopied(true))
          .catch(() => {});
      } catch (e) { /* 不支持剪贴板时，下面展示的完整链接仍可手动复制 */ }
    }

    openInWallet(wallet);
  };

  const hasExt = !!(injectedWallets && injectedWallets.length);
  const showWall = mobile;            // 手机：钱包墙，点了进 App 内置浏览器
  const showExt = !mobile && hasExt;  // 桌面有扩展：列出来，点一下直连
  const showQR = !mobile && !hasExt;  // 桌面什么都没有：扫码去手机

  const subtitle = mobile
    ? (wcReady
        ? 'Approve in your wallet app — this page stays open and you come straight back to it.'
        : 'The page opens inside your wallet, not here.')
    : hasExt
      ? 'Pick the wallet already in this browser.'
      : 'No wallet in this browser. Scan below and open it on your phone.';

  return (
    <div
      onClick={onClose}
      style={{ ...FONT, position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)',
               display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center',
               padding: mobile ? 0 : '20px', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', width: '100%', maxWidth: mobile ? '100%' : '420px',
          borderRadius: mobile ? '24px 24px 0 0' : '24px',
          padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 40px rgba(15,23,42,0.18)',
          maxHeight: mobile ? '88vh' : '84vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'ufoSheetIn .22s ease-out'
        }}
      >
        <style>{`@keyframes ufoSheetIn{from{transform:translateY(18px);opacity:.6}to{transform:none;opacity:1}}`}</style>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px' }}>Connect a wallet</div>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '5px', lineHeight: 1.5 }}>
              {subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', flexShrink: 0,
                     width: '30px', height: '30px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                     background: '#f1f5f9', color: '#64748b', fontSize: '16px', lineHeight: '30px', padding: 0 }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: '#fef2f2',
                        border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: '#fffbeb',
                        border: '1px solid #fde68a', color: '#92400e', fontSize: '12px', lineHeight: 1.6 }}>
            {notice}
          </div>
        )}

        {(opening || copied) && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px',
                        background: copied ? '#f0fdf4' : '#eff6ff',
                        border: `1px solid ${copied ? '#bbf7d0' : '#bfdbfe'}`,
                        color: copied ? '#15803d' : '#1d4ed8', fontSize: '12px', lineHeight: 1.55, fontWeight: '600' }}>
            {hint ? (
              <div>
                {opening && <div style={{ opacity: 0.75, marginBottom: '5px' }}>Opening {opening}…</div>}
                <div>{hint}</div>
                {pasteUrl && (
                  <div style={{ marginTop: '7px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px',
                                fontWeight: 500, color: '#166534', background: '#fff',
                                border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px 8px',
                                wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                    {pasteUrl}
                  </div>
                )}
              </div>
            ) : (copied
                  ? 'Link copied. Open your wallet’s DApp browser and paste it.'
                  : `Opening ${opening}…`)}
          </div>
        )}

        {/* WalletConnect 的手动入口。
            只有在自动跳转没能把页面切走时才出现 —— 那说明系统没接住这条
            入口（App 没装、或这个 build 没注册对应的 App Links）。
            用户点它是一次全新的用户手势，不会被浏览器丢弃。 */}
        {manualOpen && (
          <a
            href={manualOpen.href}
            style={{ ...FONT, display: 'block', marginTop: '10px', padding: '13px 14px',
                     background: '#1d4ed8', color: '#fff', borderRadius: '12px',
                     fontSize: '13.5px', fontWeight: '700', textAlign: 'center',
                     textDecoration: 'none', boxShadow: '0 2px 8px rgba(29,78,216,0.25)' }}
          >
            Open {manualOpen.name}
          </a>
        )}

        {/* 桌面端：已安装的扩展优先，点一下直接连 */}
        {showExt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '18px' }}>
            {injectedWallets.map(({ info, provider }) => (
              <button
                key={info.uuid}
                onClick={() => onPick(provider)}
                disabled={busy}
                style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', display: 'flex', alignItems: 'center',
                         gap: '12px', width: '100%', textAlign: 'left', padding: '12px 14px', minHeight: '56px',
                         background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px',
                         cursor: busy ? 'wait' : 'pointer', color: '#1e293b' }}
              >
                {info.icon
                  ? <img src={info.icon} alt="" width="32" height="32" style={{ width: 32, height: 32, borderRadius: '8px', display: 'block' }} />
                  : <span style={{ width: 32, height: 32, borderRadius: '8px', background: '#e2e8f0', display: 'inline-block' }} />}
                <span style={{ fontSize: '14px', fontWeight: '600', flex: 1 }}>{info.name}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>In this browser</span>
              </button>
            ))}
          </div>
        )}

        {/* 移动端：钱包墙 */}
        {showWall && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginTop: '18px' }}>
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => handleApp(w)}
                style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
                         display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
                         width: 'calc(33.333% - 6px)', maxWidth: '104px', padding: '12px 4px 10px',
                         background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: '16px',
                         cursor: 'pointer', color: 'inherit', opacity: w.noBrowser ? 0.55 : 1 }}
              >
                <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fff',
                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                               boxShadow: '0 1px 3px rgba(15,23,42,0.08)' }}>
                  <img src={w.icon} alt="" width="34" height="34" style={{ width: 34, height: 34, borderRadius: '9px', display: 'block' }} />
                </span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', lineHeight: 1.25, textAlign: 'center' }}>
                  {w.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 桌面且一个扩展都没有：二维码兜底 */}
        {showQR && (
          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <img src="/qr.png" alt="Scan to open on your phone" width="150" height="150"
                 style={{ display: 'block', margin: '0 auto 10px', borderRadius: '10px' }} />
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
              Scan with your phone camera, then tap Connect and pick a wallet.
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(autoconnectUrl());
              setLinkCopied(true);
            } catch (e) { /* 权限被拒时保持原样 */ }
          }}
          style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', width: '100%', marginTop: '16px',
                   padding: '12px', background: '#fff', border: '1px solid #dbeafe', color: '#1d4ed8',
                   borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
        >
          {linkCopied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
