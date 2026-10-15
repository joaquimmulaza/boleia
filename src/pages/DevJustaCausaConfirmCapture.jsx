import React from 'react';
import {
  copyJustaCausaTerminateIntro,
  copyJustaCausaTerminateModoMessage,
  copyJustaCausaTerminateConfirmText,
  copyJustaCausaTerminateTitle,
} from '../utils/justaCausaTerminateConfirmCopy';

/**
 * Pré-visualização DEV (390px) — folha de confirmação justa causa (passageiro parcial/último + motorista).
 */
export default function DevJustaCausaConfirmCapture() {
  const panels = [
    {
      testId: 'dev-jc-confirm-pax-parcial',
      label: 'Passageiro — outros vivos',
      variant: 'passageiro_parcial',
    },
    {
      testId: 'dev-jc-confirm-pax-ultimo',
      label: 'Passageiro — último (B2)',
      variant: 'passageiro_ultimo',
    },
    {
      testId: 'dev-jc-confirm-motorista',
      label: 'Motorista — acordo inteiro',
      variant: 'motorista',
    },
  ];

  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark p-4"
      data-testid="dev-jc-confirm-capture"
    >
      <div className="mx-auto max-w-[390px] space-y-6">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Confirmação justa causa (v1.10 / P0 1:N)
        </h1>

        {panels.map(({ testId, label, variant }) => {
          const counterparty =
            variant === 'motorista' ? 'os passageiros' : 'o motorista';
          const odSuffix = variant === 'motorista' ? '' : ' (Talatona → Mutual)';
          const title = copyJustaCausaTerminateTitle({ variant });
          const intro = copyJustaCausaTerminateIntro({ variant, counterparty, odSuffix });
          const modo = copyJustaCausaTerminateModoMessage({ variant });
          const cta = copyJustaCausaTerminateConfirmText({ variant });

          return (
            <section
              key={testId}
              className="rounded-[34px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-lg"
              data-testid={testId}
            >
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{intro}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{modo}</p>
              <div className="pt-2">
                <span className="inline-flex w-full justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white">
                  {cta}
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
