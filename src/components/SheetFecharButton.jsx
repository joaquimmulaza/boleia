import React from 'react';
import { Button } from './ui/button';

/**
 * Fechar de sheets bottom — shadcn Button com nome acessível fixo.
 * @param {{
 *   onClick: () => void,
 *   disabled?: boolean,
 *   'data-testid'?: string,
 *   className?: string,
 * } & import('react').ComponentPropsWithoutRef<typeof Button>} props
 */
const SheetFecharButton = React.forwardRef(function SheetFecharButton(
  { onClick, disabled = false, className, ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      aria-label="Fechar"
      onClick={onClick}
      className={`h-10 shrink-0 px-3 font-bold text-slate-600 dark:text-slate-300 ${className || ''}`}
      {...rest}
    >
      Fechar
    </Button>
  );
});

export default SheetFecharButton;
