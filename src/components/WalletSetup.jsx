import React, { useEffect, useState } from 'react';
import { skyBtn } from '../ui';

// ============================================================================
// 钱包面板：生成 / 导入 / 解锁 / 账户管理（查看私钥、删除账户、切换账户）
// ----------------------------------------------------------------------------
// 密钥形态：**裸私钥**，不是助记词。
//   · 生成后立刻给出完整私钥，允许复制 —— 用户必须能把它带走；
//   · 之后只有「Accounts → View private key」能看到，且每次都要重输 6 位 PIN；
//   · 删除账户只删本机密文，链上资产不动，但没保存私钥的人会永久失去这个地址。
//
// 账户管理是唯一的账户入口：切换、查看私钥、删除、新增、导入都在这里，
// 免得同一件事散落在三四个按钮上。
// ============================================================================

const FONT = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased'
};

// 全站按钮同一套语言（ui.js）。这里保留旧的三个名字，是因为调用点有二十多处，
// 逐个改容易漏；语义没变，只是外观统一到「天蓝渐变 + 白字」。
const primaryBtn = (disabled) => skyBtn('lg', { block: true, disabled });

// 次级动作：白底 + 天蓝字 + 天蓝描边。仍然是按钮，不是灰字透明底。
const ghostBtn = { ...skyBtn('md', { block: true, soft: true }), marginTop: 0 };

const secBtn = { ...skyBtn('md', { block: true, soft: true }) };

// 卡片内的小按钮
const cardBtn = (disabled) => skyBtn('sm', { disabled });

const label = {
  fontSize: '11px', fontWeight: 700, color: '#94a3b8',
  letterSpacing: '0.6px', textTransform: 'uppercase'
};

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

