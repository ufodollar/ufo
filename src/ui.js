// ============================================================================
// 统一的按钮语言
// ----------------------------------------------------------------------------
// 全站只保留一种按钮：与顶部 Account 按钮同款 —— 天蓝渐变、白字、圆角、轻投影。
// 之前每个弹层、每个列表行都自带一套按钮样式（深蓝实心、白底描边、透明文字、
// 灰底禁用…），同一屏里能出现四种"可点"的观感，用户分不清哪个是主操作。
//
// 这里只描述几何与配色，不描述语义：语义靠文案（Send / Delete / Cancel）表达，
// 而不是靠"红色=危险"这种每个页面各自解释一遍的约定。次级动作仍有区分 ——
// 用 soft（白底 + 天蓝字 + 天蓝描边）而不是灰字透明底，保证两者都像按钮。
// ============================================================================

const SKY_FROM = '#5CCBEC';
const SKY_TO = '#38BDF8';
export const SKY_GRADIENT = `linear-gradient(180deg, ${SKY_FROM} 0%, ${SKY_TO} 100%)`;
export const SKY_SHADOW = '0 5px 14px -4px rgba(56,189,248,0.75)';

const SIZES = {
  xs: { height: '28px', padding: '0 10px', fontSize: '11px', radius: '9px' },
  sm: { height: '34px', padding: '0 13px', fontSize: '12px', radius: '11px' },
  md: { height: '42px', padding: '0 16px', fontSize: '13px', radius: '13px' },
  lg: { height: '54px', padding: '0 20px', fontSize: '16px', radius: '16px' }
};

/**
 * @param {'xs'|'sm'|'md'|'lg'} size
 * @param {boolean} block  撑满一行（表单主操作、列表底部的按钮）
 * @param {boolean} soft   次级动作：白底、天蓝字、天蓝描边
 * @param {boolean} disabled
 */
export function skyBtn(size = 'md', { block = false, soft = false, disabled = false } = {}) {
  const s = SIZES[size] || SIZES.md;
  return {
    appearance: 'none',
    WebkitAppearance: 'none',
    font: 'inherit',
    display: block ? 'flex' : 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    flexShrink: 0,
    width: block ? '100%' : undefined,
    height: s.height,
    padding: s.padding,
    borderRadius: s.radius,
    border: soft ? '1px solid rgba(56,189,248,0.5)' : 'none',
    background: soft ? '#fff' : SKY_GRADIENT,
    color: soft ? '#0B7CC1' : '#fff',
    fontSize: s.fontSize,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    boxShadow: disabled || soft ? 'none' : SKY_SHADOW,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    // iOS 上按钮默认有 300ms 点击延迟，触摸反馈也会被系统高亮覆盖；
    // 这个属性不会影响桌面的 hover / focus 行为。
    touchAction: 'manipulation'
  };
}

/** 和按钮同款配色的链接（BscScan 这类外链） */
export function skyLink(size = 'sm') {
  const s = SIZES[size] || SIZES.sm;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    flexShrink: 0,
    height: s.height,
    padding: `0 ${s.padding.split(' ')[1]}`,
    borderRadius: s.radius,
    background: SKY_GRADIENT,
    color: '#fff',
    fontSize: s.fontSize,
    fontWeight: 700,
    lineHeight: 1,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    boxShadow: SKY_SHADOW
  };
}
