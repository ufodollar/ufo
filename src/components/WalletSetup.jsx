import React, { useEffect, useState } from 'react';

// ============================================================================
// 钱包创建 / 解锁 / 备份面板
// ----------------------------------------------------------------------------
// 三种模式共用一套壳，因为它们的形状完全一样：先输 PIN，再（可能）看一眼密钥。
//
// 关键约束（来自产品要求）：助记词只出现这一次，用户必须手抄。
//   · 不给复制按钮，选中也被关掉 —— 复制到剪贴板等于把私钥交给系统输入法、
//     剪贴板历史和所有能读剪贴板的应用；
//   · 关闭后无法再次查看，除非重新输 PIN 走一次备份流程；
//   · 必须勾选「已抄写」才能关闭，避免误触。
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

export default function WalletSetup({ mode, onClose, onCreate, onUnlock, onBackup, onBackedUp, address }) {
  const open = !!mode;

  const [pin, setPin] = useState('');
  const [step, setStep] = useState('pin');       // 'pin' | 'reveal'
  const [mnemonic, setMnemonic] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setPin(''); setStep('pin'); setMnemonic(''); setNewAddress('');
    setAgree(false); setBusy(false); setErr('');
  }, [open, mode]);

  if (!open) return null;

  const isCreate = mode === 'create';
  const isBackup = mode === 'backup';
  const words = mnemonic ? mnemonic.trim().split(/\s+/) : [];

  const submit = async () => {
    if (busy) return;
    if (pin.length < 6) { setErr('Use at least 6 digits.'); return; }
    setBusy(true); setErr('');
    try {
      if (isCreate) {
        const r = await onCreate(pin);
        setMnemonic(r.mnemonic);
        setNewAddress(r.address);
        setStep('reveal');
      } else if (isBackup) {
        const phrase = await onBackup(pin);
        setMnemonic(phrase);
        setStep('reveal');
      } else {
        await onUnlock(pin);
        onClose();
      }
    } catch (e) {
      setErr(e && e.code === 'BAD_PIN' ? 'Wrong PIN. Try again.' : String((e && e.message) || e));
    } finally {
      setBusy(false);
    }
  };

  const title = step === 'reveal'
    ? 'Your recovery phrase'
    : isCreate ? 'Create your UFO wallet'
      : isBackup ? 'Back up your wallet'
        : 'Unlock your wallet';

  const shownAddress = newAddress || address || '';

  return (
    <div
      onClick={step === 'reveal' ? undefined : onClose}
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
          {step !== 'reveal' && (
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

        {step === 'pin' && (
          <>
            <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.65, marginTop: '8px' }}>
              {isCreate
                ? 'This wallet is created here, inside this page. The key never leaves this device — choosing a 6-digit PIN encrypts it before it is stored.'
                : isBackup
                  ? 'Enter your PIN to display the phrase again. Make sure nobody is looking at your screen.'
                  : 'Enter the 6-digit PIN you set when you created this wallet.'}
            </div>

            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="6-digit PIN"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '18px', padding: '14px 16px',
                       fontSize: '17px', letterSpacing: '7px', textAlign: 'center', borderRadius: '13px',
                       border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a', outline: 'none' }}
            />

            {err && (
              <div style={{ marginTop: '10px', padding: '9px 11px', borderRadius: '9px',
                            background: '#fef2f2', border: '1px solid #fecaca',
                            color: '#b91c1c', fontSize: '12px', lineHeight: 1.5 }}>
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy || pin.length < 6}
              style={{ ...primaryBtn(busy || pin.length < 6), marginTop: '16px' }}
            >
              {busy ? 'Generating…' : isCreate ? 'Generate wallet' : isBackup ? 'Show phrase' : 'Unlock'}
            </button>

            {isCreate && (
              <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
                A brand-new address is generated each time you tap. It starts empty —
                send BEP-20 USDT to it before issuing UFO.
              </div>
            )}

            <button onClick={onClose} style={{ ...ghostBtn, marginTop: '6px' }}>Cancel</button>
          </>
        )}

        {step === 'reveal' && (
          <>
            <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#b45309', background: '#fffbeb',
                          border: '1px solid #fde68a', borderRadius: '11px', padding: '11px 12px', lineHeight: 1.65 }}>
              <b>Write these 12 words on paper.</b> Do not screenshot, do not copy, do not store them in
              a chat. Anyone who reads them owns this wallet.
            </div>

            {shownAddress && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  Your address
                </div>
                <div style={{ marginTop: '4px', padding: '10px 11px', borderRadius: '10px',
                              background: '#f8fafc', border: '1px solid #e2e8f0',
                              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px',
                              lineHeight: 1.6, wordBreak: 'break-all', userSelect: 'all', WebkitUserSelect: 'all' }}>
                  {shownAddress}
                </div>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Recovery phrase (your private key)
              </div>
              <div
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                         padding: '12px', borderRadius: '12px', background: '#0f172a',
                         userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
              >
                {words.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '6px',
                                        padding: '5px 7px', borderRadius: '7px', background: 'rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', minWidth: '14px', textAlign: 'right' }}>{i + 1}</span>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '13.5px',
                                   color: '#f8fafc', letterSpacing: '0.2px' }}>{w}</span>
                  </div>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', marginTop: '14px',
                            cursor: 'pointer', fontSize: '12.5px', color: '#334155', lineHeight: 1.55 }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, accentColor: '#1d4ed8' }}
              />
              I have written all 12 words on paper, in order.
            </label>

            <button
              onClick={() => { if (onBackedUp) onBackedUp(); onClose(); }}
              disabled={!agree}
              style={{ ...primaryBtn(!agree), marginTop: '14px' }}
            >
              {isCreate ? 'Done — open my wallet' : 'Done'}
            </button>

            <div style={{ marginTop: '10px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
              This phrase will not be shown again. You can view it later from Wallet → Back up,
              but only by entering your PIN.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
