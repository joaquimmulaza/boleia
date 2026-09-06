import { AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * @typedef {'success' | 'error' | 'offline'} FeedbackAlertType
 */

const VARIANT = {
  success: {
    role: 'status',
    live: 'polite',
    Icon: CheckCircle2,
    srLabel: 'Sucesso:',
    surface:
      'border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/45 dark:text-emerald-50',
    iconClass: 'text-emerald-700 dark:text-emerald-300',
  },
  error: {
    role: 'alert',
    live: 'assertive',
    Icon: AlertCircle,
    srLabel: 'Erro:',
    surface:
      'border-red-200/80 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/45 dark:text-red-50',
    iconClass: 'text-red-700 dark:text-red-300',
  },
  offline: {
    role: 'status',
    live: 'polite',
    Icon: WifiOff,
    srLabel: 'Aviso de rede:',
    surface:
      'border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/55 dark:text-amber-50',
    iconClass: 'text-amber-800 dark:text-amber-200',
  },
};

/**
 * Alerta tonal (MD3) para feedback de sucesso, erro ou rede offline.
 * Ícones + rótulo sr-only para não depender só da cor (Norman / a11y).
 *
 * @param {{
 *   type?: FeedbackAlertType;
 *   text?: string;
 *   children?: import('react').ReactNode;
 *   className?: string;
 *   'data-testid'?: string;
 * }} props
 */
export default function FeedbackAlert({
  type = 'error',
  text = '',
  children,
  className,
  'data-testid': dataTestId,
}) {
  const content = children ?? text;
  if (content == null || content === '') return null;

  const variant = VARIANT[type] ?? VARIANT.error;
  const { role, live, Icon, srLabel, surface, iconClass } = variant;

  return (
    <div
      role={role}
      aria-live={live}
      data-variant={type in VARIANT ? type : 'error'}
      data-testid={dataTestId}
      className={cn(
        'feedback-alert-enter mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm',
        surface,
        className,
      )}
    >
      <Icon
        size={20}
        className={cn('mt-0.5 size-5 shrink-0', iconClass)}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-pretty leading-relaxed">
        <span className="sr-only">{srLabel} </span>
        {content}
      </p>
    </div>
  );
}
