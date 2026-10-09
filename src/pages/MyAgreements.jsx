import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, Users, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  leavePassenger,
  terminateAgreement,
  rejectAgreementTermination,
  listAdendaHistorico,
} from '../services/AgreementService';
import { resolveIdempotencyKey } from '../utils/callRpcWithOfflineFallback.js';
import { listPending } from '../services/offlineQueue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import EmptyState from '../components/EmptyState';
import FeedbackAlert from '../components/FeedbackAlert';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import ConfirmationModal from '../components/ConfirmationModal';
import OverlayShell from '../components/OverlayShell';
import AcordoDetalheSheetHeader from '../components/AcordoDetalheSheetHeader';
import SheetDragHandle from '../components/SheetDragHandle';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import TerminateConfirmSheet from '../components/TerminateConfirmSheet';
import { Button } from '../components/ui/button';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { subscribeMarketplaceHubRefresh } from '../utils/marketplaceHubRefresh';
import {
  labelEstadoAcordo,
  variantChipEstadoAcordo,
} from '../utils/acordoEstadoDisplay';
import {
  acordoPrecisaLiveRefresh,
  useAcordoDetalheLiveRefresh,
} from '../hooks/useAcordoDetalheLiveRefresh';
import { labelRotaOferta } from '../utils/ofertaLabels';
import { buildAcordoContratoSnapshot } from '../utils/buildAcordoContratoSnapshot';
import AcordoContratoSnapshot from '../components/AcordoContratoSnapshot';
import { isOfertaFlexivel } from '../services/OfertaService';
import AcordoPagamentoPanel from '../components/AcordoPagamentoPanel';
import AcordoContactosPanel from '../components/AcordoContactosPanel';
import {
  acordoTemRescisaoConsensualPendenteParaUser,
  copyCancelamentoPendente,
} from '../utils/rescisaoDisplay';
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
import { formatPrimeiroNome } from '../utils/primeiroNome';

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isActivo(estado) {
  return isActivoPassageiro(estado);
}

/**
 * @param {'activo' | 'pendente' | 'inactivo'} variant
 * @returns {string}
 */
function chipClassEstadoAcordo(variant) {
  if (variant === 'activo') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (variant === 'pendente') {
    return 'bg-amber-100 text-amber-900';
  }
  return 'bg-slate-100 text-slate-600';
}

/**
 * RPC get_acordo_contactos só para acordos vigentes ou com rescisão pendente.
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function podeCarregarContactos(estado) {
  const e = String(estado || '').toLowerCase();
  return e === 'activo' || e === 'cancelamento_pendente';
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
 * Linha activa/reservada para snapshot N=1; só linhas[0] se não houver viva.
 * @param {Array<{ estado?: string }>} linhas
 * @returns {object | null}
 */
