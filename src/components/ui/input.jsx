import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Input shadcn (JSX) — tokens `border-input` / `bg-background`.
 * @param {object} props
 * @param {string} [props.className]
 * @param {string} [props.type]
 */
const Input = React.forwardRef(function Input({ className, type, ...props }, ref) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

export { Input };
