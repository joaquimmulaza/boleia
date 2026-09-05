import React, { useState, useEffect, useRef } from 'react';
import { useAutocomplete } from '../hooks/useAutocomplete';
import AutocompleteDropdown from './AutocompleteDropdown';

const SearchAddressInput = ({
  id,
  name,
  placeholder,
  value,
  onChange,
}) => {
  const {
    suggestions,
    loading,
    error,
    fetchPredictions,
    clearSuggestions,
  } = useAutocomplete();

  const [inputValue, setInputValue] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  // Sync external value with internal input
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    // Close dropdown on click outside
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
    onChange(newVal);

    if (newVal.length > 2) {
      setShowDropdown(true);
      fetchPredictions(newVal);
    } else {
      setShowDropdown(false);
      clearSuggestions();
    }
  };

  const handleSelect = (suggestion) => {
    setInputValue(suggestion.description);
    onChange(suggestion.description);
    setShowDropdown(false);
    clearSuggestions();
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        id={id}
        name={name}
        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-full py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
        placeholder={placeholder}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => {
          if (inputValue.length > 2) setShowDropdown(true);
        }}
      />
      {/* Rich Modeless Feedback for Service Errors */}
      {error && !showDropdown && (
         <div className="absolute top-full left-0 mt-1 ml-4 text-xs text-red-500 font-medium z-10">{error}</div>
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

export default SearchAddressInput;
