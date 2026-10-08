import { formatDiasSemana } from './diasSemana';
import { formatKwanza } from './formatKwanza';
import { formatTime24h } from './formatTime';
import { labelModoPreco } from './ofertaLabels';

export const CTA_LABEL = {
  oferta: 'Propor acordo',
  procura: 'Enviar proposta',
  grupo: 'Enviar proposta',
  verAcordo: 'Ver acordo',
};

export const COPY_ERRO_OPORTUNIDADES = 'Não foi possível carregar as oportunidades';
export const COPY_TENTAR_NOVAMENTE = 'Tentar novamente';
export const COPY_A_CARREGAR = 'A carregar oportunidades';

const ESTADOS_OFERTA_VIVA = new Set(['disponivel', 'parcial']);
const ESTADOS_PROCURA_VIVA = new Set(['activa', 'em_negociacao']);

/**
 * Feed só mostra oportunidades vivas. Cancelada/expirada não entra no cartão.
 * Sem `estado` (já filtrado a montante) conta como viva.
 * @param {'oferta' | 'procura' | 'grupo'} kind
 * @param {{ estado?: string | null }} item
 * @returns {boolean}
 */
export function isLiveOpportunity(kind, item) {
  const estado = String(item?.estado || '').trim().toLowerCase();
  if (!estado) return true;
  if (kind === 'oferta') return ESTADOS_OFERTA_VIVA.has(estado);
  return ESTADOS_PROCURA_VIVA.has(estado);
}

/**
 * @param {unknown} valor
 * @returns {boolean}
 */
function temPreco(valor) {
  if (valor == null || valor === '') return false;
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0;
}

/**
 * @param {object} item
 * @param {boolean} flexivel
 * @returns {string[]}
 */
function resolveHorario(item, flexivel) {
  const hora = formatTime24h(item?.departure_time || item?.preferred_time);
  const dias = formatDiasSemana(item?.dias_semana);
  if (flexivel) return [hora, dias].filter(Boolean);
  if (hora && dias) return [`${hora} · ${dias}`];
  return [hora || dias].filter(Boolean);
}

/**
 * @param {'oferta' | 'procura' | 'grupo'} kind
 * @param {object} item
 * @returns {string}
 */
function resolveCapacidade(kind, item) {
  if (kind === 'grupo') {
    const pessoas = Number(item?.n_pessoas ?? item?.n_actual ?? item?.n_candidato) || 0;
    return pessoas === 1 ? 'Grupo · 1 pessoa' : `Grupo · ${pessoas} pessoas`;
  }
  if (kind === 'procura') {
    const n = Number(item?.n_candidato) || 0;
    return n === 1 ? '1 passageiro' : `${n} passageiros`;
  }
  const vagas = Number(item?.vagas_disponiveis);
  if (!Number.isFinite(vagas) || vagas <= 0) return 'Sem lugares disponíveis';
  return vagas === 1 ? '1 lugar disponível' : `${vagas} lugares disponíveis`;
}

/**
 * Modelo de apresentação do cartão. Não calcula preço × N.
 * @param {{ kind: 'oferta' | 'procura' | 'grupo', item: object }} input
 */
export function resolveOpportunityCard({ kind, item }) {
  const flexivel = kind === 'oferta' && Boolean(item?.flexibilidade_rota);
  const origem = item?.origin_name || null;
  const destino = item?.destination_name || null;
  const rota = !flexivel && origem && destino ? { origem, destino } : null;

  let tipo = 'Oferta fixa';
  if (kind === 'procura') tipo = 'Procura';
  else if (kind === 'grupo') tipo = 'Grupo';
  else if (flexivel) tipo = 'Oferta flexível';

  const preco = kind === 'oferta'
    ? (temPreco(item?.valor_mensal_ask_kz)
      ? { valor: `${formatKwanza(item.valor_mensal_ask_kz)} Kz`, modo: labelModoPreco(item?.modo_preco) }
      : { valor: 'Definido no acordo', modo: null })
    : null;

  const vagas = Number(item?.vagas_disponiveis);

  return {
    tipo,
    headline: flexivel ? 'Disponível para acordos' : null,
    rota,
    horario: resolveHorario(item, flexivel),
    capacidade: resolveCapacidade(kind, item),
    cta: CTA_LABEL[kind] || CTA_LABEL.oferta,
    ctaDisabled: kind === 'oferta' && (!Number.isFinite(vagas) || vagas <= 0),
    preco,
  };
}
