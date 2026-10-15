import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFloatingGeocoderPanel } from './useFloatingGeocoderPanel';

describe('useFloatingGeocoderPanel', () => {
  it('abre sempre abaixo do campo (sem flip para cima)', async () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({
      top: 120,
      bottom: 176,
      left: 16,
      width: 358,
      right: 374,
      height: 56,
      x: 16,
      y: 120,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });

    const ref = { current: anchor };
    const { result, rerender } = renderHook(
      ({ open }) => useFloatingGeocoderPanel(ref, open),
      { initialProps: { open: false } },
    );

    rerender({ open: true });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.style.top).toBe(184);
    expect(result.current?.style.transform).toBeUndefined();
    expect(result.current?.maxListHeight).toBeLessThanOrEqual(240);

    document.body.removeChild(anchor);
  });

  it('limita maxListHeight ao espaço abaixo do campo', async () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    anchor.getBoundingClientRect = () => ({
      top: 700,
      bottom: 756,
      left: 16,
      width: 358,
      right: 374,
      height: 56,
      x: 16,
      y: 700,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const ref = { current: anchor };
    const { result, rerender } = renderHook(
      ({ open }) => useFloatingGeocoderPanel(ref, open),
      { initialProps: { open: false } },
    );

    rerender({ open: true });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.maxListHeight).toBeLessThan(120);

    document.body.removeChild(anchor);
  });

  it('não posiciona a lista acima do header do sheet', async () => {
    const sheet = document.createElement('div');
    sheet.setAttribute('data-geocoder-sheet-boundary', '');
    const header = document.createElement('div');
    header.setAttribute('data-geocoder-sheet-header', '');
    sheet.appendChild(header);
    const anchor = document.createElement('div');
    sheet.appendChild(anchor);
    document.body.appendChild(sheet);

    header.getBoundingClientRect = () => ({
      top: 100,
      bottom: 160,
      left: 0,
      width: 390,
      right: 390,
      height: 60,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    sheet.getBoundingClientRect = () => ({
      top: 80,
      bottom: 800,
      left: 0,
      width: 390,
      right: 390,
      height: 720,
      x: 0,
      y: 80,
      toJSON: () => ({}),
    });
    anchor.getBoundingClientRect = () => ({
      top: 120,
      bottom: 176,
      left: 16,
      width: 358,
      right: 374,
      height: 56,
      x: 16,
      y: 120,
      toJSON: () => ({}),
    });

    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });

    const ref = { current: anchor };
    const { result, rerender } = renderHook(
      ({ open }) => useFloatingGeocoderPanel(ref, open),
      { initialProps: { open: false } },
    );

    rerender({ open: true });

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current?.style.top).toBeGreaterThanOrEqual(168);
    expect(result.current?.style.transform).toBeUndefined();

    document.body.removeChild(sheet);
  });
});
