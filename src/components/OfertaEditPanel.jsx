import React, { useState } from 'react';
import { Clock, History, Banknote } from 'lucide-react';
import AddressInput from './AddressInput';
import TimeInput from './TimeInput';
import { updateOferta } from '../services/OfertaService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { DIAS_SEMANA, DIAS_UTEIS_DEFAULT } from '../utils/diasSemana';

const OD_VAZIO = {
  origin_name: '',
  origin_lat: null,
  origin_lng: null,
  destination_name: '',
  destination_lat: null,
  destination_lng: null,
};

/**
 * Formulário inline para editar oferta publicada.
 * @param {{
 *   oferta: object,
 *   busy?: boolean,
 *   onCancel: () => void,
 *   onSaved: (oferta: object) => void,
 *   onSubmitStart?: () => void,
 * }} props
 */
const OfertaEditPanel = ({ oferta, busy = false, onCancel, onSaved, onSubmitStart }) => {
  const [modoPreco, setModoPreco] = useState(oferta.modo_preco || 'POR_PASSAGEIRO');
  const [ofertaFlexivel, setOfertaFlexivel] = useState(Boolean(oferta.flexibilidade_rota));
  const [diasSemana, setDiasSemana] = useState(
    Array.isArray(oferta.dias_semana) && oferta.dias_semana.length > 0
      ? oferta.dias_semana.map((d) => Number(d))
      : [...DIAS_UTEIS_DEFAULT],
  );
  const [formData, setFormData] = useState({
    origin_name: oferta.origin_name || '',
    origin_lat: oferta.origin_lat ?? null,
    origin_lng: oferta.origin_lng ?? null,
    destination_name: oferta.destination_name || '',
    destination_lat: oferta.destination_lat ?? null,
    destination_lng: oferta.destination_lng ?? null,
    departure_time: String(oferta.departure_time || '').slice(0, 5),
    return_time: oferta.return_time ? String(oferta.return_time).slice(0, 5) : '',
    valor_mensal_ask_kz: String(oferta.valor_mensal_ask_kz ?? ''),
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectTipoRota = (flexivel) => {
    setOfertaFlexivel(flexivel);
    if (flexivel) {
      setFormData((prev) => ({ ...prev, ...OD_VAZIO }));
    }
  };

  const toggleDia = (valor) => {
    setDiasSemana((prev) => {
      if (prev.includes(valor)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== valor).toSorted((a, b) => a - b);
      }
      return [...prev, valor].toSorted((a, b) => a - b);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (
      !ofertaFlexivel &&
      (formData.origin_lat == null ||
        formData.origin_lng == null ||
        formData.destination_lat == null ||
        formData.destination_lng == null)
    ) {
      setMessage({
        type: 'error',
        text: 'Seleccione origem e destino na lista de sugestões.',
      });
      return;
    }

    const valor = parseInt(String(formData.valor_mensal_ask_kz).replace(/\D/g, ''), 10);
    if (!Number.isInteger(valor) || valor < 0) {
      setMessage({ type: 'error', text: 'Indique um valor mensal válido em Kz.' });
      return;
    }

    setSaving(true);
    onSubmitStart?.();
    try {
      const actualizada = await updateOferta(oferta.id, {
        modo_preco: modoPreco,
        valor_mensal_ask_kz: valor,
        origin_name: ofertaFlexivel ? null : formData.origin_name,
        origin_lat: ofertaFlexivel ? null : formData.origin_lat,
        origin_lng: ofertaFlexivel ? null : formData.origin_lng,
        destination_name: ofertaFlexivel ? null : formData.destination_name,
        destination_lat: ofertaFlexivel ? null : formData.destination_lat,
        destination_lng: ofertaFlexivel ? null : formData.destination_lng,
        departure_time: formData.departure_time,
        return_time: formData.return_time || null,
        dias_semana: diasSemana,
        flexibilidade_rota: ofertaFlexivel,
      });
      onSaved(actualizada);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const isBusy = busy || saving;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4"
      data-testid="oferta-edit-panel"
    >
      <p className="text-xs text-slate-500 text-pretty">
        Propostas já enviadas mantêm o valor negociado. Alterações materiais só afectam novas
        propostas ou invalidam as abertas incompatíveis.
      </p>

      <div
        className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
        role="group"
        aria-label="Tipo de rota"
      >
        <button
          type="button"
          disabled={isBusy}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
            !ofertaFlexivel
              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-500'
          }`}
          onClick={() => handleSelectTipoRota(false)}
        >
          Fixa
        </button>
        <button
          type="button"
          disabled={isBusy}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
            ofertaFlexivel
              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-500'
          }`}
          onClick={() => handleSelectTipoRota(true)}
        >
          Flexível
        </button>
      </div>

      <div
        className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
        role="group"
        aria-label="Modo de preço"
      >
        <button
          type="button"
          disabled={isBusy}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
            modoPreco === 'POR_PASSAGEIRO'
              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-500'
          }`}
          onClick={() => setModoPreco('POR_PASSAGEIRO')}
        >
          Por passageiro
        </button>
        <button
          type="button"
          disabled={isBusy}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
            modoPreco === 'TOTAL_ACORDO'
              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-500'
          }`}
          onClick={() => setModoPreco('TOTAL_ACORDO')}
        >
          Total do acordo
        </button>
      </div>

      {!ofertaFlexivel && (
        <>
          <AddressInput
            name="origin_name"
            label="Origem"
            value={formData.origin_name}
            onChange={handleChange}
            onSelectCoordinates={(c) =>
              setFormData((prev) => ({ ...prev, origin_lat: c.lat, origin_lng: c.lng }))
            }
          />
          <AddressInput
            name="destination_name"
            label="Destino"
            value={formData.destination_name}
            onChange={handleChange}
            onSelectCoordinates={(c) =>
              setFormData((prev) => ({
                ...prev,
                destination_lat: c.lat,
                destination_lng: c.lng,
              }))
            }
          />
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span className="flex items-center gap-1">
            <Clock size={15} aria-hidden="true" /> Ida
          </span>
          <TimeInput
            name="departure_time"
            value={formData.departure_time}
            onChange={handleChange}
            required
            disabled={isBusy}
            className="h-11 rounded-lg bg-slate-50 dark:bg-slate-800 px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          <span className="flex items-center gap-1">
            <History size={15} aria-hidden="true" /> Regresso
          </span>
          <TimeInput
            name="return_time"
            value={formData.return_time}
            onChange={handleChange}
            disabled={isBusy}
            className="h-11 rounded-lg bg-slate-50 dark:bg-slate-800 px-3"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana">
        {DIAS_SEMANA.map(({ valor, label }) => {
          const activo = diasSemana.includes(valor);
          return (
            <button
              key={valor}
              type="button"
              disabled={isBusy}
              aria-pressed={activo}
              onClick={() => toggleDia(valor)}
              className={`min-w-10 h-9 px-2 rounded-lg text-sm font-bold ${
                activo ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        <span className="flex items-center gap-1">
          <Banknote size={15} aria-hidden="true" />
          {modoPreco === 'POR_PASSAGEIRO' ? 'Valor por passageiro (Kz)' : 'Total do acordo (Kz)'}
        </span>
        <input
          type="number"
          name="valor_mensal_ask_kz"
          min="0"
          step="1"
          value={formData.valor_mensal_ask_kz}
          onChange={handleChange}
          required
          disabled={isBusy}
          className="h-11 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 tabular-nums"
        />
      </label>

      {message.text && (
        <div role="alert" className="text-sm text-red-600 font-medium">
          {message.text}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          className="flex-1 min-h-11 border border-slate-200 dark:border-slate-700 font-bold rounded-xl"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isBusy}
          className="flex-1 min-h-11 bg-primary text-white font-bold rounded-xl disabled:opacity-60"
        >
          {saving ? 'A guardar…' : 'Guardar alterações'}
        </button>
      </div>
    </form>
  );
};

export default OfertaEditPanel;
