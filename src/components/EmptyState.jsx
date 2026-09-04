import React from 'react';
import { Car } from 'lucide-react';

/**
 * Estado vazio com mensagem e acção opcional.
 * @param {{
 *   icon?: import('lucide-react').LucideIcon;
 *   title?: string;
 *   message: string;
 *   actionLabel?: string;
 *   onAction?: () => void;
 * }} props
 */
const EmptyState = ({
  icon: IconComponent = Car,
  title,
  message,
  actionLabel,
  onAction,
}) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-4">
    <div className="bg-primary/10 rounded-full p-6">
      <IconComponent size={48} className="text-primary" aria-hidden="true" />
    </div>
    {title ? (
      <h3 className="text-base font-bold text-slate-900 dark:text-white text-balance">{title}</h3>
    ) : null}
    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed text-pretty">{message}</p>
    {actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="mt-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-all"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

export default EmptyState;
