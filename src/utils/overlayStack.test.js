import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushOverlay,
  popOverlay,
  getTopOverlay,
  resetOverlayStackForTests,
} from './overlayStack.js';

describe('overlayStack', () => {
  beforeEach(() => {
    resetOverlayStackForTests();
  });

  it('getTopOverlay devolve o último registado', () => {
    pushOverlay('a', () => {});
    pushOverlay('b', () => {});
    expect(getTopOverlay()?.id).toBe('b');
  });

  it('popOverlay remove pelo id sem afectar outros', () => {
    pushOverlay('a', () => {});
    pushOverlay('b', () => {});
    popOverlay('a');
    expect(getTopOverlay()?.id).toBe('b');
  });
});
