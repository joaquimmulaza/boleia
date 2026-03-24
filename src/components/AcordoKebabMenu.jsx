import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Flag, Trash2 } from 'lucide-react';

const AcordoKebabMenu = ({ onReportar, onCancelar }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        aria-label="Opções"
        aria-expanded={isOpen}
      >
        <MoreVertical size={20} className="shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
          <ul className="py-1">
            <li>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onReportar && onReportar();
                }}
                className="w-full flex items-center px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors gap-3"
              >
                <Flag size={16} className="text-slate-400" />
                <span>Reportar Problema</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onCancelar && onCancelar();
                }}
                className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors gap-3"
              >
                <Trash2 size={16} />
                <span>Cancelar Acordo</span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default AcordoKebabMenu;
