import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAbsences, logAbsence } from './AbsenceService.js';
import { supabase } from '../lib/supabase';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('AbsenceService (marketplace)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logAbsence aceita passenger_id e viagem', async () => {
    const payload = {
      id_acordo: 'acordo-1',
      data_falta: '2026-09-04',
      tipo: 'Passageiro',
      passenger_id: 'pax-1',
      viagem: 'ambas',
    };
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'f1', ...payload, desconto_kz: 1363.64 },
      error: null,
    });
    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });

    const result = await logAbsence(payload);
    expect(result.viagem).toBe('ambas');
    expect(result.passenger_id).toBe('pax-1');
  });

  it('logAbsence rejeita viagem inválida', async () => {
    await expect(
      logAbsence({
        id_acordo: 'acordo-1',
        data_falta: '2026-09-04',
        tipo: 'Passageiro',
        viagem: 'meio-dia',
      }),
    ).rejects.toThrow('Viagem inválida');
  });

  it('getAbsences continua a filtrar por id_acordo', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    });
    await getAbsences('acordo-1');
    expect(mockEq).toHaveBeenCalledWith('id_acordo', 'acordo-1');
  });

  it('código-fonte não contém divisor hardcoded / 4', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, 'AbsenceService.js'), 'utf8');
    expect(src).not.toMatch(/\/\s*4(\.0)?\b/);
  });
});
