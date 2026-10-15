import React, { useEffect, useRef } from 'react';
import AcordoPagamentosMotoristaPanel from '../components/AcordoPagamentosMotoristaPanel';
import AcordoRatingMotBanner from '../components/rating/AcordoRatingMotBanner';
import AcordoDetalheSheetHeader from '../components/AcordoDetalheSheetHeader';
import { buildMotoristaRatingPrompts } from '../utils/ratingGates';
import AcordoContratoSnapshot from '../components/AcordoContratoSnapshot';
import AcordoPagamentoEstadoCartao from '../components/AcordoPagamentoEstadoCartao';
import { buildAcordoContratoSnapshot } from '../utils/buildAcordoContratoSnapshot';
import { resolvePessoasAcordoUi } from '../utils/resolvePessoasAcordoUi';
import {
  copyCartaoEstadoPagamentoPassageiro,
  resolvePassageiroReservaPagamento,
} from '../utils/resolveAcordoPagamentoUi';
import AcordoPagamentoPanel from '../components/AcordoPagamentoPanel';
import { Button } from '../components/ui/button';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';

/**
 * Captura DEV (390px) — hotfix prod QA acordos (#276 follow-up).
 */
function CaptureSheetFecharFocado() {
  const fecharRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  useEffect(() => {
    fecharRef.current?.focus();
  }, []);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
      <AcordoDetalheSheetHeader
        acordoId="capture-acordo"
        estadoAcordo="activo"
        fecharRef={fecharRef}
        onClose={() => {}}
        podeRegistarFaltas={false}
        podeEncerrar={false}
        onRegistarFalta={() => {}}
        onEncerrar={() => {}}
      />
    </div>
  );
}

