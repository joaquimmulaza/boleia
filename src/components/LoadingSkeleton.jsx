import React from 'react';
import { cn } from '../lib/utils';

/**
 * Skeleton de carregamento com variantes reutilizáveis.
 * @param {{ variant?: 'card' | 'list' | 'profile'; count?: number; className?: string }} props
 */
const LoadingSkeleton = ({ variant = 'card', count = 3, className }) => {
  if (variant === 'profile') {
    return (
      <div data-testid="skeleton-profile" className={cn('animate-pulse space-y-6 pt-2', className)}>
        <div className="flex flex-col items-center gap-3">
          <div className="size-24 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-40 rounded-2xl bg-slate-200 dark:bg-slate-800/50 w-full" />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3 animate-pulse pt-2', className)}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            data-testid="skeleton-item"
            className="h-16 rounded-xl bg-slate-200 dark:bg-slate-800/50 w-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 animate-pulse pt-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-2xl w-full" />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
