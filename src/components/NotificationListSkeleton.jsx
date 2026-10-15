import React from 'react';
import LoadingSkeleton from './LoadingSkeleton';

/**
 * Placeholder da lista do sino — reutiliza {@link LoadingSkeleton} (`notificationBell`).
 *
 * @param {{ rows?: number }} props
 */
export default function NotificationListSkeleton({ rows = 3 }) {
  return <LoadingSkeleton variant="notificationBell" count={rows} />;
}
