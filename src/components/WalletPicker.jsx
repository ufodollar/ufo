import React, { useState, useEffect, useMemo } from 'react';
import { walletList, openInWallet, isMobile, currentUrl } from '../wallets';

const FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif' };

/**
 * 钱包选择面板。
 *
 * 移动端：10 个钱包图标墙，点了直接跳进该 App 的内置浏览器，
 *        落地时页面里已有注入，自动就是已连接状态 —— 没有二维码、没有配对。
 * 桌面端：优先列出 EIP-6963 发现到的扩展（一列，图标+名字），
 *        一个扩展都没有时才给二维码，让用户用手机接着走上面的流程。
 */
export default function WalletPicker({ open, onClose, injectedWallets, onPick, busy, error }) {
  const [opening, setOpening] = useState('');
  const mobile = useMemo(() => isMobile(), []);
  const wallets = useMemo(() => walletList(), []);

  useEffect(() => {
    if (!open) { setOpening(''); return; }
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleApp = (wallet) => {
    setOpening(wallet.name);
    openInWallet(wallet);
  };

  const hasExt = !!(injectedWallets && injectedWallets.length);
  const showWall = mobile;            // 手机：钱包墙，点了进 App 内置浏览器
  const showExt = !mobile && hasExt;  // 桌面有扩展：列出来，点一下直连
  const showQR = !mobile && !hasExt;  // 桌面什么都没有：扫码去手机

  const subtitle = mobile
    ? 'Opens inside the wallet’s own browser — already connected.'
    : hasExt
      ? 'Choose an installed browser wallet.'
      : 'No browser wallet found on this device.';

  return (
    <div
      onClick={onClose}
      style={{ ...FONT, position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)',
               display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center',
               padding: mobile ? 0 : '20px', WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', width: '100%', maxWidth: mobile ? '100%' : '420px',
          borderRadius: mobile ? '24px 24px 0 0' : '24px',
          padding: '22px 20px calc(22px + env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 40px rgba(15,23,42,0.18)',
          maxHeight: mobile ? '88vh' : '84vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'ufoSheetIn .22s ease-out'
        }}
      >
        <style>{`@keyframes ufoSheetIn{from{transform:translateY(18px);opacity:.6}to{transform:none;opacity:1}}`}</style>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px' }}>Connect a wallet</div>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '5px', lineHeight: 1.5 }}>
              {subtitle}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', flexShrink: 0,
                     width: '30px', height: '30px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                     background: '#f1f5f9', color: '#64748b', fontSize: '16px', lineHeight: '30px', padding: 0 }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: '#fef2f2',
                        border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {opening && (
          <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: '#eff6ff',
                        border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: '12px', fontWeight: '600' }}>
            Opening {opening}… If nothing happens, it isn’t installed.
          </div>
        )}

        {/* 桌面端：已安装的扩展优先，点一下直接连 */}
        {showExt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '18px' }}>
            {injectedWallets.map(({ info, provider }) => (
              <button
                key={info.uuid}
                onClick={() => onPick(provider)}
                disabled={busy}
                style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', display: 'flex', alignItems: 'center',
                         gap: '12px', width: '100%', textAlign: 'left', padding: '12px 14px', minHeight: '56px',
                         background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px',
                         cursor: busy ? 'wait' : 'pointer', color: '#1e293b' }}
              >
                {info.icon
                  ? <img src={info.icon} alt="" width="32" height="32" style={{ width: 32, height: 32, borderRadius: '8px', display: 'block' }} />
                  : <span style={{ width: 32, height: 32, borderRadius: '8px', background: '#e2e8f0', display: 'inline-block' }} />}
                <span style={{ fontSize: '14px', fontWeight: '600', flex: 1 }}>{info.name}</span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Installed</span>
              </button>
            ))}
          </div>
        )}

        {/* 移动端：钱包墙 */}
        {showWall && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginTop: '18px' }}>
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => handleApp(w)}
                style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
                         display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
                         width: 'calc(33.333% - 6px)', maxWidth: '104px', padding: '12px 4px 10px',
                         background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: '16px',
                         cursor: 'pointer', color: 'inherit' }}
              >
                <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#fff',
                               display: 'flex', alignItems: 'center', justifyContent: 'center',
                               boxShadow: '0 1px 3px rgba(15,23,42,0.08)' }}>
                  <img src={w.icon} alt="" width="34" height="34" style={{ width: 34, height: 34, borderRadius: '9px', display: 'block' }} />
                </span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', lineHeight: 1.25, textAlign: 'center' }}>
                  {w.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* 桌面且一个扩展都没有：二维码兜底 */}
        {showQR && (
          <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <img src="/qr.png" alt="Scan to open on your phone" width="150" height="150"
                 style={{ display: 'block', margin: '0 auto 10px', borderRadius: '10px' }} />
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
              Scan with your phone camera, then tap Connect and pick a wallet.
            </div>
          </div>
        )}

        <button
          onClick={() => {
            const url = currentUrl();
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url).then(() => setOpening(''), () => {});
            }
          }}
          style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit', width: '100%', marginTop: '16px',
                   padding: '12px', background: '#fff', border: '1px solid #dbeafe', color: '#1d4ed8',
                   borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
        >
          Copy link
        </button>
      </div>
    </div>
  );
}
