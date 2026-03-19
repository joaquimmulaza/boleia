import React from 'react';

const getBadgeClasses = (estado) => {
  switch (estado?.toLowerCase()) {
    case 'ativo':
      return 'bg-emerald/10 text-emerald';
    case 'pendente':
      return 'bg-amber/10 text-amber';
    case 'cancelado':
      return 'bg-coral/10 text-coral';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

const EstadoBadge = ({ estado }) => (
  <span
    data-testid="badge-estado"
    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getBadgeClasses(estado)}`}
  >
    {estado}
  </span>
);

export default EstadoBadge;
