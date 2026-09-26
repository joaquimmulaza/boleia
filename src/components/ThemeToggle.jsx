import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Alternar tema"
      title="Alternar tema"
      className="flex items-center justify-center p-2 rounded-full transition-colors text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
    >
      {theme === 'dark' ? (
        <Sun size={20} strokeWidth={2} className="text-amber-400" />
      ) : (
        <Moon size={20} strokeWidth={2} className="text-slate-600" />
      )}
    </button>
  );
};

export default ThemeToggle;
