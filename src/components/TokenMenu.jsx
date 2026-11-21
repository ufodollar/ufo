import React from 'react';

/* ============================================================
   🪙 TokenMenu — 兑换页的代币下拉菜单
   买/卖两侧原本各抄了一份几乎相同的 JSX，其中一份还会在
   vaultBalances 缺字段时直接 .toFixed() 抛错。这里合并成一处，
   差异只有右侧那一列：买入显示稳定币报价，卖出显示池内可用量。
   ============================================================ */
export default function TokenMenu({ coins, prices, vaultBalances, mode, onSelect, onClose }) {
  return (
    <>
      {/* 全屏透明层：点页面任意位置关闭菜单，避免菜单挡住下方区域后无法操作 */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent' }}
      />

      <div
        style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          minWidth: '190px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          zIndex: 100,
          overflow: 'hidden',
        }}
      >
        {coins.map((coin) => {
          const price = prices ? prices[coin.symbol] : null;
          const failed = !!(prices && prices.errors && prices.errors.some((e) => e.token === coin.symbol));
          const pool = (vaultBalances && vaultBalances[coin.symbol]) || 0;

          const meta =
            mode === 'buy'
              ? failed
                ? 'Feed down · $1.00'
                : price
                  ? `≈ $${price.priceFloat.toFixed(4)}`
                  : '—'
              : `Vault ${pool.toFixed(2)}`;

          return (
            <div
              key={coin.symbol}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(coin);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <img src={coin.icon} style={{ width: 20, height: 20 }} alt={coin.symbol} />
              <span style={{ fontSize: '14px', color: '#1e293b' }}>{coin.symbol}</span>
              <span
                style={{
                  fontSize: '11px',
                  marginLeft: 'auto',
                  color: failed ? '#ef4444' : '#94a3b8',
                }}
              >
                {meta}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
