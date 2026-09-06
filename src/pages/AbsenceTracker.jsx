import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, Info, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAbsences, logAbsence } from '../services/AbsenceService';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
} from '../services/AgreementService';
import LogAbsenceModal from '../components/LogAbsenceModal';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatDate } from '../utils/formatters';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

const AbsenceTracker = () => {
  const { acordoId } = useParams();
  const navigate = useNavigate();
  const { user, tipoPerfil } = useAuth();

  const [faltas, setFaltas] = useState([]);
  const [acordosActivos, setAcordosActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const carregarFaltas = useCallback(async () => {
    if (!acordoId) return;
    setLoading(true);
    try {
      const data = await getAbsences(acordoId);
      setFaltas(data);
    } catch (err) {
      console.error('Erro ao buscar faltas:', err);
      setMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [acordoId]);

  const carregarAcordosActivos = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setAcordosActivos([]);
        return;
      }
      const acordos =
        tipoPerfil === 'Motorista'
          ? await getAgreementsForDriver(user.id)
          : await getAgreementsForPassenger(user.id);
      const activos = (acordos || []).filter(
        (a) => a.estado?.toLowerCase() === 'activo' && !a.is_hidden_by_user,
      );
      setAcordosActivos(activos);
    } catch (err) {
      console.error('Erro ao carregar acordos:', err);
      setMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [user?.id, tipoPerfil]);

  useEffect(() => {
    if (acordoId) {
      carregarFaltas();
    } else {
      carregarAcordosActivos();
    }
  }, [acordoId, carregarFaltas, carregarAcordosActivos]);

  const totalDesconto = faltas.reduce(
    (acc, falta) => acc + (Number(falta.desconto_kz) || 0),
    0,
  );

  const handleLogAbsence = async (formData) => {
    if (!acordoId) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      await logAbsence({
        id_acordo: acordoId,
        data_falta: formData.dataFalta,
        tipo: formData.tipo,
        observacao: formData.observacao || null,
        passenger_id: formData.tipo === 'Passageiro' ? user?.id : null,
        viagem: formData.viagem || 'ambas',
      });
      setIsModalOpen(false);
      setMessage({ type: 'success', text: 'Falta registada com sucesso.' });
      await carregarFaltas();
    } catch (err) {
      console.error('Erro ao registar falta:', err);
      setMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const renderHub = () => (
    <>
      <PageHeader
        title="Registo de Faltas"
        subtitle="Selecciona um acordo para ver ou registar faltas"
      />
      <div className="space-y-3">
        {loading ? (
          <LoadingSkeleton variant="list" count={3} />
        ) : acordosActivos.length === 0 ? (
          <EmptyState
            title="Sem acordos activos"
            message="Não tens acordos activos. As faltas só podem ser registadas em boleias activas."
            actionLabel="Ver acordos"
            onAction={() => navigate('/acordos')}
          />
        ) : (
          acordosActivos.map((acordo) => (
            <button
              key={acordo.id}
              type="button"
              data-testid="acordo-faltas-item"
              onClick={() => navigate(`/faltas/${acordo.id}`)}
              className="w-full bg-white dark:bg-slate-900/50 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center text-left hover:border-primary/30 transition-colors"
            >
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  Acordo · {acordo.n_passageiros_contrato}{' '}
                  {acordo.n_passageiros_contrato === 1 ? 'pessoa' : 'pessoas'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {Number(acordo.valor_mensal_por_passageiro_kz).toLocaleString('pt-PT')} Kz /
                  pessoa
                </p>
              </div>
              <ChevronRight className="text-primary shrink-0" size={20} aria-hidden="true" />
            </button>
          ))
        )}
      </div>
    </>
  );

  const renderDetalhe = () => (
    <>
      <PageHeader title="Registo de Faltas" onBack={() => navigate('/faltas')} />

      <div className="mt-2 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl border border-primary/20">
        <p className="text-primary font-semibold text-sm uppercase">Total a descontar</p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-3xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
            {formatKwanza(totalDesconto)}
          </span>
          <span className="text-lg font-semibold text-slate-600 dark:text-slate-400">Kz</span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info size={14} aria-hidden="true" />
          <span className="text-pretty">
            Desconto com base na quota mensal do acordo (por pessoa), sem divisores fixos.
          </span>
        </div>
      </div>

      <div className="mt-8 mb-4 flex justify-between items-center">
        <h2 className="text-lg font-bold text-balance">Histórico de Ausências</h2>
        <span className="text-sm text-primary font-medium">Este mês</span>
      </div>

      <div className="space-y-3">
        {loading ? (
          <LoadingSkeleton variant="list" count={4} />
        ) : faltas.length === 0 ? (
          <EmptyState message="Não há faltas registadas neste acordo." />
        ) : (
          faltas.map((falta) => (
            <div
              key={falta.id}
              data-testid="absence-card"
              className="bg-white dark:bg-slate-900/50 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tabular-nums">
                    {formatDate(falta.data_falta) || falta.data_falta}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      falta.tipo?.toLowerCase() === 'motorista'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {falta.tipo}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {falta.observacao || '-'}
                  {falta.viagem ? ` · ${falta.viagem}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-red-500 tabular-nums">
                  -{formatKwanza(falta.desconto_kz)} Kz
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <PageShell className="pb-32">
      {message.text && (
        <div
          role="alert"
          className={`mb-4 p-4 rounded-xl text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {acordoId ? renderDetalhe() : renderHub()}

      {acordoId && (
        <div className="fixed bottom-24 right-4 z-header">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={submitting}
            className="bg-primary hover:bg-primary/90 text-white flex items-center gap-2 px-5 py-3.5 rounded-full shadow-lg shadow-primary/30 font-bold transition-all active:scale-95 disabled:opacity-60"
          >
            <Plus size={20} aria-hidden="true" />
            <span>Registar Falta</span>
          </button>
        </div>
      )}

      <LogAbsenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleLogAbsence}
      />
    </PageShell>
  );
};

export default AbsenceTracker;
