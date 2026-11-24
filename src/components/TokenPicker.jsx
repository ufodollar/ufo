import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TokenIcon } from '../icons';

// ============================================================================
// 代币选择弹窗（bottom sheet）
// ----------------------------------------------------------------------------
// 形状对齐主流钱包：顶部拖拽条、搜索框、双列表头（代币 / 余额），
// 每行 = 图标 + 代号 + 认证标 + 全名 + 余额 + 折美元。
//
// 两条设计约束：
//   1. 余额与美元估值必须来自真实读数。读不到就写 "—"，不写 0.00 —— 对一个
//      钱包来说，"0" 和 "读不到" 是两件事，把后者显示成前者会让人以为币没了。
//   2. 这张表只覆盖一条链（BNB Chain），所以不再放链筛选胶囊 —— 一排点不动
//      的「全部链 / 收藏」只是装饰，占掉首屏最好的一块位置。
// ============================================================================

const SHEET_MAX = 480;

export default function TokenPicker({
  open, tokens = [], balances = {}, prices = {}, selectedSymbol = '',
  otherSymbol = '', onSelect, onClose
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  // ---- 下拖关闭 ----
  // 顶部那道凹槽不是装饰：按住它往下拖，超过 90px 就关掉面板，不到就弹回去。
  // 用 pointer 事件而不是 touch：桌面浏览器也能拖，且不会被滚动容器抢走。
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  const dragStart = (e) => {
    dragRef.current = { y: e.clientY, dy: 0 };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器 */ }
  };
  const dragMove = (e) => {
    if (!dragRef.current) return;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.dy = dy;
    setDragY(Math.max(0, dy));   // 只允许往下，往上不给「拉长」
  };
  const dragEnd = () => {
    if (!dragRef.current) return;
    const dy = dragRef.current.dy;
    dragRef.current = null;
    setDragging(false);
    if (dy > 90) { onClose(); return; }
    setDragY(0);
  };

  useEffect(() => {
    if (!open) return;
    setQ('');
    setDragY(0);
    setDragging(false);
    dragRef.current = null;
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

  // 不再在这里拦「不可兑换」：能不能换由链上有没有流动性决定，
  // 选完之后报价那一步会说清楚。选到对侧已有的币则对调两侧，由调用方处理。
  const pick = (t) => onSelect(t);

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
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 220ms cubic-bezier(.22,.9,.3,1)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}
      >
        {/* 拖拽条：整条都是把手，不只是那根 4px 的线 —— 4px 手指按不住 */}
        <div
          onPointerDown={dragStart}
          onPointerMove={dragMove}
          onPointerUp={dragEnd}
          onPointerCancel={dragEnd}
          style={{ padding: '14px 0 10px', display: 'flex', justifyContent: 'center',
                   cursor: 'grab', touchAction: 'none' }}
        >
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#d5dbe3' }} />
        </div>

        {/* 搜索 */}
        <div style={{ padding: '14px 16px 12px' }}>
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
                    {/* 另一侧正在用的币：点它会直接把两侧对调，这里先给个暗示 */}
                    {t.symbol === otherSymbol && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c0c8d2"
                           strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M7 4v13" /><path d="M4 14l3 3 3-3" />
                        <path d="M17 20V7" /><path d="M14 10l3-3 3 3" />
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
