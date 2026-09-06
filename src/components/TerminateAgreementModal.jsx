import React, { useId, useState } from 'react';
import { Button } from './ui/button';
import FeedbackAlert from './FeedbackAlert';
import { RESCISAO_JUSTIFICATIVAS, RESCISAO_MODOS } from '../services/AgreementService';

/**
 * @typedef {'aviso_previo' | 'consensual' | 'justa_causa'} RescisaoModo
 * @typedef {'faltas_excessivas' | 'avaria_veiculo' | 'seguranca'} RescisaoJustificativa
 */

const MODO_COPY = {
  aviso_previo: {
    titulo: 'Aviso prévio',
    descricao:
      'O acordo continua activo até ao último dia deste mês. As boleias e as vagas mantêm-se. O contrato termina no 1.º dia do mês seguinte.',
  },
  consensual: {
    titulo: 'Por acordo das duas partes',
    descricao:
      'Precisa de confirmação da outra parte. Até lá o acordo continua activo. Uma confirmação encerra o acordo para todos.',
  },
  justa_causa: {
    titulo: 'Justa causa',
    descricao: 'Termina de imediato. Indica a razão. A outra parte é notificada.',
  },
};

const JUSTIFICATIVA_LABEL = {
  faltas_excessivas: 'Faltas em excesso',
  avaria_veiculo: 'Avaria do veículo',
  seguranca: 'Questão de segurança',
};

/**
 * Modal de rescisão do acordo inteiro (3 modos).
 * Justa causa: select do enum do serviço — sem texto livre e sem preview pro-rata.
 *
 * @param {{
 *   isOpen: boolean,
 *   acordo?: object,
 *   busy?: boolean,
 *   error?: string,
 *   onConfirm: (input: { modo: RescisaoModo, justificativa?: RescisaoJustificativa }) => void,
 *   onCancel: () => void,
 * }} props
 */
export default function TerminateAgreementModal({
  isOpen,
  acordo,
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const [modo, setModo] = useState(/** @type {RescisaoModo | ''} */ (''));
  const [justificativa, setJustificativa] = useState(/** @type {RescisaoJustificativa | ''} */ (''));

  if (!isOpen) return null;

  const precisaMotivo = modo === 'justa_causa';
  const canSubmit =
    Boolean(modo) &&
    RESCISAO_MODOS.includes(/** @type {RescisaoModo} */ (modo)) &&
    (!precisaMotivo || RESCISAO_JUSTIFICATIVAS.includes(/** @type {RescisaoJustificativa} */ (justificativa)));

  const handleOverlayClick = () => {
    if (busy) return;
    onCancel();
  };

  const handleConfirm = () => {
    if (!canSubmit || busy) return;
    if (modo === 'justa_causa') {
      onConfirm({
        modo: 'justa_causa',
        justificativa: /** @type {RescisaoJustificativa} */ (justificativa),
      });
      return;
    }
    onConfirm({ modo: /** @type {RescisaoModo} */ (modo) });
  };

  return (
    <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className="fixed inset-0 bg-black/80"
        aria-hidden="true"
        onClick={handleOverlayClick}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-acordo-id={acordo?.id || undefined}
        className="relative w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
      >
        <div className="px-6 pt-8 pb-4 space-y-2">
          <h3 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white text-balance">
            Rescindir acordo
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-pretty">
            Escolhe como queres terminar. Isto afecta o acordo inteiro, não só o teu lugar.
          </p>
        </div>

        <fieldset className="px-6 space-y-2" disabled={busy}>
          <legend className="sr-only">Modo de rescisão</legend>
          <div role="radiogroup" aria-labelledby={titleId} className="space-y-2">
            {RESCISAO_MODOS.map((valor) => {
              const copy = MODO_COPY[valor];
              const selected = modo === valor;
              return (
                <label
                  key={valor}
                  className={`flex items-start gap-3 rounded-xl border p-3 min-h-12 cursor-pointer ${
                    selected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="rescisao-modo"
                    value={valor}
                    checked={selected}
                    disabled={busy}
                    onChange={() => {
                      setModo(valor);
                      if (valor !== 'justa_causa') setJustificativa('');
                    }}
                    className="mt-1 size-6 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      {copy.titulo}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 text-pretty">
                      {copy.descricao}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {precisaMotivo ? (
          <div className="px-6 pt-4">
            <label
              htmlFor="terminate-motivo"
              className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              Motivo
              <select
                id="terminate-motivo"
                value={justificativa}
                disabled={busy}
                onChange={(e) =>
                  setJustificativa(/** @type {RescisaoJustificativa | ''} */ (e.target.value))
                }
                className="h-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Escolhe o motivo</option>
                {RESCISAO_JUSTIFICATIVAS.map((valor) => (
                  <option key={valor} value={valor}>
                    {JUSTIFICATIVA_LABEL[valor]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <div className="flex flex-col p-4 pt-6">
          {error ? (
            <FeedbackAlert type="error" text={error} className="mb-4" />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            autoFocus
            disabled={busy}
            onClick={onCancel}
            className="w-full min-h-12 rounded-2xl font-bold text-slate-600 dark:text-slate-300"
          >
            Cancelar
          </Button>
          <div className="h-6" aria-hidden="true" />
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit || busy}
            onClick={handleConfirm}
            className="w-full min-h-12 rounded-2xl font-bold bg-destructive text-destructive-foreground"
          >
            Confirmar rescisão
          </Button>
        </div>
      </div>
    </div>
  );
}
