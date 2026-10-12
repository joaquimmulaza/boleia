import { useLayoutEffect, useState } from 'react';

const DEFAULT_MAX = 240;
const MIN_MAX = 120;
const VIEWPORT_MARGIN = 16;

/**
 * Posição fixed do painel de sugestões para não ser cortado por overflow do sheet.
 * @param {React.RefObject<HTMLElement | null>} anchorRef
 * @param {boolean} open
 * @returns {{ style: import('react').CSSProperties, maxListHeight: number } | null}
 */
export function useFloatingGeocoderPanel(anchorRef, open) {
  const [layout, setLayout] = useState(/** @type {null | { style: import('react').CSSProperties, maxListHeight: number }} */ (null));

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    const anchor = anchorRef.current;
    if (!anchor || typeof window === 'undefined') {
      return undefined;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - VIEWPORT_MARGIN;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;
      const maxListHeight = Math.min(
        DEFAULT_MAX,
        Math.max(MIN_MAX, available - 48),
      );

      const top = openUp ? rect.top - 8 : rect.bottom + 8;
      setLayout({
        maxListHeight,
        style: {
          position: 'fixed',
          left: rect.left,
          width: rect.width,
          top,
          transform: openUp ? 'translateY(-100%)' : undefined,
          zIndex: 80,
        },
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      setLayout(null);
    };
  }, [anchorRef, open]);

  return open ? layout : null;
}
