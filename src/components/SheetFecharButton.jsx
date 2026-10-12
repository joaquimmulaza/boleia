import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Fechar de sheets — botão X shadcn com aria-label «Fechar».
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
  const handleMouseDown = (e) => {
    e.stopPropagation();
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled) {
      onClick?.(e);
    }
  };

  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      aria-label="Fechar"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`size-10 shrink-0 text-slate-600 dark:text-slate-300 ${className || ''}`}
      {...rest}
    >
      <X className="size-5" aria-hidden="true" />
    </Button>
  );
});

export default SheetFecharButton;
