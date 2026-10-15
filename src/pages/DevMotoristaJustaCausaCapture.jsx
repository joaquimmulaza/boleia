import React from 'react';
import MotoristaJustaCausaPassageiroAlert from '../components/MotoristaJustaCausaPassageiroAlert';
import {
  copyMotoristaJustaCausaParcial,
  copyMotoristaJustaCausaUltimoPassageiro,
} from '../utils/driverJustaCausaPassageiroCopy';

const DATA_FIXA = '12 de outubro de 2026';

/**
 * Pré-visualização DEV (390px) — banners v1.10 justa causa passageiro (motorista).
 */
export default function DevMotoristaJustaCausaCapture() {
  const corpoB = copyMotoristaJustaCausaParcial({ nome: 'Ana', dataFormatada: DATA_FIXA });
  const corpoB2 = copyMotoristaJustaCausaUltimoPassageiro({
    nome: 'Ana',
    dataFormatada: DATA_FIXA,
  });

  return (
    <div
      className="min-h-dvh bg-background-light dark:bg-background-dark p-4"
      data-testid="dev-motorista-jc-capture"
    >
      <div className="mx-auto max-w-[390px] space-y-6">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          v1.10 — justa causa passageiro (motorista)
        </h1>

        <section
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
          data-testid="dev-motorista-jc-B"
        >
          <p className="text-xs font-semibold text-slate-500">B) Outros passageiros activos</p>
          <MotoristaJustaCausaPassageiroAlert corpo={corpoB} variant="B" />
        </section>

        <section
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
          data-testid="dev-motorista-jc-B2"
        >
          <p className="text-xs font-semibold text-slate-500">B2) Último passageiro</p>
          <MotoristaJustaCausaPassageiroAlert corpo={corpoB2} variant="B2" />
        </section>
      </div>
    </div>
  );
}
