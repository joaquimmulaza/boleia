import { describe, it, expect } from 'vitest';
import { acordoPrecisaLiveRefresh } from './useAcordoDetalheLiveRefresh';

describe('acordoPrecisaLiveRefresh', () => {
  it('activa com rescisão consensual em curso', () => {
    expect(
      acordoPrecisaLiveRefresh({
        id: 'a1',
        estado: 'activo',
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
      }),
    ).toBe(true);
  });

  it('activa em cancelamento_pendente', () => {
    expect(
      acordoPrecisaLiveRefresh({
        id: 'a1',
        estado: 'cancelamento_pendente',
      }),
    ).toBe(true);
  });

  it('não activa para acordo cancelado', () => {
    expect(
      acordoPrecisaLiveRefresh({
        id: 'a1',
        estado: 'cancelado',
      }),
    ).toBe(false);
  });
});
