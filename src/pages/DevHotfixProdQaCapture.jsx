import React from 'react';
import AcordoPagamentosMotoristaPanel from '../components/AcordoPagamentosMotoristaPanel';
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

        <section data-testid="capture-motorista-cancelamento-pendente">
          <p className="text-xs font-semibold text-slate-500 mb-2">
            1b — Motorista · cancelamento_pendente (aviso prévio)
          </p>
          <AcordoPagamentosMotoristaPanel
            acordoTerminado={false}
            rows={[
              {
                pagamento_id: 'pg-prev',
                passenger_id: 'pax-1',
                passenger_nome: 'Ana Costa',
                estado: 'pendente_pagamento',
                valor: 40000,
                valor_em_divida: 40000,
              },
              {
                pagamento_id: 'pg-comp',
                passenger_id: 'pax-2',
                passenger_nome: 'João Pedro',
                estado: 'comprovativo_enviado',
                valor: 0,
                valor_em_divida: 0,
                valor_comprovativo: 40000,
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
                className="w-full min-h-11"
                disabled={!reservaSemIban.ctaReservaPagamentoAtivo}
              >
                {reservaSemIban.ctaReservaPagamentoLabel}
              </Button>
            </div>
          ) : null}
          <AcordoPagamentoPanel pagamento={pagamentoAa66} />
        </section>
      </div>
    </div>
  );
}
