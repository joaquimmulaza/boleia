import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Clock, Users, ChevronRight, ShieldCheck, Pencil, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  leavePassenger,
  renegotiateAgreementPricing,
  proposeAgreementAdenda,
  acceptAgreementAdenda,
  rejectAgreementAdenda,
  terminateAgreement,
} from '../services/AgreementService';
import { listPending } from '../services/offlineQueue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import EmptyState from '../components/EmptyState';
import FeedbackAlert from '../components/FeedbackAlert';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import ConfirmationModal from '../components/ConfirmationModal';
import TerminateAgreementModal from '../components/TerminateAgreementModal';
import { Button } from '../components/ui/button';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing';

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isActivo(estado) {
  return String(estado || '').toLowerCase() === 'activo';
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isCancelamentoPendente(estado) {
  return String(estado || '').toLowerCase() === 'cancelamento_pendente';
}

/**
 * Rótulo humano do estado do acordo (sem snake_case na UI).
 * @param {string | null | undefined} estado
 * @returns {string}
 */
function estadoAcordoLabel(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'activo') return 'Activo';
  if (e === 'cancelamento_pendente') return 'A terminar no fim do mês';
  if (e === 'cancelado') return 'Cancelado';
  if (e === 'cancelado_justificado') return 'Terminado';
  return estado || '—';
}

/**
 * @param {{ estado?: string, created_by?: string } | null | undefined} adenda
 * @param {string | undefined} userId
 * @param {boolean} isMotorista
 * @returns {boolean}
 */
function isAdendaCreator(adenda, userId, isMotorista) {
  if (!adenda || !userId) return false;
  if (adenda.created_by) return adenda.created_by === userId;
  const estado = String(adenda.estado || '').toLowerCase();
  if (estado === 'pendente_passageiro') return isMotorista;
  if (estado === 'pendente_contraparte') return !isMotorista;
  return false;
}

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
function estadoPassageiroLabel(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'activo') return 'Confirmado';
  if (e === 'saiu') return 'Saiu';
  return estado || '—';
}

/**
 * @param {string | null | undefined} nome
 * @returns {string}
 */
