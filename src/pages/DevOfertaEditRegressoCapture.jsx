import React from 'react';
import PageShell from '../components/PageShell';
import OfertaEditPanel from '../components/OfertaEditPanel';

/** Captura DEV 390px — Regresso 17:45 (FAIL 2 Critiquito). */
export default function DevOfertaEditRegressoCapture() {
  return (
    <PageShell className="mx-auto w-full max-w-[390px] px-4">
      <OfertaEditPanel
        oferta={{
          id: 'dev-oferta-1',
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 40000,
          flexibilidade_rota: false,
          origin_name: 'Talatona',
          origin_lat: -8.9,
          origin_lng: 13.2,
          destination_name: 'Maianga',
          destination_lat: -8.8,
          destination_lng: 13.23,
          departure_time: '07:00',
          return_time: '17:45',
          dias_semana: [1, 2, 3, 4, 5],
          vagas_disponiveis: 3,
          vagas_totais: 3,
        }}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    </PageShell>
  );
}
