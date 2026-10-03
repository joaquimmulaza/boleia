import React from 'react';

/**
 * Origem, linha e destino. A linha estica com o bloco (1 ou 2 linhas).
 * Sem imagem e sem ícone — a altura acompanha o texto.
 */
function RouteIndicator() {
  return (
    <div
      className="flex w-2 shrink-0 flex-col items-center self-stretch py-1"
      data-testid="route-indicator"
      aria-hidden="true"
    >
      <span
        className="size-2 shrink-0 rounded-full bg-[#17231c] dark:bg-slate-100"
        data-testid="route-origin-dot"
      />
      <span
        className="my-1 w-0.5 min-h-4 flex-1 rounded-full bg-[#17231c]/35 dark:bg-slate-100/40"
        data-testid="route-line"
      />
      <span
        className="size-2 shrink-0 rounded-full border-2 border-[#17231c] dark:border-slate-100"
        data-testid="route-destination-dot"
      />
    </div>
  );
}

export default RouteIndicator;
