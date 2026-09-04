import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Clock, Users, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  leavePassenger,
} from '../services/AgreementService';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import ConfirmationModal from '../components/ConfirmationModal';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

/**
 * Gestão de acordos 1 motorista : N passageiros.
 */
const MyAgreements = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tipoPerfil } = useAuth();
  const [message, setMessage] = useState({ type: '', text: '' });
  const [acordos, setAcordos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data =
        tipoPerfil === 'Motorista'
          ? await getAgreementsForDriver(user.id)
          : await getAgreementsForPassenger(user.id);
      setAcordos((data || []).filter((a) => !a.is_hidden_by_user));
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tipoPerfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (isLoading || acordos.length === 0) return;
    const params = new URLSearchParams(location.search);
    const openAcordoId = params.get('openAcordoId') || location.state?.openAcordoId;
    if (openAcordoId) {
      const found = acordos.find((a) => a.id === openAcordoId);
      if (found) {
        setSelected(found);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [isLoading, acordos, location.search, location.state, navigate, location.pathname]);

  const activos = acordos.filter((a) => a.estado === 'activo');
  const outros = acordos.filter((a) => a.estado !== 'activo');

  const handleLeave = async () => {
    if (!selected || !user?.id) return;
    try {
      await leavePassenger(selected.id, user.id);
      setMessage({ type: 'success', text: 'Saíste do acordo. A quota do mês mantém-se.' });
      setLeaveModalOpen(false);
      setSelected(null);
      await carregar();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    }
  };

  const renderCard = (acordo) => {
    const nPax =
      acordo.n_passageiros_contrato ||
      acordo.acordos_passageiros?.filter((p) => p.estado === 'activo').length ||
      0;
    const oferta = acordo.ofertas_capacidade;
    const origem = oferta?.origin_name || 'Origem';
    const destino = oferta?.destination_name || 'Destino';
    return (
      <button
        type="button"
        key={acordo.id}
        onClick={() => setSelected(acordo)}
        className="w-full text-left bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2"
      >
        <div className="flex justify-between items-center">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              acordo.estado === 'activo'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {acordo.estado === 'activo' ? 'Activo' : acordo.estado}
          </span>
          <ChevronRight size={18} className="text-slate-400" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 font-bold">
          <span>{origem}</span>
          <ArrowRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span>{destino}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Users size={14} aria-hidden="true" />
            {nPax === 1 ? 'Individual' : `Grupo · ${nPax} pessoas`}
          </span>
          <strong className="text-primary tabular-nums">
            {formatKwanza(acordo.valor_mensal_por_passageiro_kz)} Kz / pessoa
          </strong>
        </div>
      </button>
    );
  };

  return (
    <PageShell>
      <PageHeader title="Acordos" subtitle="As tuas viagens combinadas num só lugar." />

      {message.text && (
        <div
          role="alert"
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {isLoading && <LoadingSkeleton />}

      {!isLoading && acordos.length === 0 && (
        <EmptyState
          title="Sem acordos"
          message="Quando aceitares uma proposta, o acordo aparece aqui."
        />
      )}

      {!isLoading && activos.length > 0 && (
        <div className="space-y-3 mb-6">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Activos · {activos.length}
          </p>
          {activos.map(renderCard)}
        </div>
      )}

      {!isLoading && outros.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Outros</p>
          {outros.map(renderCard)}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <h2 className="text-lg font-bold text-balance">Detalhe do acordo</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-slate-500">Estado:</span>{' '}
                <strong>{selected.estado}</strong>
              </p>
              <p>
                <span className="text-slate-500">Passageiros no contrato:</span>{' '}
                <strong>{selected.n_passageiros_contrato}</strong>
              </p>
              <p>
                <span className="text-slate-500">Por pessoa:</span>{' '}
                <strong className="tabular-nums">
                  {formatKwanza(selected.valor_mensal_por_passageiro_kz)} Kz
                </strong>
              </p>
              <p>
                <span className="text-slate-500">Total do acordo:</span>{' '}
                <strong className="tabular-nums">
                  {formatKwanza(selected.valor_mensal_total_kz)} Kz
                </strong>
              </p>
              {selected.acordos_passageiros?.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                  {selected.acordos_passageiros.map((p) => (
                    <li key={p.id} className="flex justify-between text-xs">
                      <span>{p.passenger_id.slice(0, 8)}…</span>
                      <span>
                        {formatKwanza(p.quota_mensal_kz)} Kz · {p.estado}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate(`/faltas/${selected.id}`)}
                className="w-full bg-slate-100 dark:bg-slate-800 font-bold py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <Clock size={16} aria-hidden="true" /> Registar faltas
              </button>
              {tipoPerfil === 'Passageiro' && selected.estado === 'activo' && (
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(true)}
                  className="w-full text-red-600 font-bold py-3 rounded-xl border border-red-200"
                >
                  Sair do acordo
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full font-bold py-3 text-slate-500"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={leaveModalOpen}
        title="Sair do acordo?"
        message="A tua quota deste mês não é reembolsada. Os preços dos restantes passageiros mantêm-se."
        confirmText="Sair"
        onConfirm={handleLeave}
        onCancel={() => setLeaveModalOpen(false)}
      />
    </PageShell>
  );
};

export default MyAgreements;
