import { describe, it, expect, vi } from 'vitest';
import { resolvePassageiroTotalDescontoFaltasKz } from './resolveTotalDescontoFaltas';

describe('resolvePassageiroTotalDescontoFaltasKz', () => {
  const pagamentos = [
    {
      id: 'pg-1',
      passenger_id: 'pax-1',
      mes_referencia: '2026-10-01',
      estado: 'em_custodia',
      desconto_faltas_kz: 0,
    },
    {
      id: 'pg-liq',
      passenger_id: 'pax-1',
      mes_referencia: '2026-09-01',
      estado: 'liquidado',
      desconto_faltas_kz: 500,
    },
  ];

  it('em custódia: usa preview RPC', async () => {
    const fetchPreview = vi.fn().mockResolvedValue(1200);
    const total = await resolvePassageiroTotalDescontoFaltasKz(
      pagamentos,
      'pax-1',
      { mesReferencia: '2026-10-01', fetchPreview },
    );
    expect(total).toBe(1200);
    expect(fetchPreview).toHaveBeenCalledWith('pg-1');
  });

  it('liquidado: usa desconto_faltas_kz persistido', async () => {
    const fetchPreview = vi.fn();
    const total = await resolvePassageiroTotalDescontoFaltasKz(
      pagamentos,
      'pax-1',
      { mesReferencia: '2026-09-01', fetchPreview },
    );
    expect(total).toBe(500);
    expect(fetchPreview).not.toHaveBeenCalled();
  });
});
