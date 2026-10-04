import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAbsences, logAbsence } from '../services/AbsenceService';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
} from '../services/AgreementService';
import { listPagamentosByAcordo } from '../services/PaymentService';
import { allowsAssiduidadeFaltasForAcordo } from '../utils/paymentStatus';
import LogAbsenceModal from '../components/LogAbsenceModal';
import PageShell from '../components/PageShell';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import {
  filterFaltasEsteMes,
  formatFaltaDiaCurto,
  resolveFaltasHubCard,
  sumDescontoFaltas,
} from '../utils/faltasDisplay';

/**
 * @param {string | null | undefined} viagem
 * @returns {string}
 */
function labelViagemFalta(viagem) {
  const v = String(viagem || '').toLowerCase();
  if (v === 'ida') return 'Só ida';
  if (v === 'regresso') return 'Só regresso';
  if (v === 'ambas') return 'Ida e regresso';
  return '';
}

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
  const [podeRegistarFaltas, setPodeRegistarFaltas] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [acordoDetalhe, setAcordoDetalhe] = useState(null);

  const carregarGatePagamento = useCallback(async () => {
    if (!acordoId || !user?.id) {
      setPodeRegistarFaltas(false);
      setAcordoDetalhe(null);
      return;
    }
    setGateLoading(true);
    try {
      const [pagamentos, acordos] = await Promise.all([
        listPagamentosByAcordo(acordoId),
        tipoPerfil === 'Motorista'
          ? getAgreementsForDriver(user.id)
          : getAgreementsForPassenger(user.id),
      ]);
      const acordo = (acordos || []).find((a) => a.id === acordoId) || null;
      setAcordoDetalhe(acordo);
      let idsRequired = [];
      if (tipoPerfil === 'Motorista') {
        idsRequired = (acordo?.acordos_passageiros || [])
          .filter((p) => p.estado?.toLowerCase() === 'activo')
          .map((p) => p.passenger_id)
          .filter(Boolean);
      } else {
        idsRequired = [user.id];
      }
      setPodeRegistarFaltas(
        allowsAssiduidadeFaltasForAcordo(pagamentos, idsRequired),
      );
    } catch (err) {
      console.error('Erro ao verificar pagamento para faltas:', err);
      setPodeRegistarFaltas(false);
      setAcordoDetalhe(null);
    } finally {
      setGateLoading(false);
    }
  }, [acordoId, user?.id, tipoPerfil]);

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
      void carregarGatePagamento();
    } else {
      carregarAcordosActivos();
    }
  }, [acordoId, carregarFaltas, carregarAcordosActivos, carregarGatePagamento]);

  const faltasEsteMes = filterFaltasEsteMes(faltas);
  const totalDesconto = sumDescontoFaltas(faltasEsteMes);

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
      <header className="mb-3 flex flex-col gap-3">
        <h1 className="text-[22px] font-bold leading-[30px] text-slate-900 dark:text-white">Faltas</h1>
        <p className="text-sm leading-[19px] text-slate-500 dark:text-slate-400">
          Selecciona um acordo para ver ou registar faltas
        </p>
      </header>
      <div className="space-y-3">
        {loading ? (
          <LoadingSkeleton variant="list" count={3} />
        ) : acordosActivos.length === 0 ? (
          <div className="px-2 py-9 text-center">
            <p className="text-base font-bold text-slate-900 dark:text-white">Sem acordos activos</p>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-5 text-slate-500 dark:text-slate-400">
              Não tens acordos activos. As faltas só podem ser registadas em boleias activas.
            </p>
            <button
              type="button"
              onClick={() => navigate('/acordos')}
              className="mt-4 h-12 w-full rounded-xl bg-primary text-[15px] font-semibold text-[#06130b]"
            >
              Ver acordos
            </button>
          </div>
        ) : (
          acordosActivos.map((acordo) => {
            const card = resolveFaltasHubCard(acordo);
            return (
              <button
                key={acordo.id}
                type="button"
                data-testid="acordo-faltas-item"
                onClick={() => navigate(`/faltas/${acordo.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-900/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-5 text-slate-900 dark:text-slate-100">
                    {card.titulo}
                  </span>
                  {card.rota ? (
                    <span className="mt-1 block text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
                      <span className="block">{card.rota.origem}</span>
                      <span className="block">{card.rota.destino}</span>
                    </span>
                  ) : null}
                  <span className="mt-1 block text-[13px] leading-[18px] text-slate-500 tabular-nums dark:text-slate-400">
                    {formatKwanza(card.precoKz)} Kz / pessoa
                  </span>
                </span>
                <ChevronRight className="shrink-0 text-slate-400" size={16} aria-hidden="true" />
              </button>
            );
          })
        )}
      </div>
    </>
  );

  const renderDetalhe = () => (
    <>
      <header className="mb-3 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate('/faltas')}
          className="w-fit text-sm font-semibold leading-[19px] text-primary"
        >
          Faltas
        </button>
        <h1 className="text-[22px] font-bold leading-[30px] text-slate-900 dark:text-white">
          Registo de Faltas
        </h1>
      </header>

      {!gateLoading && !podeRegistarFaltas ? (
        <p
          className="mb-3 text-base font-bold leading-snug text-slate-900 dark:text-white"
          data-testid="faltas-gate-pagamento"
        >
          Registo de faltas disponível após pagamento validado em custódia.
        </p>
      ) : null}

      <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-[13px] font-semibold leading-[18px] text-slate-500 dark:text-slate-400">
          Total a descontar
        </p>
        <p className="text-[28px] font-bold leading-[38px] text-slate-900 tabular-nums dark:text-white">
          {formatKwanza(totalDesconto)} Kz
        </p>
      </div>
      <p className="mt-3 text-xs leading-4 text-slate-500 dark:text-slate-400">
        Desconto com base na quota mensal do acordo (por pessoa).
      </p>

      <div className="mb-3 mt-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Histórico de Ausências</h2>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          Este mês
        </span>
      </div>

      <div className="space-y-3">
        {loading ? (
          <LoadingSkeleton variant="list" count={4} />
        ) : faltasEsteMes.length === 0 ? (
          podeRegistarFaltas ? (
            <div className="py-7 text-center">
              <p className="text-base font-bold text-slate-900 dark:text-white">Sem faltas este mês</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Não há faltas registadas neste acordo.
              </p>
            </div>
          ) : null
        ) : (
          faltasEsteMes.map((falta) => {
            const viagem = labelViagemFalta(falta.viagem);
            return (
              <div
                key={falta.id}
                data-testid="absence-card"
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-[15px] font-semibold leading-5 text-slate-900 dark:text-white">
                    {formatFaltaDiaCurto(falta.data_falta)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-[#f6f8f6] px-2 py-0.5 text-[11px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {falta.tipo}
                    </span>
                    {viagem ? (
                      <span className="text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
                        {viagem}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p
                  className="shrink-0 text-[15px] font-semibold text-slate-900 tabular-nums dark:text-white"
                  aria-label={`Desconto de ${formatKwanza(falta.desconto_kz)} Kz`}
                >
                  {formatKwanza(falta.desconto_kz)} Kz
                </p>
              </div>
            );
          })
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

      {acordoId && podeRegistarFaltas ? (
        <div className="fixed bottom-24 right-4 z-header">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={submitting || gateLoading}
            className="rounded-xl bg-primary px-4 py-3.5 text-[15px] font-semibold text-[#06130b] disabled:opacity-60"
          >
            Registar Falta
          </button>
        </div>
      ) : null}

      <LogAbsenceModal
        key={tipoPerfil}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleLogAbsence}
        tipoPerfil={tipoPerfil}
        quotaMensalKz={acordoDetalhe?.valor_mensal_por_passageiro_kz}
        diasUteisMes={acordoDetalhe?.dias_uteis_mes}
      />
    </PageShell>
  );
};

export default AbsenceTracker;
