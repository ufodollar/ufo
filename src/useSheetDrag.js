import { useEffect, useRef, useState } from 'react';

// ============================================================================
// 底部弹层的「任意位置下拉关闭」
// ----------------------------------------------------------------------------
// 以前只有顶部那道凹槽能拖。手指要精确按到 40×14px 的区域，误触率很高；
// 用户实际会按住列表、按住空白处往下拉 —— 那些位置以前毫无反应。
//
// 这里的规则是「整张面板都是把手，但滚动优先」：
//   · 面板内任何一个可滚动区域只要没滚到顶，这一下手势就是滚动，不接管；
//   · 滚到顶之后继续往下拖，面板跟着手指走，超过 90px 松手就关；
//   · 位移小于 6px 视为点击，不干扰按钮、输入框。
//
// 为什么用 touch 事件而不是 pointer：pointer 在滚动开始后会被浏览器
// 取消（pointercancel），拿不到后半段位移；touchmove 才能用
// preventDefault 把「滚动」改成「拖拽」。桌面鼠标单独用 pointer 补一份。
// ============================================================================

const CLOSE_PX = 90;
const START_PX = 6;

/** 从手指按下的位置向上找，找到第一个真的能滚的容器 */
function findScroller(node, root) {
  let n = node;
  while (n) {
    if (n.nodeType === 1 && n.scrollHeight - n.clientHeight > 4) {
      const oy = getComputedStyle(n).overflowY;
      if (oy === 'auto' || oy === 'scroll') return n;
    }
    if (n === root) break;      // 面板自身也能滚（发送面板就是这样）
    n = n.parentElement;
  }
  return null;
}

/** 拖完松手时浏览器还会补一次 click，落到原来的按钮上就会误触 */
let blockNextClick = false;
function suppressClick() {
  blockNextClick = true;
  setTimeout(() => { blockNextClick = false; }, 350);
}

export function useSheetDrag(onClose, enabled = true) {
  const ref = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;

    let st = null;

    const begin = (y, target) => {
      const sc = findScroller(target, el);
      st = { y, dy: 0, sc, active: false, fromTop: !sc || sc.scrollTop <= 0 };
    };

    const moveTo = (y, prevent) => {
      if (!st) return;
      const dy = y - st.y;
      if (!st.active) {
        if (dy <= START_PX) return;
        // 列表没停在顶部：这是滚动，交还给浏览器
        if (!st.fromTop || (st.sc && st.sc.scrollTop > 0)) { st = null; return; }
        st.active = true;
        setDragging(true);
      }
      if (dy > 0) {
        if (prevent) prevent();
        st.dy = dy;
        setDragY(dy);
      }
    };

    const finish = () => {
      if (!st) return;
      const wasActive = st.active;
      const dy = st.dy;
      st = null;
      setDragging(false);
      setDragY(0);
      if (!wasActive) return;
      suppressClick();
      if (dy > CLOSE_PX && closeRef.current) closeRef.current();
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      begin(e.touches[0].clientY, e.target);
    };
    const onTouchMove = (e) => {
      if (!st || e.touches.length !== 1) return;
      moveTo(e.touches[0].clientY, () => e.preventDefault());
    };

    const onPointerDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      begin(e.clientY, e.target);
    };
    const onPointerMove = (e) => {
      if (!st || e.pointerType !== 'mouse') return;
      moveTo(e.clientY, () => e.preventDefault());
    };
    const onPointerUp = (e) => {
      if (!st || e.pointerType !== 'mouse') return;
      finish();
    };

    const onClickCapture = (e) => {
      if (!blockNextClick) return;
      blockNextClick = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', finish);
    el.addEventListener('touchcancel', finish);
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('click', onClickCapture, true);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', finish);
      el.removeEventListener('touchcancel', finish);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('click', onClickCapture, true);
    };
  }, [enabled]);

  return { ref, dragY, dragging };
}
