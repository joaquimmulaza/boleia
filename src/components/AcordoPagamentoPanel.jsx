import React, { useRef, useState } from 'react';
import { Upload, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { formatKwanza } from '../utils/formatKwanza';
import {
  helpEstadoPagamento,
  chipClassEstadoPagamento,
  PAYMENT_STATES,
} from '../utils/paymentStatus';
import {
  normalizeObrigacaoSnapshot,
  linhaProporcionalPagamento,
  linhaValorAPagarResumo,
  mostrarDesagregacaoProporcionalPagamento,
  linhaPrazoPagamento,
  linhaSecundariaExcessoPassageiro,
  labelEstadoPagamentoPassageiro,
  mostrarIconeSucessoPagamento,
  valorEmDividaParaExibir,
  isDestaqueValorEmDividaSaiuPendente,
  isPagamentoEmExcessoAnalise,
} from '../utils/pagamentoObrigacaoCopy';
import { basenameComprovativoPath } from '../utils/comprovativoPath';
import { getPlatformIban, uploadComprovativo } from '../services/PaymentService';
import FeedbackAlert from './FeedbackAlert';

/**
 * Bloco de pagamento mensal (passageiro) — IBAN plataforma + comprovativo.
 *
 * @param {{
 *   pagamento: {
 *     id: string,
 *     valor_kz: number,
 *     valor_payout_liquido_kz?: number,
 *     estado: string,
 *     comprovativo_path?: string | null,
 *     rejeicao_motivo?: string | null,
 *     requer_resolucao_admin?: boolean,
 *   } | null,
 *   obrigacao?: import('../utils/pagamentoObrigacaoCopy.js').ObrigacaoSnapshot | null,
 *   lugarEstado?: string | null,
 *   pagamentoUiVariant?: 'S1' | 'S2' | 'S3' | 'S6a' | null,
 *   onUpdated?: () => void,
 *   layout?: 'completo' | 'acoes' | 'uploadButton',
 * }} props
 */
function AcordoPagamentoPanel({
  pagamento,
  obrigacao = null,
  lugarEstado = null,
  pagamentoUiVariant = null,
  onUpdated,
  layout = 'completo',
}) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(/** @type {{ type: 'success' | 'error', text: string } | null} */ (null));

  if (!pagamento) {
    return (
      <p className="text-sm text-slate-500" data-testid="pagamento-ausente">
        Pagamento ainda não disponível para este acordo.
      </p>
    );
  }

  const obrigacaoNorm = normalizeObrigacaoSnapshot(obrigacao);
  const platformIban = getPlatformIban();
  const ibanConfigurado = Boolean(platformIban);
  const estadoNorm = String(pagamento.estado || '').toLowerCase();
  const emExcesso = isPagamentoEmExcessoAnalise(pagamento);
  const obrigacaoValorZero = obrigacaoNorm != null && Number(obrigacaoNorm.valor) === 0;
  const podeEnviar = ['pendente_pagamento', 'comprovativo_enviado'].includes(estadoNorm)
    && estadoNorm !== PAYMENT_STATES.ANULADO
    && !emExcesso
    && !obrigacaoValorZero;
  const mostrarDesagregacao = mostrarDesagregacaoProporcionalPagamento(
    lugarEstado,
    pagamentoUiVariant,
  );
  const linhaProp = emExcesso || !mostrarDesagregacao
    ? null
    : linhaProporcionalPagamento(obrigacaoNorm, {
      pagamentoEstado: pagamento.estado,
      valorComprovativo: pagamento.valor_kz,
    });
  const linhaResumoActivo = !emExcesso && !mostrarDesagregacao && obrigacaoNorm
    ? linhaValorAPagarResumo(obrigacaoNorm, pagamento)
    : null;
  const linhaExcesso = emExcesso ? linhaSecundariaExcessoPassageiro(obrigacaoNorm) : null;
  const linhaPrazo = obrigacaoValorZero
    ? null
    : linhaPrazoPagamento(obrigacaoNorm?.prazo ?? pagamento.prazo_pagamento_em);
  const valorEmDivida = valorEmDividaParaExibir(obrigacaoNorm, pagamento);
  const destaqueSaiuPendente = isDestaqueValorEmDividaSaiuPendente(lugarEstado, pagamento);
  const comprovativoNome = basenameComprovativoPath(pagamento.comprovativo_path);
  const temComprovativo = Boolean(comprovativoNome);
  const labelUpload = temComprovativo ? 'Substituir comprovativo' : 'Enviar comprovativo';
  const helpEstado = emExcesso
    ? 'A plataforma está a analisar a diferença entre o valor pago e o devido neste mês.'
    : helpEstadoPagamento(pagamento.estado);
  const labelEstado = labelEstadoPagamentoPassageiro(pagamento, obrigacaoNorm);
  const mostrarCheck = mostrarIconeSucessoPagamento({
    pagamento,
    obrigacao: obrigacaoNorm,
    lugarEstado,
  });

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      await uploadComprovativo(pagamento.id, file);
      setFeedback({ type: 'success', text: 'Comprovativo enviado. Aguarda validação.' });
      onUpdated?.();
    } catch (error) {
      console.error('Erro ao enviar comprovativo:', error);
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível enviar o comprovativo.',
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const uploadButton = podeEnviar ? (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        data-testid="comprovativo-input"
        onChange={handleFile}
      />
      <button
        type="button"
        disabled={busy || !ibanConfigurado}
        onClick={() => inputRef.current?.click()}
        className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        data-testid="comprovativo-upload-btn"
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload size={18} aria-hidden="true" />
        )}
        {labelUpload}
      </button>
    </>
  ) : null;

  if (layout === 'uploadButton') {
    return (
      <div data-testid="acordo-pagamento-upload-slot">
        {uploadButton}
      </div>
    );
  }

  const mostrarCorpoCompleto = layout === 'completo';

  return (
    <section
      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
      data-testid="acordo-pagamento-panel"
      data-layout={layout}
    >
      {mostrarCorpoCompleto ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pagamento mensal</h3>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${chipClassEstadoPagamento(pagamento.estado)}`}
              title={helpEstado || undefined}
              data-testid="pagamento-estado-chip"
            >
              {mostrarCheck ? (
                <CheckCircle2 size={14} className="shrink-0" aria-hidden="true" data-testid="pagamento-estado-check" />
              ) : null}
              {labelEstado}
            </span>
          </div>

          {helpEstado ? (
            <p className="text-xs text-slate-500 text-pretty">{helpEstado}</p>
          ) : null}

          {linhaExcesso ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 text-pretty" data-testid="linha-excesso-pagamento">
              {linhaExcesso}
            </p>
          ) : null}

          {linhaProp ? (
            <p className="text-xs text-slate-600 dark:text-slate-300 text-pretty" data-testid="linha-proporcional-pagamento">
              {linhaProp}
            </p>
          ) : null}
          {linhaResumoActivo ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty" data-testid="linha-valor-pagar-resumo">
              {linhaResumoActivo}
            </p>
          ) : null}

          {linhaPrazo ? (
            <p className="text-xs text-amber-800 dark:text-amber-200" data-testid="linha-prazo-pagamento">
              {linhaPrazo}
            </p>
          ) : null}

          {destaqueSaiuPendente ? (
            <div className="space-y-1" data-testid="valor-em-divida-destaque">
              <p className="text-xs text-slate-500">Valor em dívida</p>
              <p className="text-2xl font-bold tabular-nums text-primary">
                {formatKwanza(valorEmDivida)} Kz
              </p>
            </div>
          ) : linhaResumoActivo ? null : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {linhaProp ? 'Valor a pagar agora' : 'Valor acordado'}:{' '}
              <strong className="tabular-nums text-slate-900 dark:text-white">
                {formatKwanza(valorEmDivida)} Kz
              </strong>
            </p>
          )}
        </>
      ) : null}

      {ibanConfigurado ? (
        <p className="text-xs text-slate-500 text-pretty">
          IBAN da plataforma:{' '}
          <span className="font-mono text-slate-700 dark:text-slate-200">{platformIban}</span>
        </p>
      ) : (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/40 p-3 space-y-1"
          data-testid="iban-nao-configurado"
        >
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Transferência indisponível
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 text-pretty">
            O IBAN da plataforma ainda não está configurado. Não é possível enviar comprovativo
            até a equipa activar o pagamento.
          </p>
        </div>
      )}

      {pagamento.rejeicao_motivo ? (
        <FeedbackAlert
          type="error"
          text={`Comprovativo rejeitado: ${pagamento.rejeicao_motivo}`}
        />
      ) : null}

      {feedback ? <FeedbackAlert type={feedback.type} text={feedback.text} /> : null}

      {temComprovativo ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
          data-testid="comprovativo-preview"
        >
          <FileText size={16} className="text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {comprovativoNome}
          </span>
        </div>
      ) : null}

      {uploadButton}
    </section>
  );
}

export default AcordoPagamentoPanel;
