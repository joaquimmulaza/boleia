import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Switch } from './switch';

/**
 * Wrapper fino sobre Switch shadcn — loading e ARIA de /perfil.
 * Zona de toque: 52×44px (root Radix h-11; trilho visual ~52×32 centrado com items-center).
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
  /** OFF track = bg-muted — spinner com foreground garante ≥3:1 em light/dark */
  const spinnerClass = checked ? 'text-primary-foreground' : 'text-foreground';

  return (
    <Switch
      id={id}
      checked={checked}
      disabled={isDisabled}
      aria-busy={loading ? true : undefined}
      aria-disabled={isDisabled ? true : undefined}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      data-testid="boleia-switch"
      onCheckedChange={(next) => {
        if (isDisabled) return;
        onCheckedChange?.(next);
      }}
      className={cn(
        'relative',
        isDisabled && 'pointer-events-none',
        className,
      )}
    >
      {loading ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <Loader2 className={cn('size-4 animate-spin', spinnerClass)} />
        </span>
      ) : null}
    </Switch>
  );
}
