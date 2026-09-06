import React from 'react';
import { cn } from '../lib/utils';

/**
 * Input de hora em formato 24h (PT-AO/PT-PT) — sem AM/PM.
 * @param {{
 *   name: string;
 *   value: string;
 *   onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
 *   required?: boolean;
 *   className?: string;
 *   id?: string;
 *   'aria-label'?: string;
 * }} props
 */
const TimeInput = ({
  name,
  value,
  onChange,
  required = false,
  className,
  id,
  'aria-label': ariaLabel,
}) => (
  <input
    type="time"
    lang="pt-PT"
    step="60"
    name={name}
    id={id}
    value={value}
    onChange={onChange}
    required={required}
    aria-label={ariaLabel}
    className={cn('time-input-24h tabular-nums', className)}
  />
);

export default TimeInput;
