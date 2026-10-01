import { describe, it, expect } from 'vitest';
import {
  SHEET_DISMISS_DISTANCE_RATIO,
  SHEET_HEIGHT_FALLBACK_PX,
  backdropOpacity,
  clampDragY,
  dismissDurationMs,
  isHorizontalGesture,
  resolveSheetHeight,
  shouldDismissSheet,
} from './sheetGesture';

describe('sheetGesture', () => {
  it('limita o arrasto a valores não negativos', () => {
    expect(clampDragY(-40)).toBe(0);
    expect(clampDragY(0)).toBe(0);
    expect(clampDragY(80)).toBe(80);
  });

  it('usa a altura medida e cai para o fallback quando é zero', () => {
    expect(resolveSheetHeight(480)).toBe(480);
    expect(resolveSheetHeight(0)).toBe(SHEET_HEIGHT_FALLBACK_PX);
    expect(resolveSheetHeight(-1)).toBe(SHEET_HEIGHT_FALLBACK_PX);
  });

  it('reduz a opacidade do backdrop em proporção ao arrasto', () => {
    expect(backdropOpacity(0, 400)).toBe(1);
    expect(backdropOpacity(80, 400)).toBeCloseTo(0.8);
    expect(backdropOpacity(400, 400)).toBe(0);
    expect(backdropOpacity(520, 400)).toBe(0);
  });

  it('fecha quando a distância passa cerca de 28% da altura', () => {
    const height = 400;
    const limit = height * SHEET_DISMISS_DISTANCE_RATIO;
    expect(shouldDismissSheet({ dragY: limit - 1, sheetHeight: height, velocityY: 0 })).toBe(false);
    expect(shouldDismissSheet({ dragY: limit, sheetHeight: height, velocityY: 0 })).toBe(true);
  });

  it('fecha num flick para baixo mesmo com pouca distância', () => {
    expect(shouldDismissSheet({ dragY: 24, sheetHeight: 400, velocityY: 0.75 })).toBe(true);
    expect(shouldDismissSheet({ dragY: 23, sheetHeight: 400, velocityY: 2 })).toBe(false);
    expect(shouldDismissSheet({ dragY: 40, sheetHeight: 400, velocityY: 0.74 })).toBe(false);
  });

  it('não trata um swipe horizontal como dismiss', () => {
    expect(isHorizontalGesture(48, 12)).toBe(true);
    expect(isHorizontalGesture(12, 48)).toBe(false);
    expect(isHorizontalGesture(6, 4)).toBe(false);
  });

  it('encurta a animação de fecho com a velocidade e respeita o intervalo', () => {
    const slow = dismissDurationMs({ dragY: 100, sheetHeight: 400, velocityY: 0.1 });
    const fast = dismissDurationMs({ dragY: 100, sheetHeight: 400, velocityY: 3 });
    expect(slow).toBeGreaterThan(fast);
    expect(slow).toBeLessThanOrEqual(420);
    expect(fast).toBeGreaterThanOrEqual(180);
    expect(dismissDurationMs({
      dragY: 100,
      sheetHeight: 400,
      velocityY: 2,
      reducedMotion: true,
    })).toBe(0);
  });
});
