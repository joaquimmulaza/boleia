import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Selector de estrelas 1–5 (obrigatório antes de submeter).
 * @param {{
 *   value: number,
 *   onChange: (value: number) => void,
 *   disabled?: boolean,
 *   id?: string,
 * }} props
 */
export default function StarRatingInput({ value, onChange, disabled = false, id = 'rating-stars' }) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Classificação em estrelas"
      className="flex items-center justify-center gap-2"
      data-testid="star-rating-input"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={`${star} estrelas`}
            disabled={disabled}
            onClick={() => onChange(star)}
            className={cn(
              'size-12 rounded-xl flex items-center justify-center transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              filled ? 'bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Star
              size={28}
              className={cn(
                filled ? 'fill-primary text-primary' : 'text-slate-300',
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
