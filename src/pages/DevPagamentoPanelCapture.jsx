import React from 'react';
import AcordoPagamentoPanel from '../components/AcordoPagamentoPanel';

/**
 * Ecrã estático para captura visual do painel de pagamento (dev only, /__dev/pagamento-panel).
 * @typedef {Readonly<{}>} DevPagamentoPanelCaptureProps
 */
export default function DevPagamentoPanelCapture() {
  return (
    <div className="min-h-screen bg-background p-3 flex justify-center">
      <div className="w-full max-w-[390px]">
        <AcordoPagamentoPanel
          pagamento={{
            id: 'captura-pag-1',
            valor_kz: 43000,
            estado: 'pendente_pagamento',
          }}
        />
      </div>
    </div>
  );
}
