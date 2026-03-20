import React from 'react';
import { Car } from 'lucide-react';

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6 space-y-4">
    <div className="bg-primary/10 rounded-full p-6">
      <Car size={48} className="text-primary" aria-hidden="true" />
    </div>
    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">{message}</p>
  </div>
);

export default EmptyState;
