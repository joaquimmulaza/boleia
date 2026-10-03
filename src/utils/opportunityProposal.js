import { formatKwanza } from './formatKwanza';
import { resolveOpportunityCard } from './opportunityCard';

export const COPY_N_FIXO = 'Este número fica fixo nesta proposta.';

/**
 * N da proposta é o snapshot (`nProposto`). Não lê o N vivo do grupo.
 * @param {number} nProposto
 * @returns {number}
 */
function snapshotN(nProposto) {
  const n = Number(nProposto);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.trunc(n);
}

/**
 * @param {unknown} valor
 * @returns {number | null}
 */
function precoPositivo(valor) {
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Modelo da proposta. `TOTAL_ACORDO` é um valor; por passageiro usa só o snapshot.
 * A frase do número fixo fica no sheet do motorista, não no stepper do passageiro.
 * @param {{
 *   papel: 'motorista' | 'passageiro',
 *   alvo?: 'grupo' | 'passageiro',
 *   item: object,
 *   nProposto: number,
 *   valorKz?: number | null,
 *   modoPreco?: string | null,
 * }} input
 */
export function resolveOpportunityProposal({
  papel,
  alvo = 'passageiro',
  item,
  nProposto,
  valorKz,
  modoPreco,
}) {
  const n = snapshotN(nProposto);
  const totalAcordo = modoPreco === 'TOTAL_ACORDO';
  const flexivel = Boolean(item?.flexibilidade_rota);
  const card = resolveOpportunityCard({
    kind: flexivel ? 'oferta' : (alvo === 'grupo' ? 'grupo' : 'procura'),
    item,
  });
  const unit = precoPositivo(valorKz);
  const totalNumero = unit == null || totalAcordo ? unit : unit * n;

  return {
    titulo: 'Nova proposta',
    rota: flexivel ? null : card.rota,
    headline: flexivel ? 'Disponível para acordos' : null,
    horario: card.horario,
    mostrarHorario: totalAcordo || papel === 'passageiro',
    nome: alvo === 'grupo' ? (String(item?.nome || '').trim() || 'Grupo') : null,
    contagem: n === 1 ? '1 passageiro' : `${n} passageiros`,
    n,
    stepper: papel === 'passageiro',
    snapshotNote: papel === 'motorista' ? COPY_N_FIXO : null,
    precoPorPassageiro: !totalAcordo && unit != null
      ? `${formatKwanza(unit)} Kz por passageiro`
      : null,
    total: !totalAcordo && totalNumero != null
      ? {
        label: papel === 'passageiro' ? 'Total estimado' : 'Total',
        valor: `${formatKwanza(totalNumero)} Kz`,
      }
      : null,
    precoUnico: totalAcordo && unit != null
      ? { valor: `${formatKwanza(unit)} Kz`, modo: 'Total do acordo' }
      : null,
    cta: 'Enviar proposta',
  };
}
