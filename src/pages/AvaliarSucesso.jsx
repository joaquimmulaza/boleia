import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import PageShell from '../components/PageShell';
import { Button } from '../components/ui/button';

/**
 * Confirmação «Já avaliaste» (Figma 1:9).
 */
export default function AvaliarSucesso() {
  const { acordoId } = useParams();
  const navigate = useNavigate();

  return (
    <PageShell className="flex flex-col items-center justify-center text-center min-h-[60dvh]">
      <div
        className="size-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-6"
        aria-hidden="true"
      >
        <CheckCircle2 size={36} />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Já avaliaste</h1>
      <p className="text-sm text-slate-500 text-pretty max-w-xs mb-8">
        Obrigado pelo teu feedback. A contraparte vê apenas que foi avaliada.
      </p>
      <Button
        type="button"
        className="w-full max-w-xs h-11 rounded-xl font-bold"
        onClick={() => navigate(acordoId ? `/acordos?openAcordoId=${acordoId}` : '/acordos')}
        data-testid="avaliar-sucesso-voltar"
      >
        Voltar aos acordos
      </Button>
    </PageShell>
  );
}
