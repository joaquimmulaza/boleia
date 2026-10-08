import React from 'react';
import { ArrowRight, Clock, Users, ChevronRight } from 'lucide-react';
import TextFade from './TextFade';
import OfertaKebabMenu from './OfertaKebabMenu';
import OfertaEditPanel from './OfertaEditPanel';
import { labelOfertaRota } from '../services/OfertaService';
import { formatKwanza } from '../utils/formatKwanza';

/**
 * @param {object} oferta
 */
function OfertaRotaTitulo({ oferta }) {
  const flexLabel = labelOfertaRota(oferta);
  if (flexLabel) {
    return (
      <TextFade as="div" className="font-bold text-slate-900 dark:text-white">
        {flexLabel}
      </TextFade>
    );
  }
  return (
    <div className="flex items-center gap-2 min-w-0 font-bold text-slate-900 dark:text-white">
      <TextFade className="flex-1">{oferta.origin_name}</TextFade>
      <ArrowRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
      <TextFade className="flex-1">{oferta.destination_name}</TextFade>
    </div>
  );
}

/**
 * Card de oferta no hub motorista — card vivo + kebab + CTAs no corpo (Figma D2 / KebabCard).
 * @param {{
 *   oferta: object,
 *   chip: { label: string, className: string },
 *   horario: string,
 *   tipoRota: string,
 *   modoLabel: string,
 *   canEdit: boolean,
 *   canDespublicar: boolean,
 *   editing: boolean,
 *   ofertaBusy: boolean,
 *   editPropostas: object[],
 *   editProcurasById: Record<string, object>,
 *   veiculoVagasPassageiros?: number | null,
 *   onOpenDetail: () => void,
 *   onVerProcuras: () => void,
 *   onVerPropostas: () => void,
 *   onEditar: () => void,
 *   onDespublicar: () => void,
 *   onCancelEdit: () => void,
 *   onSaved: (oferta: object) => void,
 *   temAcordoActivoMsg?: boolean,
 * }} props
 */
function DriverOfertaCard({
  oferta,
  chip,
  horario,
  tipoRota,
  modoLabel,
  canEdit,
  canDespublicar,
  editing,
  ofertaBusy,
  editPropostas,
  editProcurasById,
  veiculoVagasPassageiros = null,
  onOpenDetail,
  onVerProcuras,
  onVerPropostas,
  onEditar,
  onDespublicar,
  onCancelEdit,
  onSaved,
  temAcordoActivoMsg = false,
}) {
  return (
    <section
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
      data-testid={`driver-oferta-card-${oferta.id}`}
    >
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${chip.className}`}>
            {chip.label}
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {tipoRota}
          </span>
        </div>
        <OfertaKebabMenu
          canEdit={canEdit}
          canDespublicar={canDespublicar}
          disabled={ofertaBusy}
          onEditar={onEditar}
          onDespublicar={onDespublicar}
        />
      </div>

      <button
        type="button"
        data-testid="driver-oferta-detail-trigger"
        onClick={onOpenDetail}
        className="w-full text-left px-5 pb-5 pt-3 space-y-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
        aria-label="Ver detalhe da oferta"
      >
        <OfertaRotaTitulo oferta={oferta} />

        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-1 tabular-nums">
            <Clock size={15} aria-hidden="true" /> {horario}
          </span>
          <span className="flex items-center gap-1">
            <Users size={15} aria-hidden="true" />{' '}
            {oferta.vagas_disponiveis}{' '}
            {oferta.vagas_disponiveis === 1 ? 'lugar disponível' : 'lugares disponíveis'}
          </span>
        </div>

        <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
          <strong className="text-primary tabular-nums text-lg">
            {formatKwanza(oferta.valor_mensal_ask_kz)} Kz
          </strong>
          <p className="text-xs text-slate-400">{modoLabel}</p>
        </div>
      </button>

      <div className="px-5 pb-5 flex flex-col gap-2 border-t border-slate-50 dark:border-slate-800 pt-3">
        <button
          type="button"
          onClick={onVerProcuras}
          className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 w-fit"
        >
          Procuras compatíveis <ChevronRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onVerPropostas}
          className="w-full min-h-11 rounded-xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center gap-1"
        >
          Ver propostas <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {canEdit && editing ? (
        <div className="px-5 pb-5 border-t border-slate-50 dark:border-slate-800 pt-3">
          <OfertaEditPanel
            oferta={oferta}
            busy={ofertaBusy}
            propostas={editPropostas}
            procurasById={editProcurasById}
            veiculoVagasPassageiros={veiculoVagasPassageiros}
            onCancel={onCancelEdit}
            onSaved={onSaved}
          />
        </div>
      ) : null}

      {canEdit && !canDespublicar && temAcordoActivoMsg ? (
        <p className="px-5 pb-4 text-xs text-slate-500 text-pretty">
          Com acordo activo, encerra o acordo em Acordos antes de despublicar.
        </p>
      ) : null}
    </section>
  );
}

export default DriverOfertaCard;
export { OfertaRotaTitulo };
