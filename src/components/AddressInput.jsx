import React, { useState, useEffect, useRef } from 'react';
import { useAutocomplete } from '../hooks/useAutocomplete';
import AutocompleteDropdown from './AutocompleteDropdown';

/**
 * Campo de endereço com autocomplete Photon/OSM.
 * @param {{
 *   id?: string,
 *   name: string,
 *   label?: string,
 *   value?: string,
 *   onChange: (e: { target: { name: string, value: string } }) => void,
 *   onSelectCoordinates?: (coords: { lat: number, lng: number, [key: string]: any }) => void,
 *   required?: boolean,
 * }} props
 */
const AddressInput = ({
  id,
  name,
  label,
  value,
  onChange,
  onSelectCoordinates,
  required = true,
}) => {
  const {
    suggestions,
    loading,
    error,
    fetchPredictions,
    selectPlace,
    clearSuggestions,
  } = useAutocomplete();

  const [inputValue, setInputValue] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const inputId = id || name;

  useEffect(() => {
    // Sincroniza o valor controlado externo com o input interno.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    onChange({ target: { name, value: newVal } });

    if (newVal.length > 2) {
      setShowDropdown(true);
      fetchPredictions(newVal);
    } else {
      setShowDropdown(false);
      clearSuggestions();
    }
  };

  const handleSelect = async (suggestion) => {
    setInputValue(suggestion.description);
    onChange({ target: { name, value: suggestion.description } });
    setShowDropdown(false);

    const details = await selectPlace(suggestion.place_id);
    if (details && onSelectCoordinates) {
      onSelectCoordinates(details);
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
        <div className="relative flex items-center">
          <input
            id={inputId}
            type="text"
            name={name}
            required={required}
            value={inputValue}
            onChange={handleChange}
            onFocus={() => {
              if (inputValue.length > 2) setShowDropdown(true);
            }}
            className="form-input w-full pl-4 pr-4 h-14 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:ring-primary/20 transition-all placeholder:text-slate-400 outline-none"
          />
        </div>
      </label>

      {error && !showDropdown && (
         <div className="mt-1 ml-1 text-xs text-red-500 font-medium">{error}</div>
      )}

      {showDropdown && (
        <AutocompleteDropdown
          suggestions={suggestions}
          loading={loading}
          error={error}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
};

export default AddressInput;
