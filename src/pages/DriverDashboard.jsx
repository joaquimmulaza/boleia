import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, AlertCircle, ArrowRight, Clock, Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listOfertasByDriver } from '../services/OfertaService';
import { listPropostasByOferta, rejectProposta } from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

function estadoChip(estado) {
  const map = {
    disponivel: { label: 'Disponível', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
    parcial: { label: 'Parcial', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    cheia: { label: 'Cheia', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
    inactiva: { label: 'Inactiva', className: 'bg-slate-100 text-slate-500' },
  };
  return map[estado] || { label: estado, className: 'bg-slate-100 text-slate-600' };
}

function labelModo(modo) {
  return modo === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Por passageiro';
}

/**
 * Hub motorista — ofertas + rever/aceitar propostas.
 */
const DriverDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasVehicle, setHasVehicle] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [ofertas, setOfertas] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [selectedOfertaId, setSelectedOfertaId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [busyId, setBusyId] = useState(null);

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('id')
        .eq('id_motorista', user.id);

      setHasVehicle(Boolean(veiculosData && veiculosData.length > 0));

      const lista = await listOfertasByDriver(user.id);
      setOfertas(lista);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleVerPropostas = async (ofertaId) => {
    setSelectedOfertaId(ofertaId);
    setFeedback({ type: '', text: '' });
    try {
      const lista = await listPropostasByOferta(ofertaId);
      setPropostas(lista.filter((p) => p.estado === 'aberta'));
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    }
  };

  const handleAceitar = async (propostaId) => {
    setBusyId(propostaId);
    setFeedback({ type: '', text: '' });
    try {
      await createAgreementFromProposal(propostaId);
      setFeedback({ type: 'success', text: 'Proposta aceite. Acordo criado.' });
      setPropostas((prev) => prev.filter((p) => p.id !== propostaId));
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleRecusar = async (propostaId) => {
    setBusyId(propostaId);
    try {
      await rejectProposta(propostaId);
      setPropostas((prev) => prev.filter((p) => p.id !== propostaId));
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="As minhas ofertas"
        subtitle="Acompanha as tuas viagens e propostas."
        actionLabel="Publicar oferta"
        onAction={() => navigate('/publicar-trajeto')}
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

      {!isLoading && !hasVehicle && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={24} className="text-amber-500 shrink-0" aria-hidden="true" />
            <div className="space-y-2">
              <h3 className="text-amber-800 dark:text-amber-400 font-bold text-base">Veículo não registado</h3>
              <p className="text-amber-700 text-sm text-pretty">
                Para publicares ofertas, regista primeiro o teu veículo.
              </p>
              <button
                type="button"
                onClick={() => navigate('/veiculo')}
                className="mt-2 bg-amber-500 text-white text-sm font-bold py-2.5 px-4 rounded-lg"
              >
                Registar veículo
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <LoadingSkeleton />}

      {!isLoading && ofertas.length === 0 && hasVehicle && (
        <EmptyState
          icon={MapPin}
          title="Ainda sem ofertas"
          message="Publica a tua primeira oferta de capacidade."
          actionLabel="Publicar oferta"
          onAction={() => navigate('/publicar-trajeto')}
        />
      )}

      <div className="space-y-4">
        {ofertas.map((oferta) => {
          const chip = estadoChip(oferta.estado);
          const time = String(oferta.departure_time || '').slice(0, 5);
          return (
            <section
              key={oferta.id}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${chip.className}`}>
                  {chip.label}
                </span>
                <span className="text-xs text-slate-400">{labelModo(oferta.modo_preco)}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                <span>{oferta.origin_name || 'Origem'}</span>
                <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
                <span>{oferta.destination_name || 'Destino'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={15} aria-hidden="true" /> {time}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={15} aria-hidden="true" />{' '}
                  {oferta.vagas_disponiveis}{' '}
                  {oferta.vagas_disponiveis === 1 ? 'lugar disponível' : 'lugares disponíveis'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800">
                <strong className="text-primary tabular-nums">
                  {formatKwanza(oferta.valor_mensal_ask_kz)} Kz
                </strong>
                <button
                  type="button"
                  onClick={() => handleVerPropostas(oferta.id)}
                  className="text-sm font-bold text-primary flex items-center gap-1"
                >
                  Ver propostas <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {selectedOfertaId && (
        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold text-balance">Rever propostas</h2>
          {propostas.length === 0 ? (
            <p className="text-sm text-slate-500">Não há propostas abertas nesta oferta.</p>
          ) : (
            propostas.map((p) => (
              <section
                key={p.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm space-y-3"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">
                    {p.n_passageiros_propostos}{' '}
                    {p.n_passageiros_propostos === 1 ? 'passageiro' : 'passageiros'}
                  </span>
                  <span className="text-primary font-bold tabular-nums">
                    {formatKwanza(p.valor_mensal_ask_kz)} Kz
                  </span>
                </div>
                <p className="text-xs text-slate-500">{labelModo(p.modo_preco)}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => handleAceitar(p.id)}
                    className="flex-1 bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-60"
                  >
                    Aceitar proposta
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => handleRecusar(p.id)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 font-bold py-3 rounded-xl disabled:opacity-60"
                  >
                    Recusar
                  </button>
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </PageShell>
  );
};

export default DriverDashboard;
