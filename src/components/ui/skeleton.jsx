import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * @param {React.ComponentProps<'div'>} props
 */
function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
