import React, { memo } from "react";
import { cn } from "../lib/utils";

/**
 * Skeleton de carregamento com variantes reutilizáveis.
 * @param {{ variant?: 'card' | 'list' | 'profile' | 'notificationBell'; count?: number; className?: string }} props
 */
const LoadingSkeleton = memo(({ variant = "card", count = 3, className }) => {
  if (variant === 'notificationBell') {
    return (
      <ul
        className={cn('divide-y divide-gray-100 dark:divide-gray-800/50 animate-pulse', className)}
        data-testid="notification-list-skeleton"
        aria-busy="true"
        aria-label="A carregar notificações"
      >
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="flex items-start gap-3 px-5 py-4"
            data-testid="notification-list-skeleton-row"
          >
            <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800/50" />
            <div className="flex-1 min-w-0 max-w-[390px] space-y-2 pt-0.5">
              <div className="h-4 w-[78%] rounded bg-slate-200 dark:bg-slate-800/50" />
              <div className="h-3.5 w-full rounded bg-slate-200 dark:bg-slate-800/50" />
              <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800/50" />
            </div>
            <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800/50" />
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "profile") {
    return (
      <div
        data-testid="skeleton-profile"
        className={cn("animate-pulse space-y-6 pt-2", className)}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="size-24 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-40 rounded-2xl bg-slate-200 dark:bg-slate-800/50 w-full" />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-3 animate-pulse pt-2", className)}>
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
    <div className={cn("space-y-4 animate-pulse pt-2", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-40 bg-slate-200 dark:bg-slate-800/50 rounded-2xl w-full"
        />
      ))}
    </div>
  );
});

// Added display name for debugging since memo can make it anonymous in some devtools
LoadingSkeleton.displayName = "LoadingSkeleton";

export default LoadingSkeleton;
