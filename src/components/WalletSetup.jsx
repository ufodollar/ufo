import React, { useEffect, useRef, useState } from 'react';
import { skyBtn, skyLink } from '../ui';

// ============================================================================
// 钱包面板：选择钱包 / 添加钱包 / 生成 / 导入 / 查看私钥
// ----------------------------------------------------------------------------
// 密钥形态：**裸私钥**，不是助记词。
//   · 生成后立刻给出完整私钥，允许复制 —— 用户必须能把它带走；
//   · 之后只有「去备份」能看到，且每次都要重输 6 位 PIN；
//   · 删除账户只删本机密文，链上资产不动，但没保存私钥的人会永久失去这个地址。
//
// 两个入口，对应两种动作：
//   选择钱包 —— 列出现在这台设备上的所有钱包，**点一下就是切过去**，
//               不需要再点一次确认。右侧的「去备份」是查看私钥的入口。
//   添加钱包 —— 只有两条路：创建、导入。没有硬件钱包、观察钱包、社交登录，
//               这台设备只管理私钥，别的入口都指向不存在的东西。
// ============================================================================

const FONT = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased'
};

const primaryBtn = (disabled) => skyBtn('lg', { block: true, disabled });
const ghostBtn = { ...skyBtn('md', { block: true, soft: true }), marginTop: 0 };
const secBtn = { ...skyBtn('md', { block: true, soft: true }) };

const label = {
  fontSize: '11px', fontWeight: 700, color: '#94a3b8',
  letterSpacing: '0.6px', textTransform: 'uppercase'
};

const hint = { fontSize: '12.5px', color: '#64748b', lineHeight: 1.65, marginTop: '8px' };

// 每个钱包一张头像。不是随机图：编号决定色相，用户靠「颜色 + 名字」认钱包，
// 比只记编号快得多，也避免同一屏里排一片一模一样的灰圈。
const AVATAR_HUES = [200, 340, 265, 152, 28, 320];

/** 老 WebView 里 navigator.clipboard 常常不存在，必须留 execCommand 兜底 */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* 落到兜底 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-200px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

/** 0x0d10e…C72031 —— 首尾各 6 位，中间省略，手机上也不会被挤成两行 */
function shortAddr(a) {
  if (!a) return '—';
  return a.slice(0, 7) + '…' + a.slice(-6);
}

