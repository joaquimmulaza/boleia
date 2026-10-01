import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    from: (...args) => mockFrom(...args),
  },
}));

import {
  submitAvaliacao,
  listMinhasAvaliacoesAcordo,
  wasAvaliadoPor,
  mapCounterpartyRatingView,
} from './RatingService.js';

describe('RatingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submitAvaliacao chama RPC com estrelas obrigatórias', async () => {
    mockRpc.mockResolvedValue({ data: 'rating-id-1', error: null });

    const id = await submitAvaliacao({
      acordoId: 'a1',
      acordoPassageiroId: 'ap1',
      momento: 'primeiro_periodo',
      estrelas: 4,
      comentario: 'Boa boleia',
    });

    expect(id).toBe('rating-id-1');
    expect(mockRpc).toHaveBeenCalledWith('submit_avaliacao_acordo', expect.objectContaining({
      p_acordo_id: 'a1',
      p_acordo_passageiro_id: 'ap1',
      p_momento: 'primeiro_periodo',
      p_estrelas: 4,
      p_comentario: 'Boa boleia',
    }));
  });

  it('submitAvaliacao rejeita estrelas inválidas no client', async () => {
    await expect(
      submitAvaliacao({
        acordoId: 'a1',
        acordoPassageiroId: 'ap1',
        momento: 'primeiro_periodo',
        estrelas: 0,
      }),
    ).rejects.toThrow(/classificação/i);
  });

  it('listMinhasAvaliacoesAcordo devolve só avaliações do utilizador', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'r1', comentario: 'segredo', estrelas: 5 }],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const rows = await listMinhasAvaliacoesAcordo('a1');
    expect(rows).toHaveLength(1);
    expect(rows[0].comentario).toBe('segredo');
    expect(chain.eq).toHaveBeenCalledWith('acordo_id', 'a1');
  });

  it('wasAvaliadoPor devolve booleano da RPC', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const ok = await wasAvaliadoPor('ap1', 'primeiro_periodo', 'motorista_para_passageiro');
    expect(ok).toBe(true);
  });

  it('mapCounterpartyRatingView nunca inclui comentário', () => {
    const view = mapCounterpartyRatingView(true);
    expect(view).toEqual({ avaliado: true, label: 'Avaliado' });
    expect(JSON.stringify(view)).not.toMatch(/comentario|estrelas/i);
  });
});
