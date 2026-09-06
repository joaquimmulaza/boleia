import React from 'react';
import { cn } from '../lib/utils';

/**
 * Wrapper de página mobile-first com padding consistente.
 * @param {{ children: React.ReactNode; className?: string }} props
 */
const PageShell = ({ children, className }) => (
  <div className={cn('flex-1 px-4 py-6 pb-24 max-w-md mx-auto w-full', className)}>
    {children}
  </div>
);

export default PageShell;
