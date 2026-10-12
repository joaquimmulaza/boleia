import React from 'react';

/**
 * @param {{ label: string; value: string; className?: string }} props
 */
export default function ProfileReadOnlyField({ label, value, className = '' }) {
  return (
    <div className={`py-3 first:pt-0 ${className}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground break-words">{value || '—'}</p>
    </div>
  );
}
