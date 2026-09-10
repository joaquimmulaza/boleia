import React from 'react';
import { cn } from '../lib/utils';

/**
 * Texto truncado multi-linha com fade mask (sem reticências) + title nativo.
 * Endereços Photon / OD / pickup.
 *
 * @param {{
 *   text?: string | null,
 *   lines?: 1 | 2 | 3,
 *   className?: string,
 * }} props
 */
export default function TruncatedText({ text, lines = 2, className }) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) return null;

  const linesClass =
    lines === 1
      ? 'truncate-fade-y-1'
      : lines === 3
        ? 'truncate-fade-y-3'
        : 'truncate-fade-y-2';

  return (
    <span
      title={value}
      className={cn('min-w-0 truncate-fade-y', linesClass, className)}
    >
      {value}
    </span>
  );
}
