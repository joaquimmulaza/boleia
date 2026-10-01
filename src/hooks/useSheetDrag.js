import { useEffect, useRef } from 'react';
import {
  SHEET_SNAP_EASING,
  SHEET_SNAP_MS,
  SHEET_DISMISS_EASING,
  backdropOpacity,
  clampDragY,
  dismissDurationMs,
  isHorizontalGesture,
  passedAxisLock,
  readTranslateY,
  resolveSheetHeight,
  shouldDismissSheet,
} from '../utils/sheetGesture';

const INTERACTIVE_SELECTOR = 'input, textarea, select, button, a, [contenteditable="true"], [contenteditable=""]';

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function isScrollableY(el) {
  const overflowY = getComputedStyle(el).overflowY;
  if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return true;
  const className = el.className;
  if (typeof className !== 'string') return false;
  return /\boverflow(?:-y)?-(?:auto|scroll)\b/.test(className);
}

/**
 * @param {EventTarget | null} target
 * @param {HTMLElement} boundary
 * @returns {boolean}
 */
function canScrollUpFrom(target, boundary) {
  let node = target instanceof Element ? target : null;
  while (node) {
    if (isScrollableY(node) && node.scrollTop > 0) return true;
    if (node === boundary) break;
    node = node.parentElement;
  }
  return false;
}

/**
 * @returns {boolean}
 */
