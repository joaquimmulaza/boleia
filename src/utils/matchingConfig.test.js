import { describe, it, expect } from 'vitest';
import {
  MATCH_TIME_TOLERANCE_MINUTES,
  MATCH_RADIUS_ORIGIN_METERS,
  MATCH_RADIUS_DESTINATION_METERS,
} from './matchingConfig';
import { haversineMeters } from './geo';

describe('matchingConfig', () => {
  it('exporta defaults do MVP (±15 min, 2500 m OD)', () => {
    expect(MATCH_TIME_TOLERANCE_MINUTES).toBe(15);
    expect(MATCH_RADIUS_ORIGIN_METERS).toBe(2500);
    expect(MATCH_RADIUS_DESTINATION_METERS).toBe(2500);
  });
});

describe('haversineMeters', () => {
  it('distância aproximadamente zero para o mesmo ponto', () => {
    expect(haversineMeters(-8.8383, 13.2344, -8.8383, 13.2344)).toBe(0);
  });

  it('estima ~1 km entre pontos próximos em Luanda', () => {
    // ~0.009° latitude ≈ 1 km
    const d = haversineMeters(-8.8383, 13.2344, -8.8473, 13.2344);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });
});
