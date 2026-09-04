import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Clock, Users, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AddressInput from '../components/AddressInput';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { createProcura, listProcurasByOwner } from '../services/ProcuraService';
import { findCompatibleOfertas } from '../services/MatchingService';
import { createProposta } from '../services/PropostaService';
import { enqueueWaitlist } from '../services/WaitlistService';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

/**
 * Hub passageiro — procura, matches e lista de espera.
 */
const PassengerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [procura, setProcura] = useState(null);
  const [matches, setMatches] = useState({ direct: [], waitlist: [] });
  const [view, setView] = useState('hub'); // hub | form | matches
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({
    preferred_time: '07:15',
    origin_name: '',
    origin_lat: null,
    origin_lng: null,
    destination_name: '',
    destination_lat: null,
    destination_lng: null,
  });

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lista = await listProcurasByOwner(user.id);
      const activa = lista.find((p) => p.estado === 'activa' || p.estado === 'em_negociacao') || null;
      setProcura(activa);
      if (activa) {
        const result = await findCompatibleOfertas({
          preferred_time: String(activa.preferred_time).slice(0, 5),
          origin_lat: Number(activa.origin_lat),
          origin_lng: Number(activa.origin_lng),
          destination_lat: Number(activa.destination_lat),
          destination_lng: Number(activa.destination_lng),
          n_candidato: activa.n_candidato,
        });
        setMatches({ direct: result.direct, waitlist: result.waitlist });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCriarProcura = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    if (form.origin_lat == null || form.destination_lat == null) {
      setFeedback({
        type: 'error',
        text: 'Seleccione origem e destino na lista de sugestões.',
      });
      return;
    }
    try {
      const criada = await createProcura(form);
      setProcura(criada);
      setView('matches');
      await carregar();
      setFeedback({ type: 'success', text: 'Procura criada.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    }
  };

  const handlePropor = async (oferta) => {
    if (!procura) return;
    setBusyId(oferta.id);
    setFeedback({ type: '', text: '' });
    try {
      await createProposta({
        oferta_id: oferta.id,
        procura_id: procura.id,
        modo_preco: oferta.modo_preco,
        valor_mensal_ask_kz: oferta.valor_mensal_ask_kz,
        n_passageiros_propostos: procura.n_candidato,
      });
      setFeedback({ type: 'success', text: 'Proposta enviada ao motorista.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleWaitlist = async (oferta) => {
    if (!procura) return;
    setBusyId(oferta.id);
    try {
      await enqueueWaitlist({
        oferta_id: oferta.id,
        procura_id: procura.id,
      });
      setFeedback({ type: 'success', text: 'Entraste na lista de espera.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const labelModo = (modo) =>
    modo === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Por passageiro';

  return (
    <PageShell>
      <PageHeader
        title={view === 'form' ? 'Nova procura' : 'A minha procura'}
        subtitle={
          view === 'form'
            ? 'Define a tua rota diária casa–trabalho.'
            : 'Encontra ofertas compatíveis com o teu horário.'
        }
        {...(view !== 'hub'
          ? { onBack: () => setView(procura ? 'matches' : 'hub') }
          : {})}
      />

      {feedback.text && (
        <div
          role="alert"
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {loading && <LoadingSkeleton />}

      {!loading && view === 'hub' && !procura && (
        <EmptyState
          icon={MapPin}
          title="Sem procura activa"
          message="Cria uma procura para ver ofertas compatíveis."
          actionLabel="Criar procura"
          onAction={() => setView('form')}
        />
      )}

      {!loading && view === 'form' && (
        <form onSubmit={handleCriarProcura} className="space-y-4 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm">
          <AddressInput
            name="origin_name"
            label="Origem"
            value={form.origin_name}
            onChange={handleChange}
            onSelectCoordinates={(c) =>
              setForm((prev) => ({ ...prev, origin_lat: c.lat, origin_lng: c.lng }))
            }
          />
          <AddressInput
            name="destination_name"
            label="Destino"
            value={form.destination_name}
            onChange={handleChange}
            onSelectCoordinates={(c) =>
              setForm((prev) => ({ ...prev, destination_lat: c.lat, destination_lng: c.lng }))
            }
          />
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Hora preferida
            <input
              type="time"
              name="preferred_time"
              value={form.preferred_time}
              onChange={handleChange}
              required
              className="h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3"
            />
          </label>
          <button
            type="submit"
            className="w-full bg-primary text-white font-bold py-4 rounded-xl"
          >
            Guardar procura
          </button>
        </form>
      )}

      {!loading && procura && (view === 'hub' || view === 'matches') && (
        <div className="space-y-4">
          <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span>{procura.origin_name}</span>
              <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
              <span>{procura.destination_name}</span>
            </div>
            <div className="flex gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Clock size={14} aria-hidden="true" />
                {String(procura.preferred_time).slice(0, 5)}
              </span>
              <span className="flex items-center gap-1">
                <Users size={14} aria-hidden="true" />
                {procura.n_candidato === 1
                  ? 'Individual'
                  : `Grupo · ${procura.n_candidato} pessoas`}
              </span>
            </div>
            <button
              type="button"
              className="text-sm font-bold text-primary"
              onClick={() => setView('matches')}
            >
              Ver ofertas compatíveis
            </button>
          </section>

          {(view === 'matches' || view === 'hub') && (
            <>
              <p className="text-sm font-semibold text-slate-500">
                {(() => {
                  const n = matches.direct.length + matches.waitlist.length;
                  return n === 1 ? '1 oferta compatível' : `${n} ofertas compatíveis`;
                })()}
              </p>

              {matches.direct.map((oferta) => (
                <section
                  key={oferta.id}
                  className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold flex items-center gap-2">
                      {oferta.origin_name}
                      <ArrowRight size={14} className="text-slate-400" aria-hidden="true" />
                      {oferta.destination_name}
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      Disponível
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={14} aria-hidden="true" />
                      {String(oferta.departure_time).slice(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} aria-hidden="true" />
                      {oferta.vagas_disponiveis} lugares
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <strong className="text-primary tabular-nums">
                        {formatKwanza(oferta.valor_mensal_ask_kz)} Kz
                      </strong>
                      <p className="text-xs text-slate-400">{labelModo(oferta.modo_preco)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === oferta.id}
                      onClick={() => handlePropor(oferta)}
                      className="bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-60"
                    >
                      Propor acordo
                    </button>
                  </div>
                </section>
              ))}

              {matches.waitlist.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                    Lista de espera
                  </h3>
                  {matches.waitlist.map((oferta) => (
                    <section
                      key={oferta.id}
                      className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 space-y-3"
                    >
                      <div className="font-bold flex items-center gap-2">
                        {oferta.origin_name}
                        <ArrowRight size={14} className="text-slate-400" aria-hidden="true" />
                        {oferta.destination_name}
                      </div>
                      <p className="text-sm text-slate-500">
                        Sem lugares suficientes agora ({oferta.vagas_disponiveis} disponíveis).
                      </p>
                      <button
                        type="button"
                        disabled={busyId === oferta.id}
                        onClick={() => handleWaitlist(oferta)}
                        className="text-sm font-bold text-primary"
                      >
                        Entrar na lista de espera
                      </button>
                    </section>
                  ))}
                </>
              )}

              {matches.direct.length === 0 && matches.waitlist.length === 0 && (
                <p className="text-sm text-slate-500 text-pretty">
                  Ainda não há ofertas compatíveis com o teu horário e zona.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </PageShell>
  );
};

export default PassengerDashboard;
