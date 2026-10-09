import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@/lib/utils';

/**
 * Switch shadcn (Radix) — Root h-11 (zona de toque ≥44px, transparente); trilho visual 52×32 num span interior.
 * @param {React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>} props
 */
const Switch = React.forwardRef(function Switch({ className, children, ...props }, ref) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'group peer inline-flex h-11 min-h-[44px] w-[52px] shrink-0 cursor-pointer items-center justify-center',
        'border-0 bg-transparent p-0 shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
      ref={ref}
    >
      <span
        data-testid="switch-track-visual"
        aria-hidden="true"
        className={cn(
          'inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 p-0.5 transition-colors overflow-hidden',
          'group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary',
          'group-data-[state=unchecked]:border-border group-data-[state=unchecked]:bg-muted',
        )}
      >
        <SwitchPrimitives.Thumb
          className={cn(
            'pointer-events-none block size-6 rounded-full bg-background shadow-md ring-0 transition-transform duration-200',
            'data-[state=unchecked]:translate-x-0',
            'data-[state=checked]:translate-x-[1.25rem]',
          )}
        />
      </span>
      {children}
    </SwitchPrimitives.Root>
  );
});

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