export default function DevHotfixProdQaCapture() {
  const acordoB4010c7e = {
    modo_preco: 'POR_PASSAGEIRO',
    n_passageiros_contrato: 1,
    valor_mensal_por_passageiro_kz: 22000,
    valor_mensal_total_kz: 22000,
  };
  const linhasEncerradoSaiu = [
    {
      id: 'ap-crit',
      passenger_id: 'pax-crit',
      estado: 'saiu',
      quota_mensal_kz: 22000,
      perfis: { nome_completo: 'Critiquito Prod Passenger' },
    },
  ];
  const pessoasB4010c7e = resolvePessoasAcordoUi(acordoB4010c7e, linhasEncerradoSaiu);
  const snapshotN1 = buildAcordoContratoSnapshot(acordoB4010c7e, {
    nLabel: pessoasB4010c7e.nLabel ?? undefined,
  });

  const pagamentoAa66 = {
    id: 'pg-aa66',
    estado: 'pendente_pagamento',
    valor_kz: 22000,
    valor_payout_liquido_kz: 19800,
  };
  const settledAt = '2026-10-12T11:39:06.000Z';
  const ratingPromptsDoisPax = buildMotoristaRatingPrompts({
    acordoId: '0d8cb19e-b8d9-4064-a4e4-7536649ac0ee',
    passageiros: [
      { id: 'ap1', passenger_id: 'p1', estado: 'activo', perfis: { nome_completo: 'Passageiro A' } },
      { id: 'ap2', passenger_id: 'p2', estado: 'activo', perfis: { nome_completo: 'Passageiro B' } },
    ],
    pagamentos: [
      {
        acordo_passageiro_id: 'ap1',
        passenger_id: 'p1',
        estado: 'em_custodia',
        validado_em: settledAt,
        mes_referencia: '2026-10-01',
      },
      {
        acordo_passageiro_id: 'ap2',
        passenger_id: 'p2',
        estado: 'pendente_pagamento',
        validado_em: null,
        mes_referencia: '2026-10-01',
      },
    ],
    avaliacoes: [],
    now: settledAt,
    driverId: 'mot-capture',
  });

  const reservaSemIban = resolvePassageiroReservaPagamento({
    minhaLinha: { estado: 'reservado', passenger_id: 'pax-aa66' },
    pagamento: pagamentoAa66,
    pagamentoLoading: false,
    obrigacao: { valor: 22000, valor_em_divida: 22000, quota: 22000 },
    transferenciaDisponivel: false,
  });

  const cartaoJustaCausa = copyCartaoEstadoPagamentoPassageiro('S3', {
    pagamento: {
      estado: 'anulado',
      anulacao_motivo: ANULACAO_MOTIVO.RESCISAO_JUSTA_CAUSA,
    },
    obrigacao: { valor_em_divida: 0 },
    pagamentoLoading: false,
  });

  return (
    <div className="min-h-dvh bg-background-light dark:bg-background-dark p-4">
      <div className="mx-auto max-w-[390px] space-y-8">
        <section data-testid="capture-motorista-encerrado">
          <p className="text-xs font-semibold text-slate-500 mb-2">1 — Motorista · acordo encerrado</p>
          <AcordoPagamentosMotoristaPanel
            acordoTerminado
            rows={[
              {
                pagamento_id: 'pg-034',
                passenger_id: 'pax-crit',
                passenger_nome: 'Critiquito Prod Passenger',
                estado: 'pendente_pagamento',
                valor: 22000,
                valor_em_divida: 22000,
              },
            ]}
          />
        </section>

        <section data-testid="capture-s3-justa-causa">
          <p className="text-xs font-semibold text-slate-500 mb-2">2 — Passageiro · justa causa (S3)</p>
          <AcordoPagamentoEstadoCartao
            variant="S3"
            corpo={cartaoJustaCausa.corpo}
            secundaria={cartaoJustaCausa.secundaria}
            aguardarMontante={false}
            chipPagamento="Pagamento cancelado"
            mostrarUploadNoCartao={false}
          />
        </section>

        <section data-testid="capture-reserva-alinhado" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">3 — Reserva · painel disponível (sem conflito)</p>
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 px-3 py-3"
          >
            <p className="text-sm text-pretty mb-2">Lugar reservado — aguarda pagamento em 72 h.</p>
            <button
              type="button"
              className="w-full min-h-11 rounded-xl bg-primary text-white font-semibold"
            >
              Ir para pagamento
            </button>
          </div>
          <p className="text-xs text-slate-500">Pagamento mensal · Pagamento pendente</p>
        </section>

        <section data-testid="capture-individual" className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            4 — b4010c7e · encerrado · fonte única (Individual + Passageiros · 0)
          </p>
          <AcordoContratoSnapshot snapshot={snapshotN1} />
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Passageiros · {pessoasB4010c7e.nPassageirosVivos}
          </p>
        </section>

        <section data-testid="capture-reserva-iban-falta" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">
            5 — aa66b9a6 · reserva · IBAN em falta (CTA alinhado ao painel)
          </p>
          {reservaSemIban.mostrarBannerReserva ? (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 px-3 py-3 space-y-2"
            >
              <p className="text-sm text-pretty">
                Lugar reservado — aguarda pagamento em 72 h. O lugar confirma-se quando o comprovativo
                for validado.
              </p>
              <Button
                type="button"
                className="w-full min-h-11 disabled:opacity-100 disabled:bg-slate-200 disabled:text-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-200"
                disabled={!reservaSemIban.ctaReservaPagamentoAtivo}
                data-testid="capture-disabled-pagamento-cta"
              >
                {reservaSemIban.ctaReservaPagamentoLabel}
              </Button>
            </div>
          ) : null}
          <AcordoPagamentoPanel pagamento={pagamentoAa66} />
        </section>

        <section data-testid="capture-rating-mot-2pax">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            6 — Motorista · Avaliar passageiros (2 lugares, 0 de 2)
          </p>
          <AcordoRatingMotBanner
            prompts={ratingPromptsDoisPax}
            onAvaliar={() => {}}
          />
        </section>

        <section data-testid="capture-sheet-fechar-foco">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            7 — Detalhe acordo · Fechar focado (anel vs chip)
          </p>
          <CaptureSheetFecharFocado />
        </section>
      </div>
    </div>
  );
}
