import React from 'react';
import { Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

/**
 * Banner v1.10 — motorista, justa causa invocada por passageiro.
 *
 * @param {{ corpo: string, variant: 'B' | 'B2' }} props
 */
export default function MotoristaJustaCausaPassageiroAlert({ corpo, variant }) {
  return (
    <Alert
      variant="info"
      data-testid={`motorista-jc-passageiro-${variant}`}
      className="scroll-mt-acordo-detalhe"
    >
      <Info className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden="true" />
      <AlertDescription className="text-slate-700 dark:text-slate-200">{corpo}</AlertDescription>
    </Alert>
  );
}
