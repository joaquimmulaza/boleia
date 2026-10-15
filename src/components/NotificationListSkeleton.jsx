import React from 'react';
import { Skeleton } from './ui/skeleton';

/**
 * Placeholder da lista do sino — alinhado ao layout de {@link NotificationListItem}.
 *
 * @param {{ rows?: number }} props
 */
export default function NotificationListSkeleton({ rows = 3 }) {
  return (
    <ul
      className="divide-y divide-gray-100 dark:divide-gray-800/50"
      data-testid="notification-list-skeleton"
      aria-busy="true"
      aria-label="A carregar notificações"
    >
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex items-start gap-3 px-5 py-4"
          data-testid="notification-list-skeleton-row"
        >
          <Skeleton className="mt-0.5 h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 min-w-0 max-w-[390px] space-y-2 pt-0.5">
            <Skeleton className="h-4 w-[78%]" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="mt-2 h-2 w-2 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
