import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TokenIcon, BnbIcon } from '../icons';

// ============================================================================
// 代币选择弹窗（bottom sheet）
// ----------------------------------------------------------------------------
// 形状对齐主流钱包：顶部拖拽条、搜索框、链筛选胶囊、双列表头（代币 / 余额），
// 每行 = 图标 + 代号 + 认证标 + 全名 + 余额 + 折美元。
//
// 两条设计约束：
//   1. 余额与美元估值必须来自真实读数。读不到就写 "—"，不写 0.00 —— 对一个
//      钱包来说，"0" 和 "读不到" 是两件事，把后者显示成前者会让人以为币没了。
//   2. 当前金库只给 USDT / USDC / UFO 报价。其余币种照样列出（持有就能看见、
//      能转出），但点选做兑换会明确提示不支持的币对，而不是让交易在链上 revert。
// ============================================================================

const SHEET_MAX = 480;

export default function TokenPicker({
  open, tokens = [], balances = {}, prices = {}, selectedSymbol = '',
  onSelect, onClose, onBlocked
}) {
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setNote('');
    const t = setTimeout(() => { try { inputRef.current?.focus(); } catch (e) {} }, 220);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return tokens;
    return tokens.filter((t) =>
      t.symbol.toLowerCase().includes(kw) ||
      t.name.toLowerCase().includes(kw) ||
      (t.address || '').toLowerCase().includes(kw)
    );
  }, [tokens, q]);

  if (!open) return null;

  const pick = (t) => {
    if (!t.tradable) {
      setNote(`${t.symbol} is not priced by the Vault. Swaps settle in USDT, USDC or UFO.`);
      return;
    }
    setNote('');
    onSelect(t);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 3000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'ufoFade 160ms ease-out'
      }}
    >
      <style>{`
        @keyframes ufoFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ufoSheetUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .ufo-picker-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .ufo-picker-scroll::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select a token"
        style={{
          width: '100%', maxWidth: `${SHEET_MAX}px`,
          background: '#fff', borderRadius: '24px 24px 0 0',
          boxShadow: '0 -18px 50px rgba(15,23,42,0.22)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '88vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          animation: 'ufoSheetUp 240ms cubic-bezier(.22,.9,.3,1)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}
      >
        {/* 拖拽条 */}
        <div style={{ padding: '9px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#e2e8f0' }} />
        </div>

        {/* 搜索 */}
        <div style={{ padding: '14px 16px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '9px',
            background: '#f4f5f7', borderRadius: '14px', padding: '0 12px', height: '44px'
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9aa4b2"
                 strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, symbol or address"
              aria-label="Search tokens"
              spellCheck={false}
              autoComplete="off"
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                fontSize: '14px', fontWeight: 500, color: '#0f172a', padding: 0
              }}
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                style={{ border: 'none', background: 'transparent', color: '#9aa4b2', cursor: 'pointer', padding: 0, fontSize: '15px', lineHeight: 1 }}
              >
                ✕
              </button>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9aa4b2"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="3" width="11" height="15" rx="2.4" />
                <path d="M5 7.5H4a1 1 0 0 0-1 1V19a2 2 0 0 0 2 2h8a1 1 0 0 0 1-1v-1" />
              </svg>
            )}
          </div>
        </div>

        {/* 链筛选：只保留有语义的三颗，不做点不动的装饰 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px', padding: '0 16px 12px',
          overflowX: 'auto', scrollbarWidth: 'none'
        }}>
          <Chip aria-label="Favourites">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F5B82E" stroke="#F5B82E" strokeWidth="1.6" strokeLinejoin="round">
              <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />
            </svg>
          </Chip>
          <Chip aria-label="All chains">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" />
              <path d="M12 3.4c2.4 2.4 3.6 5.4 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.4-3.6-8.6s1.2-6.2 3.6-8.6z" />
            </svg>
          </Chip>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0,
            height: '36px', padding: '0 14px 0 9px', borderRadius: '18px',
            background: '#fff', border: '1.5px solid #38BDF8',
            boxShadow: '0 4px 12px -6px rgba(56,189,248,0.9)'
          }}>
            <BnbIcon size={19} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>BNB Chain</span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            height: '36px', minWidth: '36px', padding: '0 10px', borderRadius: '18px',
            background: '#f4f5f7', color: '#64748b', fontSize: '12.5px', fontWeight: 800
          }}>
            {tokens.length}
          </div>
        </div>

        {note && (
          <div style={{
            margin: '0 16px 10px', padding: '9px 11px', borderRadius: '11px',
            background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412',
            fontSize: '11.5px', fontWeight: 600, lineHeight: 1.5
          }}>
            {note}
          </div>
        )}

        {/* 表头 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0 18px 8px', borderBottom: '1px solid #f1f5f9'
        }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px' }}>Token</span>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.4px' }}>Balance</span>
        </div>

        {/* 列表 */}
        <div className="ufo-picker-scroll" style={{ overflowY: 'auto', flex: 1, minHeight: '120px', paddingBottom: '10px' }}>
          {list.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', lineHeight: 1.7 }}>
              No token matches “{q}”.
            </div>
          ) : list.map((t) => {
            const bal = Number(balances[t.symbol] || 0);
            const price = prices[t.symbol];
            // 余额为 0 时估值必然是 0，与有没有行情无关 —— 这里显示 "—" 只会让人
            // 以为这个币没价格，而不是「我没这个币」。
            const usd = bal === 0 ? 0 : (price == null ? null : bal * price);
            const selected = t.symbol === selectedSymbol;
            return (
              <button
                key={t.symbol}
                type="button"
                onClick={() => pick(t)}
                style={{
                  appearance: 'none', WebkitAppearance: 'none', font: 'inherit', width: '100%',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 18px', border: 'none', textAlign: 'left',
                  background: selected ? '#f0faff' : '#fff', cursor: 'pointer',
                  touchAction: 'manipulation'
                }}
              >
                <TokenIcon token={t} size={38} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{
                      fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {t.symbol}
                    </span>
                    {t.verified && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="#38BDF8" style={{ flexShrink: 0 }}>
                        <path d="M12 1.8 14.9 4l3.6-.3 1.2 3.4 3 2-1 3.5 1 3.5-3 2-1.2 3.4-3.6-.3L12 22.2 9.1 20l-3.6.3-1.2-3.4-3-2 1-3.5-1-3.5 3-2L5.5 3.7 9.1 4z" />
                        <path d="m8.4 12.2 2.4 2.4 4.8-4.9" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div style={{
                    fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', fontWeight: 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {t.name}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    {selected ? 'Selected' : (bal === 0 ? '0.00'
                      : bal < 0.000001 ? '<0.000001'
                        : bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                    {selected ? '' : (usd == null ? '$ —' : '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 关闭：贴底一颗，和全站按钮同款 */}
        <div style={{ padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid #f1f5f9' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              appearance: 'none', WebkitAppearance: 'none', font: 'inherit', width: '100%',
              height: '48px', borderRadius: '14px', border: 'none',
              background: 'linear-gradient(180deg, #5CCBEC 0%, #38BDF8 100%)',
              color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 5px 14px -4px rgba(56,189,248,0.75)'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: '36px', height: '36px', borderRadius: '18px', background: '#f4f5f7'
      }}
    >
      {children}
    </div>
  );
}
