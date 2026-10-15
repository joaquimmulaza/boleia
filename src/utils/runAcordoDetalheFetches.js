/**
 * Orquestração paralela dos pedidos do detalhe do acordo (UI).
 * @typedef {{
 *   listPagamentosByAcordo: () => Promise<object[]>,
 *   listPagamentosPendentesMotorista?: () => Promise<object[]>,
 *   getObrigacaoPassageiro?: () => Promise<{ pagamento?: object | null, obrigacao?: object | null } | null>,
 *   getAcordoContactos?: () => Promise<object | null>,
 *   listMinhasAvaliacoesAcordo: () => Promise<object[]>,
 *   listAdendaHistorico: () => Promise<object[]>,
 * }} AcordoDetalheFetchers
 */

/**
 * @param {AcordoDetalheFetchers} fetchers
 * @returns {Promise<{
 *   pagamentosAcordo: object[],
 *   motoristaPagamentos: object[],
 *   pagamento: object | null,
 *   obrigacaoPagamento: object | null,
 *   contactos: object | null,
 *   avaliacoesAcordo: object[],
 *   historicoPreco: object[],
 *   errors: Record<string, unknown>,
 * }>}
 */
export async function runAcordoDetalheFetches(fetchers) {
  /** @type {Record<string, unknown>} */
  const errors = {};

  const track = (key, promise) =>
    Promise.resolve(promise).then(
      (value) => value,
      (err) => {
        errors[key] = err;
        return null;
      },
    );

  const pagamentosPromise = track('pagamentos', fetchers.listPagamentosByAcordo());
  const motoristaPromise = fetchers.listPagamentosPendentesMotorista
    ? track('motorista', fetchers.listPagamentosPendentesMotorista())
    : Promise.resolve(null);
  const obrigacaoPromise = fetchers.getObrigacaoPassageiro
    ? track('obrigacao', fetchers.getObrigacaoPassageiro())
    : Promise.resolve(null);
  const contactosPromise = fetchers.getAcordoContactos
    ? track('contactos', fetchers.getAcordoContactos())
    : Promise.resolve(null);
  const avaliacoesPromise = track('avaliacoes', fetchers.listMinhasAvaliacoesAcordo());
  const historicoPromise = track('historico', fetchers.listAdendaHistorico());

  const [
    pagamentosAcordoRaw,
    motoristaRaw,
    obrigacaoRaw,
    contactosRaw,
    avaliacoesRaw,
    historicoRaw,
  ] = await Promise.all([
    pagamentosPromise,
    motoristaPromise,
    obrigacaoPromise,
    contactosPromise,
    avaliacoesPromise,
    historicoPromise,
  ]);

  const pagamentosAcordo = Array.isArray(pagamentosAcordoRaw) ? pagamentosAcordoRaw : [];
  const motoristaPagamentos = Array.isArray(motoristaRaw) ? motoristaRaw : [];
  const avaliacoesAcordo = Array.isArray(avaliacoesRaw) ? avaliacoesRaw : [];
  const historicoPreco = Array.isArray(historicoRaw) ? historicoRaw : [];

  let pagamento = null;
  let obrigacaoPagamento = null;
  if (obrigacaoRaw && typeof obrigacaoRaw === 'object') {
    pagamento = obrigacaoRaw.pagamento ?? null;
    obrigacaoPagamento = obrigacaoRaw.obrigacao ?? null;
  }

  return {
    pagamentosAcordo,
    motoristaPagamentos,
    pagamento,
    obrigacaoPagamento,
    contactos: contactosRaw,
    avaliacoesAcordo,
    historicoPreco,
    errors,
  };
}

/**
 * Mede rondas sequenciais vs paralelas com latência fixa (harness de regressão).
 * @param {number} latencyMs
 * @param {number} nRequests
 */
export function estimateDetalheLoadMs(latencyMs, nRequests = 5) {
  const sequential = latencyMs * nRequests;
  const parallel = latencyMs;
  return { sequentialMs: sequential, parallelMs: parallel };
}
