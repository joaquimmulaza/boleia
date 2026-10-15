import React from 'react';
import { MapPin } from 'lucide-react';
import {
  GEOCODER_NETWORK_ERROR_MESSAGE,
  GEOCODER_RETRY_LABEL,
} from '../utils/addressGeocoderCopy';
import { GEOCODER_FLOATING_LIST_ATTR } from '../utils/geocoderDismissChrome';

/**
 * @param {boolean} floating
 * @returns {string}
 */
function shellPositionClass(floating) {
  return floating
    ? 'rounded-xl shadow-lg overflow-hidden'
    : 'absolute top-full left-0 right-0 z-50 mt-2 rounded-xl shadow-lg overflow-hidden';
}

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
 *   floatingStyle?: import('react').CSSProperties,
 *   maxListHeight?: number,
 * }} props
 */
const AutocompleteDropdown = React.forwardRef(function AutocompleteDropdown(
  {
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
    floatingStyle,
    maxListHeight = 240,
  },
  ref,
) {
  const floating = Boolean(floatingStyle);
  const floatingShellAttrs = floating
    ? { [GEOCODER_FLOATING_LIST_ATTR]: '' }
    : {};
  const shellClass = `${shellPositionClass(floating)} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${
    floating ? 'pointer-events-auto' : ''
  }`;
  const listMaxStyle = { maxHeight: `${maxListHeight}px` };

  if (loading) {
    return (
      <div ref={ref} className={shellClass} style={floatingStyle} {...floatingShellAttrs}>
        <p className="p-4 text-sm text-slate-500 text-center animate-pulse">A procurar...</p>
      </div>
    );
  }

  if (errorKind === 'network') {
    return (
      <div
        ref={ref}
        className={`${shellPositionClass(floating)} bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-xl shadow-lg overflow-hidden p-4 space-y-3 ${
          floating ? 'pointer-events-auto' : ''
        }`}
        style={floatingStyle}
        role="alert"
        data-testid="geocoder-network-error"
        {...floatingShellAttrs}
      >
        <p className="text-sm text-amber-900 dark:text-amber-100 text-center text-pretty">
          {GEOCODER_NETWORK_ERROR_MESSAGE}
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            {GEOCODER_RETRY_LABEL}
          </button>
        ) : null}
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
    );
  }

  if (error) {
    return (
      <div ref={ref} className={shellClass} style={floatingStyle} {...floatingShellAttrs}>
        <p className="p-4 text-sm text-red-500 text-center">{error}</p>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div ref={ref} className={shellClass} style={floatingStyle} {...floatingShellAttrs}>
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
    <div ref={ref} className={shellClass} style={floatingStyle} {...floatingShellAttrs}>
      {title ? (
        <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700">{title}</p>
      ) : null}
      <ul
        id={listboxId}
        role="listbox"
        className="overflow-y-auto overscroll-y-contain"
        style={listMaxStyle}
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
});

export default AutocompleteDropdown;
