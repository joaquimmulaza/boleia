import React, { useState } from 'react';
import { Banknote, Clock } from 'lucide-react';
import AddressInput from '../components/AddressInput';
import TimeInput from '../components/TimeInput';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';

const DIAS = [
  { valor: 1, label: 'Seg' },
  { valor: 2, label: 'Ter' },
  { valor: 3, label: 'Qua' },
  { valor: 4, label: 'Qui' },
  { valor: 5, label: 'Sex' },
];

/**
 * Captura DEV (390px) — Editar procura alinhado ao form real (Critiquito / #273).
 * ?geocoderError=1 força estado de erro inline na origem (screenshot FAIL 4).
 */
export default function DevGeocoderEditarProcuraCapture() {
  const forceGeocoderError =
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('geocoderError') === '1';

  const [form, setForm] = useState({
    origin_name: forceGeocoderError ? 'Talaton' : 'Talatona',
    destination_name: 'Viana',
    preferred_time: '07:30',
    teto_mensal_kz: '',
    dias_semana: [1, 2, 3, 4, 5],
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <PageShell className="max-w-[390px] px-0">
      <PageHeader
        title="Editar procura"
        subtitle="Corrige origem, destino, horário, dias ou teto."
      />
      <form
        data-testid="dev-geocoder-editar-procura-form"
        className="mx-auto flex w-full max-w-[390px] max-h-[calc(100dvh-10rem)] flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain p-5">
          <AddressInput
            name="origin_name"
            label="Origem"
            value={form.origin_name}
            onChange={handleChange}
            allowFreeTextUse
            fieldError={forceGeocoderError ? null : null}
          />
          {forceGeocoderError ? (
            <p
              data-testid="geocoder-network-error"
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40"
            >
              Sem ligação. Verifica a rede e tenta outra vez.
            </p>
          ) : null}
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
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-charcoal dark:text-slate-300">
              Dias da semana
            </span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana">
              {DIAS.map(({ valor, label }) => (
                <span
                  key={valor}
                  className={`min-w-10 h-10 px-2.5 inline-flex items-center justify-center rounded-lg text-sm font-bold ${
                    form.dias_semana.includes(valor)
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-light-gray dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Banknote size={16} aria-hidden="true" />
              Teto mensal por passageiro (Kz)
            </span>
            <input
              type="number"
              name="teto_mensal_kz"
              value={form.teto_mensal_kz}
              onChange={handleChange}
              placeholder="Opcional"
              className="flex-1 h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 tabular-nums outline-none focus:ring-2 focus:ring-primary/50"
            />
          </label>
        </div>
        <div className="sticky bottom-0 shrink-0 border-t border-slate-100 bg-white p-5 pt-3 dark:border-slate-800 dark:bg-slate-900">
          <button type="button" className="w-full bg-primary py-4 font-bold text-white rounded-xl">
            Guardar alterações
          </button>
        </div>
      </form>
    </PageShell>
  );
}
