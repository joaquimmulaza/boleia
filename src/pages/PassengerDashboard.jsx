import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Users, Banknote } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AddressInput from '../components/AddressInput';
import TimeInput from '../components/TimeInput';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import OverlayShell from '../components/OverlayShell';
import FeedbackAlert from '../components/FeedbackAlert';
import LoadingSkeleton from '../components/LoadingSkeleton';
import GrupoProcuraPanel from '../components/GrupoProcuraPanel';
import GrupoDescobertaPanel from '../components/GrupoDescobertaPanel';
import OfertaMatchCard from '../components/OfertaMatchCard';
import OpportunityCard from '../components/OpportunityCard';
import OpportunityDetailSheet from '../components/OpportunityDetailSheet';
import OpportunityProposalSheet from '../components/OpportunityProposalSheet';
import TextFade from '../components/TextFade';
import PropostaReviewCard from '../components/PropostaReviewCard';
import {
  createProcura,
  createProcuraWithGrupo,
  listProcurasByOwner,
  updateProcura,
  cancelProcura,
} from '../services/ProcuraService';
import { findCompatibleOfertas, toProcuraMatchInput } from '../services/MatchingService';
import { isOfertaRotaCompativelComProcura } from '../utils/matchingFilters';
import { buildAvisoProporRota } from '../utils/proporRotaAviso';
import { listOfertasDisponiveis } from '../services/OfertaService';
import { getGrupoByProcura, listMembrosGrupo } from '../services/GrupoService';
import {
  createProposta,
  listPropostasByProcura,
  listPropostasByOferta,
  listOpenPropostasByCreator,
  enrichPropostasForReview,
  rejectProposta,
  cancelProposta,
} from '../services/PropostaService';
import { createAgreementFromProposal, getAgreementsForPassenger } from '../services/AgreementService';
import {
  buildAcordoIdPorOfertaMap,
  buildAcordoOptimistaPosAceite,
  mergeAcordosPassageiro,
  isOptimistaExpirada,
  ACORDO_OPTIMISTA_TTL_MS,
  CTA_VER_ACORDO,
} from '../utils/acordoPorOferta';
import { notifyMarketplaceHubRefresh } from '../utils/marketplaceHubRefresh';
import { shouldAvisarProcuraFecha } from '../utils/propostaReview';
import { CTA_LABEL } from '../utils/opportunityCard';
import { enqueueWaitlist, filterWaitlistEntriesVisiveis, listWaitlistByProcura } from '../services/WaitlistService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { formatKwanza } from '../utils/formatKwanza';
import { formatTime24h } from '../utils/formatTime';
import { markPermissionsEligible } from '../utils/permissionsPrompt';
import {
  filterPropostasParaInbox,
  filterPropostasEnviadas,
  filterPropostasTerminadasRecebidas,
  filterPropostasTerminadasEnviadas,
} from '../utils/propostaInbox';
import { DIAS_SEMANA, DIAS_UTEIS_DEFAULT, formatDiasSemana } from '../utils/diasSemana';
import { getModoTetoPreferido, setModoTetoPreferido } from '../utils/procuraTetoPrefs';
import { resolveCapacityN } from '../utils/capacityGate.js';
import { canEditProcura } from '../utils/canEditProcura';
import { countPropostasAInvalidar } from '../utils/procuraEditImpact';
import { isPropostaAcimaDoTeto } from '../utils/isPropostaAcimaDoTeto';
import PropostaValorInput from '../components/PropostaValorInput';
import { parseValorPropostaKz, validarValorPropostaKz } from '../utils/propostaValor.js';
import { buildProcuraMinimaFromOferta, getPropostaBrowseGaps } from '../utils/procuraFromOferta';
import { labelRotaProcura } from '../utils/ofertaLabels';
import ConfirmationModal from '../components/ConfirmationModal';
import { FEEDBACK_PROPOSTA_ENVIADA_MOTORISTA } from '../utils/propostaFeedback';

const CAPACIDADES_GRUPO = [2, 3, 4, 5, 6, 7, 8];

/**
 * @param {'POR_PASSAGEIRO' | 'TOTAL_ACORDO'} modo
 */
function labelModoTeto(modo) {
  return modo === 'TOTAL_ACORDO' ? 'Total do acordo' : 'Por passageiro';
}

/**
 * Copy humana do tamanho da procura (lista = resumo).
 * @param {{ n: number, nMaximo?: number | null, temGrupo?: boolean }} args
 */
function labelTamanhoProcura({ n, nMaximo = null, temGrupo = false }) {
  if (temGrupo && nMaximo != null) {
    return `Grupo · ${n} de ${nMaximo}`;
  }
  if (n === 1) return 'Individual';
  return `Grupo · ${n} pessoas`;
}

/**
 * @param {string} estado
 */
