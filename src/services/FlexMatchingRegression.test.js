import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evaluateMatch } from '../utils/matchingFilters';
import { findCompatibleProcuras } from '../services/MatchingService';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');

/** @param {string} relPath */
function readSrc(relPath) {
  return readFileSync(join(repoRoot, relPath), 'utf8');
}

const baseProcura = {
  preferred_time: '07:10',
  origin_lat: -8.8473,
  origin_lng: 13.2344,
  destination_lat: -8.855,
  destination_lng: 13.255,
  dias_semana: [1, 2, 3, 4, 5],
};

const baseOfertaFixa = {
  departure_time: '07:00',
  flexibilidade_rota: false,
  vagas_disponiveis: 3,
  dias_semana: [1, 2, 3, 4, 5],
  origin_lat: -8.8383,
  origin_lng: 13.2344,
  destination_lat: -8.85,
  destination_lng: 13.25,
};

describe('PACOTE ENG #1 — matching flexível vs fixa (não-regressão)', () => {
  describe('auditoria estática — sem residência/OD fabricado', () => {
    it('MatchingService não referencia perfis, residência nem zonas', () => {
      const src = readSrc('src/services/MatchingService.js');
      expect(src).not.toMatch(/perfis|residencia|residence|zona_resid/i);
    });

    it('matchingFilters não referencia perfis, residência nem zonas', () => {
      const src = readSrc('src/utils/matchingFilters.js');
      expect(src).not.toMatch(/perfis|residencia|residence|zona_resid/i);
    });
  });

  describe('evaluateMatch — contrato fixa vs flexível', () => {
    it('AC1: oferta flexível casa sem OD (procura longe)', () => {
      expect(
        evaluateMatch({
          oferta: {
            departure_time: '07:00',
            flexibilidade_rota: true,
            vagas_disponiveis: 3,
            dias_semana: [1, 2, 3, 4, 5],
            origin_lat: null,
            origin_lng: null,
            destination_lat: null,
            destination_lng: null,
          },
          procura: {
            ...baseProcura,
            origin_lat: -9.5,
            origin_lng: 13.0,
            destination_lat: -9.6,
            destination_lng: 13.1,
          },
          n_candidato: 2,
        }),
      ).toBe('direct');
    });

    it('AC2: residência/coords residuais na oferta flex não restringem', () => {
      expect(
        evaluateMatch({
          oferta: {
            departure_time: '07:00',
            flexibilidade_rota: true,
            vagas_disponiveis: 3,
            dias_semana: [1, 2, 3, 4, 5],
            origin_lat: -9.5,
            origin_lng: 13.0,
            destination_lat: -9.6,
            destination_lng: 13.1,
          },
          procura: baseProcura,
          n_candidato: 1,
        }),
      ).toBe('direct');
    });

    it('AC5: oferta fixa continua a exigir geo compatível', () => {
      expect(
        evaluateMatch({
          oferta: baseOfertaFixa,
          procura: {
            ...baseProcura,
            origin_lat: -8.95,
            origin_lng: 13.1,
            destination_lat: -8.9,
            destination_lng: 13.15,
          },
          n_candidato: 1,
        }),
      ).toBe('incompatible');
    });

    it('AC5: oferta fixa sem OD completo é incompatível', () => {
      expect(
        evaluateMatch({
          oferta: {
            ...baseOfertaFixa,
            origin_lat: null,
            origin_lng: null,
            destination_lat: null,
            destination_lng: null,
          },
          procura: baseProcura,
          n_candidato: 1,
        }),
      ).toBe('incompatible');
    });
  });

  describe('findCompatibleProcuras — early exit fixa sem OD', () => {
    it('oferta fixa sem OD não consulta procuras', async () => {
      const result = await findCompatibleProcuras({
        flexibilidade_rota: false,
        departure_time: '07:00',
        vagas_disponiveis: 3,
        origin_lat: null,
        origin_lng: null,
        destination_lat: null,
        destination_lng: null,
      });
      expect(result).toEqual({ direct: [], waitlist: [], incompatible: [] });
    });
  });
});
