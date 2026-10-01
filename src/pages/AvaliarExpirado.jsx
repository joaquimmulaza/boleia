import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import PageShell from '../components/PageShell';
import { Button } from '../components/ui/button';

/**
 * Janela expirou (Figma 1:11).
 */
export default function AvaliarExpirado() {
  const { acordoId } = useParams();
  const navigate = useNavigate();

  return (
    <PageShell className="flex flex-col items-center justify-center text-center min-h-[60dvh]">
      <div
        className="size-16 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mb-6"
        aria-hidden="true"
      >
        <Clock size={36} />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Janela expirou</h1>
      <p className="text-sm text-slate-500 text-pretty max-w-xs mb-8">
        O prazo para avaliar este período terminou. Podes continuar a usar a plataforma normalmente.
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-full max-w-xs h-11 rounded-xl font-bold"
        onClick={() => navigate(acordoId ? `/acordos?openAcordoId=${acordoId}` : '/acordos')}
        data-testid="avaliar-expirado-voltar"
      >
        Voltar aos acordos
      </Button>
    </PageShell>
  );
}
