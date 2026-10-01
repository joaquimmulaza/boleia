import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Badge de estado (janela, à espera, etc.) alinhado ao Figma ENG#35.
 * @param {{ children: React.ReactNode; tone?: 'amber' | 'grey' | 'green' | 'red' }} props
 */
export default function AcordoPrecoBadge({ children, tone = 'amber' }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    grey: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    red: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-100',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
        tones[tone] || tones.amber,
      )}
    >
      {children}
    </span>
  );
}
