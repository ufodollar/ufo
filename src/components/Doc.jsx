import React from 'react';

/* ============================================================
   📄 Doc — 条款体排版组件（Guide / Rules 共用）
   用途：把说明文字写成可逐条引用的条款，而不是宣传段落
   - SecTitle  节标题（编号 + 细线）
   - Cl        条款行（悬挂编号 1.1 / 1.2）
   - DefTable  口径表（左术语 / 右取值）
   - Note      脚注块（法律、例外、交叉引用）
   ============================================================ */

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export const SecTitle = ({ n, children }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '10px',
      paddingBottom: '9px',
      borderBottom: '1px solid rgba(255,255,255,0.30)',
      marginBottom: '4px',
    }}
  >
    <span
      style={{
        fontFamily: MONO,
        fontSize: '11px',
        letterSpacing: '1.2px',
        opacity: 0.72,
      }}
    >
      {n}
    </span>
    <span style={{ fontSize: '15.5px', fontWeight: 800, letterSpacing: '-0.1px' }}>
      {children}
    </span>
  </div>
);

export const Cl = ({ n, children }) => (
  <div style={{ display: 'flex', gap: '10px', marginTop: '11px' }}>
    <span
      style={{
        fontFamily: MONO,
        fontSize: '11.5px',
        lineHeight: 1.9,
        opacity: 0.62,
        flexShrink: 0,
        minWidth: '24px',
      }}
    >
      {n}
    </span>
    <p
      style={{
        margin: 0,
        fontSize: '13.5px',
        lineHeight: 1.72,
        color: 'rgba(255,255,255,0.93)',
      }}
    >
      {children}
    </p>
  </div>
);

export const DefTable = ({ rows }) => (
  <div
    style={{
      marginTop: '15px',
      background: 'rgba(255,255,255,0.10)',
      border: '1px solid rgba(255,255,255,0.22)',
      borderRadius: '14px',
      padding: '2px 14px',
    }}
  >
    {rows.map(([k, v], i) => (
      <div
        key={k}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '16px',
          padding: '9px 0',
          borderBottom:
            i === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.15)',
          fontSize: '12.8px',
          lineHeight: 1.5,
        }}
      >
        <span style={{ opacity: 0.74, flexShrink: 0 }}>{k}</span>
        <span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
      </div>
    ))}
  </div>
);

export const Note = ({ children }) => (
  <div
    style={{
      marginTop: '16px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(255,255,255,0.26)',
      fontSize: '12.4px',
      lineHeight: 1.7,
      color: 'rgba(255,255,255,0.86)',
    }}
  >
    {children}
  </div>
);
