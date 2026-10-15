import React, { useEffect, useId, useState } from 'react';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import { ADDRESS_INPUT_SURFACE_CLASS } from '../utils/addressInputSurface.js';
import { formatTime24h } from '../utils/formatTime.js';
import {
  formatTimeInputOnBlur,
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
 *   onValidityChange?: (valid: boolean) => void;
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
  onValidityChange,
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
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [invalidDisplay, setInvalidDisplay] = useState(null);

  const committed = formatTime24h(value) || '';
  const shownValue = isEditing ? editText : invalidDisplay ?? committed;

  const emitChange = (nextValue) => {
    onChange({
      type: 'change',
      target: {
        name,
        id: inputId,
        value: nextValue,
      },
    });
  };

  const computeValid = () => {
    if (invalidDisplay || error) return false;
    if (required && !committed) return false;
    if (committed && !isValidTime24h(committed)) return false;
    return true;
  };

  useEffect(() => {
    onValidityChange?.(computeValid());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validity derivada de estado local + value
  }, [invalidDisplay, error, committed, required, onValidityChange]);

  const handleFocus = () => {
    setIsEditing(true);
    setEditText(invalidDisplay ?? committed);
    setError('');
    setInvalidDisplay(null);
  };

  const handleChange = (e) => {
    const masked = maskTimeInputRaw(e.target.value);
    setEditText(masked);
    setError('');
    setInvalidDisplay(null);
    const normalized = normalizeTime24h(masked);
    if (normalized) {
      emitChange(normalized);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (!trimmed) {
      setInvalidDisplay(null);
      if (required) {
        setError('Indica a hora.');
        return;
      }
      setError('');
      emitChange('');
      return;
    }

    const candidate = formatTimeInputOnBlur(trimmed);
    if (!isValidTime24h(candidate)) {
      setInvalidDisplay(trimmed.includes(':') ? trimmed : candidate);
      setError(TIME_INPUT_INVALID_MESSAGE);
      return;
    }

    const normalized = normalizeTime24h(candidate);
    setInvalidDisplay(null);
    setError('');
    if (normalized && normalized !== value) {
      emitChange(normalized);
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
