import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import OverlayShell from "./OverlayShell";
import SheetDragHandle from "./SheetDragHandle";
import FaltaAgreementDatePicker from "./FaltaAgreementDatePicker";
import {
  isFaltaEsteMesAteHoje,
  isFutureFaltaDate,
  resolveLogAbsenceDateBounds,
} from "../utils/faltasDisplay";
import { isPassageiroProprioFaltaDataSubmissivel } from "../utils/passageiroFaltaPrazo";
import { isDataDiaViagemAcordo } from "../utils/faltasDiasAcordo";
import { computeFaltaDescontoForIsoDate } from "../utils/faltaDesconto";
import { formatKwanza } from "../utils/formatKwanza";
import FaltaPrevistaBadge from "./FaltaPrevistaBadge";
import {
  FALTA_DATA_HELP_MOTORISTA,
  FALTA_DATA_HELP_PASSAGEIRO,
  FALTA_DATA_INLINE_ERRO_DIA,
} from "../copy/faltasLogAbsenceCopy.js";

/**
 * @typedef {'ida' | 'regresso' | 'ambas'} ViagemFalta
 */

const VIAGENS = [
  { value: "ambas", label: "Ida e regresso (dia completo)" },
  { value: "ida", label: "Só ida (meia quota)" },
  { value: "regresso", label: "Só regresso (meia quota)" },
];

/**
 * Desconto deste dia (divisor = dias de viagem do mês da data, como no trigger SQL).
 * @param {number | null | undefined} quotaMensalKz
 * @param {string} isoDate
 * @param {number[] | null | undefined} diasSemanaAcordo
 * @param {ViagemFalta} viagem
 * @returns {number | null}
 */
function descontoDesteDia(quotaMensalKz, isoDate, diasSemanaAcordo, viagem) {
  if (!isoDate) return null;
  try {
    return computeFaltaDescontoForIsoDate(
      quotaMensalKz,
      isoDate,
      diasSemanaAcordo,
      viagem,
    );
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
 *   diasSemanaAcordo?: number[] | null,
 *   referenceDate?: Date,
 * }} props
 */
