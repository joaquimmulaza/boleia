import React, { useState } from 'react';
import { Clock, History } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import TimeInput from '../components/TimeInput';

/** Captura DEV 390px — Ida/Regresso 24h em Publicar oferta (FAIL 2). */
export default function DevPublishRouteTimeCapture() {
  const [departureTime, setDepartureTime] = useState('07:15');
  const [returnTime, setReturnTime] = useState('17:45');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'departure_time') setDepartureTime(value);
    if (name === 'return_time') setReturnTime(value);
  };

  return (
    <PageShell className="mx-auto w-full max-w-[390px] px-4 pb-8">
      <PageHeader title="Publicar oferta" onBack={() => {}} />
      <div className="grid grid-cols-2 gap-3 mt-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <Clock size={16} aria-hidden="true" /> Ida
          </span>
          <TimeInput
            name="departure_time"
            value={departureTime}
            onChange={handleChange}
            required
            aria-label="Hora de ida"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <History size={16} aria-hidden="true" /> Regresso
          </span>
          <TimeInput
            name="return_time"
            value={returnTime}
            onChange={handleChange}
            aria-label="Hora de regresso"
          />
        </label>
      </div>
    </PageShell>
  );
}