function chipEstadoProcura(estado) {
  const e = String(estado || '').toLowerCase();
  if (e === 'em_negociacao') {
    return {
      label: 'Em negociação',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    };
  }
  return {
    label: 'Activa',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
}

/**
 * Limpa inbox/enviadas/browse após aceite confirmado pelo servidor (não offline).
 *
 * @param {{
 *   procuraId: string | null,
 *   ofertaId: string | null,
 *   setInboxReviews: React.Dispatch<React.SetStateAction<Array>>,
 *   setEnviadasReviews: React.Dispatch<React.SetStateAction<Array>>,
 *   setBrowseOfertasComProposta: React.Dispatch<React.SetStateAction<Set<string>>>,
 * }} params
 */
function aplicarClearUiPosAceiteServidor({
  procuraId,
  ofertaId,
  setInboxReviews,
  setEnviadasReviews,
  setBrowseOfertasComProposta,
}) {
  if (procuraId) {
    setInboxReviews((prev) => prev.filter((r) => r.proposta.procura_id !== procuraId));
    setEnviadasReviews((prev) => prev.filter((r) => r.proposta.procura_id !== procuraId));
  } else if (ofertaId) {
    setInboxReviews((prev) => prev.filter((r) => r.proposta.oferta_id !== ofertaId));
    setEnviadasReviews((prev) => prev.filter((r) => r.proposta.oferta_id !== ofertaId));
  }
  if (ofertaId) {
    setBrowseOfertasComProposta((prev) => {
      const next = new Set(prev);
      next.delete(ofertaId);
      return next;
    });
  }
}

/** @param {unknown} err */
function mensagemErroAceiteInbox(err) {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (msg.includes('Sessão necessária')) {
    return msg;
  }
  return 'Não foi possível aceitar — a oferta mudou.';
}

/**
 * Hub passageiro — procura, matches, inbox (B), enviadas + cancel, lista de espera.
 * Grupo = procura colectiva viva: N_proposto = N_actual no instante da proposta
 * (não exige «grupo completo» vs capacidade pretendida).
 */
const PassengerDashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  /** @type {React.MutableRefObject<null | { openOfertaId: string | null, propostaId: string | null }>} */
  const pendingPropostaDeepLinkRef = useRef(null);
  const propostaDeepLinkHandledRef = useRef(false);
  const propostaDeepLinkLoadStartedRef = useRef(false);
  /** Ignora resultados de carregar() sobrepostos (refetch lento ou em corrida). */
  const carregarSeqRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [procura, setProcura] = useState(null);
  const [grupo, setGrupo] = useState(null);
  const [membrosCount, setMembrosCount] = useState(0);
  const [matches, setMatches] = useState({ direct: [], waitlist: [] });
  const [browseOfertas, setBrowseOfertas] = useState([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [inboxReviews, setInboxReviews] = useState([]);
  const [enviadasReviews, setEnviadasReviews] = useState([]);
  const [terminadasRecebidas, setTerminadasRecebidas] = useState([]);
  const [terminadasEnviadas, setTerminadasEnviadas] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [view, setView] = useState('hub'); // hub | form | matches
  /** explorar | procura — troca de feed no mesmo Início, sem sair da rota */
  const [hubTab, setHubTab] = useState('explorar');
  const [avisoRota, setAvisoRota] = useState(null);
  const hubTabFocusRef = useRef(null);
  useEffect(() => {
    const id = hubTabFocusRef.current;
    if (!id) return;
    hubTabFocusRef.current = null;
    document.getElementById(id)?.focus();
  }, [hubTab, view]);
  const deepLinkTabAppliedRef = useRef(false);
  /** null | 'propostas' — deep-link proposal_received força painel de propostas */
  const [hubFocus, setHubFocus] = useState(null);
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
    dias_semana: [...DIAS_UTEIS_DEFAULT],
    teto_mensal_kz: '',
  });
  const [tipoProcura, setTipoProcura] = useState('individual'); // individual | grupo
  const [nMaximoGrupo, setNMaximoGrupo] = useState(4);
  const [modoTeto, setModoTeto] = useState(() => getModoTetoPreferido());
  const [modoTetoActivo, setModoTetoActivo] = useState(() => getModoTetoPreferido());
  const [editing, setEditing] = useState(false);
  const [ofertasById, setOfertasById] = useState({});
  const [confirmEditN, setConfirmEditN] = useState(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [savingProcura, setSavingProcura] = useState(false);
  const [browseBusy, setBrowseBusy] = useState(false);
  /** @type {[Set<string>, Function]} */
  const [browseOfertasComProposta, setBrowseOfertasComProposta] = useState(() => new Set());
  /** Propostas com accept_proposal enfileirado offline — chip «A enviar…» até sync. */
  const [aceitesOfflinePendentes, setAceitesOfflinePendentes] = useState(
    () => new Set(),
  );
  /** @type {[null | { oferta: object, gaps: Array<'time' | 'od'>, source: 'browse' | 'hub', form: object }, Function]} */
  const [proporSheet, setProporSheet] = useState(null);
  const [propostaOferta, setPropostaOferta] = useState(null);
  const [detalheOferta, setDetalheOferta] = useState(null);
  const [propostaErro, setPropostaErro] = useState('');
  /** @type {[null | { propostaId: string, oferta_id: string, procura_id: string, grupo_id?: string | null, modo_preco: string, n_passageiros_propostos: number, valor_mensal_ask_kz: string, precoPublicadoKz?: number | null }, Function]} */
  const [contraPropostaSheet, setContraPropostaSheet] = useState(null);
  /** @type {[Set<string>, Function]} ids de propostas recebidas com contra-proposta enviada nesta sessão */
  const [contraPropostaFeitaIds, setContraPropostaFeitaIds] = useState(() => new Set());
  const [acordosPassageiro, setAcordosPassageiro] = useState([]);

  const acordoPorOferta = useMemo(
    () => buildAcordoIdPorOfertaMap(acordosPassageiro, user?.id),
    [acordosPassageiro, user?.id],
  );

  useEffect(() => {
    let timeoutId = null;
    const now = Date.now();
    let nextExpiry = null;

    for (const acordo of acordosPassageiro) {
      if (!acordo?._optimista) continue;
      const expiresAt = (acordo._optimistaDesde ?? 0) + ACORDO_OPTIMISTA_TTL_MS;
      if (expiresAt > now && (nextExpiry === null || expiresAt < nextExpiry)) {
        nextExpiry = expiresAt;
      }
    }

    if (nextExpiry !== null) {
      timeoutId = setTimeout(() => {
        setAcordosPassageiro((prev) =>
          prev.filter((acordo) => !(acordo?._optimista && isOptimistaExpirada(acordo))),
        );
      }, nextExpiry - now);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [acordosPassageiro]);


  const ofertasComPropostaAberta = useMemo(() => {
    const ids = new Set(browseOfertasComProposta);
    for (const review of enviadasReviews) {
      if (review?.proposta?.oferta_id) ids.add(review.proposta.oferta_id);
    }
    return ids;
  }, [browseOfertasComProposta, enviadasReviews]);

  /**
   * @param {{ silent?: boolean }} [options]
   */
  const carregar = useCallback(async (options = {}) => {
    const { silent = false } = options;
    const seq = ++carregarSeqRef.current;
    const isStale = () => seq !== carregarSeqRef.current;

    if (!user?.id) {
      if (!isStale()) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const lista = await listProcurasByOwner(user.id);
      if (isStale()) return;

      const activa = lista.find((p) => p.estado === 'activa' || p.estado === 'em_negociacao') || null;
      setProcura(activa);

      const browsePromise = (async () => {
        setLoadingBrowse(true);
        try {
          const [ofertas, abertas, acordos] = await Promise.all([
            listOfertasDisponiveis(),
            listOpenPropostasByCreator(user.id),
            getAgreementsForPassenger(user.id),
          ]);
          if (isStale()) return;

          setBrowseOfertas(ofertas);
          setAcordosPassageiro((prev) => mergeAcordosPassageiro(prev, acordos || [], user.id));
          setBrowseOfertasComProposta(
            new Set(abertas.map((p) => p.oferta_id).filter(Boolean)),
          );
        } catch (err) {
          if (isStale()) return;

          console.error(err);
          setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
        } finally {
          if (!isStale()) setLoadingBrowse(false);
        }
      })();

      if (activa) {
        setLoadingInbox(true);
        try {
          const [g, enrolled, propostas] = await Promise.all([
            getGrupoByProcura(activa.id),
            listWaitlistByProcura(activa.id),
            listPropostasByProcura(activa.id),
          ]);
          if (isStale()) return;

          setGrupo(g);
          setWaitlistEntries(enrolled);
          let membrosActivos = 0;
          if (g) {
            const membros = await listMembrosGrupo(g.id);
            if (isStale()) return;

            membrosActivos = membros.length;
            setMembrosCount(membrosActivos);
          } else {
            setMembrosCount(0);
          }
          const nCapacidade = resolveCapacityN({
            n_candidato: activa.n_candidato,
            membrosActivos,
          });
          const inbox = filterPropostasParaInbox(propostas, user.id);
          const enviadas = filterPropostasEnviadas(propostas, user.id);
          const termRecebidas = filterPropostasTerminadasRecebidas(propostas, user.id);
          const termEnviadas = filterPropostasTerminadasEnviadas(propostas, user.id);
          const [enrichedInbox, enrichedEnviadas, enrichedTermR, enrichedTermE] = await Promise.all([
            enrichPropostasForReview(inbox),
            enrichPropostasForReview(enviadas),
            enrichPropostasForReview(termRecebidas),
            enrichPropostasForReview(termEnviadas),
          ]);
          if (isStale()) return;

          setInboxReviews(enrichedInbox);
          setEnviadasReviews(enrichedEnviadas);
          setTerminadasRecebidas(enrichedTermR);
          setTerminadasEnviadas(enrichedTermE);
          const result = await findCompatibleOfertas({
            ...toProcuraMatchInput(activa),
            n_candidato: nCapacidade,
          });
          if (isStale()) return;

          setMatches({ direct: result.direct, waitlist: result.waitlist });
          const index = {};
          for (const ofe of [...result.direct, ...result.waitlist, ...result.incompatible]) {
            if (ofe?.id) index[ofe.id] = ofe;
          }
          setOfertasById(index);
        } finally {
          if (!isStale()) setLoadingInbox(false);
        }
      } else if (!isStale()) {
        setGrupo(null);
        setMembrosCount(0);
        setWaitlistEntries([]);
        setMatches({ direct: [], waitlist: [] });
        setInboxReviews([]);
        setEnviadasReviews([]);
        setTerminadasRecebidas([]);
        setTerminadasEnviadas([]);
        setLoadingInbox(false);
      }
      await browsePromise;
    } catch (err) {
      if (isStale()) return;

      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      if (!isStale()) {
        setLoading(false);
        setLoadingInbox(false);
        setLoadingBrowse(false);
      }
    }
  }, [user?.id]);

  const carregarPropostasOferta = useCallback(async (ofertaId) => {
    if (!user?.id || !ofertaId) return;
    setLoadingInbox(true);
    try {
      const propostas = await listPropostasByOferta(ofertaId);
      const inbox = filterPropostasParaInbox(propostas, user.id);
      const enviadas = filterPropostasEnviadas(propostas, user.id);
      const termRecebidas = filterPropostasTerminadasRecebidas(propostas, user.id);
      const termEnviadas = filterPropostasTerminadasEnviadas(propostas, user.id);
      const [enrichedInbox, enrichedEnviadas, enrichedTermR, enrichedTermE] = await Promise.all([
        enrichPropostasForReview(inbox),
        enrichPropostasForReview(enviadas),
        enrichPropostasForReview(termRecebidas),
        enrichPropostasForReview(termEnviadas),
      ]);
      setInboxReviews(enrichedInbox);
      setEnviadasReviews(enrichedEnviadas);
      setTerminadasRecebidas(enrichedTermR);
      setTerminadasEnviadas(enrichedTermE);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoadingInbox(false);
    }
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openOfertaId = params.get('openOfertaId');
    const propostaId = params.get('propostaId');
    const focus = params.get('focus');
    if (openOfertaId || focus === 'propostas' || propostaId) {
      setView('hub');
      setHubFocus('propostas');
      deepLinkTabAppliedRef.current = false;
      propostaDeepLinkHandledRef.current = false;
      propostaDeepLinkLoadStartedRef.current = false;
      pendingPropostaDeepLinkRef.current = {
        openOfertaId: openOfertaId || null,
        propostaId: propostaId || null,
      };
    }
  }, [location.search]);

  useEffect(() => {
    if (deepLinkTabAppliedRef.current || hubFocus !== 'propostas' || !procura || loading) {
      return undefined;
    }
    deepLinkTabAppliedRef.current = true;
    setHubTab('procura');
    return undefined;
  }, [hubFocus, procura, loading]);

  useEffect(() => {
    const pending = pendingPropostaDeepLinkRef.current;
    if (
      propostaDeepLinkLoadStartedRef.current
      || hubFocus !== 'propostas'
      || loading
      || procura
      || !pending?.openOfertaId
    ) {
      return undefined;
    }

    propostaDeepLinkLoadStartedRef.current = true;
    void carregarPropostasOferta(pending.openOfertaId);
    return undefined;
  }, [hubFocus, loading, procura, carregarPropostasOferta]);

  useEffect(() => {
    const pending = pendingPropostaDeepLinkRef.current;
    if (propostaDeepLinkHandledRef.current || hubFocus !== 'propostas') return undefined;
    if (loadingInbox || loading) return undefined;

    const propostaId = pending?.propostaId;
    const selector = propostaId
      ? `[data-proposta-id="${propostaId}"]`
      : '[data-testid="propostas-recebidas-section"]';
    if (propostaId) {
      const visible = [...inboxReviews, ...enviadasReviews, ...terminadasRecebidas, ...terminadasEnviadas]
        .some((r) => r.proposta.id === propostaId);
      if (!visible) return undefined;
    }

    const node = document.querySelector(selector)
      || document.querySelector('[data-testid="propostas-recebidas-section"]');
    if (!node) return undefined;

    propostaDeepLinkHandledRef.current = true;
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return undefined;
  }, [
    hubFocus,
    hubTab,
    loadingInbox,
    loading,
    inboxReviews,
    enviadasReviews,
    terminadasRecebidas,
    terminadasEnviadas,
  ]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /**
   * @param {number} valor
   */
  const toggleDia = (valor) => {
    setForm((prev) => {
      const actual = prev.dias_semana || [];
      const next = actual.includes(valor)
        ? actual.filter((d) => d !== valor)
        : [...actual, valor].sort((a, b) => a - b);
      return { ...prev, dias_semana: next };
    });
  };

  /**
   * @returns {{ ok: boolean, payload?: object, tetoNumero?: number | null }}
   */
  const buildProcuraPayload = () => {
    if (form.origin_lat == null || form.destination_lat == null) {
      setFeedback({
        type: 'error',
        text: 'Seleccione origem e destino na lista de sugestões.',
      });
      return { ok: false };
    }
    if (!form.dias_semana?.length) {
      setFeedback({
        type: 'error',
        text: 'Selecciona pelo menos um dia da semana.',
      });
      return { ok: false };
    }
    const tetoRaw = String(form.teto_mensal_kz || '').trim();
    let tetoNumero = null;
    if (tetoRaw !== '') {
      tetoNumero = Number.parseInt(tetoRaw, 10);
      if (!Number.isFinite(tetoNumero) || tetoNumero <= 0) {
        setFeedback({
          type: 'error',
          text: 'O teto mensal deve ser um valor maior que 0 Kz.',
        });
        return { ok: false };
      }
    }
    return {
      ok: true,
      tetoNumero,
      payload: {
        preferred_time: form.preferred_time,
        origin_name: form.origin_name,
        origin_lat: form.origin_lat,
        origin_lng: form.origin_lng,
        destination_name: form.destination_name,
        destination_lat: form.destination_lat,
        destination_lng: form.destination_lng,
        dias_semana: form.dias_semana,
        teto_mensal_kz: tetoNumero,
      },
    };
  };

  const prefillFormFromProcura = (row) => {
    setForm({
      preferred_time: String(row.preferred_time || '07:15').slice(0, 5),
      origin_name: row.origin_name || '',
      origin_lat: row.origin_lat ?? null,
      origin_lng: row.origin_lng ?? null,
      destination_name: row.destination_name || '',
      destination_lat: row.destination_lat ?? null,
      destination_lng: row.destination_lng ?? null,
      dias_semana: Array.isArray(row.dias_semana) && row.dias_semana.length > 0
        ? row.dias_semana.map((d) => Number(d))
        : [...DIAS_UTEIS_DEFAULT],
      teto_mensal_kz: row.teto_mensal_kz != null ? String(row.teto_mensal_kz) : '',
    });
  };

  const persistProcuraUpdate = async (payload) => {
    setSavingProcura(true);
    try {
      const actualizada = await updateProcura(procura.id, payload);
      setModoTetoPreferido(modoTeto);
      setModoTetoActivo(modoTeto);
      setProcura(actualizada);
      setEditing(false);
      setView('hub');
      setHubTab('procura');
      setConfirmEditN(null);
      await carregar();
      setFeedback({ type: 'success', text: 'Procura actualizada.' });
      return actualizada;
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
      throw err;
    } finally {
      setSavingProcura(false);
    }
  };

  const handleSubmitProcura = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    const built = buildProcuraPayload();
    if (!built.ok) return;

    if (editing && procura) {
      const nImpacto = countPropostasAInvalidar({
        propostas: [...inboxReviews, ...enviadasReviews].map((r) => r.proposta),
        ofertasById,
        procura: built.payload,
        nCandidato: grupo
          ? (membrosCount > 0 ? membrosCount : procura.n_candidato ?? 1)
          : procura.n_candidato ?? 1,
      });
      if (nImpacto > 0) {
        setConfirmEditN(nImpacto);
        return;
      }
      try {
        await persistProcuraUpdate(built.payload);
      } catch {
        /* feedback já definido */
      }
      return;
    }

    const { payload } = built;
    try {
      const criada = tipoProcura === 'grupo'
        ? await createProcuraWithGrupo(payload, {
            nome: 'O meu grupo',
            nMaximo: nMaximoGrupo,
            pickup_name: form.origin_name ?? null,
            pickup_lat: form.origin_lat ?? null,
            pickup_lng: form.origin_lng ?? null,
            dropoff_name: form.destination_name ?? null,
            dropoff_lat: form.destination_lat ?? null,
            dropoff_lng: form.destination_lng ?? null,
          })
        : await createProcura(payload);

      setModoTetoPreferido(modoTeto);
      setModoTetoActivo(modoTeto);
      setProcura(criada);
      setView('hub');
      setHubTab('explorar');
      markPermissionsEligible();
      await carregar();
      setFeedback({ type: 'success', text: 'Procura criada.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    }
  };

  /**
   * N_proposto = N_actual no instante da proposta.
   * Grupo vivo: N_actual < n_maximo NÃO bloqueia — só falta de grupo quando N>1.
   * @returns {{ nProposto: number, grupoId: string | null, erro: string | null }}
   */
  const resolverPropostaN = () => {
    if (grupo?.id) {
      const nProposto = membrosCount;
      if (nProposto < 1) {
        return {
          nProposto: 0,
          grupoId: grupo.id,
          erro: 'O grupo precisa de pelo menos um passageiro para propor.',
        };
      }
      return { nProposto, grupoId: grupo.id, erro: null };
    }
    const nProposto = procura?.n_candidato ?? 1;
    if (nProposto > 1) {
      return {
        nProposto,
        grupoId: null,
        erro: 'Para propor com mais de uma pessoa, cria um grupo na procura.',
      };
    }
    return { nProposto: 1, grupoId: null, erro: null };
  };

  /**
   * @param {object} oferta
   * @returns {object}
   */
  const buildProporSheetForm = (oferta) => ({
    preferred_time: String(oferta.departure_time || '07:15').slice(0, 5),
    origin_name: oferta.origin_name || '',
    origin_lat: oferta.origin_lat ?? null,
    origin_lng: oferta.origin_lng ?? null,
    destination_name: oferta.destination_name || '',
    destination_lat: oferta.destination_lat ?? null,
    destination_lng: oferta.destination_lng ?? null,
    valor_mensal_ask_kz: String(oferta.valor_mensal_ask_kz ?? ''),
  });

  /**
   * @param {object} oferta
   * @param {'browse' | 'hub'} source
   */
  const openProporSheet = (oferta, source) => {
    setProporSheet({
      oferta,
      gaps: source === 'browse' ? getPropostaBrowseGaps(oferta) : [],
      source,
      form: buildProporSheetForm(oferta),
    });
  };

  /** @param {object} oferta */
  const openProporBrowseSheet = (oferta) => openProporSheet(oferta, 'browse');

  /**
   * Explorar autenticado: a folha de proposta já existente.
   * Lacunas de oferta fixa incompleta continuam no sheet de dados em falta.
   * @param {object} oferta
   */
  const abrirPropostaBrowse = (oferta) => {
    if (ofertasComPropostaAberta.has(oferta.id)) return;
    if (getPropostaBrowseGaps(oferta).length > 0) {
      openProporBrowseSheet(oferta);
      return;
    }
    setPropostaErro('');
    setPropostaOferta(oferta);
  };

  /**
   * Browse: cria procura mínima + proposta (valores da oferta).
   * @param {object} oferta
   * @param {object} overrides
   */
  /**
   * @param {object} oferta
   * @param {object} overrides
   * @param {number} valorMensalKz
   */
  const submitProporBrowse = async (oferta, overrides, valorMensalKz, nPassageiros = 1) => {
    if (ofertasComPropostaAberta.has(oferta.id)) {
      return;
    }
    if (nPassageiros > 1) {
      setFeedback({
        type: 'error',
        text: 'Para propor com mais de uma pessoa é necessário um grupo ligado à procura.',
      });
      return;
    }

    setBrowseBusy(true);
    setBusyId(oferta.id);
    setFeedback({ type: '', text: '' });

    try {
      const payload = buildProcuraMinimaFromOferta(oferta, overrides);
      const criada = await createProcura(payload);
      let propostaOk = false;
      try {
        await createProposta({
          oferta_id: oferta.id,
          procura_id: criada.id,
          grupo_id: null,
          modo_preco: oferta.modo_preco,
          valor_mensal_ask_kz: valorMensalKz,
          n_passageiros_propostos: nPassageiros,
        });
        propostaOk = true;
        setFeedback({ type: 'success', text: FEEDBACK_PROPOSTA_ENVIADA_MOTORISTA });
      } catch (propErr) {
        console.error(propErr);
        setFeedback({
          type: 'error',
          text: 'Procura criada, mas não foi possível enviar a proposta. Vê «Propostas enviadas» ou tenta propor de novo.',
        });
      }
      setProporSheet(null);
      await carregar();
      if (propostaOk) {
        setBrowseOfertasComProposta((prev) => new Set(prev).add(oferta.id));
      }
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBrowseBusy(false);
      setBusyId(null);
    }
  };

  /**
   * @param {object} oferta
   * @param {number} valorMensalKz
   */
  const submitProporHub = async (oferta, valorMensalKz) => {
    if (ofertasComPropostaAberta.has(oferta.id)) {
      return;
    }
    if (!procura) {
      setFeedback({
        type: 'error',
        text: 'Cria uma procura com origem, destino e horário antes de propor acordo.',
      });
      setView('form');
      return;
    }

    const { nProposto, grupoId, erro } = resolverPropostaN();
    if (erro) {
      setFeedback({ type: 'error', text: erro });
      return;
    }

    setBusyId(oferta.id);
    setFeedback({ type: '', text: '' });
    try {
      await createProposta({
        oferta_id: oferta.id,
        procura_id: procura.id,
        grupo_id: grupoId,
        modo_preco: oferta.modo_preco,
        valor_mensal_ask_kz: valorMensalKz,
        n_passageiros_propostos: nProposto,
      });
      setFeedback({ type: 'success', text: FEEDBACK_PROPOSTA_ENVIADA_MOTORISTA });
      setProporSheet(null);
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleProporSheetSubmit = async (e) => {
    e.preventDefault();
    if (!proporSheet) return;

    const { oferta, gaps, form, source } = proporSheet;
    const valorParsed = parseValorPropostaKz(form.valor_mensal_ask_kz);
    const valorCheck = validarValorPropostaKz(valorParsed);
    if (!valorCheck.ok) {
      setFeedback({ type: 'error', text: valorCheck.erro });
      return;
    }

    if (gaps.includes('time') && !form.preferred_time) {
      setFeedback({ type: 'error', text: 'Indica o horário preferido.' });
      return;
    }
    if (gaps.includes('od') && (form.origin_lat == null || form.destination_lat == null)) {
      setFeedback({ type: 'error', text: 'Seleccione origem e destino na lista de sugestões.' });
      return;
    }

    if (source === 'hub') {
      await submitProporHub(oferta, valorCheck.valor);
      return;
    }

    await submitProporBrowse(
      oferta,
      {
        preferred_time: form.preferred_time,
        origin_name: form.origin_name || null,
        origin_lat: form.origin_lat,
        origin_lng: form.origin_lng,
        destination_name: form.destination_name || null,
        destination_lat: form.destination_lat,
        destination_lng: form.destination_lng,
      },
      valorCheck.valor,
    );
  };

  const handlePropor = (oferta) => {
    if (ofertasComPropostaAberta.has(oferta.id)) {
      return;
    }
    if (!procura) {
      setFeedback({
        type: 'error',
        text: 'Cria uma procura com origem, destino e horário antes de propor acordo.',
      });
      setView('form');
      return;
    }

    const { erro } = resolverPropostaN();
    if (erro) {
      setFeedback({ type: 'error', text: erro });
      return;
    }

    openProporSheet(oferta, 'hub');
  };

  const handleWaitlist = async (oferta) => {
    if (!procura) {
      setFeedback({
        type: 'error',
        text: 'Cria uma procura com origem, destino e horário antes de entrar na lista de espera.',
      });
      setView('form');
      return;
    }
    setBusyId(oferta.id);
    try {
      await enqueueWaitlist({
        oferta_id: oferta.id,
        procura_id: procura.id,
        grupo_id: grupo?.id ?? null,
      });
      const enrolled = await listWaitlistByProcura(procura.id);
      setWaitlistEntries(enrolled);
      setFeedback({ type: 'success', text: 'Entraste na lista de espera.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleAceitarInbox = async (propostaId, memberIds) => {
    setBusyId(propostaId);
    setFeedback({ type: '', text: '' });
    const reviewAceite = inboxReviews.find((r) => r.proposta.id === propostaId);
    const ofertaIdAceite = reviewAceite?.proposta?.oferta_id ?? null;
    const procuraIdAceite = reviewAceite?.proposta?.procura_id ?? procura?.id ?? null;
    try {
      let result;
      if (Array.isArray(memberIds) && memberIds.length > 0) {
        result = await createAgreementFromProposal(propostaId, { memberIds });
      } else {
        result = await createAgreementFromProposal(propostaId);
      }
      const offlineQueued = Boolean(result?.offlineQueued);
      const fechaProcura = !offlineQueued && shouldAvisarProcuraFecha(procura?.estado);
      if (offlineQueued) {
        setAceitesOfflinePendentes((prev) => new Set(prev).add(propostaId));
      } else if (result?.id) {
        setAceitesOfflinePendentes((prev) => {
          const next = new Set(prev);
          next.delete(propostaId);
          return next;
        });
        const optimista = buildAcordoOptimistaPosAceite(
          { ...result, oferta_id: result.oferta_id ?? ofertaIdAceite },
          user.id,
          Date.now(),
          memberIds,
        );
        if (optimista) {
          setAcordosPassageiro((prev) => mergeAcordosPassageiro([optimista], prev || [], user.id));
        }
        const ofertaId = result.oferta_id ?? ofertaIdAceite;
        aplicarClearUiPosAceiteServidor({
          procuraId: procuraIdAceite,
          ofertaId,
          setInboxReviews,
          setEnviadasReviews,
          setBrowseOfertasComProposta,
        });
      }
      setFeedback({
        type: 'success',
        text: fechaProcura
          ? 'Procura fechada — tens acordo activo.'
          : offlineQueued
            ? 'Sem rede. O aceite vai ser enviado quando a rede voltar.'
            : 'Proposta aceite. Acordo criado.',
      });
      await carregar({ silent: true });
      if (!offlineQueued && result?.id) {
        aplicarClearUiPosAceiteServidor({
          procuraId: procuraIdAceite,
          ofertaId: result.oferta_id ?? ofertaIdAceite,
          setInboxReviews,
          setEnviadasReviews,
          setBrowseOfertasComProposta,
        });
      }
      notifyMarketplaceHubRefresh();
    } catch (err) {
      setAceitesOfflinePendentes((prev) => {
        const next = new Set(prev);
        next.delete(propostaId);
        return next;
      });
      setFeedback({ type: 'error', text: mensagemErroAceiteInbox(err) });
    } finally {
      setBusyId(null);
    }
  };

  /**
   * @param {string} propostaId
   * @returns {boolean}
   */
  const aceitePendenteConfirmacao = (propostaId) =>
    busyId === propostaId || aceitesOfflinePendentes.has(propostaId);

  const handleRecusarInbox = async (propostaId) => {
    setBusyId(propostaId);
    try {
      await rejectProposta(propostaId);
      setFeedback({ type: 'success', text: 'Proposta recusada.' });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Enviada aberta do utilizador para o par (oferta, procura).
   * @param {{ oferta_id: string, procura_id: string }} par
   */
  const findEnviadaAberta = ({ oferta_id, procura_id }) =>
    enviadasReviews.find(
      (r) =>
        r.proposta.oferta_id === oferta_id
        && r.proposta.procura_id === procura_id,
    );

  /** Oculta CTA só após contra-proposta bem-sucedida nesta sessão (não por enviada prévia). */
  /** @param {import('../components/PropostaReviewCard').PropostaReview} review */
  const jaEnviouContraProposta = (review) =>
    contraPropostaFeitaIds.has(review.proposta.id);

  /** @param {import('../components/PropostaReviewCard').PropostaReview} review */
  const handleAbrirContraProposta = (review) => {
    const { proposta } = review;
    const oferta = ofertasById[proposta.oferta_id];
    setContraPropostaSheet({
      propostaId: proposta.id,
      oferta_id: proposta.oferta_id,
      procura_id: proposta.procura_id || procura?.id,
      grupo_id: proposta.grupo_id ?? null,
      modo_preco: proposta.modo_preco,
      n_passageiros_propostos: proposta.n_passageiros_propostos ?? 1,
      valor_mensal_ask_kz: String(proposta.valor_mensal_ask_kz ?? ''),
      precoPublicadoKz: oferta?.valor_mensal_ask_kz ?? null,
    });
  };

  const handleContraPropostaSubmit = async (e) => {
    e.preventDefault();
    if (!contraPropostaSheet) return;

    const valorParsed = parseValorPropostaKz(contraPropostaSheet.valor_mensal_ask_kz);
    const valorCheck = validarValorPropostaKz(valorParsed);
    if (!valorCheck.ok) {
      setFeedback({ type: 'error', text: valorCheck.erro });
      return;
    }

    setBusyId(contraPropostaSheet.propostaId);
    setFeedback({ type: '', text: '' });
    try {
      const enviadaExistente = findEnviadaAberta({
        oferta_id: contraPropostaSheet.oferta_id,
        procura_id: contraPropostaSheet.procura_id,
      });
      if (enviadaExistente) {
        await cancelProposta(enviadaExistente.proposta.id);
      }
      await createProposta({
        oferta_id: contraPropostaSheet.oferta_id,
        procura_id: contraPropostaSheet.procura_id,
        grupo_id: contraPropostaSheet.grupo_id,
        modo_preco: contraPropostaSheet.modo_preco,
        valor_mensal_ask_kz: valorCheck.valor,
        n_passageiros_propostos: contraPropostaSheet.n_passageiros_propostos,
      });
      setContraPropostaFeitaIds((prev) => new Set(prev).add(contraPropostaSheet.propostaId));
      setContraPropostaSheet(null);
      setFeedback({ type: 'success', text: FEEDBACK_PROPOSTA_ENVIADA_MOTORISTA });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelarEnviada = async (propostaId) => {
    setBusyId(propostaId);
    setFeedback({ type: '', text: '' });
    try {
      await cancelProposta(propostaId);
      setFeedback({ type: 'success', text: 'Proposta cancelada.' });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const waitlistEntriesVisiveis = filterWaitlistEntriesVisiveis(waitlistEntries);

  const waitlistEstadoOferta = (ofertaId) =>
    waitlistEntriesVisiveis.find((e) => e.oferta_id === ofertaId)?.estado ?? null;

  const temPromocaoWaitlist = waitlistEntriesVisiveis.some((e) => e.estado === 'notificada');

  const waitlistOfertaIds = new Set(matches.waitlist.map((o) => o.id));
  const waitlistOrfas = waitlistEntriesVisiveis.filter((e) => !waitlistOfertaIds.has(e.oferta_id));

  const temSecaoWaitlist =
    waitlistEntriesVisiveis.length > 0 || matches.waitlist.length > 0 || temPromocaoWaitlist;

  const nDisplayGrupo = grupo
    ? (membrosCount > 0 ? membrosCount : procura?.n_candidato ?? 1)
    : (procura?.n_candidato ?? 1);
  const chipProcura = procura ? chipEstadoProcura(procura.estado) : null;
  const tabActivo = view === 'matches' ? 'procura' : hubTab;
  const mostrarSegmented = Boolean(procura) && (view === 'hub' || view === 'matches');
  const rotaProcura = procura ? labelRotaProcura(procura) : null;
  const procuraFlexivel = rotaProcura?.origem === 'Procura flexível';
  const metaSticky = (() => {
    if (!procura) return '';
    const partes = [];
    const dias = formatDiasSemana(procura.dias_semana);
    if (dias) partes.push(dias);
    if (procura.preferred_time) partes.push(formatTime24h(procura.preferred_time));
    if (procura.teto_mensal_kz != null && Number(procura.teto_mensal_kz) > 0) {
      const sufixo = modoTetoActivo === 'TOTAL_ACORDO' ? '' : ' / pax';
      partes.push(`Teto ${formatKwanza(procura.teto_mensal_kz)} Kz${sufixo}`);
    }
    return partes.join(' · ');
  })();

  const irParaOfertasCompativeis = () => {
    hubTabFocusRef.current = null;
    setView('hub');
    setHubTab('procura');
    requestAnimationFrame(() => {
      document.getElementById('ofertas-compativeis')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  /** @param {object} oferta */
  const irParaAcordoDaOferta = (oferta) => {
    const acordoId = acordoPorOferta.get(oferta.id);
    if (!acordoId) return;
    navigate(`/acordos?openAcordoId=${encodeURIComponent(acordoId)}`);
  };

  /**
   * @param {object} oferta
   * @returns {{ label?: string, disabled: boolean, onAction: () => void }}
   */
  const resolveOfertaFeedCta = (oferta) => {
    if (acordoPorOferta.has(oferta.id)) {
      return {
        label: CTA_VER_ACORDO,
        disabled: false,
        onAction: () => irParaAcordoDaOferta(oferta),
      };
    }
    const enviada = ofertasComPropostaAberta.has(oferta.id);
    if (enviada) {
      return {
        label: 'Proposta enviada',
        disabled: true,
        onAction: () => {},
      };
    }
    return {
      label: undefined,
      disabled: false,
      onAction: () => proporNoFeed(oferta),
    };
  };

  const proporNoFeed = (oferta) => {
    if (procura) {
      if (!isOfertaRotaCompativelComProcura(oferta, procura)) {
        setAvisoRota(oferta);
        return;
      }
      handlePropor(oferta);
      return;
    }
    abrirPropostaBrowse(oferta);
  };

  const onHubTabKeyDown = (event) => {
    const order = ['explorar', 'procura'];
    const current = tabActivo === 'procura' ? 1 : 0;
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + order.length) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    else return;
    event.preventDefault();
    const id = order[next];
    const buttonId = id === 'explorar' ? 'hub-tab-explorar' : 'hub-tab-procura';
    if (id === tabActivo && view === 'hub') {
      hubTabFocusRef.current = null;
      document.getElementById(buttonId)?.focus();
      return;
    }
    hubTabFocusRef.current = buttonId;
    setView('hub');
    setHubTab(id);
  };

  return (
    <PageShell>
      {(view === 'form' || !mostrarSegmented) && (
        <PageHeader
          title={
            view === 'form'
              ? (editing ? 'Editar procura' : 'Nova procura')
              : hubFocus === 'propostas'
                ? 'Propostas'
                : 'Explorar'
          }
          subtitle={
            view === 'form'
              ? (editing
                ? 'Corrige origem, destino, horário, dias ou teto.'
                : 'Define a tua rota diária casa–trabalho.')
              : hubFocus === 'propostas'
                ? 'Propostas recebidas e enviadas nesta oferta.'
                : 'Explora ofertas e propõe acordo directamente — ou cria procura para filtrar matches.'
          }
          {...(view !== 'hub'
            ? {
                onBack: () => {
                  setView('hub');
                  if (procura) setHubTab(editing ? 'procura' : 'explorar');
                },
              }
            : {})}
        />
      )}

      {!loading && mostrarSegmented ? (
        <div
          role="tablist"
          aria-label="Início"
          className="mb-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
          data-testid="hub-segmented"
        >
          <button
            type="button"
            role="tab"
            id="hub-tab-explorar"
            aria-controls="hub-panel-explorar"
            aria-selected={tabActivo === 'explorar'}
            tabIndex={tabActivo === 'explorar' ? 0 : -1}
            className={`min-h-11 flex-1 rounded-lg text-sm font-bold ${
              tabActivo === 'explorar'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
            onClick={() => {
              hubTabFocusRef.current = null;
              setView('hub');
              setHubTab('explorar');
            }}
            onKeyDown={onHubTabKeyDown}
          >
            Explorar
          </button>
          <button
            type="button"
            role="tab"
            id="hub-tab-procura"
            aria-controls="hub-panel-procura"
            aria-selected={tabActivo === 'procura'}
            tabIndex={tabActivo === 'procura' ? 0 : -1}
            className={`min-h-11 flex-1 rounded-lg text-sm font-bold ${
              tabActivo === 'procura'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 dark:text-slate-300'
            }`}
            onClick={() => {
              hubTabFocusRef.current = null;
              setView('hub');
              setHubTab('procura');
            }}
            onKeyDown={onHubTabKeyDown}
          >
            A minha procura
          </button>
        </div>
      ) : null}

      {feedback.text ? (
        <FeedbackAlert
          type={feedback.type === 'success' ? 'success' : 'error'}
          text={feedback.text}
          data-testid="passenger-feedback"
        />
      ) : null}

      {loading && <LoadingSkeleton />}

      {!loading && view === 'hub' && (!procura ? hubFocus !== 'propostas' : tabActivo === 'explorar') && (
        <div
          className="space-y-4 relative"
          {...(mostrarSegmented
            ? {
                id: 'hub-panel-explorar',
                role: 'tabpanel',
                'aria-labelledby': 'hub-tab-explorar',
              }
            : {})}
        >
          {browseBusy ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 dark:bg-slate-900/70"
              role="status"
              aria-live="polite"
              data-testid="browse-busy-overlay"
            >
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">A enviar proposta…</p>
            </div>
          ) : null}
          {procura ? (
            <section
              className="sticky top-0 z-10 space-y-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              data-testid="procura-sticky"
            >
              <div className="flex items-center gap-2">
                {chipProcura ? (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipProcura.className}`}>
                    {chipProcura.label}
                  </span>
                ) : null}
                {procuraFlexivel ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Flexível
                  </span>
                ) : null}
              </div>
              {procuraFlexivel ? (
                <p className="font-bold text-slate-900 dark:text-white">Sem origem/destino fixos</p>
              ) : (
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white min-w-0">
                  <TextFade className="flex-1">{rotaProcura.origem}</TextFade>
                  <ArrowRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                  <TextFade className="flex-1">{rotaProcura.destino}</TextFade>
                </div>
              )}
              {metaSticky ? (
                <p className="text-sm text-slate-500 tabular-nums">{metaSticky}</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 font-bold dark:border-slate-700"
                  onClick={() => setHubTab('procura')}
                >
                  Ver detalhe
                </button>
                <button
                  type="button"
                  className="min-h-11 flex-1 rounded-xl bg-primary font-bold text-white"
                  onClick={irParaOfertasCompativeis}
                >
                  Ver ofertas compatíveis
                </button>
              </div>
            </section>
          ) : null}
          <section className="space-y-3" data-testid="browse-ofertas-feed">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-balance">Ofertas disponíveis</h2>
              {procura ? null : (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    className="text-sm font-bold text-primary"
                    onClick={() => navigate('/explorar')}
                  >
                    Ver boleias
                  </button>
                  <button
                    type="button"
                    className="text-sm font-bold text-primary"
                    onClick={() => setView('form')}
                  >
                    Criar procura
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500 text-pretty">
              Toca «Propor acordo» numa oferta para enviar proposta já — ou «Criar procura» para filtrar por horário e trajeto.
            </p>

            {loadingBrowse ? (
              <LoadingSkeleton />
            ) : browseOfertas.length === 0 ? (
              <p className="text-sm text-slate-500 text-pretty">
                Ainda não há ofertas publicadas. Volta mais tarde.
              </p>
            ) : (
              browseOfertas.map((oferta) => {
                const cta = resolveOfertaFeedCta(oferta);
                return (
                  <OpportunityCard
                    key={oferta.id}
                    kind="oferta"
                    item={oferta}
                    onOpen={() => setDetalheOferta(oferta)}
                    ctaDisabled={cta.disabled}
                    ctaLabel={cta.label}
                    onCta={cta.onAction}
                  />
                );
              })
            )}
          </section>

          <GrupoDescobertaPanel userId={user.id} excludeGrupoId={grupo?.id ?? null} />
        </div>
      )}

      {!loading && view === 'hub' && !procura && hubFocus === 'propostas' && (
        <div className="space-y-4" data-testid="propostas-deep-link-panel">
          <section className="space-y-3" data-testid="propostas-recebidas-section">
            <h2 className="text-lg font-bold text-balance">Propostas recebidas</h2>
            {loadingInbox ? (
              <LoadingSkeleton />
            ) : inboxReviews.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ainda sem propostas do motorista.
              </p>
            ) : (
              inboxReviews.map((review) => (
                <PropostaReviewCard
                  key={review.proposta.id}
                  review={review}
                  secao="recebidas"
                  busy={busyId === review.proposta.id}
                  aceitePendenteEnvio={aceitePendenteConfirmacao(review.proposta.id)}
                  precoPublicadoKz={ofertasById[review.proposta.oferta_id]?.valor_mensal_ask_kz ?? null}
                  procuraEstado={procura?.estado ?? null}
                  onAceitar={(memberIds) => handleAceitarInbox(review.proposta.id, memberIds)}
                  onRecusar={() => handleRecusarInbox(review.proposta.id)}
                  onContraProposta={
                    jaEnviouContraProposta(review)
                      ? undefined
                      : () => handleAbrirContraProposta(review)
                  }
                />
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-balance">Propostas enviadas</h2>
            {loadingInbox ? (
              <LoadingSkeleton />
            ) : enviadasReviews.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ainda sem propostas enviadas a motoristas.
              </p>
            ) : (
              enviadasReviews.map((review) => (
                <PropostaReviewCard
                  key={review.proposta.id}
                  review={review}
                  modo="criador"
                  secao="enviadas"
                  busy={busyId === review.proposta.id}
                  onCancelar={() => handleCancelarEnviada(review.proposta.id)}
                />
              ))
            )}
          </section>

          {(terminadasRecebidas.length > 0 || terminadasEnviadas.length > 0) && (
            <section className="space-y-3" data-testid="propostas-terminadas">
              <h2 className="text-lg font-bold text-balance">Propostas concluídas</h2>
              <p className="text-sm text-slate-500 text-pretty">
                Aceites, recusadas, canceladas ou que já não correspondem — já não podes actuar sobre estas propostas.
              </p>
              {terminadasRecebidas.map((review) => (
                <PropostaReviewCard
                  key={`tr-${review.proposta.id}`}
                  review={review}
                  modo="historico"
                  secao="recebidas"
                />
              ))}
              {terminadasEnviadas.map((review) => (
                <PropostaReviewCard
                  key={`te-${review.proposta.id}`}
                  review={review}
                  modo="historico"
                  secao="enviadas"
                />
              ))}
            </section>
          )}
        </div>
      )}

      {!loading && view === 'form' && (
        <form onSubmit={handleSubmitProcura} className="space-y-4 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm">
          {editing ? (
            <button
              type="button"
              className="text-sm font-semibold text-primary"
              onClick={() => {
                setEditing(false);
                setView('hub');
                setConfirmEditN(null);
              }}
            >
              Voltar
            </button>
          ) : null}
          {!editing && (
          <>
          <div
            className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
            role="group"
            aria-label="Tipo de procura"
          >
            <button
              type="button"
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tipoProcura === 'individual'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500'
              }`}
              onClick={() => setTipoProcura('individual')}
            >
              Individual
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                tipoProcura === 'grupo'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500'
              }`}
              onClick={() => setTipoProcura('grupo')}
            >
              Grupo
            </button>
          </div>
          <p className="text-xs text-slate-500 text-pretty">
            {tipoProcura === 'individual'
              ? 'Viajas sozinho — podes criar grupo mais tarde se quiseres.'
              : 'Define quantas pessoas podem entrar no grupo desde o início.'}
          </p>

          {tipoProcura === 'grupo' && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-charcoal dark:text-slate-300">
                Até quantas pessoas?
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Capacidade do grupo">
                {CAPACIDADES_GRUPO.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={nMaximoGrupo === n}
                    onClick={() => setNMaximoGrupo(n)}
                    className={`min-w-10 h-10 px-2.5 rounded-lg text-sm font-bold transition-all ${
                      nMaximoGrupo === n
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-light-gray dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          </>
          )}

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
            <span className="flex items-center gap-1.5">
              <Clock size={16} aria-hidden="true" />
              Hora preferida
            </span>
            <TimeInput
              name="preferred_time"
              value={form.preferred_time}
              onChange={handleChange}
              required
              aria-label="Hora preferida"
              className="h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 outline-none focus:ring-2 focus:ring-primary/50"
            />
          </label>

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
                const activo = form.dias_semana.includes(valor);
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

          <div
            className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1"
            role="group"
            aria-label="Modo do teto mensal"
          >
            <button
              type="button"
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                modoTeto === 'POR_PASSAGEIRO'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500'
              }`}
              onClick={() => {
                setModoTeto('POR_PASSAGEIRO');
                setModoTetoPreferido('POR_PASSAGEIRO');
              }}
            >
              Por passageiro
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                modoTeto === 'TOTAL_ACORDO'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500'
              }`}
              onClick={() => {
                setModoTeto('TOTAL_ACORDO');
                setModoTetoPreferido('TOTAL_ACORDO');
              }}
            >
              Total do acordo
            </button>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Banknote size={16} aria-hidden="true" />
              {modoTeto === 'POR_PASSAGEIRO'
                ? 'Teto mensal por passageiro (Kz)'
                : 'Teto mensal total do acordo (Kz)'}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                name="teto_mensal_kz"
                min={1}
                step={1}
                value={form.teto_mensal_kz}
                onChange={handleChange}
                placeholder="Opcional"
                aria-label={
                  modoTeto === 'POR_PASSAGEIRO'
                    ? 'Teto mensal por passageiro'
                    : 'Teto mensal total do acordo'
                }
                className="flex-1 h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 tabular-nums outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-sm font-medium text-slate-500 shrink-0">Kz</span>
            </div>
            <p className="text-xs text-slate-500 text-pretty">
              {modoTeto === 'POR_PASSAGEIRO'
                ? 'Valor máximo que queres pagar pela tua quota mensal.'
                : 'Valor máximo para o carro completo no acordo.'}
            </p>
          </label>

          <button
            type="submit"
            className="w-full bg-primary text-white font-bold py-4 rounded-xl"
            disabled={savingProcura}
          >
            {editing ? 'Guardar alterações' : 'Guardar procura'}
          </button>
        </form>
      )}

      {!loading && procura && (view === 'hub' || view === 'matches') && tabActivo === 'procura' && (
        <div
          className="space-y-4"
          data-testid="procura-detail"
          id="hub-panel-procura"
          role="tabpanel"
          aria-labelledby="hub-tab-procura"
        >
          <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              {chipProcura && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipProcura.className}`}>
                  {chipProcura.label}
                </span>
              )}
              {procuraFlexivel ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Flexível
                </span>
              ) : null}
            </div>
            {procuraFlexivel ? (
              <p className="font-bold text-slate-900 dark:text-white">Sem origem/destino fixos</p>
            ) : (
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white min-w-0">
                <TextFade className="flex-1">{rotaProcura.origem}</TextFade>
                <ArrowRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                <TextFade className="flex-1">{rotaProcura.destino}</TextFade>
              </div>
            )}
            <div className="flex gap-3 text-sm text-slate-500 flex-wrap">
              <span className="flex items-center gap-1 tabular-nums">
                <Clock size={14} aria-hidden="true" />
                {formatTime24h(procura.preferred_time)}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Users size={14} aria-hidden="true" />
                {labelTamanhoProcura({
                  n: nDisplayGrupo,
                  nMaximo: grupo?.n_maximo ?? null,
                  temGrupo: Boolean(grupo),
                })}
              </span>
              {procura.teto_mensal_kz != null && Number(procura.teto_mensal_kz) > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Banknote size={14} aria-hidden="true" />
                  Teto {labelModoTeto(modoTetoActivo).toLowerCase()}{' '}
                  {formatKwanza(procura.teto_mensal_kz)} Kz
                </span>
              )}
            </div>
            <button
              type="button"
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20"
              onClick={irParaOfertasCompativeis}
            >
              Ver ofertas compatíveis
            </button>
            {canEditProcura(procura) ? (
              <>
                <button
                  type="button"
                  aria-label="Editar procura"
                  className="w-full min-h-12 border border-slate-200 dark:border-slate-700 font-bold py-3.5 rounded-xl"
                  onClick={() => {
                    prefillFormFromProcura(procura);
                    setEditing(true);
                    setView('form');
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="w-full min-h-12 text-red-600 dark:text-red-400 font-semibold py-3"
                  onClick={() => setConfirmCancelOpen(true)}
                >
                  Cancelar procura
                </button>
              </>
            ) : null}
          </section>

          <GrupoProcuraPanel
            procura={procura}
            userId={user.id}
            onGrupoChange={carregar}
          />

          <section className="space-y-3" data-testid="waitlist-bucket">
            <h2 className="text-lg font-bold text-balance">Lista de espera</h2>
            <p className="text-sm text-slate-500 text-pretty">
              Quando não há lugares suficientes para o teu grupo, podes entrar em espera.
              Se abrir vaga, recebes aviso — decides tu se propões acordo.
            </p>

            {temPromocaoWaitlist && (
              <div
                role="status"
                className="rounded-xl px-4 py-3 text-sm font-medium bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
              >
                Abriu-se uma vaga numa oferta em que estás em espera. Podes propor
                acordo — não foste aceite automaticamente.
              </div>
            )}

            {loadingInbox ? (
              <LoadingSkeleton />
            ) : !temSecaoWaitlist ? (
              <p className="text-sm text-slate-500">
                Ainda não estás em nenhuma lista de espera. Vê ofertas compatíveis
                abaixo — as sem lugares mostram o botão «Entrar na lista de espera».
              </p>
            ) : (
              <div className="space-y-3">
                {matches.waitlist.map((oferta) => (
                  <OfertaMatchCard
                    key={oferta.id}
                    oferta={oferta}
                    variant="waitlist"
                    waitlistEstado={waitlistEstadoOferta(oferta.id)}
                    busy={busyId === oferta.id}
                    propostaEnviada={ofertasComPropostaAberta.has(oferta.id)}
                    onPropor={
                      ofertasComPropostaAberta.has(oferta.id)
                        ? undefined
                        : () => handlePropor(oferta)
                    }
                    onWaitlist={() => handleWaitlist(oferta)}
                  />
                ))}

                {waitlistOrfas.map((entry) => {
                  const chip =
                    entry.estado === 'notificada'
                      ? { label: 'Vaga aberta', className: 'bg-amber-100 text-amber-800' }
                      : { label: 'Em espera', className: 'bg-slate-100 text-slate-600' };
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2"
                      data-testid="waitlist-entry-orfa"
                    >
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Inscrição activa nesta oferta
                      </p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${chip.className}`}>
                        {chip.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3" data-testid="propostas-recebidas-section">
            <h2 className="text-lg font-bold text-balance">Propostas recebidas</h2>
            {loadingInbox ? (
              <LoadingSkeleton />
            ) : inboxReviews.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ainda sem propostas do motorista.
              </p>
            ) : (
              inboxReviews.map((review) => (
                <PropostaReviewCard
                  key={review.proposta.id}
                  review={review}
                  secao="recebidas"
                  busy={busyId === review.proposta.id}
                  aceitePendenteEnvio={aceitePendenteConfirmacao(review.proposta.id)}
                  precoPublicadoKz={ofertasById[review.proposta.oferta_id]?.valor_mensal_ask_kz ?? null}
                  acimaDoTeto={isPropostaAcimaDoTeto(
                    review.proposta,
                    procura.teto_mensal_kz,
                    modoTetoActivo,
                  )}
                  procuraEstado={procura?.estado ?? null}
                  onAceitar={(memberIds) => handleAceitarInbox(review.proposta.id, memberIds)}
                  onRecusar={() => handleRecusarInbox(review.proposta.id)}
                  onContraProposta={
                    jaEnviouContraProposta(review)
                      ? undefined
                      : () => handleAbrirContraProposta(review)
                  }
                />
              ))
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-balance">Propostas enviadas</h2>
            {loadingInbox ? (
              <LoadingSkeleton />
            ) : enviadasReviews.length === 0 ? (
              <p className="text-sm text-slate-500">
                Ainda sem propostas enviadas a motoristas.
              </p>
            ) : (
              enviadasReviews.map((review) => (
                <PropostaReviewCard
                  key={review.proposta.id}
                  review={review}
                  modo="criador"
                  secao="enviadas"
                  busy={busyId === review.proposta.id}
                  acimaDoTeto={isPropostaAcimaDoTeto(
                    review.proposta,
                    procura.teto_mensal_kz,
                    modoTetoActivo,
                  )}
                  onCancelar={() => handleCancelarEnviada(review.proposta.id)}
                />
              ))
            )}
          </section>

          {(terminadasRecebidas.length > 0 || terminadasEnviadas.length > 0) && (
            <section className="space-y-3" data-testid="propostas-terminadas">
              <h2 className="text-lg font-bold text-balance">Propostas concluídas</h2>
              <p className="text-sm text-slate-500 text-pretty">
                Aceites, recusadas, canceladas ou que já não correspondem — já não podes actuar sobre estas propostas.
              </p>
              {terminadasRecebidas.map((review) => (
                <PropostaReviewCard
                  key={`tr-${review.proposta.id}`}
                  review={review}
                  modo="historico"
                  secao="recebidas"
                />
              ))}
              {terminadasEnviadas.map((review) => (
                <PropostaReviewCard
                  key={`te-${review.proposta.id}`}
                  review={review}
                  modo="historico"
                  secao="enviadas"
                />
              ))}
            </section>
          )}

          {(view === 'matches' || view === 'hub') && (
            <>
              <h2 id="ofertas-compativeis" className="text-lg font-bold text-balance">Ofertas compatíveis</h2>
              <p className="text-sm font-semibold text-slate-500">
                {matches.direct.length === 1
                  ? '1 oferta compatível'
                  : `${matches.direct.length} ofertas compatíveis`}
              </p>

              {matches.direct.map((oferta) => (
                <OfertaMatchCard
                  key={oferta.id}
                  oferta={oferta}
                  variant="direct"
                  busy={busyId === oferta.id}
                  propostaEnviada={ofertasComPropostaAberta.has(oferta.id)}
                  onPropor={
                    ofertasComPropostaAberta.has(oferta.id)
                      ? undefined
                      : () => handlePropor(oferta)
                  }
                />
              ))}

              {matches.direct.length === 0 && matches.waitlist.length === 0 && (
                <p className="text-sm text-slate-500 text-pretty">
                  Ainda não há ofertas compatíveis com o teu horário e trajeto.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(avisoRota)}
        title="Rotas diferentes"
        message={avisoRota && procura ? buildAvisoProporRota(avisoRota, procura) : ''}
        confirmText="Propor na mesma"
        cancelText="Cancelar"
        variant="primary"
        testId="propor-rota-aviso"
        onCancel={() => setAvisoRota(null)}
        onConfirm={() => {
          const oferta = avisoRota;
          setAvisoRota(null);
          if (oferta) handlePropor(oferta);
        }}
      />
      <ConfirmationModal
        isOpen={confirmEditN != null && confirmEditN > 0}
        title={
          confirmEditN === 1
            ? '1 proposta deixa de corresponder'
            : `${confirmEditN} propostas deixam de corresponder`
        }
        message="O preço e o número de pessoas em cada uma não mudam; passam ao histórico como incompatíveis."
        confirmText="Actualizar mesmo assim"
        cancelText="Voltar"
        variant="primary"
        busy={savingProcura}
        onCancel={() => setConfirmEditN(null)}
        onConfirm={async () => {
          const built = buildProcuraPayload();
          if (!built.ok) return;
          try {
            await persistProcuraUpdate(built.payload);
          } catch {
            /* feedback já definido */
          }
        }}
      />
      {detalheOferta ? (
        <OpportunityDetailSheet
          kind="oferta"
          item={detalheOferta}
          onClose={() => setDetalheOferta(null)}
          ctaLabel={resolveOfertaFeedCta(detalheOferta).label || CTA_LABEL.oferta}
          ctaDisabled={resolveOfertaFeedCta(detalheOferta).disabled}
          onCta={
            resolveOfertaFeedCta(detalheOferta).disabled
              ? undefined
              : () => {
                  const oferta = detalheOferta;
                  const cta = resolveOfertaFeedCta(oferta);
                  setDetalheOferta(null);
                  cta.onAction();
                }
          }
        />
      ) : null}

      {propostaOferta ? (
        <OpportunityProposalSheet
          papel="passageiro"
          item={propostaOferta}
          nProposto={1}
          valorKz={propostaOferta.valor_mensal_ask_kz}
          modoPreco={propostaOferta.modo_preco}
          valorEditavel={Number(propostaOferta.vagas_disponiveis) > 0}
          disabled={browseBusy}
          erro={propostaErro}
          onClose={() => {
            setPropostaErro('');
            setPropostaOferta(null);
          }}
          onSubmit={(n, valorMensalKz) => {
            if (n > 1) {
              setPropostaErro('Para propor com mais de uma pessoa é necessário um grupo ligado à procura.');
              return;
            }
            const oferta = propostaOferta;
            setPropostaErro('');
            setPropostaOferta(null);
            void submitProporBrowse(oferta, {}, valorMensalKz ?? Number(oferta.valor_mensal_ask_kz), n);
          }}
        />
      ) : null}

      {proporSheet ? (
        <OverlayShell
          variant="bottom"
          overlayClassName="bg-slate-900/60 dark:bg-black/80"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-5 pt-4 space-y-4"
          testId="propor-browse-sheet"
          onDismiss={() => setProporSheet(null)}
        >
          <div className="space-y-4">
            <div className="flex h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white text-balance">
              {proporSheet.gaps.length > 0 ? 'Dados em falta para propor' : 'Confirmar proposta'}
            </h2>
            <p className="text-sm text-slate-500 text-pretty">
              {proporSheet.gaps.length > 0
                ? proporSheet.oferta.flexibilidade_rota
                  ? 'Indica o horário para completar a proposta — sem origem/destino fixos.'
                  : 'Completa origem, destino ou horário antes de enviar a proposta.'
                : 'Revê o valor mensal — podes propor outro preço antes de enviar.'}
            </p>
            <form onSubmit={handleProporSheetSubmit} className="space-y-4">
              <PropostaValorInput
                modoPreco={proporSheet.oferta.modo_preco}
                value={proporSheet.form.valor_mensal_ask_kz}
                askKz={proporSheet.oferta.valor_mensal_ask_kz}
                disabled={browseBusy}
                onChange={(e) =>
                  setProporSheet((prev) => ({
                    ...prev,
                    form: { ...prev.form, valor_mensal_ask_kz: e.target.value },
                  }))
                }
              />
              {proporSheet.gaps.includes('time') ? (
                <TimeInput
                  name="preferred_time"
                  label="Horário preferido"
                  value={proporSheet.form.preferred_time}
                  onChange={(e) =>
                    setProporSheet((prev) => ({
                      ...prev,
                      form: { ...prev.form, preferred_time: e.target.value },
                    }))
                  }
                />
              ) : null}
              {proporSheet.gaps.includes('od') ? (
                <>
                  <AddressInput
                    name="origin_name"
                    label="Origem"
                    value={proporSheet.form.origin_name}
                    onChange={(e) =>
                      setProporSheet((prev) => ({
                        ...prev,
                        form: { ...prev.form, origin_name: e.target.value },
                      }))
                    }
                    onSelectCoordinates={(c) =>
                      setProporSheet((prev) => ({
                        ...prev,
                        form: {
                          ...prev.form,
                          origin_lat: c.lat,
                          origin_lng: c.lng,
                        },
                      }))
                    }
                  />
                  <AddressInput
                    name="destination_name"
                    label="Destino"
                    value={proporSheet.form.destination_name}
                    onChange={(e) =>
                      setProporSheet((prev) => ({
                        ...prev,
                        form: { ...prev.form, destination_name: e.target.value },
                      }))
                    }
                    onSelectCoordinates={(c) =>
                      setProporSheet((prev) => ({
                        ...prev,
                        form: {
                          ...prev.form,
                          destination_lat: c.lat,
                          destination_lng: c.lng,
                        },
                      }))
                    }
                  />
                </>
              ) : null}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 min-h-12 border border-slate-200 dark:border-slate-700 font-bold rounded-xl"
                  onClick={() => setProporSheet(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-60"
                  disabled={browseBusy}
                >
                  Confirmar proposta
                </button>
              </div>
            </form>
          </div>
        </OverlayShell>
      ) : null}

      {contraPropostaSheet ? (
        <OverlayShell
          variant="bottom"
          overlayClassName="bg-slate-900/60 dark:bg-black/80"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-5 pt-4 space-y-4"
          testId="contra-proposta-sheet"
          onDismiss={() => setContraPropostaSheet(null)}
        >
          <div className="space-y-4">
            <div className="flex h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white text-balance">
              Contra-proposta
            </h2>
            <p className="text-sm text-slate-500 text-pretty">
              Propõe outro valor mensal em resposta — a proposta recebida mantém-se aberta.
            </p>
            <form onSubmit={handleContraPropostaSubmit} className="space-y-4">
              <PropostaValorInput
                modoPreco={contraPropostaSheet.modo_preco}
                value={contraPropostaSheet.valor_mensal_ask_kz}
                askKz={contraPropostaSheet.precoPublicadoKz}
                disabled={busyId === contraPropostaSheet.propostaId}
                onChange={(e) =>
                  setContraPropostaSheet((prev) =>
                    prev ? { ...prev, valor_mensal_ask_kz: e.target.value } : prev,
                  )
                }
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="flex-1 min-h-12 border border-slate-200 dark:border-slate-700 font-bold rounded-xl"
                  onClick={() => setContraPropostaSheet(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/25 disabled:opacity-60"
                  disabled={busyId === contraPropostaSheet.propostaId}
                >
                  Confirmar proposta
                </button>
              </div>
            </form>
          </div>
        </OverlayShell>
      ) : null}

      <ConfirmationModal
        isOpen={confirmCancelOpen}
        title="Cancelar procura?"
        message={`${inboxReviews.length + enviadasReviews.length} proposta(s) aberta(s) e ${waitlistEntriesVisiveis.length} inscrição(ões) em espera ficam sem efeito.`}
        confirmText="Cancelar procura"
        cancelText="Voltar"
        variant="destructive"
        busy={savingProcura}
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={async () => {
          if (!procura?.id) return;
          setSavingProcura(true);
          try {
            await cancelProcura(procura.id);
            setConfirmCancelOpen(false);
            setEditing(false);
            setView('hub');
            setHubTab('explorar');
            await carregar();
            setFeedback({ type: 'success', text: 'Procura cancelada.' });
          } catch (err) {
            setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
          } finally {
            setSavingProcura(false);
          }
        }}
      />
    </PageShell>
  );
};

export default PassengerDashboard;
