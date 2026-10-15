import React from 'react';
import { Users } from 'lucide-react';
import AcordoDetalheSheetHeader from '../components/AcordoDetalheSheetHeader';
import AcordoPagamentosMotoristaPanel from '../components/AcordoPagamentosMotoristaPanel';
import { Badge } from '../components/ui/badge';
import {
  labelChipFimLugar,
  chipClassFimLugar,
} from '../utils/acordoSeatEndChip';
import {
  nomePassageiroUi,
  iniciaisPassageiroUi,
} from '../utils/passageiroNomeUi.js';
import { resolveQuotaLinhaPassageiroUi, QUOTA_LINHA_ANULADO } from '../utils/passageiroLinhaQuotaUi.js';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import { LISTA_SECCAO_ACTIVOS, LISTA_SECCAO_ENCERRADOS } from '../constants/acordoFollowup278Copy.js';

/**
 * Captura DEV 390px — follow-up #278 (PR body only).
 */
export default function DevFollowup278Capture() {
  const pagamentoP1a = {
    pagamento_id: 'e4f7e6b4',
    passenger_id: 'pax-debt',
    passenger_nome: 'Maria Devedora',
    estado: 'pendente_pagamento',
    valor: 15000,
    valor_em_divida: 15000,
  };

  const chips = [
    {
      key: 'jc',
      linha: { estado: 'saiu', lugar_rescisao_modo: 'justa_causa' },
      pagamento: null,
    },
    {
      key: 'vol',
      linha: { estado: 'saiu' },
      pagamento: null,
    },
    {
      key: 'ret',
      linha: { estado: 'saiu', lugar_saida_iniciador: 'motorista' },
      pagamento: null,
    },
  ];

  return (
    <div className="min-h-dvh bg-background-light dark:bg-background-dark p-4">
      <div className="mx-auto max-w-[390px] space-y-8">
        <section
          data-testid="capture-sheet-header-jc-motorista-355"
          className="mx-auto w-[355px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <p className="text-xs font-semibold text-slate-500 px-4 pt-3">
            UX Critiquito — motorista / chip JC · 355px
          </p>
          <AcordoDetalheSheetHeader
            acordoId="acordo-cap-355"
            estadoAcordo="activo"
            acordosPassageiros={[
              { passenger_id: 'pax-jc', estado: 'saiu', lugar_rescisao_modo: 'justa_causa' },
              { passenger_id: 'driver-1', estado: 'activo' },
            ]}
            nPassageirosContrato={2}
            tipoPerfil="Passageiro"
            viewerUserId="pax-jc"
            minhaLinha={{
              passenger_id: 'pax-jc',
              estado: 'saiu',
              lugar_rescisao_modo: 'justa_causa',
            }}
            minhaChipCtx={{ estado: 'anulado' }}
            onClose={() => {}}
            podeRegistarFaltas={false}
            podeEncerrar={false}
            onRegistarFalta={() => {}}
            onEncerrar={() => {}}
            titulo="Detalhe do acordo"
          />
        </section>

        <section
          data-testid="capture-sheet-header-jc-motorista-390"
          className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <p className="text-xs font-semibold text-slate-500 px-4 pt-3">
            UX Critiquito — motorista / chip JC · 390px
          </p>
          <AcordoDetalheSheetHeader
            acordoId="acordo-cap-390"
            estadoAcordo="activo"
            acordosPassageiros={[
              { passenger_id: 'pax-jc', estado: 'saiu', lugar_rescisao_modo: 'justa_causa' },
              { passenger_id: 'driver-1', estado: 'activo' },
            ]}
            nPassageirosContrato={2}
            tipoPerfil="Passageiro"
            viewerUserId="pax-jc"
            minhaLinha={{
              passenger_id: 'pax-jc',
              estado: 'saiu',
              lugar_rescisao_modo: 'justa_causa',
            }}
            minhaChipCtx={{ estado: 'anulado' }}
            onClose={() => {}}
            podeRegistarFaltas={false}
            podeEncerrar={false}
            onRegistarFalta={() => {}}
            onEncerrar={() => {}}
            titulo="Detalhe do acordo"
          />
        </section>

        <section
          data-testid="capture-sheet-header-jc"
          className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <p className="text-xs font-semibold text-slate-500 px-4 pt-3">B1 — cabeçalho sheet (justa causa)</p>
          <AcordoDetalheSheetHeader
            acordoId="acordo-capture-jc"
            estadoAcordo="activo"
            acordosPassageiros={[
              { passenger_id: 'pax-jc', estado: 'saiu', lugar_rescisao_modo: 'justa_causa' },
              { passenger_id: 'pax-b', estado: 'activo' },
            ]}
            nPassageirosContrato={2}
            tipoPerfil="Passageiro"
            viewerUserId="pax-jc"
            minhaLinha={{
              passenger_id: 'pax-jc',
              estado: 'saiu',
              lugar_rescisao_modo: 'justa_causa',
            }}
            minhaChipCtx={{ estado: 'anulado' }}
            onClose={() => {}}
            podeRegistarFaltas={false}
            podeEncerrar={false}
            onRegistarFalta={() => {}}
            onEncerrar={() => {}}
          />
        </section>

        <section
          data-testid="capture-sheet-header-expirado"
          className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <p className="text-xs font-semibold text-slate-500 px-4 pt-3">B1 — cabeçalho sheet (reserva expirada)</p>
          <AcordoDetalheSheetHeader
            acordoId="acordo-capture-exp"
            estadoAcordo="activo"
            acordosPassageiros={[
              { passenger_id: 'pax-exp', estado: 'expirado' },
              { passenger_id: 'pax-b', estado: 'activo' },
            ]}
            nPassageirosContrato={2}
            tipoPerfil="Passageiro"
            viewerUserId="pax-exp"
            minhaLinha={{ passenger_id: 'pax-exp', estado: 'expirado' }}
            minhaChipCtx={{
              estado: 'anulado',
              anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
            }}
            onClose={() => {}}
            podeRegistarFaltas={false}
            podeEncerrar={false}
            onRegistarFalta={() => {}}
            onEncerrar={() => {}}
          />
        </section>

        <section data-testid="capture-p1a-pagamento">
          <p className="text-xs font-semibold text-slate-500 mb-2">P1-a — pagamento pendente (motorista)</p>
          <AcordoPagamentosMotoristaPanel
            acordoTerminado={false}
            rows={[pagamentoP1a]}
          />
        </section>

        <section data-testid="capture-chips-motorista" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">P1-d — chips lugar</p>
          <ul className="space-y-2">
            {chips.map(({ key, linha, pagamento }) => {
              const label = labelChipFimLugar(linha, pagamento);
              return (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span>{key}</span>
                  <Badge variant="secondary" className={chipClassFimLugar(label)}>
                    {label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          data-testid="capture-chip-jc-355"
          className="mx-auto w-[355px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
        >
          <p className="text-xs font-semibold text-slate-500 mb-2">355px — chip justa causa (1 linha)</p>
          <Badge
            variant="secondary"
            className={`whitespace-nowrap text-xs font-bold ${chipClassFimLugar(
              labelChipFimLugar({ estado: 'saiu', lugar_rescisao_modo: 'justa_causa' }, null),
            )}`}
          >
            {labelChipFimLugar({ estado: 'saiu', lugar_rescisao_modo: 'justa_causa' }, null)}
          </Badge>
        </section>

        <section data-testid="capture-269-passenger-rows" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">#269 — linhas passageiro (motorista)</p>
          {[
            { id: 'pax-qa1', linha: { perfis: { nome_completo: 'QA Passageiro 3' }, estado: 'activo', quota_mensal_kz: 25000 } },
            { id: 'pax-exp', linha: { perfis: { nome_completo: 'QA Passenger Three' }, estado: 'expirado', quota_mensal_kz: 25000 } },
          ].map(({ id, linha }) => {
            const nome = nomePassageiroUi(linha, { motorista: true });
            const pagCtx = linha.estado === 'expirado'
              ? {
                estado: 'anulado',
                anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
              }
              : null;
            const quotaUi = resolveQuotaLinhaPassageiroUi(linha, pagCtx);
            return (
              <div
                key={id}
                data-testid={`capture-row-${id}`}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">
                  {iniciaisPassageiroUi(nome)}
                </span>
                <p className="flex-1 text-sm font-semibold">{nome}</p>
                {quotaUi.kind === 'quota' ? (
                  <strong className="text-sm tabular-nums">25 000 Kz</strong>
                ) : null}
                {quotaUi.kind === 'text' ? (
                  <span className="text-xs text-slate-500">{QUOTA_LINHA_ANULADO}</span>
                ) : null}
              </div>
            );
          })}
        </section>

        <section data-testid="capture-lista-pax" className="space-y-3">
          <p className="text-xs font-semibold text-slate-500">P1-e — lista passageiro (A saiu)</p>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {LISTA_SECCAO_ENCERRADOS} · 1
          </p>
          <div className="rounded-xl border p-4 space-y-2 bg-white dark:bg-slate-900">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100">Activo</span>
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>Viana</span>
              <span>→</span>
              <span>Centro</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Users size={14} />
                Grupo · 2 pessoas
              </span>
              <strong className="text-primary">15 000 Kz / pessoa</strong>
            </div>
          </div>
          <p className="text-xs text-slate-400">{LISTA_SECCAO_ACTIVOS} · 0 (outro pax noutra sessão)</p>
        </section>
      </div>
    </div>
  );
}
