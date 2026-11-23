import React, { useEffect, useState } from 'react';

// ============================================================================
// 钱包面板：生成 / 导入 / 解锁 / 查看私钥 / 切换账户
// ----------------------------------------------------------------------------
// 五种模式共用一套壳，因为它们的形状高度相似：先过 PIN，再做一件事。
//
// 密钥形态：**裸私钥**，不是助记词。
//   · 生成后立刻给出完整私钥，允许复制 —— 用户必须能把它带走；
//   · 关掉之后想再看，必须重新输 6 位 PIN（钱包已解锁也不例外）；
//   · 查看私钥是唯一能拿到明文的入口，所以它永远需要一次显式验证。
// ============================================================================

const FONT = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased'
};

const primaryBtn = (disabled) => ({
  appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
  width: '100%', padding: '15px 16px', border: 'none', borderRadius: '14px',
  background: disabled ? '#93b4f5' : '#1d4ed8', color: '#fff',
  fontSize: '15px', fontWeight: 700, lineHeight: 1.2,
  cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : '0 4px 14px rgba(29,78,216,0.28)'
});

const ghostBtn = {
  appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
  width: '100%', padding: '12px', border: 'none', background: 'transparent',
  color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
};

const secBtn = {
  appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
  width: '100%', padding: '13px 16px', border: '1px solid #cbd5e1', borderRadius: '13px',
  background: '#fff', color: '#334155', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
};

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

const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');

