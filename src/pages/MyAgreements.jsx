import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Clock, Users, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  leavePassenger,
  terminateAgreement,
  listAdendaHistorico,
} from '../services/AgreementService';
import { listPending } from '../services/offlineQueue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import EmptyState from '../components/EmptyState';
import FeedbackAlert from '../components/FeedbackAlert';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import ConfirmationModal from '../components/ConfirmationModal';
import ModalPortal from '../components/ModalPortal';
import { Button } from '../components/ui/button';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { labelRotaOferta } from '../utils/ofertaLabels';
import { buildAcordoContratoSnapshot } from '../utils/buildAcordoContratoSnapshot';
import AcordoContratoSnapshot from '../components/AcordoContratoSnapshot';
import { isOfertaFlexivel } from '../services/OfertaService';
import AcordoPagamentoPanel from '../components/AcordoPagamentoPanel';
import AcordoContactosPanel from '../components/AcordoContactosPanel';
import { copyCancelamentoPendente } from '../utils/rescisaoDisplay';
import AcordoPrecoProximoMesPanel from '../components/precoProximoMes/AcordoPrecoProximoMesPanel';
import {
  podeProporNovaPreco,
  resolveNegociacaoPrecoAtiva,
} from '../utils/adendaNegociacao.js';
import { isJanelaPropostaPrecoAberta, labelMesActualPt } from '../utils/precoProximoMes.js';
import {
  getPagamentoForPassageiro,
  getAcordoContactos,
  listPagamentosByAcordo,
  getMesReferenciaAtual,
} from '../services/PaymentService';
import {
  labelRenovacaoEstado,
  podeRenovarPeriodo,
  podeRecusarRenovacao,
  formatProximoMesPt,
} from '../utils/periodoRenovacao';
import {
  allowsAssiduidadeFaltasForAcordo,
  RESERVA_TTL_HORAS,
} from '../utils/paymentStatus';
import AcordoRatingBanner from '../components/rating/AcordoRatingBanner';
import AcordoRatingMotBanner from '../components/rating/AcordoRatingMotBanner';
import { listMinhasAvaliacoesAcordo } from '../services/RatingService';
import {
  buildPassageiroRatingPrompt,
  buildMotoristaRatingPrompts,
  buildSaidaRatingPrompt,
} from '../utils/ratingGates';
import {
  isActivoPassageiro,
  isReservadoPassageiro,
  isExpiradoPassageiro,
  countPassageirosConfirmadosReservados,
  formatContagemPassageiros,
  labelChipEstadoPassageiro,
  chipClassEstadoPassageiro,
  GLOSSARIO_ESTADOS_LUGAR,
} from '../utils/acordoPassageiroStatus';

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isActivo(estado) {
  return isActivoPassageiro(estado);
}

