import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useAutocomplete } from '../hooks/useAutocomplete';
import { useFloatingGeocoderPanel } from '../hooks/useFloatingGeocoderPanel';
import AutocompleteDropdown from './AutocompleteDropdown';
import { Input } from './ui/input';
import { cn } from '../lib/utils';
import {
  EMPTY_GEOCODER_MESSAGE,
  formatUseFreeTextLabel,
} from '../utils/addressGeocoderCopy';
import { ADDRESS_INPUT_SURFACE_CLASS } from '../utils/addressInputSurface.js';
import { GEOCODER_DISMISS_CHROME_SELECTOR } from '../utils/geocoderDismissChrome.js';
import { resolveGeocoderPortalContainer } from '../utils/geocoderPortal.js';
import { getTopOverlay, popOverlay, pushOverlay } from '../utils/overlayStack.js';

/**
 * Campo de endereço com autocomplete Photon/OSM (combobox a11y).
 * @param {{
 *   id?: string,
 *   name: string,
 *   label?: string,
 *   value?: string,
 *   onChange: (e: { target: { name: string, value: string } }) => void,
 *   onSelectCoordinates?: (coords: { lat: number, lng: number, [key: string]: any } | null) => void,
 *   onConfirmFreeText?: () => void,
 *   allowFreeTextUse?: boolean,
 *   required?: boolean,
 *   fieldError?: string | null,
 *   submitBlockFocusToken?: number,
 *   onBlur?: () => void,
 * }} props
 */