function prefersReducedMotion() {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * @param {Event} event
 * @returns {number}
 */
function eventTime(event) {
  if (typeof event.timeStamp === 'number' && event.timeStamp > 0) return event.timeStamp;
  return performance.now();
}

/**
 * Drag-to-dismiss de um bottom sheet. Actualiza transform/opacidade no DOM,
 * sem setState durante o gesto. O fecho chama o mesmo `onDismiss` do shell.
 * @param {{ enabled: boolean, onDismiss?: () => void }} options
 */
export function useSheetDrag({ enabled, onDismiss }) {
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const backdropRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!enabled || !panel) return undefined;

    const drag = {
      pointerId: /** @type {number | null} */ (null),
      startX: 0,
      startY: 0,
      lastY: 0,
      lastT: 0,
      velocity: 0,
      y: 0,
      offsetY: 0,
      height: 0,
      origin: /** @type {EventTarget | null} */ (null),
      mode: /** @type {'pending' | 'drag' | 'scroll' | 'horizontal' | null} */ (null),
    };

    let unmounted = false;
    let dismissing = false;
    let epoch = 0;
    let blockClick = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let blockTimer = null;
    /** @type {Animation | null} */
    let activeAnim = null;
    /** @type {Animation | null} */
    let backdropAnim = null;

    const visibleTranslateY = () => {
      const computed = readTranslateY(getComputedStyle(panel).transform);
      if (computed !== 0) return clampDragY(computed);
      return clampDragY(readTranslateY(panel.style.transform));
    };

    const apply = (y) => {
      panel.style.transform = `translate3d(0, ${y}px, 0)`;
      if (backdrop) backdrop.style.opacity = String(backdropOpacity(y, drag.height));
    };

    const resetVisual = () => {
      panel.style.transform = '';
      panel.style.willChange = '';
      panel.style.userSelect = '';
      if (backdrop) backdrop.style.opacity = '';
    };

    const cancelAnim = () => {
      epoch += 1;
      if (activeAnim) {
        activeAnim.cancel();
        activeAnim = null;
      }
      if (backdropAnim) {
        backdropAnim.cancel();
        backdropAnim = null;
      }
    };

    /**
     * @param {number} toY
     * @param {number} duration
     * @param {string} easing
     * @param {() => void} done
     */
    const animateTo = (toY, duration, easing, done) => {
      cancelAnim();
      const token = epoch;
      const fromY = drag.y;
      const fromOpacity = backdropOpacity(fromY, drag.height);
      const toOpacity = backdropOpacity(toY, drag.height);
      let settled = false;

      const finish = () => {
        if (settled || unmounted || token !== epoch) return;
        settled = true;
        drag.y = toY;
        if (toY === 0) resetVisual();
        else apply(toY);
        done();
      };

      if (duration <= 0 || typeof panel.animate !== 'function') {
        finish();
        return;
      }

      const panelAnim = panel.animate(
        [
          { transform: `translate3d(0, ${fromY}px, 0)` },
          { transform: `translate3d(0, ${toY}px, 0)` },
        ],
        { duration, easing, fill: 'forwards' },
      );
      activeAnim = panelAnim;

      if (backdrop && typeof backdrop.animate === 'function') {
        backdropAnim = backdrop.animate(
          [{ opacity: fromOpacity }, { opacity: toOpacity }],
          { duration, easing, fill: 'forwards' },
        );
      }

      panelAnim.onfinish = () => {
        if (settled || token !== epoch) return;
        settled = true;
        activeAnim = null;
        drag.y = toY;
        if (toY === 0) resetVisual();
        else apply(toY);
        try {
          backdropAnim?.cancel();
        } catch {
          /* animação já terminada */
        }
        backdropAnim = null;
        try {
          panelAnim.cancel();
        } catch {
          /* animação já terminada */
        }
        if (unmounted || token !== epoch) return;
        done();
      };
      panelAnim.oncancel = () => {
        if (activeAnim === panelAnim) activeAnim = null;
      };
      if (panelAnim.playState === 'finished') panelAnim.onfinish?.();
    };

    const finishDismiss = () => {
      if (unmounted || dismissing) return;
      dismissing = true;
      onDismissRef.current?.();
    };

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @param {number} time
     */
    const track = (clientX, clientY, time) => {
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      const dt = time - drag.lastT;
      if (dt >= 8) {
        drag.velocity = (clientY - drag.lastY) / dt;
        drag.lastY = clientY;
        drag.lastT = time;
      }

      if (drag.mode === 'pending') {
        if (!passedAxisLock(dx, dy)) return;
        if (isHorizontalGesture(dx, dy)) {
          drag.mode = 'horizontal';
          return;
        }
        const pullingContent = dy < 0 && drag.offsetY <= 0;
        if (pullingContent || canScrollUpFrom(drag.origin, panel)) {
          drag.mode = 'scroll';
          return;
        }
        drag.mode = 'drag';
        blockClick = true;
        panel.style.willChange = 'transform';
        panel.style.userSelect = 'none';
        try {
          panel.setPointerCapture(/** @type {number} */ (drag.pointerId));
        } catch {
          /* happy-dom / ponteiro já libertado */
        }
      }

      if (drag.mode !== 'drag') return;
      const y = clampDragY(drag.offsetY + dy);
      drag.y = y;
      apply(y);
    };

    /** @param {PointerEvent} event */
    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      if (drag.pointerId != null) return;
      if (isInteractiveTarget(event.target)) return;
      const visibleY = visibleTranslateY();
      cancelAnim();
      drag.offsetY = visibleY;
      drag.y = visibleY;
      if (visibleY > 0) apply(visibleY);
      drag.pointerId = event.pointerId;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      drag.lastY = event.clientY;
      drag.lastT = eventTime(event);
      drag.velocity = 0;
      drag.height = resolveSheetHeight(panel.getBoundingClientRect().height);
      drag.origin = event.target;
      drag.mode = 'pending';
      blockClick = false;
    };

    /** @param {PointerEvent} event */
    const onPointerMove = (event) => {
      if (drag.pointerId == null || event.pointerId !== drag.pointerId) return;
      track(event.clientX, event.clientY, eventTime(event));
      if (drag.mode === 'drag' && event.cancelable) event.preventDefault();
    };

    /**
     * @param {PointerEvent} event
     * @param {boolean} cancelled
     */
    const endPointer = (event, cancelled) => {
      if (drag.pointerId == null || event.pointerId !== drag.pointerId) return;
      const mode = drag.mode;
      const y = drag.y;
      const velocity = drag.velocity;
      const height = drag.height;
      try {
        if (typeof panel.hasPointerCapture === 'function' && panel.hasPointerCapture(event.pointerId)) {
          panel.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* já libertado */
      }
      drag.pointerId = null;
      drag.mode = null;
      drag.origin = null;

      if (blockClick) {
        if (blockTimer != null) clearTimeout(blockTimer);
        blockTimer = setTimeout(() => {
          blockClick = false;
          blockTimer = null;
        }, 0);
      }

      if (cancelled || mode !== 'drag' || y <= 0) {
        if (y > 0) {
          animateTo(0, prefersReducedMotion() ? 0 : SHEET_SNAP_MS, SHEET_SNAP_EASING, () => {});
        }
        return;
      }

      if (shouldDismissSheet({ dragY: y, sheetHeight: height, velocityY: Math.max(0, velocity) })) {
        const duration = dismissDurationMs({
          dragY: y,
          sheetHeight: height,
          velocityY: Math.max(0, velocity),
          reducedMotion: prefersReducedMotion(),
        });
        animateTo(height, duration, SHEET_DISMISS_EASING, finishDismiss);
        return;
      }

      animateTo(0, prefersReducedMotion() ? 0 : SHEET_SNAP_MS, SHEET_SNAP_EASING, () => {});
    };

    /** @param {PointerEvent} event */
    const onPointerUp = (event) => endPointer(event, false);

    /** @param {PointerEvent} event */
    const onPointerCancel = (event) => endPointer(event, true);

    /** @param {TouchEvent} event */
    const onTouchMove = (event) => {
      if (drag.pointerId == null || drag.mode === 'horizontal' || drag.mode === 'scroll') return;
      const touch = event.touches[0];
      if (!touch) return;
      const dy = touch.clientY - drag.startY;
      const dx = touch.clientX - drag.startX;
      if (drag.mode === 'drag') {
        if (event.cancelable) event.preventDefault();
        return;
      }
      if (drag.mode !== 'pending') return;
      if (!passedAxisLock(dx, dy)) return;
      const pullingContent = dy < 0 && drag.offsetY <= 0;
      if (isHorizontalGesture(dx, dy) || pullingContent || canScrollUpFrom(drag.origin, panel)) return;
      if (event.cancelable) event.preventDefault();
    };

    /** @param {MouseEvent} event */
    const onClickCapture = (event) => {
      if (!blockClick) return;
      blockClick = false;
      event.preventDefault();
      event.stopPropagation();
    };

    panel.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('click', onClickCapture, true);

    return () => {
      unmounted = true;
      if (blockTimer != null) clearTimeout(blockTimer);
      cancelAnim();
      if (!dismissing) resetVisual();
      panel.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('click', onClickCapture, true);
    };
  }, [enabled]);

  return { panelRef, backdropRef };
}
