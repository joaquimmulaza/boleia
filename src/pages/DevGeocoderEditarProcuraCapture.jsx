import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import AddressInput from '../components/AddressInput';
import TimeInput from '../components/TimeInput';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';

/**
 * Captura DEV (390px) — Editar procura com geocoder inline (Critiquito 15/10).
 */
export default function DevGeocoderEditarProcuraCapture() {
  const [form, setForm] = useState({
    origin_name: 'Talatona',
    destination_name: 'Viana',
    preferred_time: '07:30',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <PageShell>
      <PageHeader
        title="Editar procura"
        subtitle="Corrige origem, destino, horário, dias ou teto."
      />
      <form className="mx-auto flex w-full max-w-[390px] flex-col gap-4 px-4 pb-8">
        <AddressInput
          name="origin_name"
          label="Origem"
          value={form.origin_name}
          onChange={handleChange}
          allowFreeTextUse
        />
        <AddressInput
          name="destination_name"
          label="Destino"
          value={form.destination_name}
          onChange={handleChange}
          allowFreeTextUse
        />
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Clock size={16} aria-hidden="true" />
            Hora preferida
          </span>
          <TimeInput
            name="preferred_time"
            value={form.preferred_time}
            onChange={handleChange}
            required
            aria-label="Hora preferida"
          />
        </label>
      </form>
    </PageShell>
  );
}
