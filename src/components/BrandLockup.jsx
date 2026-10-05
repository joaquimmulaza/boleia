import React from 'react';

/**
 * Ícone oficial do shell.
 * `withName` só nas páginas públicas legais (ícone + «Boleia Certa»).
 * O shell autenticado fica só com o ícone.
 * @param {{ withName?: boolean }} props
 */
export default function BrandLockup({ withName = false }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2" data-testid="brand-lockup">
      <img
        src="/boleia-logo.png"
        alt={withName ? '' : 'Boleia Certa'}
        className="h-9 w-auto shrink-0 object-contain"
      />
      {withName ? (
        <span className="whitespace-nowrap text-[15px] font-semibold leading-5 text-slate-900 dark:text-white">
          Boleia Certa
        </span>
      ) : null}
    </span>
  );
}
