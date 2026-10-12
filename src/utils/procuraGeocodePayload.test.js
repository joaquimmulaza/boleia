import { describe, it, expect } from 'vitest';
import {
  isProcuraOdFieldUnresolved,
  resolveProcuraOdFieldForPayload,
} from './procuraGeocodePayload';

describe('resolveProcuraOdFieldForPayload', () => {
  it('Usar confirma texto livre com coordenadas nulas', () => {
    expect(
      resolveProcuraOdFieldForPayload({
        name: 'Bairro X',
        lat: -8.9,
        lng: 13.1,
        freeText: true,
        savedName: 'Talatona',
        savedLat: -8.9,
        savedLng: 13.1,
      }),
    ).toEqual({ ok: true, lat: null, lng: null });
  });

  it('texto igual ao guardado mantém lat/lng guardadas (mesmo com coords stale no form)', () => {
    expect(
      resolveProcuraOdFieldForPayload({
        name: 'Talatona',
        lat: null,
        lng: null,
        freeText: false,
        savedName: 'Talatona',
        savedLat: -8.9,
        savedLng: 13.1,
      }),
    ).toEqual({ ok: true, lat: -8.9, lng: 13.1 });
  });

  it('texto editado sem sugestão nem Usar fica por resolver (não reutiliza lat/lng antigas)', () => {
    expect(
      resolveProcuraOdFieldForPayload({
        name: 'Talatona (editado)',
        lat: -8.9,
        lng: 13.1,
        freeText: false,
        savedName: 'Talatona',
        savedLat: -8.9,
        savedLng: 13.1,
        lastSelectedName: 'Talatona',
      }),
    ).toEqual({ ok: false, unresolved: true, lat: null, lng: null });
  });

  it('sugestão escolhida com texto alinhado usa coords do form', () => {
    expect(
      resolveProcuraOdFieldForPayload({
        name: 'Viana, Luanda',
        lat: -8.916,
        lng: 13.234,
        freeText: false,
        savedName: 'Talatona',
        savedLat: -8.9,
        savedLng: 13.1,
        lastSelectedName: 'Viana, Luanda',
      }),
    ).toEqual({ ok: true, lat: -8.916, lng: 13.234 });
  });

  it('criar procura: sem seleccionar fica por resolver', () => {
    expect(
      resolveProcuraOdFieldForPayload({
        name: 'Talatona',
        lat: null,
        lng: null,
        freeText: false,
      }),
    ).toEqual({ ok: false, unresolved: true, lat: null, lng: null });
  });

  it('isProcuraOdFieldUnresolved detecta campo por resolver', () => {
    expect(
      isProcuraOdFieldUnresolved({
        name: 'Outro',
        lat: -8.9,
        lng: 13.1,
        freeText: false,
        savedName: 'Talatona',
        savedLat: -8.9,
        savedLng: 13.1,
      }),
    ).toBe(true);
  });
});
