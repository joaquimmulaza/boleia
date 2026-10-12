import { describe, it, expect } from 'vitest';
import { resolveProcuraOdFieldForPayload } from './procuraGeocodePayload';

describe('resolveProcuraOdFieldForPayload', () => {
  it('texto livre confirmado força coordenadas nulas', () => {
    expect(
      resolveProcuraOdFieldForPayload(
        { lat: -8.9, lng: 13.1, freeText: true },
        { lat: -8.5, lng: 13.0 },
      ),
    ).toEqual({ lat: null, lng: null });
  });

  it('usa coordenadas do formulário quando presentes', () => {
    expect(
      resolveProcuraOdFieldForPayload(
        { lat: -8.916, lng: 13.234, freeText: false },
        { lat: -8.9, lng: 13.1 },
      ),
    ).toEqual({ lat: -8.916, lng: 13.234 });
  });

  it('modo edição: sem sugestão nem Usar, mantém lat/lng guardados', () => {
    expect(
      resolveProcuraOdFieldForPayload(
        { lat: null, lng: null, freeText: false },
        { lat: -8.9, lng: 13.1 },
      ),
    ).toEqual({ lat: -8.9, lng: 13.1 });
  });

  it('criar procura: sem coords guardados devolve null', () => {
    expect(
      resolveProcuraOdFieldForPayload(
        { lat: null, lng: null, freeText: false },
        null,
      ),
    ).toEqual({ lat: null, lng: null });
  });
});
