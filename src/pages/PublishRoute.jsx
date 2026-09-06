import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, History, Banknote, Send } from 'lucide-react';
import { createOferta } from '../services/OfertaService';
import AddressInput from '../components/AddressInput';
import TimeInput from '../components/TimeInput';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import LoadingSkeleton from '../components/LoadingSkeleton';
import FeedbackAlert from '../components/FeedbackAlert';
import { useAuth } from '../contexts/AuthContext';
import { useHasVehicle } from '../hooks/useHasVehicle';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { DIAS_SEMANA, DIAS_UTEIS_DEFAULT } from '../utils/diasSemana';
import { markPermissionsEligible } from '../utils/permissionsPrompt';

const OD_VAZIO = {
  origin_name: '',
  origin_lat: null,
  origin_lng: null,
  destination_name: '',
  destination_lat: null,
  destination_lng: null,
};

/**
 * Publicar oferta de capacidade (substitui publicar trajeto / routes).
 * Copy humana: «Por passageiro» | «Total do acordo» | «Oferta flexível».
 * Flexível = sem OD obrigatório (não é «rota OD + flag»).
 */
const PublishRoute = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasVehicle, loading: loadingVehicle, error: vehicleError, retry: retryVehicleCheck } =
    useHasVehicle(user?.id);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [modoPreco, setModoPreco] = useState('POR_PASSAGEIRO');
  const [diasSemana, setDiasSemana] = useState(() => [...DIAS_UTEIS_DEFAULT]);
  const [ofertaFlexivel, setOfertaFlexivel] = useState(false);

  const [formData, setFormData] = useState({
    ...OD_VAZIO,
    departure_time: '',
    return_time: '',
    valor_mensal_ask_kz: '',
  });

  useEffect(() => {
    if (!loadingVehicle && !vehicleError && hasVehicle === false) {
      navigate('/veiculo', { replace: true });
    }
  }, [loadingVehicle, vehicleError, hasVehicle, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectOrigin = (coordinates) => {
    setFormData((prev) => ({
      ...prev,
      origin_lat: coordinates.lat,
      origin_lng: coordinates.lng,
    }));
  };

  const handleSelectDestination = (coordinates) => {
    setFormData((prev) => ({
      ...prev,
      destination_lat: coordinates.lat,
      destination_lng: coordinates.lng,
    }));
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
    setLoading(true);
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
      setLoading(false);
      return;
    }

    const valor = parseInt(String(formData.valor_mensal_ask_kz).replace(/\D/g, ''), 10);
    if (!Number.isInteger(valor) || valor < 0) {
      setMessage({ type: 'error', text: 'Indique um valor mensal válido em Kz.' });
      setLoading(false);
      return;
    }

    try {
      await createOferta({
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
      setMessage({ type: 'success', text: 'Oferta publicada com sucesso!' });
      markPermissionsEligible();
      setTimeout(() => navigate('/motorista'), 1500);
    } catch (error) {
      if (error.message === 'Não autenticado.') {
        setMessage({ type: 'error', text: 'Precisas de iniciar sessão para publicar uma oferta.' });
      } else if (error.message?.includes('veículo')) {
        setMessage({ type: 'error', text: error.message });
      } else {
        console.error('Erro ao publicar oferta:', error);
        setMessage({ type: 'error', text: getFriendlyErrorMessage(error) });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingVehicle || hasVehicle === false) {
    return (
      <PageShell className="pb-32">
        <PageHeader title="Publicar oferta" onBack={() => navigate('/motorista')} />
        <LoadingSkeleton />
      </PageShell>
    );
  }

  if (vehicleError) {
    return (
      <PageShell className="pb-32">
        <PageHeader title="Publicar oferta" onBack={() => navigate('/motorista')} />
        <FeedbackAlert type="error" text={vehicleError} className="mb-4" />
        <button
          type="button"
          onClick={retryVehicleCheck}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Tentar novamente
        </button>
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-32">
      <PageHeader title="Publicar oferta" onBack={() => navigate('/motorista')} />

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-pretty px-1">
        {ofertaFlexivel
          ? 'Oferta flexível: capacidade, dias e horário — sem rota origem/destino fixa. A tua residência não limita a área.'
          : 'Publica a tua rota casa–trabalho com origem e destino definidos.'}
      </p>

      <div
        className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4"
        role="group"
        aria-label="Tipo de rota"
      >
        <button
          type="button"
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
            !ofertaFlexivel
              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-500'
          }`}
          onClick={() => handleSelectTipoRota(false)}
        >
          Rota fixa
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
            ofertaFlexivel
              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-500'
          }`}
          onClick={() => handleSelectTipoRota(true)}
        >
          Flexível
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 text-pretty px-1">
        {ofertaFlexivel
          ? 'Capacidade e janela horária — sem origem/destino fixos.'
          : 'Origem e destino obrigatórios na oferta fixa.'}
      </p>

      {message.text && (
        <div
          role="alert"
          className={`p-4 mb-4 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div
        className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6"
        role="group"
        aria-label="Modo de preço"
      >
        <button
          type="button"
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
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
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
            modoPreco === 'TOTAL_ACORDO'
              ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
              : 'text-slate-500'
          }`}
          onClick={() => setModoPreco('TOTAL_ACORDO')}
        >
          Total do acordo
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
        <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          {!ofertaFlexivel && (
            <>
              <AddressInput
                name="origin_name"
                label="Origem"
                value={formData.origin_name}
                onChange={handleChange}
                onSelectCoordinates={handleSelectOrigin}
              />
              <AddressInput
                name="destination_name"
                label="Destino"
                value={formData.destination_name}
                onChange={handleChange}
                onSelectCoordinates={handleSelectDestination}
              />
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clock size={16} aria-hidden="true" /> Ida
              </span>
              <TimeInput
                name="departure_time"
                value={formData.departure_time}
                onChange={handleChange}
                required
                aria-label="Hora de ida"
                className="h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <History size={16} aria-hidden="true" /> Regresso
              </span>
              <TimeInput
                name="return_time"
                value={formData.return_time}
                onChange={handleChange}
                aria-label="Hora de regresso"
                className="h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary/50"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-charcoal dark:text-slate-300">
              Dias da semana
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Dias da semana"
            >
              {DIAS_SEMANA.map(({ valor, label }) => {
                const activo = diasSemana.includes(valor);
                return (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => toggleDia(valor)}
                    className={`min-w-10 h-10 px-2.5 rounded-lg text-sm font-bold transition-all ${
                      activo
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-light-gray dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <Banknote size={16} aria-hidden="true" />
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
              placeholder={modoPreco === 'POR_PASSAGEIRO' ? '40000' : '120000'}
              className="h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
            />
          </label>
          <p className="text-xs text-slate-500 text-pretty">
            Os lugares disponíveis vêm do teu veículo registado.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60"
        >
          <Send size={18} aria-hidden="true" />
          {loading ? 'A publicar...' : 'Publicar oferta'}
        </button>
      </form>
    </PageShell>
  );
};

export default PublishRoute;