function iniciais(nome) {
  const parts = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * @param {{ perfis?: { nome_completo?: string }, nome?: string, passenger_id?: string }} pax
 * @returns {string}
 */
function nomePassageiro(pax) {
  return pax?.perfis?.nome_completo || pax?.nome || 'Passageiro';
}

/**
 * Formata hora HH:MM a partir de time/timestamptz/string.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function formatHora(raw) {
  if (!raw) return null;
  const s = String(raw);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/**
 * Contagem de passageiros activos no acordo.
 * @param {{ acordos_passageiros?: Array<{ estado?: string }> } | null | undefined} acordo
 * @returns {number}
 */
function countActivos(acordo) {
  const linhas = acordo?.acordos_passageiros || [];
  return linhas.filter((p) => isActivo(p.estado)).length;
}

/**
 * Rótulo do mês de vigência da adenda (ex. «outubro de 2026»).
 * @param {string | null | undefined} isoDate
 * @returns {string}
 */
function formatMesAdenda(isoDate) {
  if (!isoDate) return 'próximo mês';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'próximo mês';
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}

/**
 * Gestão de acordos 1 motorista : N passageiros.
 */
const MyAgreements = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tipoPerfil } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [message, setMessage] = useState({ type: '', text: '' });
  const [acordos, setAcordos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  /** @type {[Record<string, true>, React.Dispatch<React.SetStateAction<Record<string, true>>>]} */
  const [pendingLeaveIds, setPendingLeaveIds] = useState({});

  const [adendaModo, setAdendaModo] = useState(
    /** @type {'POR_PASSAGEIRO' | 'TOTAL_ACORDO'} */ ('POR_PASSAGEIRO'),
  );
  const [adendaValor, setAdendaValor] = useState('');
  const [adendaN, setAdendaN] = useState('');
  const [adendaFormOpen, setAdendaFormOpen] = useState(false);
  const [adendaModalOpen, setAdendaModalOpen] = useState(false);
  const [adendaBusy, setAdendaBusy] = useState(false);
  const [adendaError, setAdendaError] = useState('');
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateBusy, setTerminateBusy] = useState(false);
  const [terminateError, setTerminateError] = useState('');
  const [terminateFeedback, setTerminateFeedback] = useState({ type: '', text: '' });
  const [consensualModalOpen, setConsensualModalOpen] = useState(false);

  const syncPendingLeaves = useCallback(async () => {
    try {
      const pending = await listPending();
      const next = {};
      for (const item of pending || []) {
        if (item?.rpc !== 'leave_passenger') continue;
        const acordoId = item?.args?.p_acordo_id;
        if (acordoId) next[String(acordoId)] = true;
      }
      setPendingLeaveIds(next);
    } catch {
      /* fila indisponível — manter estado local */
    }
  }, []);

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return [];
    }
    setIsLoading(true);
    try {
      const data =
        tipoPerfil === 'Motorista'
          ? await getAgreementsForDriver(user.id)
          : await getAgreementsForPassenger(user.id);
      const filtered = (data || []).filter((a) => !a.is_hidden_by_user);
      setAcordos(filtered);
      return filtered;
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tipoPerfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    void syncPendingLeaves();
  }, [syncPendingLeaves]);

  useEffect(() => {
    if (!isOnline) return;
    void syncPendingLeaves();
  }, [isOnline, syncPendingLeaves]);

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

  const activos = acordos.filter((a) => isActivo(a.estado));
  const outros = acordos.filter((a) => !isActivo(a.estado));

  const closeAdendaForm = () => {
    setAdendaFormOpen(false);
    setAdendaModalOpen(false);
    setAdendaBusy(false);
    setAdendaError('');
    setAdendaModo('POR_PASSAGEIRO');
    setAdendaValor('');
    setAdendaN('');
  };

  /**
   * @param {typeof selected} acordo
   */
  const openAdendaForm = (acordo) => {
    const nContrato = acordo?.n_passageiros_contrato || countActivos(acordo) || 1;
    setAdendaModo('POR_PASSAGEIRO');
    setAdendaValor(
      acordo?.valor_mensal_por_passageiro_kz != null
        ? String(acordo.valor_mensal_por_passageiro_kz)
        : '',
    );
    setAdendaN(String(nContrato));
    setAdendaError('');
    setAdendaFormOpen(true);
  };

  const handleLeave = async () => {
    if (!selected || !user?.id || leaveBusy) return;
    const acordoId = selected.id;
    setLeaveBusy(true);
    try {
      const result = await leavePassenger(acordoId, user.id);
      setLeaveModalOpen(false);
      if (result?.offlineQueued) {
        setPendingLeaveIds((prev) => ({ ...prev, [acordoId]: true }));
        setMessage({
          type: 'success',
          text: 'Saída guardada. Sincronizamos quando a rede voltar.',
        });
        setSelected(null);
        await carregar();
        return;
      }
      setMessage({
        type: 'success',
        text: 'Saíste do acordo. A quota do mês mantém-se.',
      });
      setSelected(null);
      setPendingLeaveIds((prev) => {
        const next = { ...prev };
        delete next[acordoId];
        return next;
      });
      await carregar();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setLeaveBusy(false);
    }
  };

  const handleConfirmAdenda = async () => {
    if (!selected || adendaBusy) return;
    const valor = Number.parseInt(String(adendaValor), 10);
    const n = Number.parseInt(String(adendaN), 10);
    if (!Number.isInteger(valor) || valor < 0) {
      setAdendaError('Indica um valor mensal válido em Kz (inteiro).');
      setAdendaModalOpen(false);
      return;
    }
    if (!Number.isInteger(n) || n < 1) {
      setAdendaError('Indica o número de passageiros no preço.');
      setAdendaModalOpen(false);
      return;
    }

    setAdendaBusy(true);
    setAdendaError('');
    try {
      const isMotorista = tipoPerfil === 'Motorista';
      const submitAdenda = isMotorista
        ? renegotiateAgreementPricing
        : proposeAgreementAdenda;
      const result = await submitAdenda(selected.id, {
        modo_preco: adendaModo,
        valor_ask_kz: valor,
        n_passageiros: n,
      });
      if (result?.offlineQueued) {
        setMessage({
          type: 'offline',
          text: 'Alteração agendada offline. Será sincronizada assim que recuperar rede.',
        });
      } else {
        setMessage({
          type: 'success',
          text: isMotorista
            ? 'Proposta de novo preço enviada. Fica à espera da aceitação do passageiro.'
            : 'Proposta de novo preço enviada. Fica à espera da aceitação do motorista.',
        });
      }
      const acordoId = selected.id;
      closeAdendaForm();
      const refreshed = await carregar();
      const updated = refreshed.find((a) => a.id === acordoId);
      if (updated) setSelected(updated);
    } catch (err) {
      console.error('Erro ao renegociar preço:', err);
      setAdendaError(err.message || getFriendlyErrorMessage(err));
      setAdendaModalOpen(false);
    } finally {
      setAdendaBusy(false);
    }
  };

  /**
   * @param {{ modo: 'aviso_previo' | 'consensual' | 'justa_causa', justificativa?: string }} input
   */
  const handleConfirmTerminate = async (input) => {
    if (!selected || terminateBusy) return;
    setTerminateBusy(true);
    setTerminateError('');
    try {
      const payload =
        input.modo === 'justa_causa'
          ? { modo: input.modo, justificativa: input.justificativa }
          : { modo: input.modo };
      const result = await terminateAgreement(selected.id, payload);
      setTerminateOpen(false);
      setConsensualModalOpen(false);
      setTerminateError('');
      const feedback = result?.offlineQueued
        ? { type: 'offline', text: 'Aguardando sincronização…' }
        : result?.rescisao_aguarda_confirmacao
          ? {
              type: 'success',
              text: 'Pedido enviado. O acordo só termina quando a outra parte confirmar.',
            }
          : result?.rescisao_concluida
            ? { type: 'success', text: 'Acordo terminado.' }
            : {
                type: 'success',
                text: 'O acordo continua activo até ao último dia deste mês.',
              };
      setTerminateFeedback(feedback);
      setMessage(feedback);
      const acordoId = selected.id;
      const refreshed = await carregar();
      const updated = refreshed.find((a) => a.id === acordoId);
      setSelected(updated || null);
    } catch (err) {
      console.error('Erro ao rescindir acordo:', err);
      const text = err.message || getFriendlyErrorMessage(err);
      if (terminateOpen) {
        setTerminateError(text);
      } else {
        setConsensualModalOpen(false);
        setTerminateFeedback({ type: 'error', text });
        setMessage({ type: 'error', text });
      }
    } finally {
      setTerminateBusy(false);
    }
  };

  const handleConfirmConsensual = async () => {
    await handleConfirmTerminate({ modo: 'consensual' });
  };

  const handleAcceptAdenda = async () => {
    const adendaId = selected?.adenda_pendente?.id;
    if (!adendaId || adendaBusy) return;
    setAdendaBusy(true);
    try {
      const result = await acceptAgreementAdenda(adendaId);
      setMessage(
        result?.offlineQueued
          ? {
              type: 'offline',
              text: 'Alteração agendada offline. Será sincronizada assim que recuperar rede.',
            }
          : {
              type: 'success',
              text: 'Alteração aceite. O novo preço aplica-se a partir do próximo mês.',
            },
      );
      const acordoId = selected.id;
      const refreshed = await carregar();
      const updated = refreshed.find((a) => a.id === acordoId);
      if (updated) setSelected(updated);
    } catch (err) {
      console.error('Erro ao aceitar adenda:', err);
      setMessage({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setAdendaBusy(false);
    }
  };

  const handleRejectAdenda = async () => {
    const adendaId = selected?.adenda_pendente?.id;
    if (!adendaId || adendaBusy) return;
    setAdendaBusy(true);
    try {
      const result = await rejectAgreementAdenda(adendaId);
      setMessage(
        result?.offlineQueued
          ? {
              type: 'offline',
              text: 'Alteração agendada offline. Será sincronizada assim que recuperar rede.',
            }
          : {
              type: 'success',
              text: 'Alteração rejeitada. Mantém-se o preço combinado actual.',
            },
      );
      const acordoId = selected.id;
      const refreshed = await carregar();
      const updated = refreshed.find((a) => a.id === acordoId);
      if (updated) setSelected(updated);
    } catch (err) {
      console.error('Erro ao rejeitar adenda:', err);
      setMessage({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setAdendaBusy(false);
    }
  };

  /**
   * @param {typeof selected} acordo
   */
  const renderCard = (acordo) => {
    const linhas = acordo.acordos_passageiros || [];
    const nPax =
      acordo.n_passageiros_contrato ||
      linhas.filter((p) => isActivo(p.estado)).length ||
      0;
    const oferta = acordo.ofertas_capacidade;
    const origem = oferta?.origin_name || 'Origem';
    const destino = oferta?.destination_name || 'Destino';
    const activo = isActivo(acordo.estado);
    const aTerminar = isCancelamentoPendente(acordo.estado);
    const leavePending = Boolean(pendingLeaveIds[acordo.id]);
    const minhaLinha = linhas.find((p) => p.passenger_id === user?.id);
    const quotaCard =
      tipoPerfil === 'Passageiro'
        ? (minhaLinha?.quota_mensal_kz ?? acordo.valor_mensal_por_passageiro_kz)
        : acordo.valor_mensal_por_passageiro_kz;
    return (
      <button
        type="button"
        key={acordo.id}
        onClick={() => {
          closeAdendaForm();
          setSelected(acordo);
        }}
        className="w-full text-left bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2"
      >
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    activo
                      ? 'bg-emerald-100 text-emerald-800'
                      : aTerminar
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {estadoAcordoLabel(acordo.estado)}
                </span>
            {leavePending && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                data-testid={`saida-pendente-${acordo.id}`}
              >
                <Loader2 size={12} className="animate-spin shrink-0" aria-hidden="true" />
                Saída Pendente (A sincronizar...)
              </span>
            )}
          </div>
          <ChevronRight size={18} className="text-slate-400 shrink-0" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 font-bold">
          <span>{origem}</span>
          <ArrowRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span>{destino}</span>
        </div>
        <div className="flex justify-between items-end gap-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Users size={14} aria-hidden="true" />
            {nPax === 1 ? 'Individual' : `Grupo · ${nPax} pessoas`}
          </span>
          {activo && quotaCard != null ? (
            <strong
              data-testid="card-quota-congelada"
              className="text-lg font-bold text-primary tabular-nums"
            >
              {formatKwanza(quotaCard)} Kz / pessoa
            </strong>
          ) : (
            <strong className="text-primary tabular-nums">
              {formatKwanza(acordo.valor_mensal_por_passageiro_kz)} Kz / pessoa
            </strong>
          )}
        </div>
      </button>
    );
  };

  const renderDetalhe = () => {
    if (!selected) return null;

    const oferta = selected.ofertas_capacidade;
    const origem = oferta?.origin_name || 'Origem';
    const destino = oferta?.destination_name || 'Destino';
    const horaPartida = formatHora(oferta?.departure_time);
    const linhas = selected.acordos_passageiros || [];
    const nLinhas = selected.n_passageiros_contrato || linhas.length || 0;
    const activo = isActivo(selected.estado);
    const aTerminar = isCancelamentoPendente(selected.estado);
    const isPassageiro = tipoPerfil === 'Passageiro';
    const isMotorista = tipoPerfil === 'Motorista';
    const minhaLinha = linhas.find((p) => p.passenger_id === user?.id);
    const quotaDestaque =
      minhaLinha?.quota_mensal_kz ?? selected.valor_mensal_por_passageiro_kz;
    const leavePending = Boolean(pendingLeaveIds[selected.id]);
    const isPassageiroActivo =
      isPassageiro && (!minhaLinha || isActivo(minhaLinha.estado));
    const podeSair = isPassageiroActivo && activo;
    const podeRenegociar = activo && (isMotorista || isPassageiroActivo);
    const podeRescindir = activo && (isMotorista || isPassageiroActivo);
    const adenda = selected.adenda_pendente;
    const adendaEstado = String(adenda?.estado || '').toLowerCase();
    const adendaPendenteDecisao =
      adendaEstado === 'pendente_passageiro' || adendaEstado === 'pendente_contraparte';
    const souCriadorAdenda = isAdendaCreator(adenda, user?.id, isMotorista);
    const possoDecidirAdenda =
      adendaPendenteDecisao &&
      !souCriadorAdenda &&
      ((adendaEstado === 'pendente_passageiro' && isPassageiroActivo) ||
        (adendaEstado === 'pendente_contraparte' && isMotorista));
    const consensualPendente =
      activo &&
      String(selected.rescisao_modo || '').toLowerCase() === 'consensual' &&
      Boolean(selected.rescisao_solicitada_por);
    const souSolicitanteRescisao = selected.rescisao_solicitada_por === user?.id;

    const valorNum = Number.parseInt(String(adendaValor), 10);
    const nNum = Number.parseInt(String(adendaN), 10);
    let preview = null;
    let previewHasResto = false;
    if (
      adendaFormOpen &&
      Number.isInteger(valorNum) &&
      valorNum >= 0 &&
      Number.isInteger(nNum) &&
      nNum >= 1
    ) {
      try {
        preview = resolveAgreementPricing({
          modo_preco: adendaModo,
          valor_ask_kz: valorNum,
          n_passageiros: nNum,
        });
        previewHasResto =
          adendaModo === 'TOTAL_ACORDO' && valorNum % nNum !== 0;
      } catch {
        preview = null;
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="acordo-detail-title"
          className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-4 shadow-xl"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    activo
                      ? 'bg-emerald-100 text-emerald-800'
                      : aTerminar
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {estadoAcordoLabel(selected.estado)}
                </span>
                {leavePending && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                    <Loader2 size={12} className="animate-spin shrink-0" aria-hidden="true" />
                    Saída Pendente (A sincronizar...)
                  </span>
                )}
              </div>
            </div>
            <h2 id="acordo-detail-title" className="text-lg font-bold text-balance">
              Detalhe do acordo
            </h2>
            <p className="font-semibold text-slate-900 dark:text-white text-balance">
              {origem} → {destino}
            </p>
          </div>

          {terminateFeedback.text ? (
            <FeedbackAlert
              type={
                terminateFeedback.type === 'success'
                  ? 'success'
                  : terminateFeedback.type === 'offline'
                    ? 'offline'
                    : 'error'
              }
              text={terminateFeedback.text}
              className="mb-0"
            />
          ) : null}

          <section className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-4">
            {(horaPartida || origem || destino) && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Partida</p>
                  {horaPartida ? (
                    <p className="font-bold tabular-nums">{horaPartida}</p>
                  ) : null}
                  <p className="text-xs text-slate-600 dark:text-slate-300">{origem}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Chegada</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{destino}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 rounded-xl border border-emerald-200/80 bg-white dark:bg-slate-900 dark:border-emerald-900/40 p-3">
              <ShieldCheck
                size={20}
                className="text-primary shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Preço combinado
                </p>
                <p className="text-xs text-slate-500 text-pretty">
                  O valor fica congelado durante este acordo.
                </p>
                {selected.valor_mensal_total_kz != null && (
                  <p className="text-xs text-slate-400 pt-1">
                    Total do acordo{' '}
                    <span className="tabular-nums font-medium text-slate-600 dark:text-slate-300">
                      {formatKwanza(selected.valor_mensal_total_kz)} Kz
                    </span>
                  </p>
                )}
              </div>
              <strong
                className={`tabular-nums shrink-0 ${
                  isPassageiro
                    ? 'text-lg font-bold text-primary'
                    : 'text-base text-slate-900 dark:text-white'
                }`}
                data-testid="quota-destaque"
              >
                {formatKwanza(quotaDestaque)} Kz
              </strong>
            </div>

            {aTerminar ? (
              <FeedbackAlert
                type="success"
                className="mb-0"
                text={`O acordo continua activo até ${
                  selected.rescisao_effective_on
                    ? formatMesAdenda(selected.rescisao_effective_on)
                    : 'o último dia deste mês'
                }. As vagas mantêm-se ocupadas.`}
              />
            ) : null}

            {consensualPendente && souSolicitanteRescisao ? (
              <FeedbackAlert
                type="success"
                className="mb-0"
                text="A aguardar confirmação da outra parte."
              />
            ) : null}

            {adenda && (
              <div
                data-testid="adenda-pendente"
                className="rounded-xl border border-amber-200/90 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 space-y-1"
              >
                {adendaPendenteDecisao ? (
                  <>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {souCriadorAdenda
                        ? isMotorista
                          ? 'À espera da aceitação do passageiro'
                          : 'A aguardar resposta da outra parte'
                        : possoDecidirAdenda
                          ? 'Proposta de novo preço'
                          : 'A aguardar resposta da outra parte'}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Cada um pagaria{' '}
                      <span className="tabular-nums font-semibold">
                        {formatKwanza(adenda.valor_mensal_por_passageiro_kz)} Kz
                      </span>
                      {adenda.effective_from
                        ? ` a partir de ${formatMesAdenda(adenda.effective_from)}`
                        : ' a partir do próximo mês'}
                      .
                    </p>
                    {possoDecidirAdenda && (
                      <div className="mt-3 flex flex-col gap-3">
                        <Button
                          type="button"
                          className="w-full min-h-12 text-base"
                          disabled={adendaBusy}
                          onClick={handleAcceptAdenda}
                        >
                          Aceitar Alteração
                        </Button>
                        <button
                          type="button"
                          disabled={adendaBusy}
                          onClick={handleRejectAdenda}
                          className="w-full min-h-12 rounded-lg border border-red-300/90 bg-transparent px-4 text-sm font-semibold text-red-800 dark:border-red-800 dark:text-red-200 disabled:opacity-60"
                        >
                          Rejeitar Alteração
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Novo preço a partir de {formatMesAdenda(adenda.effective_from)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Cada um paga{' '}
                      <span className="tabular-nums font-semibold">
                        {formatKwanza(adenda.valor_mensal_por_passageiro_kz)} Kz
                      </span>
                    </p>
                    {adenda.valor_mensal_total_kz != null && (
                      <p className="text-xs text-slate-500">
                        Total{' '}
                        <span className="tabular-nums font-medium">
                          {formatKwanza(adenda.valor_mensal_total_kz)} Kz
                        </span>
                        . O mês corrente mantém as quotas já combinadas.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          <div className="border-t border-slate-100 dark:border-slate-800" role="separator" />

          {linhas.length > 0 ? (
            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Passageiros · {nLinhas || linhas.length}
              </p>
              <ul className="space-y-2">
                {linhas.map((p) => {
                  const nome = nomePassageiro(p);
                  const highlighted = isPassageiro && p.passenger_id === user?.id;
                  const saiu = String(p.estado || '').toLowerCase() === 'saiu';
                  return (
                    <li
                      key={p.id || p.passenger_id}
                      data-testid={`passenger-row-${p.passenger_id}`}
                      data-highlighted={highlighted ? 'true' : 'false'}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                        highlighted
                          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                          : saiu
                            ? 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                            : 'border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300"
                        aria-hidden="true"
                      >
                        {iniciais(nome)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {nome}
                        </p>
                        <p
                          className={`text-xs ${
                            saiu ? 'text-slate-400' : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {estadoPassageiroLabel(p.estado)}
                        </p>
                      </div>
                      <strong
                        className={`tabular-nums text-sm shrink-0 ${
                          highlighted
                            ? 'text-lg font-bold text-primary'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {formatKwanza(p.quota_mensal_kz)} Kz
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : isPassageiro ? (
            <section className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                A tua quota
              </p>
              <div
                data-testid={`passenger-row-${user?.id}`}
                data-highlighted="true"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 border border-primary/40 bg-primary/5 ring-1 ring-primary/20"
              >
                <span className="text-sm font-semibold">Tu</span>
                <strong className="tabular-nums text-lg font-bold text-primary">
                  {formatKwanza(quotaDestaque)} Kz
                </strong>
              </div>
            </section>
          ) : (
            <p className="text-sm text-slate-500">
              Passageiros · {nLinhas || 0}
            </p>
          )}

          {adendaFormOpen && podeRenegociar && (
            <section
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-4"
              aria-labelledby="adenda-title"
            >
              <div className="space-y-1">
                <h3 id="adenda-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Novo preço
                </h3>
                <p className="text-sm text-slate-500 text-pretty">
                  Actualiza o valor combinado do acordo.
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Modo</p>
                <div className="flex bg-slate-200/80 dark:bg-slate-800 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      adendaModo === 'POR_PASSAGEIRO'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                        : 'text-slate-500'
                    }`}
                    onClick={() => setAdendaModo('POR_PASSAGEIRO')}
                  >
                    Por passageiro
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      adendaModo === 'TOTAL_ACORDO'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                        : 'text-slate-500'
                    }`}
                    onClick={() => setAdendaModo('TOTAL_ACORDO')}
                  >
                    Total do acordo
                  </button>
                </div>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Valor mensal
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={adendaValor}
                    onChange={(e) => setAdendaValor(e.target.value)}
                    className="flex-1 h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
                  />
                  <span className="text-sm font-medium text-slate-500 shrink-0">Kz</span>
                </div>
              </label>

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Passageiros no preço
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={adendaN}
                  onChange={(e) => setAdendaN(e.target.value)}
                  className="h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
                />
                <span className="text-xs font-normal text-slate-400">
                  Por omissão: o número combinado no acordo
                </span>
              </label>

              {preview && (
                <div className="rounded-xl border border-emerald-200/80 bg-white dark:bg-slate-900 dark:border-emerald-900/40 p-3 space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Como fica</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Cada um paga{' '}
                    <span className="tabular-nums font-semibold">
                      {formatKwanza(preview.valor_mensal_por_passageiro_kz)} Kz
                    </span>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Total{' '}
                    <span className="tabular-nums font-semibold">
                      {formatKwanza(preview.valor_mensal_total_kz)} Kz
                    </span>
                  </p>
                  {previewHasResto && (
                    <p className="text-xs text-slate-500">O resto fica no último</p>
                  )}
                </div>
              )}

              {adendaError ? (
                <FeedbackAlert type="error" text={adendaError} className="mb-0" />
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  type="button"
                  className="w-full h-11 rounded-xl font-bold"
                  disabled={!preview}
                  onClick={() => {
                    setAdendaError('');
                    setAdendaModalOpen(true);
                  }}
                >
                  Rever e confirmar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-11 rounded-xl font-bold text-slate-500"
                  onClick={closeAdendaForm}
                >
                  Cancelar
                </Button>
              </div>
            </section>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {podeRenegociar && !adendaFormOpen && (
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-12 rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/5"
                onClick={() => openAdendaForm(selected)}
              >
                <Pencil size={16} aria-hidden="true" />
                {isMotorista ? 'Renegociar preço' : 'Propor Reajuste de Preço'}
              </Button>
            )}
            {activo && (
              <Button
                type="button"
                variant="secondary"
                className="w-full min-h-12 rounded-xl font-bold"
                onClick={() => navigate(`/faltas/${selected.id}`)}
              >
                <Clock size={16} aria-hidden="true" /> Registar falta
              </Button>
            )}
            {consensualPendente && !souSolicitanteRescisao && (isMotorista || isPassageiroActivo) ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-12 rounded-xl font-bold border-amber-300 text-amber-900 hover:bg-amber-50"
                disabled={terminateBusy}
                onClick={() => setConsensualModalOpen(true)}
              >
                Confirmar fim do acordo
              </Button>
            ) : null}
            {podeSair && (
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-12 rounded-xl font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                disabled={leavePending}
                onClick={() => setLeaveModalOpen(true)}
              >
                Sair do acordo
              </Button>
            )}
            {podeRescindir ? (
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-12 rounded-xl font-bold mt-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={terminateBusy}
                onClick={() => {
                  setTerminateError('');
                  setTerminateFeedback({ type: '', text: '' });
                  setTerminateOpen(true);
                }}
              >
                Rescindir acordo
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="w-full min-h-12 rounded-xl font-bold text-slate-500"
              onClick={() => {
                closeAdendaForm();
                setTerminateFeedback({ type: '', text: '' });
                setSelected(null);
              }}
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageShell>
      <PageHeader title="Acordos" subtitle="As tuas viagens combinadas num só lugar." />

      {message.text ? (
        <FeedbackAlert
          type={
            message.type === 'success'
              ? 'success'
              : message.type === 'offline'
                ? 'offline'
                : 'error'
          }
          text={message.text}
          data-testid="agreements-feedback"
        />
      ) : null}

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

      {renderDetalhe()}

      <ConfirmationModal
        isOpen={leaveModalOpen}
        busy={leaveBusy}
        title="Sair do acordo?"
        message="A tua quota deste mês não é reembolsada. Os preços dos restantes passageiros mantêm-se."
        confirmText="Sair"
        onConfirm={handleLeave}
        onCancel={() => {
          if (!leaveBusy) setLeaveModalOpen(false);
        }}
      />

      <ConfirmationModal
        isOpen={adendaModalOpen}
        busy={adendaBusy}
        variant="primary"
        title="Confirmar novo preço?"
        message={
          tipoPerfil === 'Motorista'
            ? 'A proposta fica à espera da aceitação do passageiro. Depois, aplica-se a partir do próximo mês; o mês corrente mantém as quotas já combinadas.'
            : 'A proposta fica à espera da aceitação do motorista. Depois, aplica-se a partir do próximo mês; o mês corrente mantém as quotas já combinadas.'
        }
        confirmText="Confirmar"
        onConfirm={handleConfirmAdenda}
        onCancel={() => {
          if (!adendaBusy) setAdendaModalOpen(false);
        }}
      />

      {terminateOpen ? (
        <TerminateAgreementModal
          isOpen
          acordo={selected}
          busy={terminateBusy}
          error={terminateError}
          onConfirm={handleConfirmTerminate}
          onCancel={() => {
            if (!terminateBusy) {
              setTerminateOpen(false);
              setTerminateError('');
            }
          }}
        />
      ) : null}

      <ConfirmationModal
        isOpen={consensualModalOpen}
        busy={terminateBusy}
        title="Confirmar fim do acordo?"
        message="A outra parte pediu para terminar já. Se confirmares, o acordo acaba imediatamente para todos os passageiros."
        confirmText="Confirmar fim"
        onConfirm={handleConfirmConsensual}
        onCancel={() => {
          if (!terminateBusy) setConsensualModalOpen(false);
        }}
      />
    </PageShell>
  );
};

export default MyAgreements;
