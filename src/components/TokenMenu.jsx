import React from 'react';

/* ============================================================
   🪙 TokenMenu — 闪兑面板的代币菜单
   两侧胶囊共用一份：调用方把「这一侧能换成什么」算好传进来
   （items: { symbol, icon, meta, selected }），这里只负责画。
   之前 meta 文案按 mode 在组件里分支，UFO 混进来之后那种写法
   会把稳定币的报价贴到 UFO 上去，所以改成由调用方给。
   ============================================================ */

const UfoMark = ({ size = 20 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M 25 52 C 25 15, 75 15, 75 52 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="5" />
    <ellipse cx="50" cy="55" rx="45" ry="16" fill="#3b82f6" />
    <circle cx="35" cy="55" r="4.5" fill="#fff" />
    <circle cx="50" cy="57" r="4.5" fill="#fff" />
    <circle cx="65" cy="55" r="4.5" fill="#fff" />
  </svg>
);

export default function TokenMenu({ items = [], align = 'left', onSelect, onClose }) {
  return (
    <>
      {/* 全屏透明层：点页面任意位置关闭菜单，避免菜单挡住下方区域后无法操作 */}
      <div
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent' }}
      />

      <div
        style={{
          position: 'absolute',
          top: '100%',
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
          marginTop: '10px',
          minWidth: '208px',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 16px 40px -12px rgba(16,24,40,0.28)',
          border: '1px solid #eef2f6',
          zIndex: 100,
          overflow: 'hidden',
        }}
      >
        {items.map((it) => (
          <div
            key={it.symbol}
            onClick={(e) => { e.stopPropagation(); onSelect(it); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              padding: '12px 14px',
              cursor: 'pointer',
              background: it.selected ? '#f6f8fa' : '#fff',
              borderBottom: '1px solid #f4f6f8',
            }}
          >
            {it.icon === 'UFO'
              ? <UfoMark size={20} />
              : <img src={it.icon} style={{ width: 20, height: 20, borderRadius: '50%' }} alt="" />}
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{it.symbol}</span>
            <span
              style={{
                fontSize: '11.5px',
                marginLeft: 'auto',
                fontWeight: 600,
                color: it.selected ? '#38bdf8' : '#98a2b3',
              }}
            >
              {it.selected ? 'Selected' : it.meta}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
