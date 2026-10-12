import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFloatingGeocoderPanel } from './useFloatingGeocoderPanel';

describe('useFloatingGeocoderPanel', () => {
  it('devolve layout fixed quando aberto', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({
      top: 400,
      bottom: 456,
      left: 16,
      width: 358,
      right: 374,
      height: 56,
      x: 16,
      y: 400,
      toJSON: () => ({}),
    });

    const ref = { current: anchor };
    const { result, rerender } = renderHook(
      ({ open }) => useFloatingGeocoderPanel(ref, open),
      { initialProps: { open: false } },
    );

    expect(result.current).toBeNull();

    rerender({ open: true });

    expect(result.current).not.toBeNull();
    expect(result.current?.style.position).toBe('fixed');
    expect(result.current?.maxListHeight).toBeGreaterThanOrEqual(120);

    document.body.removeChild(anchor);
  });
});
