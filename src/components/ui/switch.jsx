import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@/lib/utils';

/**
 * Switch shadcn (Radix) — tokens Boleia, trilho 52×32 (Figma); zona de toque ≥44px (h-11).
 * @param {React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>} props
 */
const Switch = React.forwardRef(function Switch({ className, children, ...props }, ref) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'peer inline-flex h-11 min-h-[44px] w-[52px] shrink-0 cursor-pointer items-center rounded-full border-2 p-0.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        'data-[state=unchecked]:border-border data-[state=unchecked]:bg-muted',
        'overflow-hidden',
        className,
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block size-6 rounded-full bg-background shadow-md ring-0 transition-transform duration-200',
          'data-[state=unchecked]:translate-x-0',
          'data-[state=checked]:translate-x-[1.25rem]',
        )}
      />
      {children}
    </SwitchPrimitives.Root>
  );
});

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