export default function WalletSetup({
  mode, onClose, address, accounts = [], activeId, hasWallet, unlocked,
  onCreate, onImport, onUnlock, onViewKey, onSwitch, onBackedUp, onNavigate
}) {
  const open = !!mode;

  const [step, setStep] = useState('pin');       // 'pin' | 'form' | 'reveal' | 'list' | 'done'
  const [pin, setPin] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [secret, setSecret] = useState('');      // 展示中的私钥
  const [shownAddress, setShownAddress] = useState('');
  const [copied, setCopied] = useState('');      // '' | 'ok' | 'fail'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 这次操作是否需要先过 PIN：已解锁就不用
  const needGate = !unlocked;
  // 是不是在给这个 vault 设第一个 PIN（决定文案：设置 vs 输入）
  const settingPin = !hasWallet;

  useEffect(() => {
    if (!open) return;
    setPin(''); setKeyInput(''); setSecret(''); setShownAddress('');
    setCopied(''); setBusy(false); setErr('');

    if (mode === 'create') {
      if (needGate) { setStep('pin'); return; }
      // 已解锁时点「生成钱包」不该再问一次 PIN：直接生成，然后展示私钥。
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
    else if (mode === 'accounts') setStep(needGate ? 'pin' : 'list');
    else setStep('pin'); // unlock / viewkey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  if (!open) return null;

  // 新 PIN 必须正好 6 位；解锁路径允许 6–8 位，避免把旧版本设了 7–8 位的人锁在门外
  const pinOk = settingPin || mode === 'create' || mode === 'import'
    ? pin.length === 6
    : pin.length >= 6;
  const pinMax = settingPin ? 6 : 8;

  const errText = (e) => {
    if (!e) return 'Something went wrong.';
    if (e.code === 'BAD_PIN') return 'Wrong PIN. Try again.';
    if (e.code === 'BAD_KEY') return e.message;
    if (e.code === 'DUP') return e.message;
    return e.message || String(e);
  };

  const doGenerate = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try {
      if (settingPin && pin.length !== 6) { setErr('Choose a 6-digit PIN.'); setBusy(false); return; }
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
      if (mode === 'viewkey') {
        const k = await onViewKey(pin, activeId);
        setSecret(k);
        setShownAddress(address || '');
        setStep('reveal');
      } else if (mode === 'accounts') {
        await onUnlock(pin);
        setStep('list');
      } else if (mode === 'create') {
        // 已有钱包但本次未解锁：PIN 验过之后接着生成，不再问第二遍
        await onUnlock(pin);
        const r = await onCreate(undefined);
        setSecret(r.privateKey);
        setShownAddress(r.address);
        setStep('reveal');
      } else {
        await onUnlock(pin);
        onClose();
      }
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const doSwitch = async (id) => {
    if (busy || id === activeId) return;
    setBusy(true); setErr('');
    try {
      await onSwitch(id);
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
    mode === 'accounts' ? 'Accounts'
      : mode === 'import' ? 'Import private key'
        : mode === 'viewkey' ? 'View private key'
          : mode === 'create' ? 'Create UFO wallet'
            : 'Unlock wallet';

  // 创建结果的 reveal 不允许点遮罩关闭：私钥只在这里出现一次
  const lockOverlay = step === 'reveal' && (mode === 'create');

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
          background: '#fff', width: '100%', maxWidth: '420px',
          borderRadius: '24px', padding: '22px 20px',
          boxShadow: '0 20px 60px rgba(15,23,42,0.28)',
          maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          color: '#1e293b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
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
            <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.65, marginTop: '8px' }}>
              {mode === 'create' && !settingPin
                ? 'Enter your wallet PIN. The new account is added to this same wallet.'
                : mode === 'create'
                  ? 'This wallet is created here, inside this page. Choose a 6-digit PIN — it encrypts the private key before it is stored on this device.'
                  : mode === 'viewkey'
                    ? 'Enter your 6-digit PIN to reveal the private key. Make sure nobody is looking at your screen.'
                    : mode === 'accounts'
                      ? 'Enter your PIN to unlock the wallet before switching accounts.'
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
              style={{ ...primaryBtn(busy || !pinOk), marginTop: '16px' }}
            >
              {busy ? 'Working…'
                : mode === 'create' ? (settingPin ? 'Generate wallet' : 'Add account')
                  : mode === 'viewkey' ? 'Reveal key'
                    : mode === 'accounts' ? 'Unlock' : 'Unlock'}
            </button>

            {mode === 'create' && (
              <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
                A brand-new private key is generated on this device. The address starts empty —
                send BEP-20 USDT to it before issuing UFO.
              </div>
            )}

            {mode !== 'create' && mode !== 'accounts' && (
              <button onClick={onClose} style={{ ...ghostBtn, marginTop: '6px' }}>Cancel</button>
            )}
          </>
        )}

        {/* ---------------- 导入 ---------------- */}
        {step === 'form' && mode === 'import' && (
          <>
            <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.65, marginTop: '8px' }}>
              Paste a 64-character private key (0x optional). It is encrypted with your PIN and
              stored on this device only.
            </div>

            <div style={{ ...label, marginTop: '16px', marginBottom: '6px' }}>Private key</div>
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
              style={{ ...primaryBtn(busy || !keyInput.trim() || (needGate && !pinOk)), marginTop: '16px' }}
            >
              {busy ? 'Importing…' : 'Import account'}
            </button>

            <button onClick={onClose} style={{ ...ghostBtn, marginTop: '6px' }}>Cancel</button>
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
                <div style={label}>Address</div>
                <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                              background: '#f8fafc', border: '1px solid #e2e8f0',
                              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                              lineHeight: 1.6, wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                  {shownAddress}
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              <div style={{ ...label, marginBottom: '6px' }}>Private key</div>
              <div style={{ padding: '12px', borderRadius: '12px', background: '#0f172a',
                            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px',
                            lineHeight: 1.7, color: '#f8fafc', wordBreak: 'break-all',
                            userSelect: 'all', WebkitUserSelect: 'all', WebkitTouchCallout: 'default' }}>
                {secret}
              </div>
            </div>

            <button
              onClick={doCopy}
              style={{ ...primaryBtn(false), marginTop: '12px' }}
            >
              {copied === 'ok' ? 'Copied to clipboard' : copied === 'fail' ? 'Select the key and copy it manually' : 'Copy private key'}
            </button>

            <button
              onClick={() => { if (onBackedUp) onBackedUp(); onClose(); }}
              style={{ ...secBtn, marginTop: '9px' }}
            >
              {mode === 'create' ? 'Done — open my wallet' : 'Done'}
            </button>

            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
              You can see this key again at any time from Wallet → View private key,
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
              <div style={label}>Address</div>
              <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                            lineHeight: 1.6, wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                {shownAddress}
              </div>
            </div>
            <button onClick={onClose} style={{ ...primaryBtn(false), marginTop: '16px' }}>Done</button>
          </>
        )}

        {/* ---------------- 账户列表 ---------------- */}
        {step === 'list' && mode === 'accounts' && (
          <>
            <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.65, marginTop: '8px' }}>
              Switching changes which account signs issuance and burn transactions.
            </div>

            <div style={{ marginTop: '14px', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
              {accounts.map((a, i) => {
                const isActive = a.id === activeId;
                return (
                  <button
                    key={a.id}
                    onClick={() => doSwitch(a.id)}
                    style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
                             display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                             width: '100%', padding: '13px 14px', textAlign: 'left', cursor: 'pointer',
                             background: isActive ? '#eff6ff' : '#fff', border: 'none',
                             borderTop: i === 0 ? 'none' : '1px solid #f1f5f9' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px',
                                     color: '#0f172a', wordBreak: 'break-all' }}>
                        {short(a.address)}
                      </span>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Account {i + 1}</span>
                    </span>
                    {isActive ? (
                      <span style={{ flexShrink: 0, fontSize: '10.5px', fontWeight: 700, color: '#1d4ed8',
                                     background: '#dbeafe', borderRadius: '20px', padding: '4px 9px' }}>
                        Active
                      </span>
                    ) : (
                      <span style={{ flexShrink: 0, fontSize: '11px', color: '#64748b' }}>Switch</span>
                    )}
                  </button>
                );
              })}
            </div>

            {err && <ErrBox>{err}</ErrBox>}

            <button onClick={() => onNavigate && onNavigate('create')} style={{ ...secBtn, marginTop: '14px' }}>
              Generate new account
            </button>
            <button onClick={() => onNavigate && onNavigate('import')} style={{ ...secBtn, marginTop: '8px' }}>
              Import private key
            </button>
            <button onClick={onClose} style={{ ...ghostBtn, marginTop: '6px' }}>Close</button>
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
