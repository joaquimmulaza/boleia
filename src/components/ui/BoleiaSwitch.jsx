import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Switch acessível (Figma KIT — track 52×32, hit area 52×44).
 *
 * @param {{
 *   checked?: boolean;
 *   disabled?: boolean;
 *   loading?: boolean;
 *   onCheckedChange?: (next: boolean) => void;
 *   id?: string;
 *   'aria-labelledby'?: string;
 *   'aria-describedby'?: string;
 *   className?: string;
 * }} props
 */
export default function BoleiaSwitch({
  checked = false,
  disabled = false,
  loading = false,
  onCheckedChange,
  id,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  className,
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-disabled={isDisabled ? true : undefined}
      aria-busy={loading ? true : undefined}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        onCheckedChange?.(!checked);
      }}
      className={cn(
        'relative inline-flex h-11 w-[52px] shrink-0 items-center justify-center rounded-full',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'dark:focus-visible:ring-offset-slate-900',
        isDisabled && 'cursor-not-allowed opacity-40',
        className,
      )}
      data-testid="boleia-switch"
    >
      <span
        className={cn(
          'relative block h-8 w-[52px] rounded-full border transition-colors duration-200',
          checked
            ? 'border-primary bg-primary'
            : 'border-slate-400 bg-slate-200 dark:border-slate-500 dark:bg-slate-700',
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            'absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200',
            'border border-slate-400 dark:border-slate-500',
            checked ? 'translate-x-[24px]' : 'translate-x-1',
          )}
        />
        {loading ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-4 animate-spin text-white" aria-hidden="true" />
          </span>
        ) : null}
      </span>
    </button>
  );
}
