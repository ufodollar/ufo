import React, { useEffect, useState } from 'react';

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

const chip = (tone) => ({
  appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
  padding: '7px 10px', borderRadius: '9px',
  border: '1px solid ' + (tone === 'danger' ? '#fecaca' : '#e2e8f0'),
  background: tone === 'danger' ? '#fef2f2' : '#fff',
  color: tone === 'danger' ? '#b91c1c' : '#334155',
  fontSize: '11.5px', fontWeight: 700, lineHeight: 1.2, cursor: 'pointer', whiteSpace: 'nowrap'
});

// 账户卡的底色按编号轮换：白字始终压在渐变上，不依赖主题色
const CARD_TINTS = [
  'linear-gradient(135deg, #7C6BFF 0%, #A855F7 100%)',
  'linear-gradient(135deg, #22D3EE 0%, #0E8FE8 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #F43F5E 100%)',
  'linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)'
];

// 渐变卡上的按钮：半透明白 + 白字。实心白块会盖掉卡片本身的颜色
const glassChip = {
  appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
  padding: '7px 10px', borderRadius: '9px',
  border: '1px solid rgba(255,255,255,0.45)',
  background: 'rgba(255,255,255,0.16)',
  color: '#fff', fontSize: '11.5px', fontWeight: 700,
  lineHeight: 1.2, cursor: 'pointer', whiteSpace: 'nowrap'
};

const glassDanger = {
  ...glassChip,
  border: '1px solid rgba(255,214,214,0.55)',
  background: 'rgba(255,255,255,0.10)',
  color: '#FFE4E6'
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

  // 这次操作是否需要先过 PIN：已解锁就不用
  const needGate = !unlocked;
  // 是不是在给这个 vault 设第一个 PIN（决定文案：设置 vs 输入）
  const settingPin = !hasWallet;

  // 账户面板用彩色渐变底；PIN、私钥这些表单仍留在白底上，对比度更稳。
  // 渐变里的文字色集中在这里算，避免散落成一堆魔法值。
  const themed = mode === 'accounts';
  const hint = {
    fontSize: '12.5px',
    color: themed ? 'rgba(255,255,255,0.9)' : '#64748b',
    lineHeight: 1.65,
    marginTop: '8px'
  };
  const lbl = { ...label, color: themed ? 'rgba(255,255,255,0.7)' : label.color };
  const ghost = themed
    ? { ...ghostBtn, color: '#fff', background: 'rgba(255,255,255,0.14)', borderRadius: '12px' }
    : ghostBtn;
  // 渐变底上的主按钮反过来做：白底、深色字。蓝底压紫蓝渐变会糊成一片
  const primary = (disabled) => (themed
    ? { ...primaryBtn(disabled),
        background: disabled ? 'rgba(255,255,255,0.55)' : '#fff',
        color: disabled ? 'rgba(15,23,42,0.45)' : '#1d4ed8',
        boxShadow: disabled ? 'none' : '0 10px 24px -14px rgba(15,23,42,0.6)' }
    : primaryBtn(disabled));

  useEffect(() => {
    if (!open) return;
    setPin(''); setKeyInput(''); setSecret(''); setShownAddress(''); setTarget(null);
    setCopied(''); setBusy(false); setErr('');

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
          : mode === 'create' ? 'Create UFO wallet'
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
          background: themed
            ? 'linear-gradient(155deg, #6D5DF6 0%, #4F4CE8 30%, #2C8FE8 66%, #22D3EE 100%)'
            : '#fff',
          width: '100%', maxWidth: '420px',
          borderRadius: '24px', padding: '22px 20px',
          boxShadow: '0 20px 60px rgba(15,23,42,0.28)',
          maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          color: themed ? '#fff' : '#1e293b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.3,
                        color: themed ? '#fff' : '#1e293b' }}>
            {title}
          </div>
          {!lockOverlay && (
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', flexShrink: 0,
                       width: '30px', height: '30px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                       background: themed ? 'rgba(255,255,255,0.18)' : '#f1f5f9',
                       color: themed ? '#fff' : '#64748b', fontSize: '16px', padding: 0 }}
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
                if (mode === 'accounts') setStep('list');
                else onClose();
              }}
              style={{ ...secBtn, marginTop: '9px' }}
            >
              {mode === 'create' ? 'Done — open my wallet' : mode === 'accounts' ? 'Back to accounts' : 'Done'}
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

            {accounts.length === 0 ? (
              <div style={{ marginTop: '16px', padding: '22px 14px', textAlign: 'center',
                            border: '1px dashed rgba(255,255,255,0.45)', borderRadius: '16px',
                            fontSize: '12.5px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                No account on this device yet.
              </div>
            ) : (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {accounts.map((a) => {
                  const isActive = a.id === activeId;
                  // 底色由账户编号决定：删掉账户 1 之后，账户 2 的颜色不跟着变。
                  const tint = CARD_TINTS[(Math.max(a.no, 1) - 1) % CARD_TINTS.length];
                  return (
                    <div key={a.id} style={{ background: tint, borderRadius: '16px', padding: '13px 13px 11px',
                                             boxShadow: isActive
                                               ? '0 0 0 2px rgba(255,255,255,0.95), 0 10px 24px -12px rgba(15,23,42,0.55)'
                                               : '0 8px 20px -14px rgba(15,23,42,0.5)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', letterSpacing: '0.2px' }}>
                          Account {a.no}
                        </span>
                        {isActive ? (
                          <span style={{ flexShrink: 0, fontSize: '10.5px', fontWeight: 800, color: '#4338ca',
                                         background: '#fff', borderRadius: '20px', padding: '4px 9px' }}>
                            Active
                          </span>
                        ) : (
                          <button onClick={() => doSwitch(a.id)} disabled={busy} style={glassChip}>
                            Switch
                          </button>
                        )}
                      </div>

                      <div style={{ marginTop: '8px', fontFamily: 'ui-monospace, Menlo, monospace',
                                    fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.92)',
                                    wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                        {a.address}
                      </div>

                      <div style={{ display: 'flex', gap: '7px', marginTop: '11px' }}>
                        <button onClick={() => { setTarget(a.id); setErr(''); setPin(''); setSecret(''); setCopied(''); setStep('viewgate'); }}
                                style={glassChip}>
                          View private key
                        </button>
                        <button onClick={() => { setTarget(a.id); setErr(''); setStep('confirm'); }}
                                style={glassDanger}>
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
