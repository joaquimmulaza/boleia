import React from 'react';

/**
 * Ícone oficial já usado no shell autenticado, com a palavra «Boleia Certa».
 * O mesmo bloco no Explorar autenticado e em /explorar.
 */
export default function BrandLockup() {
  return (
    <span className="inline-flex min-w-0 items-center gap-2" data-testid="brand-lockup">
      <img src="/boleia-logo.png" alt="" className="h-9 w-auto shrink-0 object-contain" />
      <span className="text-base font-bold text-slate-900 dark:text-white">Boleia Certa</span>
    </span>
  );
}
