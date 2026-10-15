import { useLayoutEffect, useState } from 'react';
import {
  GEOCODER_SHEET_BOUNDARY_SELECTOR,
  GEOCODER_SHEET_HEADER_SELECTOR,
} from '../utils/geocoderDismissChrome.js';

const DEFAULT_LIST_MAX = 240;
const MIN_LIST_MAX = 64;
const VIEWPORT_MARGIN = 16;
const GAP_BELOW_INPUT = 8;
/** Rodapé «Powered by OpenStreetMap» + bordas do painel. */
const PANEL_CHROME_BELOW_LIST = 44;

/**
 * Posição fixed do painel de sugestões — **sempre abaixo** do campo e **dentro** do sheet (abaixo do header).
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
      let top = rect.bottom + GAP_BELOW_INPUT;
      let maxBottom = window.innerHeight - VIEWPORT_MARGIN;

      const sheet = el.closest(GEOCODER_SHEET_BOUNDARY_SELECTOR);
      if (sheet instanceof HTMLElement) {
        const sheetRect = sheet.getBoundingClientRect();
        const header = sheet.querySelector(GEOCODER_SHEET_HEADER_SELECTOR);
        const headerRect =
          header instanceof HTMLElement ? header.getBoundingClientRect() : null;
        const floorTop = Math.max(
          sheetRect.top,
          headerRect ? headerRect.bottom + GAP_BELOW_INPUT : sheetRect.top,
        );
        top = Math.max(top, floorTop);
        maxBottom = Math.min(maxBottom, sheetRect.bottom - VIEWPORT_MARGIN);
      } else {
        const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
        maxBottom = rect.bottom + GAP_BELOW_INPUT + spaceBelow;
      }

      const maxPanelHeight = Math.max(
        MIN_LIST_MAX + PANEL_CHROME_BELOW_LIST,
        maxBottom - top,
      );
      const maxListHeight = Math.min(
        DEFAULT_LIST_MAX,
        Math.max(MIN_LIST_MAX, maxPanelHeight - PANEL_CHROME_BELOW_LIST),
      );

      setLayout({
        maxListHeight,
        style: {
          position: 'fixed',
          left: rect.left,
          width: rect.width,
          top,
          zIndex: 61,
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
