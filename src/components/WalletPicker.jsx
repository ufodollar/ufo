import React, { useState, useEffect, useMemo } from 'react';
import { walletList, openInWallet, isMobile, autoconnectUrl } from '../wallets';

const FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif' };

/**
 * 钱包选择面板。
 *
 * 移动端：7 个钱包图标墙，点了直接跳进该 App 的内置浏览器，
 *        落地时页面里已有注入，自动就是已连接状态 —— 没有二维码、没有配对。
 * 桌面端：优先列出 EIP-6963 发现到的扩展（一列，图标+名字），
 *        一个扩展都没有时才给二维码，让用户用手机接着走上面的流程。
 */
export default function WalletPicker({ open, onClose, injectedWallets, onPick, busy, error }) {
  const [opening, setOpening] = useState('');
  const [copied, setCopied] = useState(false);
  const mobile = useMemo(() => isMobile(), []);
  const wallets = useMemo(() => walletList(), []);

  useEffect(() => {
    if (!open) { setOpening(''); setCopied(false); return; }
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleApp = (wallet) => {
    setOpening(wallet.name);
    setCopied(false);

    // 目前名单里已经全是 direct:true（能直接加载本站），这个分支暂时走不到。
    // 保留它是因为将来若加入只能拉起 App 的钱包，这里就是唯一需要改的地方：
    // 先把链接放进剪贴板，用户进去后直接粘贴。
    //
    // 不加 await：复制是异步的，但跳转不能等它 —— 用户点完要立刻有反应。
    // 复制必须在手势的同步调用栈里发起，浏览器才认为这是用户意图。
    if (!wallet.direct) {
      try {
        navigator.clipboard.writeText(wallet.target)
          .then(() => setCopied(true))
          .catch(() => {});
      } catch (e) { /* 浏览器不支持剪贴板，下面的兜底文案仍然可用 */ }
    }

    openInWallet(wallet);
  };

  const hasExt = !!(injectedWallets && injectedWallets.length);
  const showWall = mobile;            // 手机：钱包墙，点了进 App 内置浏览器
  const showExt = !mobile && hasExt;  // 桌面有扩展：列出来，点一下直连
  const showQR = !mobile && !hasExt;  // 桌面什么都没有：扫码去手机

  const subtitle = mobile
    ? 'The page opens inside your wallet, not here.'
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

        {(opening || copied) && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px',
                        background: copied ? '#f0fdf4' : '#eff6ff',
                        border: `1px solid ${copied ? '#bbf7d0' : '#bfdbfe'}`,
                        color: copied ? '#15803d' : '#1d4ed8', fontSize: '12px', lineHeight: 1.55, fontWeight: '600' }}>
            {copied
              ? (opening
                  ? `Link copied. In ${opening}, open its DApp browser and paste it.`
                  : 'Link copied. Open your wallet’s DApp browser and paste it.')
              : `Opening ${opening}… If nothing happens, it isn’t installed.`}
          </div>
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
                         cursor: 'pointer', color: 'inherit' }}
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
              setOpening('');
              setCopied(true);
            } catch (e) { /* 权限被拒时保持原样 */ }
          }}
          style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', width: '100%', marginTop: '16px',
                   padding: '12px', background: '#fff', border: '1px solid #dbeafe', color: '#1d4ed8',
                   borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
