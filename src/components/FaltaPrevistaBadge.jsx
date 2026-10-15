import React from 'react';
import { Badge } from './ui/badge';

/** Chip «Prevista» — falta com data futura (copy aprovada). */
export default function FaltaPrevistaBadge() {
  return (
    <Badge
      variant="secondary"
      data-testid="falta-chip-prevista"
      className="border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      Prevista
    </Badge>
  );
}
