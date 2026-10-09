import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Switch } from './switch';

/**
 * Wrapper fino sobre Switch shadcn — loading, hit area 52×44, ARIA de /perfil.
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
    <div
      className={cn(
        'relative inline-flex h-11 w-[52px] shrink-0 items-center justify-center',
        className,
      )}
      data-testid="boleia-switch"
    >
      <Switch
        id={id}
        checked={checked}
        disabled={isDisabled}
        aria-busy={loading ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onCheckedChange={(next) => {
          if (isDisabled) return;
          onCheckedChange?.(next);
        }}
        className={cn(isDisabled && 'pointer-events-none')}
      />
      {loading ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <Loader2 className="size-4 animate-spin text-primary-foreground" />
        </span>
      ) : null}
    </div>
  );
}
