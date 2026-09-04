import React from 'react';
import { MapPin } from 'lucide-react';

const AutocompleteDropdown = ({ suggestions, loading, error, onSelect }) => {
  if (loading) {
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden p-4">
        <p className="text-sm text-slate-500 text-center animate-pulse">A procurar...</p>
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
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
      <ul className="max-h-60 overflow-y-auto">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.place_id}
            onClick={() => onSelect(suggestion)}
            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/10 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
          >
            <MapPin className="text-slate-400 shrink-0" size={20} aria-hidden="true" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {suggestion.description}
            </span>
          </li>
        ))}
      </ul>
      <div className="bg-slate-50 dark:bg-slate-800/80 p-2 text-center border-t border-slate-100 dark:border-slate-700">
        <span className="text-[10px] text-slate-400 font-medium">Powered by OpenStreetMap</span>
      </div>
    </div>
  );
};

export default AutocompleteDropdown;
