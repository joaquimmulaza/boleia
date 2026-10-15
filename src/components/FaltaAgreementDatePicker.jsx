import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isDataDiaViagemAcordo } from '../utils/faltasDiasAcordo';
import { firstDayOfMonthFromIso } from '../utils/faltasDisplay';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/**
 * @param {string} mesInicio YYYY-MM-01
 * @returns {{ year: number, month: number, daysInMonth: number, startPad: number }}
 */
function parseMonth(mesInicio) {
  const iso = String(mesInicio || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-01$/.exec(iso);
  if (!m) {
    const now = new Date();
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      daysInMonth: 30,
      startPad: 0,
    };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstIso = `${m[1]}-${m[2]}-01`;
  const firstDow = new Date(`${firstIso}T12:00:00Z`).getUTCDay();
  const startPad = firstDow === 0 ? 6 : firstDow - 1;
  return { year, month, daysInMonth, startPad };
}

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {string}
 */
function monthStartIso(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * @param {string} mesInicio
 * @param {number} delta
 * @returns {string}
 */
function shiftMonth(mesInicio, delta) {
  const { year, month } = parseMonth(mesInicio);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthStartIso(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/**
 * @param {{
 *   id: string,
 *   value: string,
 *   onChange: (iso: string) => void,
 *   min: string,
 *   max?: string,
 *   diasSemana?: number[] | null,
 *   describedBy?: string,
 *   errorId?: string,
 *   hasError?: boolean,
 *   initialMonth?: string,
 * }} props
 */
export default function FaltaAgreementDatePicker({
  id,
  value,
  onChange,
  min,
  max,
  diasSemana,
  describedBy,
  errorId,
  hasError = false,
  initialMonth,
}) {
  const minIso = String(min || '').slice(0, 10);
  const maxIso = max ? String(max).slice(0, 10) : null;
  const [viewMonth, setViewMonth] = useState(() =>
    firstDayOfMonthFromIso(initialMonth || value || minIso || '2026-01-01'),
  );

  const { year, month, daysInMonth, startPad } = parseMonth(viewMonth);
  const monthLabel = new Intl.DateTimeFormat('pt-PT', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  const cells = useMemo(() => {
    const items = [];
    for (let i = 0; i < startPad; i += 1) {
      items.push({ type: 'pad', key: `pad-${i}` });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const inRange = iso >= minIso && (!maxIso || iso <= maxIso);
      const diaViagem = isDataDiaViagemAcordo(iso, diasSemana);
      const disabled = !inRange || !diaViagem;
      items.push({
        type: 'day',
        key: iso,
        iso,
        day,
        disabled,
        selected: value === iso,
      });
    }
    return items;
  }, [startPad, daysInMonth, year, month, minIso, maxIso, diasSemana, value]);

  const canPrev = shiftMonth(viewMonth, -1) >= firstDayOfMonthFromIso(minIso);
  const canNext = !maxIso || shiftMonth(viewMonth, 1) <= firstDayOfMonthFromIso(maxIso);

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={[describedBy, hasError && errorId ? errorId : null].filter(Boolean).join(' ') || undefined}
      className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
      data-testid="falta-agreement-date-picker"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
          className="rounded-lg p-1 text-slate-600 disabled:opacity-30 dark:text-slate-300"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <span id={`${id}-label`} className="text-sm font-semibold capitalize text-slate-900 dark:text-white">
          {monthLabel}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
          className="rounded-lg p-1 text-slate-600 disabled:opacity-30 dark:text-slate-300"
          aria-label="Mês seguinte"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (cell.type === 'pad') {
            return <span key={cell.key} aria-hidden="true" />;
          }
          return (
            <button
              key={cell.key}
              type="button"
              disabled={cell.disabled}
              onClick={() => onChange(cell.iso)}
              aria-pressed={cell.selected}
              aria-label={cell.iso}
              data-testid={`falta-dia-${cell.iso}`}
              className={cn(
                'h-9 rounded-lg text-sm font-medium tabular-nums',
                cell.selected
                  ? 'bg-primary text-[#06130b]'
                  : 'text-slate-900 dark:text-white',
                cell.disabled
                  ? 'cursor-not-allowed opacity-30'
                  : 'hover:bg-primary/15',
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={id} value={value} readOnly />
    </div>
  );
}
