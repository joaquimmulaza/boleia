import React from 'react';
import { MapPin } from 'lucide-react';
import {
  GEOCODER_NETWORK_ERROR_TODO,
  GEOCODER_RETRY_LABEL,
} from '../utils/addressGeocoderCopy';

/**
 * Lista de sugestões (padrão combobox shadcn: listbox + option + aria-activedescendant no input).
 * @param {{
 *   suggestions: Array<{ place_id: string, description: string }>,
 *   loading: boolean,
 *   error: string | null,
 *   errorKind?: 'network' | null,
 *   onSelect: (suggestion: { place_id: string, description: string }) => void,
 *   onRetry?: () => void,
 *   listboxId: string,
 *   activeIndex: number,
 *   title?: string,
 *   emptyMessage?: string,
 *   freeTextActionLabel?: string,
 *   onUseFreeText?: () => void,
 * }} props
 */
const AutocompleteDropdown = ({
  suggestions = [],
  loading,
  error,
  errorKind = null,
  onSelect,
  onRetry,
  listboxId,
  activeIndex,
  title,
  emptyMessage,
  freeTextActionLabel,
  onUseFreeText,
}) => {
  if (loading) {
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden p-4">
        <p className="text-sm text-slate-500 text-center animate-pulse">A procurar...</p>
      </div>
    );
  }

  if (errorKind === 'network') {
    return (
      <div
        className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-xl shadow-lg overflow-hidden p-4 space-y-3"
        role="alert"
        data-testid="geocoder-network-error"
      >
        <p className="text-sm text-amber-900 dark:text-amber-100 text-center text-pretty">
          {GEOCODER_NETWORK_ERROR_TODO}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm font-semibold text-amber-950 dark:text-amber-50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
          >
            {GEOCODER_RETRY_LABEL}
          </button>
        ) : null}
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden p-4">
        <p className="text-sm text-red-500 text-center">{error}</p>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
        {title ? (
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700">{title}</p>
        ) : null}
        <div className="p-4 text-center space-y-3" data-testid="geocoder-empty-state">
          <p className="text-sm text-slate-500">{emptyMessage}</p>
          {freeTextActionLabel && onUseFreeText ? (
            <button
              type="button"
              onClick={onUseFreeText}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              {freeTextActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
      {title ? (
        <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700">{title}</p>
      ) : null}
      <ul
        id={listboxId}
        role="listbox"
        className="max-h-60 overflow-y-auto"
        aria-label="Sugestões de locais"
      >
        {suggestions.map((suggestion, index) => {
          const optionId = `${listboxId}-option-${index}`;
          const isActive = index === activeIndex;
          return (
            <li
              key={suggestion.place_id}
              id={optionId}
              role="option"
              aria-selected={isActive}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(suggestion)}
              className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${
                isActive ? 'bg-primary/15' : 'hover:bg-primary/10'
              }`}
            >
              <MapPin className="text-slate-400 shrink-0" size={20} aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {suggestion.description}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="bg-slate-50 dark:bg-slate-800/80 p-2 text-center border-t border-slate-100 dark:border-slate-700">
        <span className="text-[10px] text-slate-400 font-medium">Powered by OpenStreetMap</span>
      </div>
    </div>
  );
};

export default AutocompleteDropdown;