const LogAbsenceModal = ({
  isOpen,
  onClose,
  onSubmit,
  tipoPerfil,
  quotaMensalKz = null,
  diasSemanaAcordo = null,
  referenceDate = new Date(),
}) => {
  const perfilNorm = String(tipoPerfil || "").toLowerCase();
  const isPassageiro = perfilNorm === "passageiro";
  const isMotorista = perfilNorm === "motorista";
  const tipoDefault = isPassageiro
    ? "Passageiro"
    : isMotorista
      ? "Motorista"
      : "";
  /** Passageiro na própria vaga (não motorista a registar outro). */
  const isPassageiroLocked = isPassageiro;

  const [formData, setFormData] = useState(() => ({
    dataFalta: "",
    tipo: tipoDefault,
    observacao: "",
    viagem: /** @type {ViagemFalta} */ ("ambas"),
  }));
  const [dataErro, setDataErro] = useState("");

  if (!isOpen) return null;

  const { min: minDataFalta, max: maxDataFalta } = resolveLogAbsenceDateBounds({
    isPassageiroLocked,
    refDate: referenceDate,
  });
  const descontoDia = descontoDesteDia(
    quotaMensalKz,
    formData.dataFalta,
    diasSemanaAcordo,
    formData.viagem,
  );
  const showPrevista =
    isPassageiroLocked && isFutureFaltaDate(formData.dataFalta, referenceDate);
  const dataHelpCopy = isPassageiroLocked
    ? FALTA_DATA_HELP_PASSAGEIRO
    : FALTA_DATA_HELP_MOTORISTA;

  const resetForm = () => {
    setFormData({
      dataFalta: "",
      tipo: tipoDefault,
      observacao: "",
      viagem: "ambas",
    });
    setDataErro("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateData = (iso) => {
    if (!iso) {
      setDataErro("");
      return false;
    }
    if (!isDataDiaViagemAcordo(iso, diasSemanaAcordo)) {
      setDataErro(FALTA_DATA_INLINE_ERRO_DIA);
      return false;
    }
    const boundsOk = isPassageiroLocked
      ? isPassageiroProprioFaltaDataSubmissivel(iso, referenceDate)
      : isFaltaEsteMesAteHoje(iso, referenceDate);
    if (!boundsOk) {
      setDataErro("");
      return false;
    }
    setDataErro("");
    return true;
  };

  const handleDataChange = (iso) => {
    setFormData({ ...formData, dataFalta: iso });
    validateData(iso);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!tipoDefault) return;
    if (!validateData(formData.dataFalta)) return;
    onSubmit({
      ...formData,
      tipo: isPassageiroLocked ? tipoDefault : formData.tipo || tipoDefault,
    });
    resetForm();
  };

  const hasDataError = Boolean(dataErro);

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
            className="text-sm font-semibold text-slate-900 hover:text-slate-700 dark:text-white dark:hover:text-slate-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 rounded-sm"
          >
            Fechar
          </button>
        </div>

        <h3 className="text-lg font-bold leading-[30px] text-slate-900 dark:text-white">
          Registar Falta
        </h3>

        <span
          id="dataFalta-label"
          className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100"
        >
          Data
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <FaltaAgreementDatePicker
            id="dataFalta"
            value={formData.dataFalta}
            onChange={handleDataChange}
            min={minDataFalta}
            max={maxDataFalta}
            diasSemana={diasSemanaAcordo}
            describedBy="dataFalta-help"
            errorId="dataFalta-error"
            hasError={hasDataError}
            initialMonth={minDataFalta}
          />
          {showPrevista ? <FaltaPrevistaBadge /> : null}
        </div>
        <p
          id="dataFalta-help"
          data-testid="falta-data-help"
          className="whitespace-normal break-words text-xs leading-4 text-slate-500 dark:text-slate-400"
        >
          {dataHelpCopy}
        </p>
        {hasDataError ? (
          <p
            id="dataFalta-error"
            role="alert"
            data-testid="falta-data-error"
            className="whitespace-normal break-words text-xs leading-4 text-red-600 dark:text-red-400"
          >
            {dataErro}
          </p>
        ) : null}

        <label
          htmlFor="tipoFalta"
          className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100"
        >
          Tipo
        </label>
        {isPassageiroLocked ? (
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
              value={formData.tipo || tipoDefault}
              onChange={(e) =>
                setFormData({ ...formData, tipo: e.target.value })
              }
            >
              <option value="Motorista">Motorista</option>
              <option value="Passageiro">Passageiro</option>
            </select>
            <ChevronRight
              className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
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
                    ? "border-[1.5px] border-primary bg-primary/10 font-semibold"
                    : "border-slate-200 font-normal dark:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="viagemFalta"
                  value={opcao.value}
                  checked={selected}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      viagem: /** @type {ViagemFalta} */ (opcao.value),
                    })
                  }
                  className="size-4 accent-primary"
                />
                {opcao.label}
              </label>
            );
          })}
        </fieldset>

        <label
          htmlFor="observacao"
          className="mt-1 text-[13px] font-semibold text-slate-900 dark:text-slate-100"
        >
          Observação (opcional)
        </label>
        <textarea
          id="observacao"
          className="min-h-10 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-[15px] text-slate-900 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          placeholder="Adicionar notas sobre a ausência..."
          value={formData.observacao}
          onChange={(e) =>
            setFormData({ ...formData, observacao: e.target.value })
          }
        />

        <div
          className="rounded-xl bg-primary/10 px-3 py-1.5"
          data-testid="falta-desconto-help"
        >
          <p className="text-xs leading-4 text-slate-500 dark:text-slate-400">
            Ida e regresso descontam o dia completo da quota. Só ida ou só
            regresso descontam metade (meia quota). O valor calcula-se
            automaticamente com a quota do acordo.
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
            className="flex-1 rounded-xl border border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 py-1.5 text-[15px] font-semibold text-slate-900 dark:border-slate-700 dark:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            title="Cancelar"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!tipoDefault || !formData.dataFalta || hasDataError}
            className="flex-1 rounded-xl bg-primary hover:bg-primary/90 py-1.5 text-[15px] font-semibold text-[#06130b] disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
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
