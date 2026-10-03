import React from 'react';

/**
 * Ícone oficial já usado no shell autenticado.
 * O mesmo bloco no Explorar autenticado e em /explorar, sem palavra ao lado.
 */
export default function BrandLockup() {
  return (
    <span className="inline-flex min-w-0 items-center" data-testid="brand-lockup">
      <img src="/boleia-logo.png" alt="Boleia Certa" className="h-9 w-auto shrink-0 object-contain" />
    </span>
  );
}