/**
 * Soft-hold: lugar ocupado mas ainda não confirmado (até em_custodia).
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isReservado(estado) {
  return isReservadoPassageiro(estado);
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isExpirado(estado) {
  return isExpiradoPassageiro(estado);
}

/**
 * Passageiro ainda no acordo (confirmado ou soft-hold).
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isNoAcordo(estado) {
  const e = String(estado || '').toLowerCase();
  return e === 'activo' || e === 'reservado';
}

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
function estadoPassageiroLabel(estado) {
  return labelChipEstadoPassageiro(estado);
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
  const [terminatePickerOpen, setTerminatePickerOpen] = useState(false);
  const [terminateConfirmOpen, setTerminateConfirmOpen] = useState(false);
  const [terminateJustaPickerOpen, setTerminateJustaPickerOpen] = useState(false);
  const [terminateVigenciaPickerOpen, setTerminateVigenciaPickerOpen] = useState(false);
  /** @type {['consensual' | 'aviso_previo' | 'justa_causa' | '', React.Dispatch<React.SetStateAction<'consensual' | 'aviso_previo' | 'justa_causa' | ''>>]} */
  const [terminateModo, setTerminateModo] = useState('');
  /** @type {['faltas_excessivas' | 'avaria_veiculo' | 'seguranca' | '', React.Dispatch<React.SetStateAction<'faltas_excessivas' | 'avaria_veiculo' | 'seguranca' | ''>>]} */
  const [terminateJustificativa, setTerminateJustificativa] = useState('');
  /** @type {['imediato' | 'fim_ciclo' | '', React.Dispatch<React.SetStateAction<'imediato' | 'fim_ciclo' | ''>>]} */
  const [terminateVigencia, setTerminateVigencia] = useState('');
  const [terminateBusy, setTerminateBusy] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  /** @type {[Record<string, true>, React.Dispatch<React.SetStateAction<Record<string, true>>>]} */
  const [pendingLeaveIds, setPendingLeaveIds] = useState({});

  const [historicoPreco, setHistoricoPreco] = useState(/** @type {object[]} */ ([]));
  const [pagamento, setPagamento] = useState(/** @type {object | null} */ (null));
  const [pagamentosAcordo, setPagamentosAcordo] = useState(/** @type {object[]} */ ([]));
  const [contactos, setContactos] = useState(/** @type {object | null} */ (null));
  const [pagamentoLoading, setPagamentoLoading] = useState(false);
  const [contactosLoading, setContactosLoading] = useState(false);
  const [avaliacoesAcordo, setAvaliacoesAcordo] = useState(/** @type {object[]} */ ([]));

  const carregarPagamentoContactos = useCallback(async (acordo) => {
    if (!acordo?.id || !user?.id) return;
    setPagamentoLoading(true);
    setContactosLoading(true);
    try {
      const pagamentos = await listPagamentosByAcordo(acordo.id);
      setPagamentosAcordo(pagamentos);
      const mesAtual = getMesReferenciaAtual();
      if (tipoPerfil === 'Passageiro') {
        const row = pagamentos.find(
          (p) => p.passenger_id === user.id && String(p.mes_referencia || '').slice(0, 10) === mesAtual,
        )
          ?? await getPagamentoForPassageiro(acordo.id, user.id, mesAtual);
        setPagamento(row);
      } else {
        setPagamento(null);
      }
      const payload = await getAcordoContactos(acordo.id);
      setContactos(payload);
      const avs = await listMinhasAvaliacoesAcordo(acordo.id);
      setAvaliacoesAcordo(avs || []);
      const historico = await listAdendaHistorico(acordo.id);
      setHistoricoPreco(historico || []);
    } catch (err) {
      console.error('Erro ao carregar pagamento/contactos:', err);
    } finally {
      setPagamentoLoading(false);
      setContactosLoading(false);
    }
  }, [user?.id, tipoPerfil]);

  useEffect(() => {
    if (selected) {
      void carregarPagamentoContactos(selected);
    } else {
      setPagamento(null);
      setPagamentosAcordo([]);
      setContactos(null);
      setAvaliacoesAcordo([]);
      setHistoricoPreco([]);
    }
  }, [selected, carregarPagamentoContactos]);

  const closeTerminateFlow = () => {
    setTerminatePickerOpen(false);
    setTerminateConfirmOpen(false);
    setTerminateJustaPickerOpen(false);
    setTerminateVigenciaPickerOpen(false);
    setTerminateModo('');
    setTerminateJustificativa('');
    setTerminateVigencia('');
    setTerminateBusy(false);
  };

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

  const pendingFocusRef = useRef(/** @type {string | null} */ (null));

  /** @param {string} focus */
  const scrollToAcordoFocus = useCallback((focus) => {
    /** @type {Record<string, string>} */
    const focusTestIds = {
      pagamento: 'acordo-pagamento-section',
      adenda: 'adenda-pendente',
      renovacao: 'renovacao-periodo-panel',
      avaliar: 'acordo-rating-banner',
    };
    const testId = focusTestIds[focus];
    if (!testId) return;
    requestAnimationFrame(() => {
      document.querySelector(`[data-testid="${testId}"]`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }, []);

  useEffect(() => {
    if (isLoading || acordos.length === 0) return;
    const params = new URLSearchParams(location.search);
    const openAcordoId = params.get('openAcordoId') || location.state?.openAcordoId;
    const focus = params.get('focus');
    if (openAcordoId) {
      const found = acordos.find((a) => a.id === openAcordoId);
      if (found) {
        setSelected(found);
        if (focus) {
          pendingFocusRef.current = focus;
        }
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [isLoading, acordos, location.search, location.state, navigate, location.pathname]);

  useEffect(() => {
    if (!selected || !pendingFocusRef.current) return undefined;

    const focus = pendingFocusRef.current;
    if (focus === 'pagamento' && pagamentoLoading) return undefined;

    pendingFocusRef.current = null;
    scrollToAcordoFocus(focus);
    return undefined;
  }, [selected, scrollToAcordoFocus, pagamentoLoading, pagamento]);

  const activos = acordos.filter((a) => isActivo(a.estado));
  const outros = acordos.filter((a) => !isActivo(a.estado));

  const podeSairSoloAcordo = useMemo(() => {
    if (!selected || tipoPerfil !== 'Passageiro') return false;
    const minhaLinha = (selected.acordos_passageiros || []).find((p) => p.passenger_id === user?.id);
    return isActivo(selected.estado) && (!minhaLinha || isNoAcordo(minhaLinha.estado));
  }, [selected, tipoPerfil, user?.id]);

  const handleSairSoEu = useCallback(() => {
    if (!selected || !user?.id) return;
    const minhaLinha = (selected.acordos_passageiros || []).find((p) => p.passenger_id === user.id);
    if (!minhaLinha) {
      setLeaveModalOpen(true);
      return;
    }
    const saidaPrompt = buildSaidaRatingPrompt({
      acordoId: selected.id,
      acordoPassageiroId: minhaLinha.id,
      passageiroEstado: minhaLinha.estado || 'activo',
      pagamentos: pagamentosAcordo,
      avaliacoes: avaliacoesAcordo,
      now: new Date(),
      avaliadorId: user.id,
    });
    if (saidaPrompt?.estado === 'pendente') {
      navigate(`/acordos/${selected.id}/sair/avaliar`);
      return;
    }
    setLeaveModalOpen(true);
  }, [selected, user?.id, pagamentosAcordo, avaliacoesAcordo, navigate]);

  const handleLeaveClick = () => {
    handleSairSoEu();
  };

  const handleLeaveSolo = async () => {
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

  const handleTerminate = async (modoOverride, justificativaOverride, vigenciaOverride) => {
    if (!selected || terminateBusy) return;
    const modo = modoOverride || terminateModo;
    if (!modo) return;

    setTerminateBusy(true);
    try {
      const input = { modo };
      const justificativa = justificativaOverride || terminateJustificativa;
      if (modo === 'justa_causa') {
        if (!justificativa) {
          setMessage({ type: 'error', text: 'Escolhe o motivo da justa causa.' });
          return;
        }
        input.justificativa = justificativa;
      }
      if (modo === 'consensual') {
        const vigencia =
          vigenciaOverride ||
          terminateVigencia ||
          selected.rescisao_vigencia ||
          'imediato';
        input.vigencia = vigencia;
      }

      const result = await terminateAgreement(selected.id, input);
      closeTerminateFlow();

      if (result?.offlineQueued) {
        setMessage({
          type: 'success',
          text: 'Rescisão guardada. Sincronizamos quando a rede voltar.',
        });
        setSelected(null);
        await carregar();
        return;
      }

      const estado = String(result?.estado || '').toLowerCase();
      const vigenciaFinal = String(result?.rescisao_vigencia || input.vigencia || '').toLowerCase();
      let text = 'Pedido de rescisão registado.';
      if (modo === 'consensual' && estado === 'activo') {
        text =
          vigenciaFinal === 'fim_ciclo'
            ? 'Pedido amigável (fim deste mês) enviado. A outra parte precisa de confirmar.'
            : 'Pedido amigável (agora, com ajuste proporcional) enviado. A outra parte precisa de confirmar.';
      } else if (modo === 'consensual' && estado === 'cancelado') {
        text = 'Acordo encerrado de forma amigável com ajuste proporcional.';
      } else if (modo === 'consensual' && estado === 'cancelamento_pendente') {
        text = 'Encerramento amigável confirmado. O acordo mantém-se activo até ao fim deste mês.';
      } else if (modo === 'aviso_previo' || estado === 'cancelamento_pendente') {
        text = 'Rescisão agendada. O acordo mantém-se activo até ao fim deste mês.';
      } else if (modo === 'justa_causa' || estado === 'cancelado_justificado') {
        text = 'Acordo rescindido por justa causa.';
      }

      setMessage({ type: 'success', text });
      setSelected(null);
      await carregar();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setTerminateBusy(false);
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
    const rota = labelRotaOferta(oferta || {});
    const activo = isActivo(acordo.estado);
    const leavePending = Boolean(pendingLeaveIds[acordo.id]);
    const minhaLinha = linhas.find((p) => p.passenger_id === user?.id);
    const minhaReservadaCard = Boolean(minhaLinha && isReservado(minhaLinha.estado));
    const minhaExpiradaCard = Boolean(minhaLinha && isExpirado(minhaLinha.estado));
    const quotaCard =
      tipoPerfil === 'Passageiro'
        ? (minhaLinha?.quota_mensal_kz ?? acordo.valor_mensal_por_passageiro_kz)
        : acordo.valor_mensal_por_passageiro_kz;
    return (
      <button
        type="button"
        key={acordo.id}
        onClick={() => setSelected(acordo)}
        className="w-full text-left bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2"
      >
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                activo
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activo ? 'Activo' : acordo.estado}
            </span>
            {minhaReservadaCard ? (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoPassageiro('reservado')}`}
                data-testid={`acordo-lugar-chip-${acordo.id}`}
              >
                {labelChipEstadoPassageiro('reservado')}
              </span>
            ) : null}
            {minhaExpiradaCard ? (
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoPassageiro('expirado')}`}
                data-testid={`acordo-lugar-expirado-chip-${acordo.id}`}
              >
                {labelChipEstadoPassageiro('expirado')}
              </span>
            ) : null}
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
          <span>{rota.origem}</span>
          <ArrowRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span>{rota.destino}</span>
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
    const rota = labelRotaOferta(oferta || {});
    const horaPartida = formatHora(oferta?.departure_time);
    const linhas = selected.acordos_passageiros || [];
    const nLinhas = selected.n_passageiros_contrato || linhas.length || 0;
    const activo = isActivo(selected.estado);
    const isPassageiro = tipoPerfil === 'Passageiro';
    const isMotorista = tipoPerfil === 'Motorista';
    const minhaLinha = linhas.find((p) => p.passenger_id === user?.id);
    const quotaDestaque =
      minhaLinha?.quota_mensal_kz ?? selected.valor_mensal_por_passageiro_kz;
    const podeSair =
      isPassageiro && activo && (!minhaLinha || isNoAcordo(minhaLinha.estado));
    const minhaReservada = Boolean(minhaLinha && isReservado(minhaLinha.estado));
    const minhaExpirada = Boolean(minhaLinha && isExpirado(minhaLinha.estado));
    const { confirmados: nConfirmados, reservados: nReservados } =
      countPassageirosConfirmadosReservados(linhas);
    const contagemPassageiros = formatContagemPassageiros(nConfirmados, nReservados);
    const mostrarContagemPassageiros = nConfirmados + nReservados > 0;
    const podeRenegociar =
      activo &&
      nConfirmados >= 1 &&
      !minhaReservada &&
      (isMotorista || (isPassageiro && podeSair));
    const podeEncerrar = activo && (isMotorista || podeSair);
    const passageirosActivosIds = linhas
      .filter((p) => isActivo(p.estado))
      .map((p) => p.passenger_id)
      .filter(Boolean);
    const pagamentosMes = pagamentosAcordo.filter(
      (p) => String(p.mes_referencia || '').slice(0, 10) === getMesReferenciaAtual(),
    );
    const pagamentosGate = isPassageiro && pagamento ? [pagamento] : pagamentosMes;
    const idsGate = isPassageiro ? [user?.id].filter(Boolean) : passageirosActivosIds;
    const podeRegistarFaltas = activo
      && allowsAssiduidadeFaltasForAcordo(pagamentosGate, idsGate);
    const leavePending = Boolean(pendingLeaveIds[selected.id]);
    const negociacaoPreco =
      resolveNegociacaoPrecoAtiva(selected.acordos_adendas) || selected.adenda_pendente || null;
    const janelaPrecoAberta = isJanelaPropostaPrecoAberta();
    const mesActualLabel = labelMesActualPt();
    const precoActualPassageiro =
      selected.valor_mensal_por_passageiro_kz ?? quotaDestaque;
    const podeProporPreco =
      podeRenegociar
      && podeProporNovaPreco(negociacaoPreco, {
        userId: user?.id,
        janelaAberta: janelaPrecoAberta,
      });
    const rescisaoConsensualPendente =
      activo &&
      String(selected.rescisao_modo || '').toLowerCase() === 'consensual' &&
      selected.rescisao_solicitada_por &&
      selected.rescisao_solicitada_por !== user?.id;
    const vigenciaConsensualPendente = String(selected.rescisao_vigencia || 'imediato').toLowerCase();
    const cancelamentoPendente =
      String(selected.estado || '').toLowerCase() === 'cancelamento_pendente';
    const cancelamentoCopy = cancelamentoPendente
      ? copyCancelamentoPendente(selected.rescisao_effective_on)
      : null;
    const podeRenovar = activo && podeRenovarPeriodo(selected);
    const podeRecusarRenov = activo && podeRecusarRenovacao(selected);
    const renovacaoRenovado =
      String(selected.renovacao_estado || '').toLowerCase() === 'renovado';
    const renovacaoRecusada =
      String(selected.renovacao_estado || '').toLowerCase() === 'nao_renovar'
      || String(selected.rescisao_modo || '').toLowerCase() === 'nao_renovacao';

    const motoristaNome =
      contactos?.motorista?.nome_completo || 'Motorista';
    const ratingPromptPax =
      isPassageiro && minhaLinha && user?.id
        ? buildPassageiroRatingPrompt({
          acordoId: selected.id,
          acordoPassageiroId: minhaLinha.id,
          passageiroEstado: minhaLinha.estado || 'activo',
          pagamentos: pagamentosAcordo,
          avaliacoes: avaliacoesAcordo,
          now: new Date(),
          driverNome: motoristaNome,
          avaliadorId: user.id,
        })
        : null;
    const ratingPromptsMot =
      isMotorista && user?.id
        ? buildMotoristaRatingPrompts({
          acordoId: selected.id,
          passageiros: linhas,
          pagamentos: pagamentosAcordo,
          avaliacoes: avaliacoesAcordo,
          now: new Date(),
          driverId: user.id,
        })
        : [];

    return (
      <ModalPortal>
        <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="acordo-detail-title"
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-4 shadow-xl pb-safe"
          >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    activo
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {activo ? 'Activo' : selected.estado}
                </span>
                {cancelamentoPendente && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900">
                    Cancelamento pendente
                  </span>
                )}
                {minhaReservada ? (
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoPassageiro('reservado')}`}
                    data-testid={`acordo-lugar-chip-${selected.id}`}
                  >
                    {labelChipEstadoPassageiro('reservado')}
                  </span>
                ) : null}
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
              {rota.origem} → {rota.destino}
            </p>
            {minhaExpirada ? (
              <div
                role="status"
                data-testid="lugar-expirado-banner"
                className="rounded-xl border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 px-3 py-3"
              >
                <p className="text-sm text-pretty">
                  Reserva expirada — a vaga foi libertada por falta de pagamento dentro do prazo (
                  {RESERVA_TTL_HORAS} h). Podes procurar nova oferta no início.
                </p>
              </div>
            ) : null}
            {minhaReservada ? (
              <div
                role="status"
                data-testid="lugar-reservado-banner"
                className="rounded-xl border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 px-3 py-3 space-y-2"
              >
                <p className="text-sm text-pretty">
                  Lugar reservado — aguarda pagamento em {RESERVA_TTL_HORAS} h. O lugar confirma-se quando o
                  comprovativo for validado.
                </p>
                <Button
                  type="button"
                  className="w-full min-h-11"
                  data-testid="lugar-reservado-pagamento-cta"
                  onClick={() => scrollToAcordoFocus('pagamento')}
                >
                  Ir para pagamento
                </Button>
              </div>
            ) : null}
          </div>

          {ratingPromptPax ? (
            <AcordoRatingBanner
              prompt={ratingPromptPax}
              onAvaliar={() => navigate(`/acordos/${selected.id}/avaliar`)}
            />
          ) : null}
          {ratingPromptsMot.length > 0 ? (
            <AcordoRatingMotBanner
              prompts={ratingPromptsMot}
              onAvaliar={() => navigate(`/acordos/${selected.id}/avaliar-passageiros`)}
            />
          ) : null}

          <section className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-4">
            {isOfertaFlexivel(oferta) ? (
              <div className="space-y-1 text-sm" data-testid="acordo-rota-flexivel">
                {horaPartida ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500">Horário: </span>
                    <span className="font-bold tabular-nums">{horaPartida}</span>
                  </p>
                ) : null}
                <p className="text-xs text-slate-600 dark:text-slate-300 text-pretty">
                  Oferta flexível — sem origem/destino fixos.
                </p>
              </div>
            ) : (horaPartida || rota.origem || rota.destino) ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Partida</p>
                  {horaPartida ? (
                    <p className="font-bold tabular-nums">{horaPartida}</p>
                  ) : null}
                  <p className="text-xs text-slate-600 dark:text-slate-300">{rota.origem}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Chegada</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{rota.destino}</p>
                </div>
              </div>
            ) : null}

            <AcordoContratoSnapshot
              snapshot={buildAcordoContratoSnapshot(selected)}
              highlightKz={isPassageiro ? quotaDestaque : null}
              className="border-0 bg-transparent dark:bg-transparent p-0"
            />

            {cancelamentoCopy ? (
              <div
                data-testid="cancelamento-pendente-banner"
                className="rounded-xl border border-amber-200/90 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 space-y-1"
              >
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {cancelamentoCopy.titulo}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 text-pretty">
                  {cancelamentoCopy.corpo}
                </p>
              </div>
            ) : null}

            {rescisaoConsensualPendente && (
              <div
                data-testid="rescisao-consensual-pendente"
                className="rounded-xl border border-amber-200/90 bg-amber-50/80 p-3 space-y-3"
              >
                <p className="text-sm font-bold text-slate-900 dark:text-white text-balance">
                  Pedido de encerramento amigável
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
                  {vigenciaConsensualPendente === 'fim_ciclo'
                    ? 'A outra parte quer encerrar no fim deste mês. Confirma se concordas.'
                    : 'A outra parte quer encerrar agora com ajuste proporcional das quotas. Confirma se concordas.'}
                </p>
                <Button
                  type="button"
                  className="w-full min-h-12"
                  disabled={terminateBusy}
                  onClick={() =>
                    handleTerminate('consensual', undefined, vigenciaConsensualPendente)
                  }
                >
                  Confirmar encerramento amigável
                </Button>
              </div>
            )}
          </section>

          {activo && podeRenegociar ? (
            <AcordoPrecoProximoMesPanel
              acordoId={selected.id}
              precoActual={precoActualPassageiro}
              negociacao={negociacaoPreco}
              historico={historicoPreco}
              janelaAberta={janelaPrecoAberta}
              mesActualLabel={mesActualLabel}
              podePropor={podeProporPreco}
            />
          ) : null}

          {(podeRenovar || renovacaoRenovado || renovacaoRecusada) && (
            <section
              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-3"
              data-testid="renovacao-periodo-panel"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Renovação do acordo
                </h3>
                <p className="text-xs text-slate-500 text-pretty">
                  {renovacaoRenovado
                    ? `${labelRenovacaoEstado('renovado')} (${formatProximoMesPt(selected.renovacao_proximo_mes)}).`
                    : renovacaoRecusada
                      ? labelRenovacaoEstado('nao_renovar')
                      : 'Confirma se o acordo continua no mês seguinte. Isto é independente de mudar o preço.'}
                </p>
              </div>

              {podeRenovar ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className="w-full min-h-11"
                    data-testid="renovar-periodo-cta"
                    onClick={() => navigate(`/acordos/${selected.id}/renovar`)}
                  >
                    Renovar
                  </Button>
                  {podeRecusarRenov ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full min-h-11 text-slate-600"
                      data-testid="nao-renovar-periodo-cta"
                      onClick={() => navigate(`/acordos/${selected.id}/nao-renovar`)}
                    >
                      Não renovar
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}

          {isPassageiro && activo ? (
            <div data-testid="acordo-pagamento-section">
              <AcordoPagamentoPanel
                pagamento={pagamentoLoading ? null : pagamento}
                onUpdated={() => carregarPagamentoContactos(selected)}
              />
            </div>
          ) : null}

          <AcordoContactosPanel contactos={contactos} loading={contactosLoading} />

          <div className="border-t border-slate-100 dark:border-slate-800" role="separator" />

          {linhas.length > 0 ? (
            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Passageiros · {nLinhas || linhas.length}
                </p>
                {mostrarContagemPassageiros ? (
                  <p
                    className="text-xs text-slate-500 tabular-nums"
                    data-testid="passageiros-contagem"
                  >
                    {contagemPassageiros}
                  </p>
                ) : null}
              </div>
              <ul
                className="rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800"
                data-testid="estados-lugar-glossario"
              >
                {GLOSSARIO_ESTADOS_LUGAR.map((item) => (
                  <li key={item.termo} className="px-3 py-2 text-xs text-slate-500 text-pretty">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {item.termo}:
                    </span>{' '}
                    {item.descricao}
                  </li>
                ))}
              </ul>
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
                        {!saiu ? (
                          <span
                            className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${chipClassEstadoPassageiro(p.estado)}`}
                            data-testid={`passageiro-estado-chip-${p.passenger_id}`}
                          >
                            {estadoPassageiroLabel(p.estado)}
                          </span>
                        ) : (
                          <p className="text-xs text-slate-400">{estadoPassageiroLabel(p.estado)}</p>
                        )}
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

          <div className="flex flex-col gap-2 pt-1">
            {activo && podeRegistarFaltas ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full h-11 rounded-xl font-bold"
                onClick={() => navigate(`/faltas/${selected.id}`)}
              >
                <Clock size={16} aria-hidden="true" /> Registar falta
              </Button>
            ) : null}
            {activo && !podeRegistarFaltas && !pagamentoLoading ? (
              <p
                className="text-xs text-slate-500 text-pretty px-1"
                data-testid="faltas-gate-pagamento"
              >
                Registo de faltas disponível após pagamento validado em custódia.
              </p>
            ) : null}
            {podeSair && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                disabled={leavePending}
                onClick={handleLeaveClick}
              >
                Sair só eu
              </Button>
            )}
            {podeEncerrar && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl font-bold text-red-700 border-red-300 hover:bg-red-50 hover:text-red-800"
                onClick={() => setTerminatePickerOpen(true)}
              >
                Encerrar acordo
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full h-11 rounded-xl font-bold text-slate-500"
              onClick={() => setSelected(null)}
            >
              Fechar
            </Button>
          </div>
        </div>
        </div>
      </ModalPortal>
    );
  };

  return (
    <PageShell>
      <PageHeader title="Acordos" subtitle="As tuas viagens combinadas num só lugar." />

      {message.text ? (
        <FeedbackAlert
          type={message.type === 'success' ? 'success' : 'error'}
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

      {terminatePickerOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="terminate-picker-title"
              data-testid="terminate-modality-picker"
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-4 shadow-xl pb-safe"
            >
            <div className="space-y-1">
              <h3 id="terminate-picker-title" className="text-lg font-bold">
                Como queres encerrar o acordo?
              </h3>
              <p className="text-sm text-slate-500 text-pretty">
                Escolhe a modalidade de rescisão do acordo completo ou sai só tu mantendo o acordo
                activo para os restantes.
              </p>
            </div>

            <div className="space-y-2">
              {podeSairSoloAcordo ? (
                <button
                  type="button"
                  className="w-full text-left rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/20 p-4 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  data-testid="terminate-picker-sair-so-eu"
                  onClick={() => {
                    setTerminatePickerOpen(false);
                    handleSairSoEu();
                  }}
                >
                  <p className="font-bold text-slate-900 dark:text-white text-balance">Sair só eu</p>
                  <p className="text-sm text-slate-500 mt-1 text-pretty">
                    Saída individual — o acordo mantém-se para os restantes. Com pagamento confirmado,
                    podes avaliar antes de sair.
                  </p>
                </button>
              ) : null}

              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                onClick={() => {
                  setTerminateModo('consensual');
                  setTerminatePickerOpen(false);
                  setTerminateVigenciaPickerOpen(true);
                }}
              >
                <p className="font-bold text-slate-900 dark:text-white text-balance">
                  Acordo amigável
                </p>
                <p className="text-sm text-slate-500 mt-1 text-pretty">
                  Pedes o encerramento e a outra parte confirma. Escolhes se termina agora ou no fim
                  deste mês.
                </p>
              </button>

              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                onClick={() => {
                  setTerminateModo('aviso_previo');
                  setTerminatePickerOpen(false);
                  setTerminateConfirmOpen(true);
                }}
              >
                <p className="font-bold text-slate-900 dark:text-white">Aviso prévio</p>
                <p className="text-sm text-slate-500 mt-1 text-pretty">
                  O acordo mantém-se activo até ao fim deste mês. A partir do próximo mês fica
                  cancelado.
                </p>
              </button>

              <button
                type="button"
                className="w-full text-left rounded-xl border border-red-200 dark:border-red-900/50 p-4 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                onClick={() => {
                  setTerminateModo('justa_causa');
                  setTerminatePickerOpen(false);
                  setTerminateJustaPickerOpen(true);
                }}
              >
                <p className="font-bold text-red-800 dark:text-red-200">Justa causa imediata</p>
                <p className="text-sm text-slate-500 mt-1 text-pretty">
                  Só com motivo válido: avaria do veículo, segurança ou faltas excessivas (&gt;50%
                  do mês).
                </p>
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setTerminatePickerOpen(false)}
            >
              Voltar
            </Button>
            </div>
          </div>
        </ModalPortal>
      )}

      {terminateJustaPickerOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="justa-causa-title"
              data-testid="terminate-justa-picker"
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-4 shadow-xl pb-safe"
            >
            <h3 id="justa-causa-title" className="text-lg font-bold">
              Motivo da justa causa
            </h3>
            <div className="space-y-2">
              {[
                { id: 'avaria_veiculo', label: 'Avaria do veículo', hint: 'Impossibilita cumprir o trajeto.' },
                { id: 'seguranca', label: 'Motivo de segurança', hint: 'Risco grave para passageiros ou motorista.' },
                { id: 'faltas_excessivas', label: 'Faltas excessivas', hint: 'Mais de metade dos dias úteis deste mês.' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`w-full text-left rounded-xl border p-4 ${
                    terminateJustificativa === opt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                  onClick={() => setTerminateJustificativa(opt.id)}
                >
                  <p className="font-bold">{opt.label}</p>
                  <p className="text-sm text-slate-500 mt-1">{opt.hint}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="w-full"
                disabled={!terminateJustificativa || terminateBusy}
                onClick={() => {
                  setTerminateJustaPickerOpen(false);
                  setTerminateConfirmOpen(true);
                }}
              >
                Continuar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setTerminateJustaPickerOpen(false);
                  setTerminatePickerOpen(true);
                  setTerminateJustificativa('');
                }}
              >
                Voltar
              </Button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {terminateVigenciaPickerOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="terminate-vigencia-title"
              data-testid="terminate-vigencia-picker"
              className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-4 shadow-xl pb-safe"
            >
            <div className="space-y-1">
              <h3 id="terminate-vigencia-title" className="text-lg font-bold text-balance">
                Quando termina?
              </h3>
              <p className="text-sm text-slate-500 text-pretty">
                A outra parte tem de confirmar. Escolhe a vigência do encerramento amigável.
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                onClick={() => {
                  setTerminateVigencia('imediato');
                  setTerminateVigenciaPickerOpen(false);
                  setTerminateConfirmOpen(true);
                }}
              >
                <p className="font-bold text-slate-900 dark:text-white text-balance">
                  Agora — ajuste proporcional
                </p>
                <p className="text-sm text-slate-500 mt-1 text-pretty">
                  Após confirmação, o acordo encerra já. As quotas deste mês ajustam-se aos dias
                  úteis já decorridos.
                </p>
              </button>
              <button
                type="button"
                className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                onClick={() => {
                  setTerminateVigencia('fim_ciclo');
                  setTerminateVigenciaPickerOpen(false);
                  setTerminateConfirmOpen(true);
                }}
              >
                <p className="font-bold text-slate-900 dark:text-white text-balance">
                  Fim deste mês
                </p>
                <p className="text-sm text-slate-500 mt-1 text-pretty">
                  Após confirmação, o serviço continua até ao último dia deste mês.
                </p>
              </button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setTerminateVigenciaPickerOpen(false);
                setTerminatePickerOpen(true);
                setTerminateVigencia('');
              }}
            >
              Voltar
            </Button>
            </div>
          </div>
        </ModalPortal>
      )}

      <ConfirmationModal
        isOpen={terminateConfirmOpen}
        busy={terminateBusy}
        title={
          terminateModo === 'consensual'
            ? terminateVigencia === 'fim_ciclo'
              ? 'Pedir encerramento no fim do mês?'
              : 'Pedir encerramento agora?'
            : terminateModo === 'aviso_previo'
              ? 'Confirmar aviso prévio?'
              : 'Confirmar justa causa?'
        }
        message={
          terminateModo === 'consensual'
            ? terminateVigencia === 'fim_ciclo'
              ? 'Enviaremos o pedido à outra parte. Se confirmar, o acordo mantém-se activo até ao fim deste mês.'
              : 'Enviaremos o pedido à outra parte. Se confirmar, o acordo encerra já com ajuste proporcional das quotas.'
            : terminateModo === 'aviso_previo'
              ? 'O acordo mantém-se activo até ao último dia deste mês. A quota deste mês não é reembolsada.'
              : 'O acordo termina de imediato se o motivo for válido. As quotas deste mês podem ser ajustadas proporcionalmente.'
        }
        confirmText="Confirmar"
        onConfirm={() => handleTerminate()}
        onCancel={() => {
          if (!terminateBusy) {
            setTerminateConfirmOpen(false);
            if (terminateModo === 'consensual') {
              setTerminateVigenciaPickerOpen(true);
            } else {
              setTerminateModo('');
              setTerminateJustificativa('');
              setTerminateVigencia('');
            }
          }
        }}
      />

      <ConfirmationModal
        isOpen={leaveModalOpen}
        busy={leaveBusy}
        title="Sair só tu?"
        message="Saída individual: o acordo mantém-se activo para os restantes. A tua quota deste mês não é reembolsada."
        confirmText="Sair"
        onConfirm={handleLeaveSolo}
        onCancel={() => {
          if (!leaveBusy) setLeaveModalOpen(false);
        }}
      />

    </PageShell>
  );
};

export default MyAgreements;
