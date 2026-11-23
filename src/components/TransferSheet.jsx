import React, { useEffect, useState } from 'react';
import { sendTransfer, normalizeAddress, toWei } from '../tx';
import { TokenIcon } from '../icons';
import { skyBtn, skyLink } from '../ui';

// ============================================================================
// 发送 / 接收
// ----------------------------------------------------------------------------
// 两件事放在同一个弹层里，因为它们在用户脑子里是一对：钱从哪出去、从哪进来。
//
// 发送：代币 + 收款地址 + 金额 → 一笔 eth_sendTransaction。地址先做 EIP-55
// 校验和检查（混合大小写抄错会被拦下），余额在签名前先查，gas 由 tx.js
// 用公共 RPC 估好，钱包只签名，不存在「点了没反应」的中间态。
//
// 接收：展示当前账户地址与二维码。二维码在本地生成（qrcode-generator 按需
// import），不请求任何外部图床 —— 地址是敏感信息，不该出现在第三方日志里。
// ============================================================================

const FONT = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased'
};

const overlayStyle = {
  ...FONT,
  position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 2000,
  background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '16px', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)'
};

const sheetStyle = {
  background: '#fff', width: '100%', maxWidth: '420px', borderRadius: '24px',
  padding: '22px 20px', boxShadow: '0 20px 60px rgba(15,23,42,0.28)',
  maxHeight: '88vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', color: '#1e293b'
};

// 与全站同一套按钮语言（ui.js）
const primaryBtn = (disabled) => skyBtn('lg', { block: true, disabled });
const ghostBtn = { ...skyBtn('md', { block: true, soft: true }) };