function pickLinhaVivaPassageiro(linhas) {
  const list = linhas || [];
  const viva = list.find((p) => isNoAcordo(p.estado));
  if (viva) return viva;
  return list[0] ?? null;
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
 * Nome na UI — motorista vê só primeiro nome; passageiro mantém copy completa.
 * @param {{ perfis?: { nome_completo?: string }, nome?: string }} pax
 * @param {{ motorista?: boolean }} [opts]
 * @returns {string}
 */
function nomePassageiroUi(pax, { motorista = false } = {}) {
  const nome = nomePassageiro(pax);
  return motorista ? formatPrimeiroNome(nome) : nome;
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
 * @param {{
 *   contactos: object | null,
 *   tipoPerfil: string | null | undefined,
 *   linhas: object[],
 * }} ctx
 * @returns {string}
 */
function buildTerminateCounterpartyLabel({ contactos, tipoPerfil, linhas }) {
  if (tipoPerfil === 'Passageiro') {
    return contactos?.motorista?.nome_completo || 'o motorista';
  }
  const activos = (linhas || []).filter((p) => {
    const e = String(p.estado || '').toLowerCase();
    return e === 'activo' || e === 'reservado';
  });
  if (activos.length === 1) {
    return nomePassageiro(activos[0]);
  }
  return 'os passageiros';
}

/**
 * @param {{
 *   contactos: object | null,
 *   rota: { origem?: string, destino?: string },
 *   tipoPerfil: string | null | undefined,
 *   linhas: object[],
 *   modoMessage: string,
 * }} ctx
 * @returns {React.ReactNode}
 */
/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isRescisaoSemPermissaoError(err) {
  const msg = String(
    (err && typeof err === 'object' && 'message' in err && err.message) || err || '',
  );
  return /sem permissão para rescindir este acordo/i.test(msg);
}

function buildTerminateConfirmBody({ contactos, rota, tipoPerfil, linhas, modoMessage }) {
  const counterparty = buildTerminateCounterpartyLabel({ contactos, tipoPerfil, linhas });
  const odSuffix =
    rota.origem && rota.destino ? ` (${rota.origem} → ${rota.destino})` : '';

  return (
    <>
      <p>
        Vais encerrar o acordo com {counterparty}
        {odSuffix}. Esta acção não se pode desfazer. O valor acordado deixa de aplicar-se a
        partir do fecho.
      </p>
      {modoMessage ? <p>{modoMessage}</p> : null}
    </>
  );
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
  const [acordoSheetHeaderScrolled, setAcordoSheetHeaderScrolled] = useState(false);
  const acordoSheetDialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const acordoSheetFecharRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const acordoSheetReturnFocusRef = useRef(/** @type {HTMLElement | null} */ (null));
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
  /** Bloqueia re-clique em Confirmar após sucesso local até refetch. */
  const [rescisaoConfirmadaLocal, setRescisaoConfirmadaLocal] = useState(false);
  const terminateInFlightRef = useRef(false);
  const carregarGenerationRef = useRef(0);
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

    const podeContactos = podeCarregarContactos(acordo.estado);
    setPagamentoLoading(true);
    setContactosLoading(podeContactos);
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

      if (podeContactos) {
        try {
          const payload = await getAcordoContactos(acordo.id);
          setContactos(payload);
        } catch (err) {
          setContactos(null);
          if (err?.code !== 'P0001') {
            console.error('Erro ao carregar contactos:', err);
          }
        }
      } else {
        setContactos(null);
      }

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

  const selectedDetalheSyncKey = selected
    ? `${selected.id}:${String(selected.estado || '').toLowerCase()}`
    : null;

  useEffect(() => {
    if (!selectedDetalheSyncKey || !selected) {
      setPagamento(null);
      setPagamentosAcordo([]);
      setContactos(null);
      setAvaliacoesAcordo([]);
      setHistoricoPreco([]);
      return;
    }
    void carregarPagamentoContactos(selected);
  }, [selectedDetalheSyncKey, selected, carregarPagamentoContactos]);

  const closeTerminateFlow = () => {
    setTerminatePickerOpen(false);
    setTerminateConfirmOpen(false);
    setTerminateJustaPickerOpen(false);
    setTerminateVigenciaPickerOpen(false);
    setTerminateModo('');
    setTerminateJustificativa('');
    setTerminateVigencia('');
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

  /**
   * @param {{ silent?: boolean }} [options]
   */
  const locationSearchRef = useRef(location.search);
  locationSearchRef.current = location.search;

  const syncOpenAcordoQuery = useCallback(
    (acordoId) => {
      const params = new URLSearchParams(locationSearchRef.current);
      const current = params.get('openAcordoId');
      if (acordoId) {
        if (current === acordoId) return;
        params.set('openAcordoId', acordoId);
      } else if (current) {
        params.delete('openAcordoId');
      } else {
        return;
      }
      params.delete('focus');
      const search = params.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : '' },
        { replace: true, state: location.state },
      );
    },
    [location.pathname, location.state, navigate],
  );

  const stripFocusFromUrl = useCallback(() => {
    const params = new URLSearchParams(locationSearchRef.current);
    if (!params.has('focus')) return;
    params.delete('focus');
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '' },
      { replace: true, state: location.state },
    );
  }, [location.pathname, location.state, navigate]);

  /** @param {typeof selected} acordo */
  const selectAcordo = useCallback(
    (acordo) => {
      if (!acordo?.id) {
        focusConsumedKeyRef.current = null;
        const returnTo = acordoSheetReturnFocusRef.current;
        acordoSheetReturnFocusRef.current = null;
        setAcordoSheetHeaderScrolled(false);
        setSelected(null);
        syncOpenAcordoQuery(null);
        if (returnTo instanceof HTMLElement) {
          requestAnimationFrame(() => returnTo.focus());
        }
        return;
      }
      setSelected(acordo);
      syncOpenAcordoQuery(acordo.id);
    },
    [syncOpenAcordoQuery],
  );

  useDialogFocusTrap({
    containerRef: acordoSheetDialogRef,
    initialFocusRef: acordoSheetFecharRef,
    active: Boolean(selected),
  });

  useEffect(() => {
    if (!selected?.id) return undefined;
    const panel = document.querySelector('[data-testid="acordo-detalhe-sheet"]');
    if (!(panel instanceof HTMLElement)) return undefined;

    const onScroll = () => {
      setAcordoSheetHeaderScrolled(panel.scrollTop > 0);
    };
    onScroll();
    panel.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      panel.removeEventListener('scroll', onScroll);
      setAcordoSheetHeaderScrolled(false);
    };
  }, [selected?.id]);

  const carregar = useCallback(async (options = {}) => {
    const { silent = false } = options;
    const generation = ++carregarGenerationRef.current;
    if (!user?.id) {
      if (!silent) setIsLoading(false);
      return [];
    }
    if (!silent) setIsLoading(true);
    try {
      const data =
        tipoPerfil === 'Motorista'
          ? await getAgreementsForDriver(user.id)
          : await getAgreementsForPassenger(user.id);
      if (generation !== carregarGenerationRef.current) {
        return data || [];
      }
      const filtered = (data || []).filter((a) => !a.is_hidden_by_user);
      setAcordos(filtered);
      setSelected((prev) => {
        if (!prev?.id) return prev;
        const found = filtered.find((a) => a.id === prev.id);
        if (!found) return null;
        return found;
      });
      return filtered;
    } catch (err) {
      if (generation === carregarGenerationRef.current) {
        console.error(err);
        setMessage({ type: 'error', text: getFriendlyErrorMessage(err) });
      }
      return [];
    } finally {
      if (generation === carregarGenerationRef.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id, tipoPerfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (message.type !== 'success' || !message.text) return undefined;
    if (!/A outra parte precisa de confirmar/i.test(message.text)) return undefined;
    const confirmado = acordos.find(
      (a) => String(a.estado || '').toLowerCase() === 'cancelamento_pendente',
    );
    if (!confirmado) return undefined;
    const copy = copyCancelamentoPendente(confirmado.rescisao_effective_on);
    const text =
      copy?.corpo
      ?? (copyCancelamentoPendente(null)?.corpo
        || 'Encerramento confirmado — termina em breve.');
    setMessage((prev) => (prev.text === message.text ? { type: 'success', text } : prev));
    return undefined;
  }, [acordos, message.type, message.text]);

  useEffect(() => {
    return subscribeMarketplaceHubRefresh(() => {
      void carregar({ silent: true });
    });
  }, [carregar]);

  useEffect(() => {
    void syncPendingLeaves();
  }, [syncPendingLeaves]);

  useEffect(() => {
    if (!isOnline) return;
    void syncPendingLeaves();
  }, [isOnline, syncPendingLeaves]);

  const pendingFocusRef = useRef(/** @type {string | null} */ (null));
  const focusConsumedKeyRef = useRef(/** @type {string | null} */ (null));

  /** @param {string} focus */
  const scrollToAcordoFocus = useCallback((focus) => {
    /** @type {Record<string, string>} */
    const focusTestIds = {
      pagamento: 'acordo-pagamento-section',
      adenda: 'adenda-pendente',
      renovacao: 'renovacao-periodo-panel',
      avaliar: 'acordo-rating-banner',
      rescisao: 'rescisao-consensual-section',
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
    if (isLoading) return;
    const params = new URLSearchParams(location.search);
    const openAcordoId = params.get('openAcordoId') || location.state?.openAcordoId;
    const focus = params.get('focus');
    if (!openAcordoId) return;
    const found = acordos.find((a) => a.id === openAcordoId);
    if (!found) {
      if (acordos.length > 0) {
        syncOpenAcordoQuery(null);
      }
      return;
    }
    setSelected((prev) => (prev?.id === found.id ? prev : found));
    if (!acordoSheetReturnFocusRef.current) {
      const card = document.querySelector(`[data-acordo-card-id="${openAcordoId}"]`);
      if (card instanceof HTMLElement) {
        acordoSheetReturnFocusRef.current = card;
      }
    }
    const focusKey = focus ? `${openAcordoId}:${focus}` : null;
    if (focus && focusConsumedKeyRef.current !== focusKey) {
      pendingFocusRef.current = focus;
      focusConsumedKeyRef.current = focusKey;
      stripFocusFromUrl();
    }
    if (location.state?.openAcordoId) {
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: {} },
      );
    }
  }, [
    isLoading,
    acordos,
    location.search,
    location.state,
    navigate,
    location.pathname,
    syncOpenAcordoQuery,
    stripFocusFromUrl,
  ]);

  useEffect(() => {
    if (selected?.id || isLoading) return;
    const params = new URLSearchParams(locationSearchRef.current);
    const urlId = params.get('openAcordoId');
    if (!urlId) return;
    if (!acordos.some((a) => a.id === urlId)) {
      syncOpenAcordoQuery(null);
    }
  }, [selected?.id, isLoading, acordos, syncOpenAcordoQuery]);

  const carregarSilentStable = useCallback(() => {
    void carregar({ silent: true });
  }, [carregar]);

  useAcordoDetalheLiveRefresh({
    enabled: Boolean(selected && acordoPrecisaLiveRefresh(selected)),
    userId: user?.id,
    acordoId: selected?.id,
    onRefresh: carregarSilentStable,
  });

  useEffect(() => {
    if (!selected || !pendingFocusRef.current) return undefined;

    const focus = pendingFocusRef.current;
    if (focus === 'pagamento' && pagamentoLoading) return undefined;

    pendingFocusRef.current = null;
    if (
      focus === 'rescisao'
      && !acordoTemRescisaoConsensualPendenteParaUser(selected, user?.id)
    ) {
      return undefined;
    }
    scrollToAcordoFocus(focus);
    return undefined;
  }, [selected, scrollToAcordoFocus, pagamentoLoading, pagamento, user?.id]);

  useEffect(() => {
    setRescisaoConfirmadaLocal(false);
  }, [selected?.id]);

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
        selectAcordo(null);
        await carregar();
        return;
      }
      setMessage({
        type: 'success',
        text: 'Saíste do acordo. A quota do mês mantém-se.',
      });
      selectAcordo(null);
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
    if (!selected || terminateBusy || terminateInFlightRef.current || rescisaoConfirmadaLocal) {
      return;
    }
    const modo = modoOverride || terminateModo;
    if (!modo) return;

    const acordoId = selected.id;
    const idempotencyKey = resolveIdempotencyKey();
    const confirmandoConsensualPendente =
      modo === 'consensual'
      && String(selected.rescisao_modo || '').toLowerCase() === 'consensual'
      && selected.rescisao_solicitada_por
      && selected.rescisao_solicitada_por !== user?.id;

    terminateInFlightRef.current = true;
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

      const result = await terminateAgreement(acordoId, input, { idempotencyKey });
      closeTerminateFlow();

      if (result?.offlineQueued) {
        setMessage({
          type: 'success',
          text: 'Rescisão guardada. Sincronizamos quando a rede voltar.',
        });
        selectAcordo(null);
        await carregar();
        return;
      }

      const estado = String(result?.estado || '').toLowerCase();
      const vigenciaFinal = String(result?.rescisao_vigencia || input.vigencia || '').toLowerCase();
      const pedidoConsensualPendente = modo === 'consensual' && estado === 'activo';
      let text = 'Pedido de rescisão registado.';
      if (pedidoConsensualPendente) {
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
      if (confirmandoConsensualPendente) {
        setRescisaoConfirmadaLocal(true);
      }
      if (result && typeof result === 'object') {
        setSelected((prev) => {
          if (prev?.id !== acordoId) return prev;
          const merged = { ...prev, ...result };
          const e = String(merged.estado || '').toLowerCase();
          if (e === 'cancelado' || e === 'cancelado_justificado') {
            merged.rescisao_modo = result.rescisao_modo ?? null;
            merged.rescisao_solicitada_por = result.rescisao_solicitada_por ?? null;
            merged.rescisao_vigencia = result.rescisao_vigencia ?? null;
          }
          return merged;
        });
      }
      await carregar({ silent: true });
    } catch (err) {
      if (
        isRescisaoSemPermissaoError(err)
        && (rescisaoConfirmadaLocal || confirmandoConsensualPendente)
      ) {
        const refreshed = await carregar({ silent: true });
        const found = refreshed.find((a) => a.id === acordoId);
        const terminalForaLista = !found;
        const terminalEstado =
          found
          && ['cancelado', 'cancelado_justificado'].includes(
            String(found.estado || '').toLowerCase(),
          );
        if (terminalForaLista || terminalEstado) {
          return;
        }
      }
      setMessage({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      terminateInFlightRef.current = false;
      setTerminateBusy(false);
    }
  };

  const handleRejectTermination = async () => {
    if (!selected || terminateBusy) return;

    const acordoId = selected.id;
    const idempotencyKey = resolveIdempotencyKey();
    setTerminateBusy(true);
    try {
      const result = await rejectAgreementTermination(acordoId, { idempotencyKey });

      if (result?.offlineQueued) {
        setMessage({
          type: 'success',
          text: 'Recusa guardada. Sincronizamos quando a rede voltar.',
        });
        selectAcordo(null);
        await carregar();
        return;
      }

      setMessage({ type: 'success', text: 'Pedido de encerramento recusado.' });
      selectAcordo(null);
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
    const estadoVariant = variantChipEstadoAcordo(acordo.estado);
    const estadoLabel = labelEstadoAcordo(acordo.estado);
    const leavePending = Boolean(pendingLeaveIds[acordo.id]);
    const minhaLinha = linhas.find((p) => p.passenger_id === user?.id);
    const minhaReservadaCard = Boolean(minhaLinha && isReservado(minhaLinha.estado));
    const minhaExpiradaCard = Boolean(minhaLinha && isExpirado(minhaLinha.estado));
    const quotaCard =
      tipoPerfil === 'Passageiro'
        ? (minhaLinha?.quota_mensal_kz ?? acordo.valor_mensal_por_passageiro_kz)
        : acordo.valor_mensal_por_passageiro_kz;
    const rotuloPessoas = (() => {
      if (nPax === 1 && tipoPerfil === 'Motorista') {
        const pax = pickLinhaVivaPassageiro(linhas);
        return formatPrimeiroNome(nomePassageiro(pax));
      }
      if (nPax === 1) return 'Individual';
      return `Grupo · ${nPax} pessoas`;
    })();
    return (
      <button
        type="button"
        key={acordo.id}
        data-acordo-card-id={acordo.id}
        onClick={(event) => {
          acordoSheetReturnFocusRef.current = event.currentTarget;
          selectAcordo(acordo);
        }}
        className="w-full text-left bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2"
      >
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipClassEstadoAcordo(estadoVariant)}`}
            >
              {estadoLabel}
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
            {rotuloPessoas}
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
    const temRescisaoConsensualAberta =
      activo &&
      String(selected.rescisao_modo || '').toLowerCase() === 'consensual' &&
      selected.rescisao_solicitada_por;
    const podeEncerrar = activo && (isMotorista || podeSair) && !temRescisaoConsensualAberta;
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
    const rescisaoConsensualEnviada =
      activo &&
      String(selected.rescisao_modo || '').toLowerCase() === 'consensual' &&
      selected.rescisao_solicitada_por === user?.id;
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
      <OverlayShell
        variant="bottom"
        onDismiss={() => selectAcordo(null)}
        panelTestId="acordo-detalhe-sheet"
        panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
      >
        <div
          ref={acordoSheetDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="acordo-detail-title"
          className="min-h-0"
        >
          <AcordoDetalheSheetHeader
            acordoId={selected.id}
            estadoAcordo={selected.estado}
            minhaReservada={minhaReservada}
            leavePending={leavePending}
            isBodyScrolled={acordoSheetHeaderScrolled}
            fecharRef={acordoSheetFecharRef}
            onClose={() => selectAcordo(null)}
            podeRegistarFaltas={podeRegistarFaltas}
            podeEncerrar={podeEncerrar}
            onRegistarFalta={() => navigate(`/faltas/${selected.id}`)}
            onEncerrar={() => setTerminatePickerOpen(true)}
          />

          <div
            data-testid="acordo-detalhe-sheet-body"
            className="px-5 pb-safe space-y-4"
          >
            <p className="font-semibold text-slate-900 dark:text-white text-balance pt-2">
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
              snapshot={buildAcordoContratoSnapshot(selected, {
                primeiroNomePassageiro: (() => {
                  if (!isMotorista || selected.n_passageiros_contrato !== 1) return undefined;
                  const pax = pickLinhaVivaPassageiro(linhas);
                  const raw = nomePassageiro(pax);
                  return raw === 'Passageiro' ? undefined : raw;
                })(),
              })}
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

            {rescisaoConsensualEnviada || rescisaoConsensualPendente ? (
              <div
                data-testid="rescisao-consensual-section"
                className="space-y-3 scroll-mt-acordo-detalhe"
              >
                {rescisaoConsensualEnviada ? (
                  <div
                    data-testid="rescisao-consensual-enviada"
                    className="rounded-xl border border-slate-200/90 bg-slate-50/80 dark:bg-slate-800/40 dark:border-slate-700 p-3 space-y-1"
                  >
                    <p className="text-sm font-bold text-slate-900 dark:text-white text-balance">
                      Pedido enviado, à espera da outra parte
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
                      {vigenciaConsensualPendente === 'fim_ciclo'
                        ? 'Pediste encerramento no fim deste mês. A outra parte pode confirmar ou recusar em Acordos.'
                        : 'Pediste encerramento imediato com ajuste proporcional. A outra parte pode confirmar ou recusar em Acordos.'}
                    </p>
                  </div>
                ) : null}

                {rescisaoConsensualPendente ? (
                  <div
                    data-testid="rescisao-consensual-pendente"
                    className="rounded-xl border border-amber-200/90 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900/50 p-3 space-y-3"
                  >
                    <p className="text-sm font-bold text-slate-900 dark:text-white text-balance">
                      Pedido de encerramento amigável
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
                      {vigenciaConsensualPendente === 'fim_ciclo'
                        ? 'A outra parte quer encerrar no fim deste mês. Confirma se concordas.'
                        : 'A outra parte quer encerrar agora com ajuste proporcional das quotas. Confirma se concordas.'}
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        className="w-full min-h-12"
                        disabled={terminateBusy || rescisaoConfirmadaLocal}
                        data-testid="rescisao-confirmar-cta"
                        onClick={() =>
                          handleTerminate('consensual', undefined, vigenciaConsensualPendente)
                        }
                      >
                        {terminateBusy ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            A processar…
                          </>
                        ) : (
                          'Confirmar encerramento'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full min-h-12"
                        disabled={terminateBusy}
                        data-testid="rescisao-recusar-cta"
                        onClick={() => handleRejectTermination()}
                      >
                        Recusar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
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
              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-3 scroll-mt-acordo-detalhe"
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
            <div data-testid="acordo-pagamento-section" className="scroll-mt-acordo-detalhe">
              <AcordoPagamentoPanel
                pagamento={pagamentoLoading ? null : pagamento}
                onUpdated={() => carregarPagamentoContactos(selected)}
              />
            </div>
          ) : null}

          {podeCarregarContactos(selected.estado) ? (
            <AcordoContactosPanel contactos={contactos} loading={contactosLoading} />
          ) : null}

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
                  const nome = nomePassageiroUi(p, { motorista: isMotorista });
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

          {activo && !podeRegistarFaltas && !pagamentoLoading ? (
            <p
              className="text-xs text-slate-500 text-pretty px-1"
              data-testid="faltas-gate-pagamento"
            >
              Registo de faltas disponível após pagamento validado em custódia.
            </p>
          ) : null}

          {podeSair ? (
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              disabled={leavePending}
              onClick={handleLeaveClick}
            >
              Sair só eu
            </Button>
          ) : null}
          </div>
        </div>
      </OverlayShell>
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

      {terminatePickerOpen ? (
        <OverlayShell
          variant="bottom"
          onDismiss={terminateBusy ? undefined : () => setTerminatePickerOpen(false)}
          dismissDisabled={terminateBusy}
          panelTestId="terminate-modality-picker"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
        >
          <SheetDragHandle />
          <div className="px-5 pb-safe space-y-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="terminate-picker-title"
              className="space-y-4"
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
                    disabled={terminateBusy}
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
                  disabled={terminateBusy}
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
                  disabled={terminateBusy}
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
                  disabled={terminateBusy}
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
                disabled={terminateBusy}
                onClick={() => setTerminatePickerOpen(false)}
              >
                Voltar
              </Button>
            </div>
          </div>
        </OverlayShell>
      ) : null}

      {terminateJustaPickerOpen ? (
        <OverlayShell
          variant="bottom"
          onDismiss={
            terminateBusy
              ? undefined
              : () => {
                setTerminateJustaPickerOpen(false);
                setTerminateJustificativa('');
              }
          }
          dismissDisabled={terminateBusy}
          panelTestId="terminate-justa-picker"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
        >
          <SheetDragHandle />
          <div className="px-5 pb-safe space-y-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="justa-causa-title"
              className="space-y-4"
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
                    disabled={terminateBusy}
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
                  disabled={terminateBusy}
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
        </OverlayShell>
      ) : null}

      {terminateVigenciaPickerOpen ? (
        <OverlayShell
          variant="bottom"
          onDismiss={
            terminateBusy
              ? undefined
              : () => {
                setTerminateVigenciaPickerOpen(false);
                setTerminateVigencia('');
              }
          }
          dismissDisabled={terminateBusy}
          panelTestId="terminate-vigencia-picker"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
        >
          <SheetDragHandle />
          <div className="px-5 pb-safe space-y-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="terminate-vigencia-title"
              className="space-y-4"
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
                  disabled={terminateBusy}
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
                  disabled={terminateBusy}
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
                disabled={terminateBusy}
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
        </OverlayShell>
      ) : null}

      <TerminateConfirmSheet
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
        body={buildTerminateConfirmBody({
          contactos,
          rota: labelRotaOferta(selected?.ofertas_capacidade || {}),
          tipoPerfil,
          linhas: selected?.acordos_passageiros || [],
          modoMessage:
            terminateModo === 'consensual'
              ? terminateVigencia === 'fim_ciclo'
                ? 'Enviaremos o pedido à outra parte. Se confirmar, o acordo mantém-se activo até ao fim deste mês.'
                : 'Enviaremos o pedido à outra parte. Se confirmar, o acordo encerra já com ajuste proporcional das quotas.'
              : terminateModo === 'aviso_previo'
                ? 'O acordo mantém-se activo até ao último dia deste mês. A quota deste mês não é reembolsada.'
                : terminateModo === 'justa_causa'
                  ? 'O acordo termina de imediato se o motivo for válido. As quotas deste mês podem ser ajustadas proporcionalmente.'
                  : '',
        })}
        confirmText="Encerrar acordo"
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