export default function WalletSetup({
  mode, onClose, onNavigate, accounts = [], activeId, hasWallet, unlocked,
  onCreate, onImport, onUnlock, onViewKey, onSwitch, onRemove, onBackedUp
}) {
  const open = !!mode;

  const [step, setStep] = useState('pin');    // pin | form | reveal | list | done | viewgate | confirm
  const [pin, setPin] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [secret, setSecret] = useState('');   // 展示中的私钥
  const [shownAddress, setShownAddress] = useState('');
  const [target, setTarget] = useState(null); // 正在查看 / 删除的账户 id
  const [copied, setCopied] = useState('');   // '' | 'ok' | 'fail'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // 正在切往哪个账户（按钮上转圈用），以及切换后的确认提示。
  // 切换是本地解密 + 写盘，几十毫秒就结束，但某些浏览器（旧 WebView、
  // 隐私模式下的 Safari）会明显慢一截，没有反馈用户会以为按钮没反应。
  const [switching, setSwitching] = useState(null);
  const [notice, setNotice] = useState('');

  // 这次操作是否需要先过 PIN：已解锁就不用
  const needGate = !unlocked;
  // 是不是在给这个 vault 设第一个 PIN（决定文案：设置 vs 输入）
  const settingPin = !hasWallet;

  // 面板是纯白的，账户卡是黑的。深色卡在浅色弹层里是「实体卡」的观感，
  // 也让「这张卡属于哪个账户」比一片彩色渐变更容易一眼分开。
  const hint = { fontSize: '12.5px', color: '#64748b', lineHeight: 1.65, marginTop: '8px' };
  const lbl = label;
  const primary = (disabled) => primaryBtn(disabled);
  const ghost = ghostBtn;

  useEffect(() => {
    if (!open) return;
    setPin(''); setKeyInput(''); setSecret(''); setShownAddress(''); setTarget(null);
    setCopied(''); setBusy(false); setErr(''); setSwitching(null); setNotice('');

    if (mode === 'create') {
      if (needGate) { setStep('pin'); return; }
      // 已解锁时点「生成账户」不该再问一次 PIN：直接生成，然后展示私钥。
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
    else if (mode === 'accounts') setStep(needGate && hasWallet ? 'pin' : 'list');
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
    if (!e) return 'Something went wrong.';
    if (e.code === 'BAD_PIN') return 'Wrong PIN. Try again.';
    return e.message || String(e);
  };

  // 编号来自账户记录本身（a.no），不是数组下标 —— 删掉账户 1 之后，
  // 账户 2 仍然是账户 2，不会因为下标变成 0 就改名叫账户 1。
  const noOf = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a && a.no ? a.no : null;
  };
  const addrOf = (id) => (accounts.find((a) => a.id === id) || {}).address || '';

  const doGenerate = async () => {
    if (busy) return;
    if (settingPin && pin.length !== 6) { setErr('Choose a 6-digit PIN.'); return; }
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
    if (needGate && !pinOk) { setErr('Enter your 6-digit PIN.'); return; }
    if (!keyInput.trim()) { setErr('Paste the private key you want to import.'); return; }
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
    if (!pinOk) { setErr('Enter your 6-digit PIN.'); return; }
    setBusy(true); setErr('');
    try {
      await onUnlock(pin);
      if (mode === 'accounts') setStep('list');
      else onClose();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doSwitch = async (id) => {
    // 只拦「同一张卡重复点」。之前用全局 busy 做闸门，只要别的动作
    // （解锁、生成、删账户）还没落定，Switch 就会被静默吞掉 ——
    // 用户看到的是「按钮点了没反应」，这正是切换失败最常见的成因。
    if (switching || id === activeId) return;
    setSwitching(id); setErr(''); setNotice('');
    try {
      const r = await onSwitch(id);
      const no = (r && r.id && noOf(r.id)) || noOf(id);
      setNotice(no ? `Now signing with Account ${no}.` : 'Account switched.');
    } catch (e) {
      setErr(errText(e));
      // 会话已经不在了（另一个标签页锁了钱包、或浏览器回收了进程）：
      // 与其在列表里显示一行读不懂的错误，不如直接回到 PIN 关卡重新解锁。
      if (e && e.code === 4100) setStep('pin');
    } finally {
      setSwitching(null);
    }
  };

  const doReveal = async () => {
    if (busy) return;
    if (pin.length < 6) { setErr('Enter your 6-digit PIN.'); return; }
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

  const title =
    step === 'confirm' ? 'Delete account'
      : mode === 'accounts' ? 'Accounts'
        : mode === 'import' ? 'Import private key'
          : mode === 'create' ? (accounts.length > 0 ? 'New account' : 'Create UFO wallet')
            : 'Unlock wallet';

  // 创建结果的 reveal 不允许点遮罩关闭：私钥只在这里出现一次
  const lockOverlay = step === 'reveal' && mode === 'create';

  return (
    <div
      onClick={lockOverlay ? undefined : onClose}
      style={{ ...FONT, position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2000, background: 'rgba(15,23,42,0.5)',
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
               backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          width: '100%', maxWidth: '420px',
          borderRadius: '24px', padding: '22px 20px',
          boxShadow: '0 20px 60px rgba(15,23,42,0.28)',
          maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          color: '#1e293b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.3, color: '#1e293b' }}>
            {title}
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

        {/* ---------------- PIN ---------------- */}
        {step === 'pin' && (
          <>
            <div style={hint}>
              {mode === 'create' && !settingPin
                ? 'Enter your wallet PIN. The new account is added to this same wallet.'
                : mode === 'create'
                  ? 'This wallet is created here, inside this page. Choose a 6-digit PIN — it encrypts the private key before it is stored on this device.'
                  : mode === 'accounts'
                    ? 'Enter your PIN to manage accounts.'
                    : 'Enter the 6-digit PIN you set when you created this wallet.'}
            </div>

            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, pinMax)); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (mode === 'create' ? doGenerate() : doGate()); }}
              placeholder="6-digit PIN"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '18px', padding: '14px 16px',
                       fontSize: '17px', letterSpacing: '7px', textAlign: 'center', borderRadius: '13px',
                       border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', outline: 'none' }}
            />

            {err && <ErrBox>{err}</ErrBox>}

            <button
              onClick={mode === 'create' ? doGenerate : doGate}
              disabled={busy || !pinOk}
              style={{ ...primary(busy || !pinOk), marginTop: '16px' }}
            >
              {busy ? 'Working…'
                : mode === 'create' ? (settingPin ? 'Generate wallet' : 'Add account') : 'Unlock'}
            </button>

            {mode === 'create' && (
              <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
                A brand-new private key is generated on this device. The address starts empty —
                send BEP-20 USDT to it before issuing UFO.
              </div>
            )}

            {mode === 'unlock' && (
              <button onClick={onClose} style={{ ...ghost, marginTop: '6px' }}>Cancel</button>
            )}
          </>
        )}

        {/* ---------------- 导入 ---------------- */}
        {step === 'form' && mode === 'import' && (
          <>
            <div style={hint}>
              Paste a 64-character private key (0x optional). It is encrypted with your PIN and
              stored on this device only.
            </div>

            <div style={{ ...lbl, marginTop: '16px', marginBottom: '6px' }}>Private key</div>
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
                <div style={{ ...lbl, marginTop: '14px', marginBottom: '6px' }}>
                  {settingPin ? 'Choose a 6-digit PIN' : 'Wallet PIN'}
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, pinMax)); setErr(''); }}
                  placeholder={settingPin ? '6-digit PIN' : 'Enter PIN'}
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
              style={{ ...primary(busy || !keyInput.trim() || (needGate && !pinOk)), marginTop: '16px' }}
            >
              {busy ? 'Importing…' : 'Import account'}
            </button>

            <button onClick={onClose} style={{ ...ghost, marginTop: '6px' }}>Cancel</button>
          </>
        )}

        {/* ---------------- 展示私钥 ---------------- */}
        {step === 'reveal' && (
          <>
            <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#b45309', background: '#fffbeb',
                          border: '1px solid #fde68a', borderRadius: '11px', padding: '11px 12px', lineHeight: 1.65 }}>
              <b>This private key is the wallet.</b> Anyone who has it can move the funds.
              Save it somewhere only you can reach.
            </div>

            {shownAddress && (
              <div style={{ marginTop: '12px' }}>
                <div style={lbl}>Address</div>
                <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                              background: '#f8fafc', border: '1px solid #e2e8f0',
                              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                              lineHeight: 1.6, wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                  {shownAddress}
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              <div style={{ ...lbl, marginBottom: '6px' }}>Private key</div>
              <div style={{ padding: '12px', borderRadius: '12px', background: '#0f172a',
                            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px',
                            lineHeight: 1.7, color: '#f8fafc', wordBreak: 'break-all',
                            userSelect: 'all', WebkitUserSelect: 'all', WebkitTouchCallout: 'default' }}>
                {secret}
              </div>
            </div>

            <button onClick={doCopy} style={{ ...primary(false), marginTop: '12px' }}>
              {copied === 'ok' ? 'Copied to clipboard' : copied === 'fail' ? 'Select the key and copy it manually' : 'Copy private key'}
            </button>

            <button
              onClick={() => {
                if (onBackedUp) onBackedUp();
                if (mode === 'accounts') { setStep('list'); return; }
                // 在账户面板里点「生成新账户」时 mode 会变成 create。生成完
                // 若只是 onClose，用户就被弹回钱包页，还得再点一次 Account。
                // 这里把面板切回 accounts，于是他看到的还是那张账户列表。
                if (mode === 'create' && accounts.length > 1 && onNavigate) {
                  onNavigate('accounts');
                  return;
                }
                onClose();
              }}
              style={{ ...secBtn, marginTop: '9px' }}
            >
              {mode === 'create'
                ? (accounts.length > 1 ? 'Back to accounts' : 'Done — open my wallet')
                : mode === 'accounts' ? 'Back to accounts' : 'Done'}
            </button>

            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
              You can see this key again from Accounts → View private key,
              but only by entering your PIN.
            </div>
          </>
        )}

        {/* ---------------- 导入完成 ---------------- */}
        {step === 'done' && (
          <>
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#047857', background: '#ecfdf5',
                          border: '1px solid #a7f3d0', borderRadius: '11px', padding: '11px 12px', lineHeight: 1.7 }}>
              Account imported and now active. Its key is encrypted on this device with your PIN.
            </div>
            <div style={{ marginTop: '12px' }}>
              <div style={lbl}>Address</div>
              <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                            lineHeight: 1.6, wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                {shownAddress}
              </div>
            </div>
            <button onClick={onClose} style={{ ...primary(false), marginTop: '16px' }}>Done</button>
          </>
        )}

        {/* ---------------- 查看私钥：先验证 PIN ---------------- */}
        {step === 'viewgate' && (
          <>
            <div style={hint}>
              Enter your 6-digit PIN to reveal the private key of Account {noOf(target) ?? '—'}.
              Make sure nobody is looking at your screen.
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
              placeholder="6-digit PIN"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '14px', padding: '14px 16px',
                       fontSize: '17px', letterSpacing: '7px', textAlign: 'center', borderRadius: '13px',
                       border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', outline: 'none' }}
            />

            {err && <ErrBox>{err}</ErrBox>}

            <button onClick={doReveal} disabled={busy || pin.length < 6}
              style={{ ...primary(busy || pin.length < 6), marginTop: '16px' }}>
              {busy ? 'Working…' : 'Reveal key'}
            </button>
            <button onClick={() => { setErr(''); setPin(''); setStep('list'); }}
              style={{ ...ghost, marginTop: '6px' }}>
              Back to accounts
            </button>
          </>
        )}

        {/* ---------------- 删除确认 ---------------- */}
        {step === 'confirm' && (
          <>
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#b91c1c', background: '#fef2f2',
                          border: '1px solid #fecaca', borderRadius: '11px', padding: '11px 12px', lineHeight: 1.7 }}>
              This removes the account from this browser. The funds stay on-chain, but if you have
              not saved the private key you will <b>never</b> be able to reach this address again.
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={lbl}>Account {noOf(target) ?? '—'}</div>
              <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                            lineHeight: 1.6, wordBreak: 'break-all' }}>
                {addrOf(target)}
              </div>
            </div>

            {err && <ErrBox>{err}</ErrBox>}

            <button onClick={doDelete} disabled={busy}
              style={{ ...primary(false), marginTop: '16px', background: '#dc2626', boxShadow: '0 4px 14px rgba(220,38,38,0.25)' }}>
              {busy ? 'Deleting…' : 'Delete account'}
            </button>
            <button onClick={() => { setTarget(null); setErr(''); setStep('list'); }}
              style={{ ...secBtn, marginTop: '9px' }}>
              Cancel
            </button>
          </>
        )}

        {/* ---------------- 账户管理 ---------------- */}
        {step === 'list' && mode === 'accounts' && (
          <>
            <div style={hint}>
              Switching changes which account signs swap transactions.
            </div>

            {notice && (
              <div style={{ marginTop: '12px', padding: '9px 11px', borderRadius: '10px',
                            background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857',
                            fontSize: '12px', fontWeight: 700, lineHeight: 1.5 }}>
                {notice}
              </div>
            )}

            {accounts.length === 0 ? (
              <div style={{ marginTop: '16px', padding: '22px 14px', textAlign: 'center',
                            border: '1px dashed #e2e8f0', borderRadius: '16px',
                            fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.7 }}>
                No account on this device yet.
              </div>
            ) : (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {accounts.map((a) => {
                  const isActive = a.id === activeId;
                  return (
                    <div key={a.id} style={{
                      background: '#0B0F19', borderRadius: '18px', padding: '14px 14px 12px',
                      boxShadow: isActive
                        ? '0 0 0 2px #38BDF8, 0 12px 26px -14px rgba(15,23,42,0.7)'
                        : '0 10px 22px -16px rgba(15,23,42,0.8)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff', letterSpacing: '0.2px' }}>
                          Account {a.no}
                        </span>
                        {isActive ? (
                          <span style={{
                            flexShrink: 0, fontSize: '10.5px', fontWeight: 800, color: '#fff',
                            background: 'linear-gradient(180deg, #5CCBEC 0%, #38BDF8 100%)',
                            borderRadius: '20px', padding: '5px 10px', lineHeight: 1
                          }}>
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => doSwitch(a.id)}
                            disabled={!!switching}
                            style={{ ...cardBtn(!!switching), minWidth: '74px' }}
                          >
                            {switching === a.id ? 'Switching…' : 'Switch'}
                          </button>
                        )}
                      </div>

                      <div style={{
                        marginTop: '9px', fontFamily: 'ui-monospace, Menlo, monospace',
                        fontSize: '11px', lineHeight: 1.65, color: 'rgba(255,255,255,0.64)',
                        wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all'
                      }}>
                        {a.address}
                      </div>

                      <div style={{ display: 'flex', gap: '7px', marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => { setTarget(a.id); setErr(''); setPin(''); setSecret(''); setCopied(''); setStep('viewgate'); }}
                          style={{ ...cardBtn(false), flex: 1 }}
                        >
                          View private key
                        </button>
                        <button
                          type="button"
                          onClick={() => { setTarget(a.id); setErr(''); setStep('confirm'); }}
                          style={{ ...cardBtn(false), flex: 1 }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {err && <ErrBox>{err}</ErrBox>}

            <button onClick={() => onNavigate && onNavigate('create')} style={{ ...secBtn, marginTop: '14px' }}>
              Generate new account
            </button>
            <button onClick={() => onNavigate && onNavigate('import')} style={{ ...secBtn, marginTop: '8px' }}>
              Import private key
            </button>
            <button onClick={onClose} style={{ ...ghost, marginTop: '6px' }}>Close</button>
          </>
        )}
      </div>
    </div>
  );
}

function ErrBox({ children }) {
  return (
    <div style={{ marginTop: '10px', padding: '9px 11px', borderRadius: '9px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  color: '#b91c1c', fontSize: '12px', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}
