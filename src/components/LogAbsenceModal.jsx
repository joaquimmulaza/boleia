import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import { firstDayCurrentMonthLuanda } from '../utils/adendaEffectiveFrom';
import { isFaltaEsteMesAteHoje, todayLuandaISO } from '../utils/faltasDisplay';
import { computeFaltaDesconto } from '../utils/faltaDesconto';
import { formatKwanza } from '../utils/formatKwanza';

/**
 * @typedef {'ida' | 'regresso' | 'ambas'} ViagemFalta
 */

const VIAGENS = [
  { value: 'ambas', label: 'Ida e regresso (dia completo)' },
  { value: 'ida', label: 'Só ida (meia quota)' },
  { value: 'regresso', label: 'Só regresso (meia quota)' },
];

/**
 * Desconto deste dia com a mesma fórmula da quota do acordo.
 * @param {number | null | undefined} quotaMensalKz
 * @param {number | null | undefined} diasUteisMes
 * @param {ViagemFalta} viagem
 * @returns {number | null}
 */
function descontoDesteDia(quotaMensalKz, diasUteisMes, viagem) {
  try {
    return computeFaltaDesconto(quotaMensalKz, diasUteisMes, viagem);
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (form: {
 *     dataFalta: string,
 *     tipo: string,
 *     observacao: string,
 *     viagem: ViagemFalta,
 *   }) => void | Promise<void>,
 *   tipoPerfil?: 'Passageiro' | 'Motorista',
 *   quotaMensalKz?: number | null,
 *   diasUteisMes?: number | null,
 * }} props
 */
const LogAbsenceModal = ({
  isOpen,
  onClose,
  onSubmit,
  tipoPerfil = 'Motorista',
  quotaMensalKz = null,
  diasUteisMes = null,
}) => {
  const isPassageiro = String(tipoPerfil || '').toLowerCase() === 'passageiro';
  const tipoDefault = isPassageiro ? 'Passageiro' : 'Motorista';
  const tipoLocked = isPassageiro;

  const buildInitialForm = () => ({
    dataFalta: '',
    tipo: tipoDefault,
    observacao: '',
    viagem: /** @type {ViagemFalta} */ ('ambas'),
  });

  const [formData, setFormData] = useState(buildInitialForm);

  if (!isOpen) return null;

  const minDataFalta = firstDayCurrentMonthLuanda();
  const maxDataFalta = todayLuandaISO();
  const descontoDia = descontoDesteDia(quotaMensalKz, diasUteisMes, formData.viagem);

  const resetForm = () => {
    setFormData(buildInitialForm());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFaltaEsteMesAteHoje(formData.dataFalta)) return;
    onSubmit(formData);
    resetForm();
  };

  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-black/45"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-4 pt-1.5"
      panelTestId="modal-registar-falta-panel"
      testId="modal-registar-falta"
      onDismiss={handleClose}
    >
      <form className="flex flex-col gap-1" onSubmit={handleSubmit}>
        <SheetDragHandle onDismiss={handleClose} />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm font-semibold text-slate-900 dark:text-white"
          >
            Fechar
          </button>
        </div>

        <h3 className="text-lg font-bold leading-[30px] text-slate-900 dark:text-white">
          Registar Falta
        </h3>

        <label htmlFor="dataFalta" className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          Data
        </label>
        <input
          id="dataFalta"
          type="date"
          min={minDataFalta}
          max={maxDataFalta}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-[15px] text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          value={formData.dataFalta}
          onChange={(e) => setFormData({ ...formData, dataFalta: e.target.value })}
          required
        />
        <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">
          Podes registar um dia deste mês, até hoje. Dias futuros e meses já fechados ficam de fora.
        </p>

        <label htmlFor="tipoFalta" className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          Tipo
        </label>
        {tipoLocked ? (
          <div
            id="tipoFalta"
            data-testid="falta-tipo-locked"
            className="flex w-full items-center rounded-xl border border-slate-200 bg-[#f6f8f6] px-4 py-1.5 text-[15px] text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            Passageiro
          </div>
        ) : (
          <div className="relative">
            <select
              id="tipoFalta"
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-1.5 pr-10 text-[15px] text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
            >
              <option value="Motorista">Motorista</option>
              <option value="Passageiro">Passageiro</option>
            </select>
            <ChevronRight className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          </div>
        )}

        <fieldset className="mt-1 flex flex-col gap-1 border-0 p-0">
          <legend className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
            Trajeto em falta
          </legend>
          {VIAGENS.map((opcao) => {
            const selected = formData.viagem === opcao.value;
            return (
              <label
                key={opcao.value}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 ${
                  selected
                    ? 'border-[1.5px] border-primary bg-primary/10 font-semibold'
                    : 'border-slate-200 font-normal dark:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="viagemFalta"
                  value={opcao.value}
                  checked={selected}
                  onChange={() => setFormData({
                    ...formData,
                    viagem: /** @type {ViagemFalta} */ (opcao.value),
                  })}
                  className="size-4 accent-primary"
                />
                {opcao.label}
              </label>
            );
          })}
        </fieldset>

        <label htmlFor="observacao" className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          Observação (opcional)
        </label>
        <textarea
          id="observacao"
          className="min-h-10 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-[15px] text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          placeholder="Adicionar notas sobre a ausência..."
          value={formData.observacao}
          onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
        />

        <div
          className="rounded-xl bg-primary/10 px-3 py-1.5"
          data-testid="falta-desconto-help"
        >
          <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">
            Ida e regresso descontam o dia completo da quota.
            Só ida ou só regresso descontam metade (meia quota).
            O valor calcula-se automaticamente com a quota do acordo.
          </p>
        </div>

        {descontoDia != null ? (
          <div
            className="flex items-center justify-between py-1 text-[15px] font-semibold text-slate-900 dark:text-white"
            data-testid="falta-desconto-dia"
          >
            <span>Desconto deste dia</span>
            <span className="tabular-nums">{formatKwanza(descontoDia)} Kz</span>
          </div>
        ) : null}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-slate-200 py-1.5 text-[15px] font-semibold text-slate-900 dark:border-slate-700 dark:text-white"
            title="Cancelar"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-primary py-1.5 text-[15px] font-semibold text-[#06130b]"
            title="Guardar"
          >
            Guardar
          </button>
        </div>
      </form>
    </OverlayShell>
  );
};

export default LogAbsenceModal;
