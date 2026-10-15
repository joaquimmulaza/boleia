import { firstDayCurrentMonthLuanda } from './adendaEffectiveFrom';

/**
 * Total «a descontar» alinhado ao servidor (passageiro — mês corrente).
 * Sem linha de pagamento no mês → `null` (UI usa total cliente; não confundir com 0 Kz).
 *
 * @param {object[] | null | undefined} pagamentos
 * @param {string} passengerId
 * @param {{
 *   mesReferencia?: string,
 *   fetchPreview?: (pagamentoId: string) => Promise<number>,
 * }} [opts]
 * @returns {Promise<number | null>}
 */
export async function resolvePassageiroTotalDescontoFaltasKz(
  pagamentos,
  passengerId,
  opts = {},
) {
  const mesReferencia = opts.mesReferencia || firstDayCurrentMonthLuanda();
  const fetchPreview = opts.fetchPreview || (async () => 0);
  const pg = (pagamentos || []).find(
    (p) => p.passenger_id === passengerId
      && String(p.mes_referencia || '').slice(0, 10) === mesReferencia,
  );
  if (!pg) {
    return null;
  }

  if (String(pg.estado || '').toLowerCase() === 'liquidado') {
    return Number(pg.desconto_faltas_kz) || 0;
  }

  return Number(await fetchPreview(pg.id)) || 0;
}
