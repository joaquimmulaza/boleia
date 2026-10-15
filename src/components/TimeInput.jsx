import React, { useId, useState } from 'react';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { ADDRESS_INPUT_SURFACE_CLASS } from '../utils/addressInputSurface.js';
import { formatTime24h } from '../utils/formatTime.js';
import {
  isValidTime24h,
  maskTimeInputRaw,
  normalizeTime24h,
  TIME_INPUT_INVALID_MESSAGE,
} from '../utils/timeInputMask.js';

/** @type {string} */
export const TIME_INPUT_ERROR_TEST_ID = 'time-input-error';

/**
 * Campo de hora em texto HH:MM (24h fixo) — sem `input type=time` (locale 12h do OS).
 * @param {{
 *   name: string;
 *   value: string;
 *   onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
 *   required?: boolean;
 *   disabled?: boolean;
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
  disabled = false,
  className,
  id: idProp,
  'aria-label': ariaLabel,
}) => {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const errorId = `${inputId}-error`;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState('');

  const committed = formatTime24h(value) || '';
  const shownValue = isEditing ? editText : committed;

  const emitChange = (e, nextValue) => {
    onChange({
      ...e,
      target: {
        ...e.target,
        name,
        id: inputId,
        value: nextValue,
      },
    });
  };

  const handleFocus = () => {
    setIsEditing(true);
    setEditText(committed);
    setError('');
  };

  const handleChange = (e) => {
    const masked = maskTimeInputRaw(e.target.value);
    setEditText(masked);
    setError('');
    const normalized = normalizeTime24h(masked);
    if (normalized) {
      emitChange(e, normalized);
    }
  };

  const handleBlur = (e) => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (!trimmed) {
      if (required) {
        setError('Indica a hora.');
      }
      return;
    }
    if (!isValidTime24h(trimmed)) {
      setError(TIME_INPUT_INVALID_MESSAGE);
      return;
    }
    const normalized = normalizeTime24h(trimmed);
    if (normalized && normalized !== value) {
      emitChange(e, normalized);
    }
  };

  return (
    <div className="w-full">
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        name={name}
        id={inputId}
        value={shownValue}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder="17:45"
        maxLength={5}
        className={cn(
          'time-input-24h tabular-nums',
          ADDRESS_INPUT_SURFACE_CLASS,
          'h-11 min-h-11',
          className,
        )}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          data-testid={TIME_INPUT_ERROR_TEST_ID}
          className="mt-1 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default TimeInput;