function usdText(v) {
  if (v == null) return '$ —';
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WalletSetup({
  mode, onClose, onNavigate, accounts = [], activeId, hasWallet, unlocked,
  totalUsd = 0, acctUsd = {},
  onCreate, onImport, onUnlock, onViewKey, onSwitch, onRemove, onBackedUp
}) {
  const open = !!mode;

  const [step, setStep] = useState('pin');    // pin | form | reveal | list | menu | done | viewgate | confirm
  const [pin, setPin] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [secret, setSecret] = useState('');   // 展示中的私钥
  const [shownAddress, setShownAddress] = useState('');
  const [target, setTarget] = useState(null); // 正在查看 / 删除的账户 id
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [copied, setCopied] = useState('');   // '' | 'ok' | 'fail'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [switching, setSwitching] = useState(null);

  // 拖拽关闭（和代币弹窗同一套手势）
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  // 创建结果的 reveal 不允许点遮罩 / 下滑关闭：私钥只在这里出现一次。
  // 这个 ref 必须在下面的早退之前声明 —— hook 不能放在 if (open) 之后。
  const lockOverlay = step === 'reveal' && mode === 'create';
  const lockOverlayRef = useRef(lockOverlay);
  lockOverlayRef.current = lockOverlay;

  // 这次操作是否需要先过 PIN：已解锁就不用
  const needGate = !unlocked;
  // 是不是在给这个 vault 设第一个 PIN（决定文案：设置 vs 输入）
  const settingPin = !hasWallet;

  useEffect(() => {
    if (!open) return;
    setPin(''); setKeyInput(''); setSecret(''); setShownAddress(''); setTarget(null);
    setCopied(''); setBusy(false); setErr(''); setSwitching(null); setPendingSwitch(null);
    setDragY(0); setDragging(false); dragRef.current = null;

    if (mode === 'create') {
      if (needGate) { setStep('pin'); return; }
      // 已解锁时点「创建钱包」不该再问一次 PIN：直接生成，然后展示私钥。
      // 生成必须放在这个 effect 里、且只依赖 [open, mode] —— 如果把
      // needGate 放进依赖，创建成功后它从 true 变 false 会再触发一次，
      // 一按生成就多出一个空账户。
      setStep('reveal');
      setBusy(true);
      (async () => {
        try {
          const r = await onCreate(undefined);
          setSecret(r.privateKey);
          setShownAddress(r.address);
        } catch (e) {
          setErr(errText(e));
          setStep('pin');
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    if (mode === 'import') setStep('form');
    else if (mode === 'accounts') setStep('list');   // 锁着也先给列表：地址不是秘密
    else if (mode === 'add') setStep('menu');
    else setStep('pin'); // unlock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  if (!open) return null;

  // 新 PIN 必须正好 6 位；解锁路径允许 6–8 位，避免把旧版本设了 7–8 位的人锁在门外
  const pinOk = (settingPin || mode === 'create' || mode === 'import')
    ? pin.length === 6
    : pin.length >= 6;
  const pinMax = settingPin ? 6 : 8;

  const errText = (e) => {
    if (!e) return '出了点问题，请重试。';
    if (e.code === 'BAD_PIN') return 'PIN 不对，再试一次。';
    if (e.code === '4100') return '请输入 PIN 解锁钱包。';
    return e.message || String(e);
  };

  // 编号来自账户记录本身（a.no），不是数组下标 —— 删掉账户 1 之后，
  // 账户 2 仍然是账户 2，不会因为下标变成 0 就改名叫账户 1。
  const noOf = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a && a.no ? a.no : null;
  };
  const addrOf = (id) => (accounts.find((a) => a.id === id) || {}).address || '';
  const nameOf = (id) => {
    const n = noOf(id);
    return n ? `我的钱包 ${n}` : '我的钱包';
  };

  const doGenerate = async () => {
    if (busy) return;
    if (settingPin && pin.length !== 6) { setErr('请设置 6 位 PIN。'); return; }
    setBusy(true); setErr('');
    try {
      const r = await onCreate(pin);
      setSecret(r.privateKey);
      setShownAddress(r.address);
      setStep('reveal');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (busy) return;
    if (needGate && !pinOk) { setErr('请输入 6 位 PIN。'); return; }
    if (!keyInput.trim()) { setErr('请先粘贴要导入的私钥。'); return; }
    setBusy(true); setErr('');
    try {
      const r = await onImport(keyInput.trim(), needGate ? pin : undefined);
      setShownAddress(r.address);
      setStep('done');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doGate = async () => {
    if (busy) return;
    if (!pinOk) { setErr('请输入 6 位 PIN。'); return; }
    setBusy(true); setErr('');
    try {
      await onUnlock(pin);
      if (pendingSwitch) {
        // 锁着的时候点了另一个钱包：先解锁，再切过去 —— 一步完成，
        // 不用让用户「解锁完再点一次」。
        const id = pendingSwitch;
        setPendingSwitch(null);
        setPin('');
        setSwitching(id);
        try { await onSwitch(id); } catch (e2) { setErr(errText(e2)); }
        setSwitching(null);
        setStep('list');
      } else if (mode === 'accounts') {
        setStep('list');
      } else {
        onClose();
      }
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doSwitch = async (id) => {
    // 只拦「同一张卡重复点」。之前用全局 busy 做闸门，只要别的动作
    // （解锁、生成、删账户）还没落定，切换就会被静默吞掉 ——
    // 用户看到的是「按钮点了没反应」，这正是切换失败最常见的成因。
    if (switching || id === activeId) return;
    if (needGate) {
      setPendingSwitch(id);
      setPin('');
      setErr('');
      setStep('pin');
      return;
    }
    setSwitching(id); setErr('');
    try {
      await onSwitch(id);
    } catch (e) {
      setErr(errText(e));
      if (e && e.code === 4100) { setPendingSwitch(id); setStep('pin'); }
    } finally {
      setSwitching(null);
    }
  };

  const doReveal = async () => {
    if (busy) return;
    if (pin.length < 6) { setErr('请输入 6 位 PIN。'); return; }
    setBusy(true); setErr('');
    try {
      const k = await onViewKey(pin, target);
      setSecret(k);
      setShownAddress(addrOf(target));
      setStep('reveal');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = onRemove(target);
      setTarget(null);
      if (!r || !r.remaining) { onClose(); return; }
      setStep('list');
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doCopy = async () => {
    const ok = await copyText(secret);
    setCopied(ok ? 'ok' : 'fail');
    if (ok && onBackedUp) onBackedUp();
    setTimeout(() => setCopied(''), 2200);
  };

  // ---- 拖拽关闭 ----
  const dragStart = (e) => {
    dragRef.current = { y: e.clientY, dy: 0 };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器 */ }
  };
  const dragMove = (e) => {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.dy = dy;
    setDragY(Math.max(0, dy));
  };
  const dragEnd = () => {
    if (!dragRef.current) return;
    const dy = dragRef.current.dy;
    dragRef.current = null;
    setDragging(false);
    setDragY(0);
    if (dy > 90 && !lockOverlayRef.current) onClose();
  };
  // 从「选择钱包」进来的创建，生成完要回到列表；从空钱包页进来的才是「进入钱包」。
  // 文案与点击行为必须用同一个判断，否则按钮写着「完成，进入钱包」却把人送回了列表。
  const backToSheet = mode === 'accounts' || (mode === 'create' && accounts.length > 1);

  const title =
    step === 'confirm' ? '删除钱包'
      : mode === 'accounts' ? '选择钱包'
        : mode === 'add' ? '添加钱包'
          : mode === 'import' ? '导入钱包'
            : mode === 'create' ? '创建钱包'
              : '输入 PIN';

  // 选择钱包 / 添加钱包 / 解锁 都是底部弹层；创建与导入是带返回的独立页
  const sheetMode = mode === 'accounts' || mode === 'add' || mode === 'unlock';
  const isAddPage = mode === 'add';

  return (
    <div
      onClick={lockOverlay ? undefined : onClose}
      style={{
        ...FONT,
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: sheetMode ? 'flex-end' : 'center', justifyContent: 'center',
        padding: sheetMode ? 0 : '16px',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        animation: 'ufoFade 160ms ease-out'
      }}
    >
      <style>{`
        @keyframes ufoFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ufoSheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .ufo-sheet-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .ufo-sheet-scroll::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: sheetMode ? '480px' : '420px',
          borderRadius: sheetMode ? '26px 26px 0 0' : '24px',
          padding: sheetMode ? '0 18px calc(16px + env(safe-area-inset-bottom, 0px))' : '22px 20px',
          boxShadow: sheetMode ? '0 -18px 50px rgba(15,23,42,0.22)' : '0 20px 60px rgba(15,23,42,0.28)',
          maxHeight: sheetMode ? '92vh' : '88vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transform: sheetMode ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(.22,.9,.3,1)',
          animation: sheetMode ? 'ufoSheetUp 240ms cubic-bezier(.22,.9,.3,1)' : undefined,
          color: '#1e293b'
        }}
      >
        {sheetMode && (
          <div
            onPointerDown={dragStart}
            onPointerMove={dragMove}
            onPointerUp={dragEnd}
            onPointerCancel={dragEnd}
            style={{ padding: '14px 0 6px', display: 'flex', justifyContent: 'center',
                     cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
          >
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#d5dbe3' }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      paddingTop: sheetMode ? '6px' : 0, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {mode === 'add' && (
              <button
                onClick={() => onNavigate && onNavigate('accounts')}
                aria-label="Back"
                style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', flexShrink: 0,
                         width: '30px', height: '30px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                         background: '#f1f5f9', color: '#334155', padding: 0,
                         display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#334155"
                     strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 5 8 12l7 7" />
                </svg>
              </button>
            )}
            <div style={{ fontSize: isAddPage ? '26px' : '21px', fontWeight: 800, letterSpacing: '-0.6px',
                          lineHeight: 1.25, color: '#0f172a' }}>
              {title}
            </div>
          </div>
          {!lockOverlay && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', flexShrink: 0,
                       width: '30px', height: '30px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                       background: '#f1f5f9', color: '#64748b', fontSize: '16px', padding: 0 }}
            >
              ×
            </button>
          )}
        </div>

        <div className="ufo-sheet-scroll" style={{ overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {/* ---------------- PIN ---------------- */}
          {step === 'pin' && (
            <>
              <div style={hint}>
                {pendingSwitch
                  ? `输入 6 位 PIN，切换到${nameOf(pendingSwitch)}。`
                  : mode === 'create' && !settingPin
                    ? '输入钱包 PIN，新钱包会加进同一个保险箱。'
                    : mode === 'create'
                      ? '钱包就在这个页面里生成。设置 6 位 PIN —— 私钥会先用它加密，再存到这台设备上。'
                      : mode === 'accounts'
                        ? '输入 6 位 PIN 解锁钱包。'
                        : '输入创建钱包时设置的 6 位 PIN。'}
              </div>

              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, pinMax)); setErr(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (mode === 'create' ? doGenerate() : doGate()); }}
                placeholder="6 位 PIN"
                style={{ width: '100%', boxSizing: 'border-box', marginTop: '18px', padding: '14px 16px',
                         fontSize: '17px', letterSpacing: '7px', textAlign: 'center', borderRadius: '13px',
                         border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', outline: 'none' }}
              />

              {err && <ErrBox>{err}</ErrBox>}

              <button
                onClick={mode === 'create' ? doGenerate : doGate}
                disabled={busy || !pinOk}
                style={{ ...primaryBtn(busy || !pinOk), marginTop: '16px' }}
              >
                {busy ? '处理中…'
                  : mode === 'create' ? (settingPin ? '生成钱包' : '添加钱包') : '解锁'}
              </button>

              {mode === 'create' && (
                <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
                  私钥在这台设备上生成，地址一开始是空的 —— 先往这个地址转 BEP-20 USDT，才能发行 UFO。
                </div>
              )}

              {mode === 'unlock' && (
                <button onClick={onClose} style={{ ...ghostBtn, marginTop: '6px' }}>取消</button>
              )}
            </>
          )}

          {/* ---------------- 导入 ---------------- */}
          {step === 'form' && mode === 'import' && (
            <>
              <div style={hint}>
                粘贴 64 位私钥（0x 可省略）。它只在这台设备上用你的 PIN 加密保存，不会上传。
              </div>

              <div style={{ ...label, marginTop: '16px', marginBottom: '6px' }}>私钥</div>
              <textarea
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setErr(''); }}
                placeholder="0x…"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                style={{ width: '100%', boxSizing: 'border-box', minHeight: '84px', padding: '12px',
                         fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', lineHeight: 1.6,
                         borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc',
                         color: '#0f172a', outline: 'none', resize: 'none', wordBreak: 'break-all' }}
              />

              {needGate && (
                <>
                  <div style={{ ...label, marginTop: '14px', marginBottom: '6px' }}>
                    {settingPin ? '设置 6 位 PIN' : '钱包 PIN'}
                  </div>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, pinMax)); setErr(''); }}
                    placeholder={settingPin ? '6 位 PIN' : '输入 PIN'}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px',
                             fontSize: '17px', letterSpacing: '7px', textAlign: 'center', borderRadius: '13px',
                             border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', outline: 'none' }}
                  />
                </>
              )}

              {err && <ErrBox>{err}</ErrBox>}

              <button
                onClick={doImport}
                disabled={busy || !keyInput.trim() || (needGate && !pinOk)}
                style={{ ...primaryBtn(busy || !keyInput.trim() || (needGate && !pinOk)), marginTop: '16px' }}
              >
                {busy ? '导入中…' : '导入钱包'}
              </button>

              <button onClick={onClose} style={{ ...ghostBtn, marginTop: '6px' }}>取消</button>
            </>
          )}

          {/* ---------------- 展示私钥 ---------------- */}
          {step === 'reveal' && (
            <>
              <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#b45309', background: '#fffbeb',
                            border: '1px solid #fde68a', borderRadius: '11px', padding: '11px 12px', lineHeight: 1.65 }}>
                <b>私钥就是钱包。</b>拿到它的人可以把里面的资产全部转走，请只保存在自己能拿到的地方。
              </div>

              {shownAddress && (
                <div style={{ marginTop: '12px' }}>
                  <div style={label}>地址</div>
                  <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                                background: '#f8fafc', border: '1px solid #e2e8f0',
                                fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                                lineHeight: 1.6, wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                    {shownAddress}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '14px' }}>
                <div style={{ ...label, marginBottom: '6px' }}>私钥</div>
                <div style={{ padding: '12px', borderRadius: '12px', background: '#0f172a',
                              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px',
                              lineHeight: 1.7, color: '#f8fafc', wordBreak: 'break-all',
                              userSelect: 'all', WebkitUserSelect: 'all', WebkitTouchCallout: 'default' }}>
                  {secret}
                </div>
              </div>

              <button onClick={doCopy} style={{ ...primaryBtn(false), marginTop: '12px' }}>
                {copied === 'ok' ? '已复制到剪贴板' : copied === 'fail' ? '请手动选中私钥复制' : '复制私钥'}
              </button>

              <button
                onClick={() => {
                  if (onBackedUp) onBackedUp();
                  if (mode === 'accounts') { setStep('list'); return; }
                  // 在选择钱包里点「创建钱包」时 mode 会变成 create。生成完
                  // 若只是 onClose，用户就被弹回钱包页，还得再点一次。
                  // 这里把面板切回 accounts，于是他看到的还是那张钱包列表。
                  if (backToSheet && onNavigate) {
                    onNavigate('accounts');
                    return;
                  }
                  onClose();
                }}
                style={{ ...secBtn, marginTop: '9px' }}
              >
                {backToSheet ? '返回选择钱包' : '完成，进入钱包'}
              </button>

              {/* 删除放在这里：已经输过 PIN、也看过私钥，是唯一「确认过本人」的时刻 */}
              {mode === 'accounts' && (
                <button
                  onClick={() => { setErr(''); setStep('confirm'); }}
                  style={{ ...skyLink('sm'), display: 'block', width: '100%', marginTop: '14px',
                           color: '#ef4444', textAlign: 'center' }}
                >
                  删除这个钱包
                </button>
              )}

              <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
                之后可以在「选择钱包 → 去备份」里再看一次，但每次都要输 PIN。
              </div>
            </>
          )}

          {/* ---------------- 导入完成 ---------------- */}
          {step === 'done' && (
            <>
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#047857', background: '#ecfdf5',
                            border: '1px solid #a7f3d0', borderRadius: '11px', padding: '11px 12px', lineHeight: 1.7 }}>
                钱包已导入并设为当前使用。私钥用你的 PIN 加密保存在这台设备上。
              </div>
              <div style={{ marginTop: '12px' }}>
                <div style={label}>地址</div>
                <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                              background: '#f8fafc', border: '1px solid #e2e8f0',
                              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                              lineHeight: 1.6, wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                  {shownAddress}
                </div>
              </div>
              <button onClick={onClose} style={{ ...primaryBtn(false), marginTop: '16px' }}>完成</button>
            </>
          )}

          {/* ---------------- 查看私钥：先验证 PIN ---------------- */}
          {step === 'viewgate' && (
            <>
              <div style={hint}>
                输入 6 位 PIN，查看{nameOf(target)}的私钥。确认周围没人看着屏幕。
              </div>

              <div style={{ marginTop: '12px', padding: '10px 11px', borderRadius: '10px',
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px',
                            lineHeight: 1.6, wordBreak: 'break-all', color: '#475569' }}>
                {addrOf(target)}
              </div>

              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setErr(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') doReveal(); }}
                placeholder="6 位 PIN"
                style={{ width: '100%', boxSizing: 'border-box', marginTop: '14px', padding: '14px 16px',
                         fontSize: '17px', letterSpacing: '7px', textAlign: 'center', borderRadius: '13px',
                         border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', outline: 'none' }}
              />

              {err && <ErrBox>{err}</ErrBox>}

              <button onClick={doReveal} disabled={busy || pin.length < 6}
                style={{ ...primaryBtn(busy || pin.length < 6), marginTop: '16px' }}>
                {busy ? '处理中…' : '查看私钥'}
              </button>
              <button onClick={() => { setErr(''); setPin(''); setStep('list'); }}
                style={{ ...ghostBtn, marginTop: '6px' }}>
                返回
              </button>
            </>
          )}

          {/* ---------------- 删除确认 ---------------- */}
          {step === 'confirm' && (
            <>
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#b91c1c', background: '#fef2f2',
                            border: '1px solid #fecaca', borderRadius: '11px', padding: '11px 12px', lineHeight: 1.7 }}>
                这会把钱包从这台设备上删掉。资产还在链上，但如果你没保存私钥，就<b>再也无法</b>找回这个地址。
              </div>

              <div style={{ marginTop: '12px' }}>
                <div style={label}>{nameOf(target)}</div>
                <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                              background: '#f8fafc', border: '1px solid #e2e8f0',
                              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                              lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {addrOf(target)}
                </div>
              </div>

              {err && <ErrBox>{err}</ErrBox>}

              <button onClick={doDelete} disabled={busy}
                style={{ ...primaryBtn(false), marginTop: '16px', background: '#dc2626', boxShadow: '0 4px 14px rgba(220,38,38,0.25)' }}>
                {busy ? '删除中…' : '确认删除'}
              </button>
              <button onClick={() => { setTarget(null); setErr(''); setStep('list'); }}
                style={{ ...secBtn, marginTop: '9px' }}>
                取消
              </button>
            </>
          )}

          {/* ---------------- 添加钱包 ---------------- */}
          {step === 'menu' && mode === 'add' && (
            <>
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <AddRow
                  icon={<PlusIcon />}
                  title="创建钱包"
                  desc="生成一个新的私钥钱包"
                  onClick={() => onNavigate && onNavigate('create')}
                />
                <AddRow
                  icon={<ImportIcon />}
                  title="导入钱包"
                  desc="用私钥导入已有的钱包"
                  onClick={() => onNavigate && onNavigate('import')}
                />
              </div>

              <div style={{ marginTop: '18px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.7, textAlign: 'center' }}>
                这台设备只管理私钥钱包，不支持硬件钱包与观察钱包。
              </div>
            </>
          )}

          {/* ---------------- 选择钱包 ---------------- */}
          {step === 'list' && mode === 'accounts' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginTop: '12px', padding: '0 2px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>资产总额</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                  {usdText(totalUsd)}
                </span>
              </div>

              {accounts.length === 0 ? (
                <div style={{ marginTop: '14px', padding: '22px 14px', textAlign: 'center',
                              border: '1px dashed #e2e8f0', borderRadius: '16px',
                              fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.7 }}>
                  这台设备上还没有钱包。
                </div>
              ) : (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {accounts.map((a) => {
                    const isActive = a.id === activeId;
                    const hue = AVATAR_HUES[(a.no - 1) % AVATAR_HUES.length];
                    const usd = isActive ? totalUsd : acctUsd[a.id];
                    return (
                      <div
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => doSwitch(a.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doSwitch(a.id); } }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 14px', borderRadius: '18px', cursor: 'pointer',
                          background: isActive ? '#eaf8fe' : '#f7f9fb',
                          border: isActive ? '1.5px solid #7dd3fc' : '1.5px solid transparent',
                          transition: 'background 120ms ease'
                        }}
                      >
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(160deg, hsl(${hue} 85% 68%), hsl(${hue} 75% 52%))`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
                               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />
                            <path d="M3 9.5h13.5" /><circle cx="16.6" cy="14" r="1.4" fill="#fff" stroke="none" />
                          </svg>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px',
                                           whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {a.no ? `我的钱包 ${a.no}` : '我的钱包'}
                            </span>
                            {switching === a.id && (
                              <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>切换中…</span>
                            )}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginTop: '2px',
                                        fontVariantNumeric: 'tabular-nums' }}>
                            {usdText(usd)}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px',
                                        fontFamily: 'ui-monospace, Menlo, monospace' }}>
                            BNB Chain: {shortAddr(a.address)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTarget(a.id); setErr(''); setPin(''); setSecret(''); setCopied('');
                            setStep('viewgate');
                          }}
                          style={{
                            appearance: 'none', WebkitAppearance: 'none', font: 'inherit', flexShrink: 0,
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '7px 11px', borderRadius: '20px', cursor: 'pointer',
                            background: '#fff', border: '1px solid #e6ebf1',
                            fontSize: '11.5px', fontWeight: 700, color: '#334155'
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b"
                               strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="4" y="10.5" width="16" height="10" rx="2.2" />
                            <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
                          </svg>
                          去备份
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {err && <ErrBox>{err}</ErrBox>}

              <button
                onClick={() => onNavigate && onNavigate('add')}
                style={{ ...primaryBtn(false), marginTop: '16px' }}
              >
                添加钱包
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 添加钱包页的一行：图标 + 标题 + 说明 + 右箭头 */
function AddRow({ icon, title, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none', WebkitAppearance: 'none', font: 'inherit', width: '100%',
        display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left',
        padding: '16px 14px', borderRadius: '18px', border: 'none',
        background: '#f7f9fb', cursor: 'pointer'
      }}
    >
      <span style={{
        width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 3px rgba(15,23,42,0.08)'
      }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{desc}</span>
      </span>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#c0c8d2"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M1.5 1.5 6.5 7l-5 5.5" />
      </svg>
    </button>
  );
}

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a"
       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);

const ImportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a"
       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v11" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" />
  </svg>
);

function ErrBox({ children }) {
  return (
    <div style={{ marginTop: '10px', padding: '9px 11px', borderRadius: '9px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  color: '#b91c1c', fontSize: '12px', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}