const AddressInput = ({
  id,
  name,
  label,
  value,
  onChange,
  onSelectCoordinates,
  onConfirmFreeText,
  allowFreeTextUse = false,
  required = true,
  fieldError = null,
  submitBlockFocusToken = 0,
  onBlur,
}) => {
  const {
    suggestions,
    loading,
    error,
    errorKind,
    fetchPredictions,
    retryLastFetch,
    selectPlace,
    clearSuggestions,
    resolvedInput,
  } = useAutocomplete();

  const [inputValue, setInputValue] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const anchorRef = useRef(null);
  const dropdownPanelRef = useRef(null);
  const inputRef = useRef(null);
  const submitBlockFocusSeenRef = useRef(0);
  const inputId = id || name;
  const listboxId = `${inputId}-geocoder-listbox`;
  const fieldErrorId = `${inputId}-field-error`;
  const geocoderOverlayId = useId();
  const [portalContainer, setPortalContainer] = useState(/** @type {HTMLElement | null} */ (null));

  const bindAnchorRef = useCallback((node) => {
    anchorRef.current = node;
    if (node instanceof HTMLElement) {
      setPortalContainer(resolveGeocoderPortalContainer(node));
    } else {
      setPortalContainer(null);
    }
  }, []);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(-1);
  }, [suggestions, errorKind, loading]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownPanelRef.current?.contains(target)) return;
      closeDropdown();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  const debounceTimeoutRef = useRef(null);

  const handleChange = (e) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    onChange({ target: { name, value: newVal } });

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (newVal.trim().length > 2) {
      setShowDropdown(true);
      clearSuggestions();
      debounceTimeoutRef.current = setTimeout(() => {
        fetchPredictions(newVal);
      }, 300);
    } else {
      closeDropdown();
      clearSuggestions();
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      submitBlockFocusToken > submitBlockFocusSeenRef.current
      && fieldError
    ) {
      submitBlockFocusSeenRef.current = submitBlockFocusToken;
      inputRef.current?.focus();
    }
  }, [submitBlockFocusToken, fieldError]);

  const trimmedInputLength = inputValue.trim().length;

  const handleUseFreeText = () => {
    if (!allowFreeTextUse || trimmedInputLength <= 2) {
      return;
    }
    closeDropdown();
    clearSuggestions();
    onConfirmFreeText?.();
    if (onSelectCoordinates) {
      onSelectCoordinates(null);
    }
  };

  const handleSelect = useCallback(async (suggestion) => {
    setInputValue(suggestion.description);
    onChange({ target: { name, value: suggestion.description } });
    closeDropdown();

    const details = await selectPlace(suggestion.place_id);
    if (details && onSelectCoordinates) {
      onSelectCoordinates(details);
    }
  }, [name, onChange, onSelectCoordinates, selectPlace, closeDropdown]);

  const inputMatchesResolved =
    resolvedInput !== null && resolvedInput.trim() === inputValue.trim();

  const predictionsSettled = !loading && inputMatchesResolved;

  const showFreeTextAction =
    allowFreeTextUse
    && predictionsSettled
    && trimmedInputLength > 2
    && (errorKind === null || errorKind === 'network');

  const emptyMessage =
    allowFreeTextUse
    && predictionsSettled
    && !errorKind
    && trimmedInputLength > 2
      ? EMPTY_GEOCODER_MESSAGE
      : undefined;

  const listPanelOpen = showDropdown && trimmedInputLength > 2;
  const floatingLayout = useFloatingGeocoderPanel(anchorRef, listPanelOpen);

  useEffect(() => {
    if (!listPanelOpen) return undefined;

    const dismissOnSheetChrome = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(GEOCODER_DISMISS_CHROME_SELECTOR)) {
        closeDropdown();
      }
    };

    document.addEventListener('pointerdown', dismissOnSheetChrome, true);
    return () => document.removeEventListener('pointerdown', dismissOnSheetChrome, true);
  }, [listPanelOpen, closeDropdown]);

  useLayoutEffect(() => {
    if (!listPanelOpen) return undefined;

    pushOverlay(geocoderOverlayId, closeDropdown);

    const onDocumentEscape = (event) => {
      if (event.key !== 'Escape') return;
      const top = getTopOverlay();
      if (top?.id !== geocoderOverlayId) return;
      event.preventDefault();
      event.stopPropagation();
      closeDropdown();
    };

    document.addEventListener('keydown', onDocumentEscape, true);
    return () => {
      document.removeEventListener('keydown', onDocumentEscape, true);
      popOverlay(geocoderOverlayId);
    };
  }, [listPanelOpen, geocoderOverlayId, closeDropdown]);

  const activeOptionId =
    listPanelOpen
    && suggestions.length > 0
    && activeIndex >= 0
    && activeIndex < suggestions.length
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  const shouldPreventEnterSubmit = listPanelOpen && (
    loading
    || errorKind === 'network'
    || suggestions.length > 0
    || Boolean(emptyMessage)
    || showFreeTextAction
  );

  const handleKeyDown = (e) => {
    if (!listPanelOpen) return;

    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      return;
    }

    if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      return;
    }

    if (e.key === 'Enter') {
      if (shouldPreventEnterSubmit) {
        e.preventDefault();
      }
      if (loading || errorKind === 'network') {
        return;
      }
      if (suggestions.length > 0 && activeIndex >= 0 && activeIndex < suggestions.length) {
        void handleSelect(suggestions[activeIndex]);
      }
    }
  };

  return (
    <div className="flex flex-col w-full relative" ref={wrapperRef}>
      <label className="flex flex-col w-full" htmlFor={inputId}>
        {label && (
          <span className="text-slate-900 dark:text-slate-200 text-sm font-semibold mb-2 ml-1">
            {label}
          </span>
        )}
        <div ref={bindAnchorRef} className="relative flex items-center">
          <Input
            ref={inputRef}
            id={inputId}
            type="text"
            name={name}
            required={required}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (trimmedInputLength > 2) setShowDropdown(true);
            }}
            onBlur={() => onBlur?.()}
            role="combobox"
            aria-expanded={listPanelOpen}
            aria-controls={listPanelOpen ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? fieldErrorId : undefined}
            autoComplete="off"
            className={cn(ADDRESS_INPUT_SURFACE_CLASS)}
          />
        </div>
      </label>

      {fieldError ? (
        <div
          id={fieldErrorId}
          className="mt-1 ml-1 text-xs text-red-500 font-medium"
          role="alert"
        >
          {fieldError}
        </div>
      ) : null}

      {error && !listPanelOpen && !errorKind && !fieldError && (
         <div className="mt-1 ml-1 text-xs text-red-500 font-medium">{error}</div>
      )}

      {listPanelOpen && portalContainer
        ? createPortal(
            <AutocompleteDropdown
              ref={dropdownPanelRef}
              suggestions={suggestions}
              loading={loading}
              error={error}
              errorKind={errorKind}
              onSelect={handleSelect}
              onRetry={retryLastFetch}
              listboxId={listboxId}
              activeIndex={activeIndex}
              emptyMessage={emptyMessage}
              floatingStyle={floatingLayout?.style}
              maxListHeight={floatingLayout?.maxListHeight ?? 240}
              freeTextActionLabel={
                showFreeTextAction ? formatUseFreeTextLabel(inputValue) : undefined
              }
              onUseFreeText={showFreeTextAction ? handleUseFreeText : undefined}
            />,
            portalContainer,
          )
        : null}
    </div>
  );
};

export default AddressInput;