/** 资产选择里用的 16px 飞碟标（纯色，避免多实例的渐变 id 冲突） */
const UfoMark = ({ size = 16 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
    <path d="M 25 52 C 25 15, 75 15, 75 52 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="5" />
    <ellipse cx="50" cy="55" rx="45" ry="16" fill="#3b82f6" />
    <circle cx="35" cy="55" r="4.5" fill="#fff" />
    <circle cx="50" cy="57" r="4.5" fill="#fff" />
    <circle cx="65" cy="55" r="4.5" fill="#fff" />
  </svg>
);

const label = {
  fontSize: '11px', fontWeight: 700, color: '#94a3b8',
  letterSpacing: '0.6px', textTransform: 'uppercase'
};

const field = {
  width: '100%', boxSizing: 'border-box', marginTop: '8px',
  padding: '13px 14px', borderRadius: '13px', border: '1px solid #e2e8f0',
  background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none'
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

export default function TransferSheet({
  mode, onClose, address, accountNo, balances = {}, tokens = [], provider, onSent
}) {
  const open = mode === 'send' || mode === 'receive';

  const [symbol, setSymbol] = useState('USDT');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);   // { hash, symbol, amount, to }
  const [copied, setCopied] = useState('');
  const [qr, setQr] = useState(null);       // { n, d }
  const [qrErr, setQrErr] = useState(false);

  // 每次重新打开都回到初始态：上一次的成功页 / 报错不该跟着进来
  useEffect(() => {
    if (!open) return;
    setSymbol('USDT');
    setTo('');
    setAmount('');
    setBusy(false);
    setErr('');
    setDone(null);
    setCopied('');
  }, [mode, open]);

  // 二维码在本地画。qrcode-generator 只在真正打开接收页时才下载。
  useEffect(() => {
    if (mode !== 'receive' || !address) { setQr(null); setQrErr(false); return undefined; }
    let alive = true;
    setQrErr(false);
    import('qrcode-generator')
      .then((m) => {
        if (!alive) return;
        const make = m.default || m;
        const qrObj = make(0, 'M');
        qrObj.addData(address);
        qrObj.make();
        const n = qrObj.getModuleCount();
        const parts = [];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (qrObj.isDark(r, c)) parts.push(`M${c} ${r}h1v1h-1z`);
          }
        }
        setQr({ n, d: parts.join('') });
      })
      .catch(() => { if (alive) { setQr(null); setQrErr(true); } });
    return () => { alive = false; };
  }, [mode, address]);

  if (!open) return null;

  const token = tokens.find((t) => t.symbol === symbol) || tokens[0] || null;
  const balNum = Number(balances[symbol] || 0);
  const amtNum = Number(amount);
  const amountOk = !!amount && Number.isFinite(amtNum) && amtNum > 0;
  const enough = amountOk && amtNum <= balNum;
  const canSend = !busy && !!address && to.trim().length > 0 && enough;

  const doSend = async () => {
    if (!canSend) return;
    setBusy(true);
    setErr('');
    try {
      const target = await normalizeAddress(to);
      const wei = toWei(amount);
      const r = await sendTransfer({
        walletProvider: provider,
        owner: address,
        token,
        to: target,
        amountWei: wei
      });
      setDone({ hash: r.hash, symbol, amount, to: target });
      if (onSent) onSent({ hash: r.hash, symbol, amount, to: target });
    } catch (e) {
      setErr((e && e.message) || String(e));
    } finally {
      setBusy(false);
    }
  };

  const doCopy = async () => {
    const ok = await copyText(address || '');
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied(''), 2200);
  };

  const setMax = () => {
    const v = Number(balances[symbol] || 0);
    if (!v) return;
    // BNB 要留 gas：把整条余额都发出去，交易一定失败
    if (symbol === 'BNB') {
      const keep = 0.0005;
      setAmount(String(Math.max(v - keep, 0)));
    } else {
      setAmount(String(v));
    }
  };

  return (
    <div onClick={busy ? undefined : onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
            {mode === 'receive' ? 'Receive' : 'Send'}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            disabled={busy}
            style={{ appearance: 'none', WebkitAppearance: 'none', flexShrink: 0, width: '30px', height: '30px',
                     borderRadius: '50%', border: 'none', background: '#f1f5f9', color: '#64748b',
                     fontSize: '16px', lineHeight: 1, cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* ---------------- 接收 ---------------- */}
        {mode === 'receive' && (
          <>
            <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.65, marginTop: '8px' }}>
              Only send BNB Chain assets (BEP-20) to this address. Anything on another network will be lost.
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '18px' }}>
                {qr ? (
                  <svg width="196" height="196" viewBox={`0 0 ${qr.n} ${qr.n}`} shapeRendering="crispEdges"
                       role="img" aria-label="Address QR code">
                    <rect width={qr.n} height={qr.n} fill="#fff" />
                    <path d={qr.d} fill="#0f172a" />
                  </svg>
                ) : qrErr ? (
                  <div style={{ width: '196px', height: '196px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: '#b91c1c', fontSize: '12px',
                                textAlign: 'center', lineHeight: 1.6, padding: '0 16px' }}>
                    QR code could not be rendered here. Use the address below.
                  </div>
                ) : (
                  <div style={{ width: '196px', height: '196px', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    Generating…
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1d4ed8' }}>
                Account {accountNo ?? '—'}
              </span>
            </div>

            <div style={{ marginTop: '10px', padding: '12px', borderRadius: '12px', background: '#f8fafc',
                          border: '1px solid #e2e8f0', fontFamily: 'ui-monospace, Menlo, monospace',
                          fontSize: '11.5px', lineHeight: 1.7, wordBreak: 'break-all', color: '#334155',
                          userSelect: 'all', WebkitUserSelect: 'all', textAlign: 'center' }}>
              {address || 'No wallet connected.'}
            </div>

            <button onClick={doCopy} disabled={!address} style={{ ...primaryBtn(!address), marginTop: '14px' }}>
              {copied === 'ok' ? 'Copied to clipboard' : copied === 'fail' ? 'Select the address above to copy' : 'Copy address'}
            </button>
            <button onClick={onClose} style={{ ...ghostBtn, marginTop: '6px' }}>Done</button>
          </>
        )}

        {/* ---------------- 发送成功 ---------------- */}
        {mode === 'send' && done && (
          <>
            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '14px', background: '#ecfdf5',
                          border: '1px solid #a7f3d0', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#047857' }}>Sent</div>
              <div style={{ marginTop: '6px', fontSize: '20px', fontWeight: 800, color: '#065f46' }}>
                {done.amount} {done.symbol}
              </div>
              <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#047857', wordBreak: 'break-all' }}>
                to {done.to.slice(0, 10)}…{done.to.slice(-8)}
              </div>
            </div>

            <a
              href={`https://bscscan.com/tx/${done.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...skyLink('md'), display: 'flex', width: '100%', marginTop: '12px' }}
            >
              View on BscScan ↗
            </a>

            <button onClick={onClose} style={{ ...primaryBtn(false), marginTop: '12px' }}>Done</button>
          </>
        )}

        {/* ---------------- 发送表单 ---------------- */}
        {mode === 'send' && !done && (
          <>
            <div style={{ marginTop: '14px' }}>
              <div style={label}>Asset</div>
              {tokens.length === 0 && (
                <div style={{ marginTop: '8px', padding: '12px', borderRadius: '12px',
                              background: '#f8fafc', border: '1px solid #f1f5f9',
                              fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
                  Nothing to send yet. Receive some BNB or BEP-20 tokens first.
                </div>
              )}
              <div style={{ display: 'flex', gap: '7px', marginTop: '8px', flexWrap: 'wrap' }}>
                {tokens.map((t) => {
                  const on = t.symbol === symbol;
                  return (
                    <button
                      key={t.symbol}
                      onClick={() => { setSymbol(t.symbol); setAmount(''); setErr(''); }}
                      disabled={busy}
                      style={{ ...skyBtn('sm', { soft: !on }), paddingLeft: '8px' }}
                    >
                      <TokenIcon token={t} size={17} />
                      {t.symbol}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={label}>Recipient</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>BNB Smart Chain</span>
              </div>
              <input
                value={to}
                onChange={(e) => { setTo(e.target.value); setErr(''); }}
                placeholder="0x…"
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                disabled={busy}
                style={{ ...field, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={label}>Amount</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Balance {Number(balances[symbol] || 0).toFixed(6)}
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErr(''); }}
                  placeholder="0.000000"
                  disabled={busy}
                  style={{ ...field, paddingRight: '64px', fontSize: '18px', fontWeight: 700 }}
                />
                <button
                  onClick={setMax}
                  disabled={busy}
                  style={{ ...skyBtn('xs'), position: 'absolute', right: '8px', top: '50%',
                           transform: 'translateY(-50%)' }}
                >
                  MAX
                </button>
              </div>
            </div>

            {err && (
              <div style={{ marginTop: '12px', padding: '10px 11px', borderRadius: '10px', background: '#fef2f2',
                            border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', lineHeight: 1.6 }}>
                {err}
              </div>
            )}

            <button onClick={doSend} disabled={!canSend} style={{ ...primaryBtn(!canSend), marginTop: '16px' }}>
              {busy ? 'Sending…' : `Send ${symbol}`}
            </button>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
              Network fee is paid in BNB. You will see the hash here when it is mined.
            </div>
            <button onClick={onClose} disabled={busy} style={{ ...ghostBtn, marginTop: '4px' }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
