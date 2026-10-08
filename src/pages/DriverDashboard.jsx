import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  listOfertasByDriver,
  isOfertaFlexivel,
  labelOfertaRota,
  cancelOferta,
  createOferta,
} from '../services/OfertaService';
import { getAgreementsForDriver } from '../services/AgreementService';
import {
  listPropostasByOferta,
  listOpenPropostasByCreator,
  rejectProposta,
  cancelProposta,
  enrichPropostasForReview,
  createProposta,
} from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';
import { findCompatibleProcuras } from '../services/MatchingService';
import { getGrupoByProcura } from '../services/GrupoService';
import { getProcura, listProcurasDisponiveis } from '../services/ProcuraService';
import { buildOfertaMinimaFromProcura, getPropostaDriverGaps } from '../utils/ofertaFromProcura';
import { notifyMarketplaceHubRefresh } from '../utils/marketplaceHubRefresh';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import OpportunityCard from '../components/OpportunityCard';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { filterPropostasParaInbox, filterPropostasEnviadas, filterPropostasTerminadasRecebidas, filterPropostasTerminadasEnviadas } from '../utils/propostaInbox';
import { formatIdaRegresso, formatTime24h } from '../utils/formatTime';
import { labelOfertaPicker } from '../utils/ofertaLabels';
import { canEditOferta, canDespublicarOferta } from '../utils/canEditOferta';
import ConfirmationModal from '../components/ConfirmationModal';
import OverlayShell from '../components/OverlayShell';
import DriverOfertaCard from '../components/DriverOfertaCard';
import ProposalSheet from '../components/ProposalSheet';
import PropostaDetailSheet from '../components/PropostaDetailSheet';
import OfertaDetailSheet from '../components/OfertaDetailSheet';
import { OfertaRotaTitulo } from '../components/DriverOfertaCard';
import PropostaValorInput from '../components/PropostaValorInput';
import OpportunityProposalSheet from '../components/OpportunityProposalSheet';
import { parseValorPropostaKz, validarValorPropostaKz } from '../utils/propostaValor.js';
import { FEEDBACK_PROPOSTA_ENVIADA_PASSAGEIRO } from '../utils/propostaFeedback';

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

function labelTipoRota(oferta) {
  return isOfertaFlexivel(oferta) ? 'Flexível' : 'Fixa';
}

/**
 * Procura de uma pessoa ou grupo. Não trata 0/null — o cartão já resolve isso.
 * @param {object} procura
 * @returns {'procura' | 'grupo'}
 */
function kindDaProcura(procura) {
  const n = Number(procura?.n_candidato);
  return Number.isFinite(n) && n > 1 ? 'grupo' : 'procura';
}

/**
 * Preço da oferta seleccionada, no rodapé do cartão.
 * @param {object | null | undefined} oferta
 * @returns {{ valor: string, modo: string } | undefined}
 */
function precoDaOferta(oferta) {
  if (!oferta) return undefined;
  return {
    valor: `${formatKwanza(oferta.valor_mensal_ask_kz)} Kz`,
    modo: labelModo(oferta.modo_preco),
  };
}

/**
 * N>1 no hub é grupo. O sheet mostra esse snapshot e não o edita.
 * @param {object} procura
 * @returns {'grupo' | 'passageiro'}
 */
function alvoPropostaHub(procura) {
  return Number(procura?.n_candidato) > 1 ? 'grupo' : 'passageiro';
}

/**
 * Título legível da oferta para resumos (sheet, detalhe).
 * @param {object} oferta
 */
function tituloOfertaLabel(oferta) {
  const flex = labelOfertaRota(oferta);
  if (flex) return flex;
  return `${oferta.origin_name || 'Origem'} → ${oferta.destination_name || 'Destino'}`;
}

/**
 * Hub motorista — ofertas + rever/aceitar propostas (A) + propor a procuras (B).
 */
const DriverDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingPropostaDeepLinkRef = useRef(null);
  const propostaDeepLinkHandledRef = useRef(false);
  const { user } = useAuth();
  const [hasVehicle, setHasVehicle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ofertas, setOfertas] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [enviadas, setEnviadas] = useState([]);
  const [terminadasRecebidas, setTerminadasRecebidas] = useState([]);
  const [terminadasEnviadas, setTerminadasEnviadas] = useState([]);
  const [selectedOfertaId, setSelectedOfertaId] = useState(null);
  const [hubTab, setHubTab] = useState('ofertas'); // 'ofertas' | 'procuras'
  const [detailPanel, setDetailPanel] = useState(null); // 'propostas' | null
  const [todasProcuras, setTodasProcuras] = useState([]);
  const [sóCompatíveis, setSóCompatíveis] = useState(false);
  const [procurasMatch, setProcurasMatch] = useState({ direct: [], waitlist: [], incompatible: [] });
  const [loadingPropostas, setLoadingPropostas] = useState(false);
  const [loadingProcuras, setLoadingProcuras] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [busyId, setBusyId] = useState(null);
  const [ofertasComAcordoActivo, setOfertasComAcordoActivo] = useState(() => new Set());
  const [editingOfertaId, setEditingOfertaId] = useState(null);
  const [confirmDespublicarId, setConfirmDespublicarId] = useState(null);
  const [ofertaBusy, setOfertaBusy] = useState(false);
  const [editPropostas, setEditPropostas] = useState([]);
  const [editProcurasById, setEditProcurasById] = useState({});
  /** @type {[Set<string>, Function]} */
  const [procurasComPropostaEnviada, setProcurasComPropostaEnviada] = useState(() => new Set());
  /** @type {[null | { procura: object, valor_mensal_ask_kz: string, modo_preco?: string, sheetOportunidade?: boolean }, Function]} */
  const [proporSheet, setProporSheet] = useState(null);
  /** @type {[null | { propostaId: string, oferta_id: string, procura_id: string, grupo_id?: string | null, modo_preco: string, n_passageiros_propostos: number, valor_mensal_ask_kz: string, precoPublicadoKz?: number | null }, Function]} */
  const [contraPropostaSheet, setContraPropostaSheet] = useState(null);
  /** @type {[Set<string>, Function]} ids de propostas recebidas com contra-proposta enviada nesta sessão */
  const [contraPropostaFeitaIds, setContraPropostaFeitaIds] = useState(() => new Set());
  /** @type {[string | null, Function]} */
  const [ofertaDetailId, setOfertaDetailId] = useState(null);
  /** @type {[null | import('../components/PropostaReviewCard').PropostaReview, Function]} */
  const [selectedReview, setSelectedReview] = useState(null);

  /**
   * @param {{ silent?: boolean }} [options]
   */
  const carregar = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!user?.id) {
      if (!silent) setIsLoading(false);
      return;
    }
    if (!silent) setIsLoading(true);
    try {
      const { data: veiculosData } = await supabase
        .from('veiculos')
        .select('id')
        .eq('id_motorista', user.id);

      setHasVehicle(Boolean(veiculosData && veiculosData.length > 0));

      const [lista, acordos] = await Promise.all([
        listOfertasByDriver(user.id),
        getAgreementsForDriver(user.id),
      ]);
      setOfertas(lista);
      const activos = new Set(
        (acordos || [])
          .filter((a) => {
            const e = String(a?.estado || '').toLowerCase();
            return e === 'activo' || e === 'cancelamento_pendente';
          })
          .map((a) => a.oferta_id)
          .filter(Boolean),
      );
      setOfertasComAcordoActivo(activos);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      if (!silent) setIsLoading(false);
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
      pendingPropostaDeepLinkRef.current = {
        openOfertaId: openOfertaId || null,
        propostaId: propostaId || null,
      };
    }
  }, [location.search]);

  const ofertasActivas = useMemo(
    () => ofertas.filter((o) => o.estado !== 'inactiva'),
    [ofertas],
  );
  const ofertaSeleccionada =
    ofertasActivas.find((o) => o.id === selectedOfertaId) ||
    ofertas.find((o) => o.id === selectedOfertaId) ||
    null;

  const carregarProcurasHub = useCallback(async (oferta) => {
    setLoadingProcuras(true);
    try {
      const todas = await listProcurasDisponiveis();
      setTodasProcuras(todas);

      if (oferta) {
        const [result, propostasOferta] = await Promise.all([
          findCompatibleProcuras(oferta),
          listPropostasByOferta(oferta.id),
        ]);
        setProcurasMatch({
          direct: result.direct || [],
          waitlist: result.waitlist || [],
          incompatible: result.incompatible || [],
        });
        const enviadas = filterPropostasEnviadas(propostasOferta, user?.id);
        setProcurasComPropostaEnviada(
          new Set(enviadas.map((p) => p.procura_id).filter(Boolean)),
        );
      } else {
        setProcurasMatch({ direct: [], waitlist: [], incompatible: [] });
        const abertas = user?.id ? await listOpenPropostasByCreator(user.id) : [];
        setProcurasComPropostaEnviada(
          new Set(abertas.map((p) => p.procura_id).filter(Boolean)),
        );
      }
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoadingProcuras(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (hubTab !== 'procuras' || isLoading || hasVehicle !== true) return;
    if (ofertasActivas.length === 0) {
      void carregarProcurasHub(null);
      return;
    }
    const alvo =
      ofertasActivas.find((o) => o.id === selectedOfertaId) || ofertasActivas[0];
    if (!ofertasActivas.some((o) => o.id === selectedOfertaId)) {
      setSelectedOfertaId(alvo.id);
      return;
    }
    void carregarProcurasHub(alvo);
  }, [hubTab, isLoading, hasVehicle, selectedOfertaId, ofertasActivas, carregarProcurasHub]);

  useEffect(() => {
    if (ofertasActivas.length === 0 && sóCompatíveis) {
      setSóCompatíveis(false);
    }
  }, [ofertasActivas.length, sóCompatíveis]);

  const matchDirectIds = useMemo(
    () => new Set(procurasMatch.direct.map((p) => p.id)),
    [procurasMatch.direct],
  );
  const matchWaitlistIds = useMemo(
    () => new Set(procurasMatch.waitlist.map((p) => p.id)),
    [procurasMatch.waitlist],
  );

  const procurasVisiveis = useMemo(() => {
    if (sóCompatíveis) {
      return [...procurasMatch.direct, ...procurasMatch.waitlist];
    }
    return todasProcuras;
  }, [sóCompatíveis, todasProcuras, procurasMatch.direct, procurasMatch.waitlist]);

  const handleVerPropostas = async (ofertaId, opts = {}) => {
    const { preserveFeedback = false, silent = false } = opts;
    if (!silent) {
      setSelectedOfertaId(ofertaId);
      setHubTab('ofertas');
      setDetailPanel('propostas');
      setReviews([]);
      setEnviadas([]);
      setTerminadasRecebidas([]);
      setTerminadasEnviadas([]);
      setProcurasMatch({ direct: [], waitlist: [], incompatible: [] });
      setTodasProcuras([]);
      setLoadingPropostas(true);
    }
    if (!preserveFeedback && !silent) {
      setFeedback({ type: '', text: '' });
    }
    try {
      const lista = await listPropostasByOferta(ofertaId);
      const inbox = filterPropostasParaInbox(lista, user?.id);
      const minhas = filterPropostasEnviadas(lista, user?.id);
      const termRecebidas = filterPropostasTerminadasRecebidas(lista, user?.id);
      const termEnviadas = filterPropostasTerminadasEnviadas(lista, user?.id);
      const [enrichedInbox, enrichedEnviadas, enrichedTermR, enrichedTermE] = await Promise.all([
        enrichPropostasForReview(inbox),
        enrichPropostasForReview(minhas),
        enrichPropostasForReview(termRecebidas),
        enrichPropostasForReview(termEnviadas),
      ]);
      setReviews(enrichedInbox);
      setEnviadas(enrichedEnviadas);
      setTerminadasRecebidas(enrichedTermR);
      setTerminadasEnviadas(enrichedTermE);
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoadingPropostas(false);
    }
  };

  useEffect(() => {
    const pending = pendingPropostaDeepLinkRef.current;
    if (
      propostaDeepLinkHandledRef.current
      || !pending?.openOfertaId
      || isLoading
      || hasVehicle !== true
    ) {
      return undefined;
    }

    const ofertaExists = ofertas.some((o) => o.id === pending.openOfertaId);
    if (!ofertaExists) return undefined;

    const target = { ...pending };
    pendingPropostaDeepLinkRef.current = null;
    propostaDeepLinkHandledRef.current = true;

    void handleVerPropostas(target.openOfertaId, { preserveFeedback: true }).then(() => {
      if (!target.propostaId) return;
      requestAnimationFrame(() => {
        document.querySelector(`[data-proposta-id="${target.propostaId}"]`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    });
    return undefined;
    // handleVerPropostas é estável o suficiente para deep link único no mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasVehicle, ofertas]);

  const handleVerProcuras = (oferta, { sóCompatíveis: filtrarCompatíveis = true } = {}) => {
    setDetailPanel(null);
    setHubTab('procuras');
    setSelectedOfertaId(oferta.id);
    setSóCompatíveis(filtrarCompatíveis);
    setReviews([]);
    setEnviadas([]);
    setTerminadasRecebidas([]);
    setTerminadasEnviadas([]);
    setFeedback({ type: '', text: '' });
  };

  const handleSeleccionarOfertaProcuras = (ofertaId) => {
    setSelectedOfertaId(ofertaId);
    setFeedback({ type: '', text: '' });
  };

  /** @param {object} procura */
  const openProporSheet = (procura) => {
    if (procurasComPropostaEnviada.has(procura.id)) return;
    const valor = String(ofertaSeleccionada?.valor_mensal_ask_kz ?? '');
    setProporSheet({
      procura,
      valor_mensal_ask_kz: valor,
      modo_preco: ofertaSeleccionada?.modo_preco ?? 'POR_PASSAGEIRO',
      sheetOportunidade: Number(valor) > 0,
    });
  };

  const handleProporSheetSubmit = async (e) => {
    e?.preventDefault?.();
    if (!proporSheet) return;

    const valorParsed = parseValorPropostaKz(proporSheet.valor_mensal_ask_kz);
    const valorCheck = validarValorPropostaKz(valorParsed);
    if (!valorCheck.ok) {
      setFeedback({ type: 'error', text: valorCheck.erro });
      return;
    }

    if (
      !ofertaSeleccionada &&
      getPropostaDriverGaps({ valor_mensal_ask_kz: valorCheck.valor }).length > 0
    ) {
      setFeedback({ type: 'error', text: 'Indica um valor mensal válido em Kz.' });
      return;
    }

    const procura = proporSheet.procura;
    if (procurasComPropostaEnviada.has(procura.id) || busyId === procura.id) return;

    setBusyId(procura.id);
    setFeedback({ type: '', text: '' });
    try {
      const nProposto = procura.n_candidato ?? 1;
      let grupoId = null;
      if (nProposto > 1) {
        const grupo = await getGrupoByProcura(procura.id);
        if (!grupo?.id) {
          setFeedback({
            type: 'error',
            text: 'Esta procura precisa de um grupo para propor com mais de uma pessoa.',
          });
          return;
        }
        grupoId = grupo.id;
      }

      let ofertaParaProposta = ofertaSeleccionada;
      if (!ofertaParaProposta) {
        const payload = buildOfertaMinimaFromProcura(procura, {
          modo_preco: proporSheet.modo_preco || 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: valorCheck.valor,
        });
        ofertaParaProposta = await createOferta(payload);
        setOfertas((prev) => [ofertaParaProposta, ...prev]);
        setSelectedOfertaId(ofertaParaProposta.id);
      }

      await createProposta({
        oferta_id: ofertaParaProposta.id,
        procura_id: procura.id,
        grupo_id: grupoId,
        modo_preco: ofertaParaProposta.modo_preco,
        valor_mensal_ask_kz: valorCheck.valor,
        n_passageiros_propostos: nProposto,
      });
      setProcurasComPropostaEnviada((prev) => new Set(prev).add(procura.id));
      setProporSheet(null);
      setFeedback({ type: 'success', text: FEEDBACK_PROPOSTA_ENVIADA_PASSAGEIRO });
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const handleAceitar = async (propostaId, memberIds) => {
    setBusyId(propostaId);
    setFeedback({ type: '', text: '' });
    try {
      if (Array.isArray(memberIds) && memberIds.length > 0) {
        await createAgreementFromProposal(propostaId, { memberIds });
      } else {
        await createAgreementFromProposal(propostaId);
      }
      setSelectedReview(null);
      setFeedback({ type: 'success', text: 'Proposta aceite. Acordo criado.' });
      if (selectedOfertaId) {
        await handleVerPropostas(selectedOfertaId, { preserveFeedback: true, silent: true });
      }
      await carregar({ silent: true });
      notifyMarketplaceHubRefresh();
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
      setSelectedReview(null);
      setFeedback({ type: 'success', text: 'Proposta recusada.' });
      if (selectedOfertaId) {
        await handleVerPropostas(selectedOfertaId, { preserveFeedback: true });
      }
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Enviada aberta do motorista para o par (oferta, procura).
   * @param {{ oferta_id: string, procura_id: string }} par
   */
  const findEnviadaAberta = ({ oferta_id, procura_id }) =>
    enviadas.find(
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
    setSelectedReview(null);
    setContraPropostaSheet({
      propostaId: proposta.id,
      oferta_id: proposta.oferta_id || selectedOfertaId,
      procura_id: proposta.procura_id,
      grupo_id: proposta.grupo_id ?? null,
      modo_preco: proposta.modo_preco,
      n_passageiros_propostos: proposta.n_passageiros_propostos ?? 1,
      valor_mensal_ask_kz: String(proposta.valor_mensal_ask_kz ?? ''),
      precoPublicadoKz: ofertaSeleccionada?.valor_mensal_ask_kz ?? null,
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
      setProcurasComPropostaEnviada((prev) => new Set(prev).add(contraPropostaSheet.procura_id));
      setFeedback({ type: 'success', text: FEEDBACK_PROPOSTA_ENVIADA_PASSAGEIRO });
      if (selectedOfertaId) {
        await handleVerPropostas(selectedOfertaId, { preserveFeedback: true });
      }
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const temAcordoActivo = (ofertaId) => ofertasComAcordoActivo.has(ofertaId);

  const sheetReviews = useMemo(
    () => [...reviews, ...enviadas, ...terminadasRecebidas, ...terminadasEnviadas],
    [reviews, enviadas, terminadasRecebidas, terminadasEnviadas],
  );

  const ofertaDetalhe = ofertaDetailId
    ? ofertas.find((o) => o.id === ofertaDetailId) || null
    : null;

  /** @param {import('../components/PropostaReviewCard').PropostaReview} review */
  const resolveReviewDetailMeta = (review) => {
    const id = review.proposta.id;
    if (terminadasRecebidas.some((r) => r.proposta.id === id)) {
      return { modo: /** @type {const} */ ('historico'), secao: /** @type {const} */ ('recebidas') };
    }
    if (terminadasEnviadas.some((r) => r.proposta.id === id)) {
      return { modo: /** @type {const} */ ('historico'), secao: /** @type {const} */ ('enviadas') };
    }
    if (enviadas.some((r) => r.proposta.id === id)) {
      return { modo: /** @type {const} */ ('criador'), secao: /** @type {const} */ ('enviadas') };
    }
    return { modo: /** @type {const} */ ('contraparte'), secao: /** @type {const} */ ('recebidas') };
  };

  const closePropostasFlow = () => {
    setDetailPanel(null);
    setSelectedReview(null);
    setFeedback({ type: '', text: '' });
  };

  const handleStartEditOferta = async (ofertaId) => {
    setEditingOfertaId(ofertaId);
    setOfertaDetailId(null);
    setSelectedReview(null);
    setDetailPanel(null);
    setEditPropostas([]);
    setEditProcurasById({});
    try {
      const propostas = await listPropostasByOferta(ofertaId);
      setEditPropostas(propostas);
      const procuraIds = [...new Set(propostas.map((p) => p.procura_id).filter(Boolean))];
      if (procuraIds.length === 0) return;
      const procuras = await Promise.all(procuraIds.map((id) => getProcura(id)));
      setEditProcurasById(
        Object.fromEntries(procuras.filter(Boolean).map((p) => [p.id, p])),
      );
    } catch (err) {
      console.warn('Falha ao carregar propostas para preview de edição:', err);
    }
  };

  const handleDespublicar = async (ofertaId) => {
    setOfertaBusy(true);
    setFeedback({ type: '', text: '' });
    try {
      await cancelOferta(ofertaId);
      setConfirmDespublicarId(null);
      setEditingOfertaId(null);
      setFeedback({ type: 'success', text: 'Oferta despublicada.' });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setOfertaBusy(false);
    }
  };

  const handleOfertaSaved = async (actualizada) => {
    setEditingOfertaId(null);
    setFeedback({ type: 'success', text: 'Oferta actualizada.' });
    await carregar();
    if (selectedOfertaId === actualizada?.id) {
      await handleVerPropostas(actualizada.id, { preserveFeedback: true });
    }
  };

  const handleCancelarEnviada = async (propostaId) => {
    setBusyId(propostaId);
    setFeedback({ type: '', text: '' });
    try {
      await cancelProposta(propostaId);
      setSelectedReview(null);
      setFeedback({ type: 'success', text: 'Proposta cancelada.' });
      if (selectedOfertaId) {
        await handleVerPropostas(selectedOfertaId, { preserveFeedback: true });
      }
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="As minhas ofertas"
        subtitle="Acompanha as tuas viagens e propostas."
        {...(hasVehicle === true
          ? {
              actionLabel: 'Publicar oferta',
              onAction: () => navigate('/publicar-trajeto'),
            }
          : {})}
      />

      {feedback.text && !selectedOfertaId && hubTab === 'ofertas' && !detailPanel && (
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

      {!isLoading && hasVehicle === false && (
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
                className="mt-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2.5 px-4 rounded-lg"
              >
                Registar veículo
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && <LoadingSkeleton />}

      {!isLoading && hasVehicle === true && (
        <div
          className="mb-6 flex gap-2 border-b border-slate-100 dark:border-slate-800"
          data-testid="driver-hub-tabs"
          role="tablist"
          aria-label="Secções do hub motorista"
        >
          <button
            type="button"
            role="tab"
            aria-selected={hubTab === 'ofertas'}
            onClick={() => {
              setHubTab('ofertas');
              setDetailPanel(null);
            }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              hubTab === 'ofertas'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            As minhas ofertas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={hubTab === 'procuras'}
            onClick={() => {
              setDetailPanel(null);
              setHubTab('procuras');
            }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
              hubTab === 'procuras'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Procuras e grupos
          </button>
        </div>
      )}

      {hubTab === 'ofertas' && !isLoading && ofertas.length === 0 && hasVehicle === true && (
        <EmptyState
          icon={MapPin}
          title="Ainda sem ofertas"
          message="Publica a tua primeira oferta de capacidade. Depois vê procuras compatíveis no separador «Procuras e grupos»."
          actionLabel="Publicar oferta"
          onAction={() => navigate('/publicar-trajeto')}
        />
      )}

      {hubTab === 'ofertas' && (
      <div className="space-y-4">
        {ofertas.map((oferta) => {
          const chip = estadoChip(oferta.estado);
          const horario = formatIdaRegresso(oferta.departure_time, oferta.return_time);
          const tipoRota = labelTipoRota(oferta);
          const podeDespublicar = canDespublicarOferta(oferta, {
            temAcordoActivo: temAcordoActivo(oferta.id),
          });
          return (
            <DriverOfertaCard
              key={oferta.id}
              oferta={oferta}
              chip={chip}
              horario={horario}
              tipoRota={tipoRota}
              modoLabel={labelModo(oferta.modo_preco)}
              canEdit={canEditOferta(oferta)}
              canDespublicar={podeDespublicar}
              editing={editingOfertaId === oferta.id}
              ofertaBusy={ofertaBusy}
              editPropostas={editPropostas}
              editProcurasById={editProcurasById}
              temAcordoActivoMsg={canEditOferta(oferta) && !podeDespublicar && temAcordoActivo(oferta.id)}
              onOpenDetail={() => setOfertaDetailId(oferta.id)}
              onVerProcuras={() => handleVerProcuras(oferta, { sóCompatíveis: true })}
              onVerPropostas={() => handleVerPropostas(oferta.id)}
              onEditar={() => handleStartEditOferta(oferta.id)}
              onDespublicar={() => setConfirmDespublicarId(oferta.id)}
              onCancelEdit={() => {
                setEditingOfertaId(null);
                setEditPropostas([]);
                setEditProcurasById({});
              }}
              onSaved={handleOfertaSaved}
            />
          );
        })}
      </div>
      )}

      {hubTab === 'procuras' && hasVehicle === true && (
        <section className="space-y-4" data-testid="driver-procuras-grupos-section">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-balance">Procuras e grupos</h2>
            <p className="text-sm text-slate-500 text-pretty">
              {ofertasActivas.length === 0
                ? 'Todas as procuras e grupos visíveis no marketplace. Podes enviar proposta sem oferta prévia — criamos uma oferta flexível mínima ao confirmar.'
                : sóCompatíveis
                  ? 'Procuras e grupos compatíveis com a tua oferta. Envia proposta in-app — o passageiro aceita ou recusa.'
                  : 'Todas as procuras e grupos visíveis no marketplace. Envia proposta in-app quando houver compatibilidade com a tua oferta.'}
            </p>
          </div>

          {ofertasActivas.length > 1 && (
            <div className="flex flex-wrap gap-2" data-testid="driver-procuras-oferta-picker">
              {ofertasActivas.map((oferta) => {
                const selected = oferta.id === selectedOfertaId;
                const rotulo = labelOfertaPicker(oferta, formatTime24h);
                return (
                  <button
                    key={oferta.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleSeleccionarOfertaProcuras(oferta.id)}
                    className={`text-xs font-bold px-3 py-2 rounded-lg border ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {rotulo}
                  </button>
                );
              })}
            </div>
          )}

          {ofertaSeleccionada &&
          isOfertaFlexivel(ofertaSeleccionada) &&
          ofertasActivas.length === 1 ? (
            <p className="text-sm text-slate-500 text-pretty">
              Oferta flexível: matching por horário, dias e lugares — sem exigir origem/destino na tua oferta.
            </p>
          ) : null}

          {ofertasActivas.length > 0 ? (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={sóCompatíveis}
                onChange={(e) => {
                  setSóCompatíveis(e.target.checked);
                  setFeedback({ type: '', text: '' });
                }}
                data-testid="driver-procuras-só-compatíveis"
                className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Só compatíveis com a minha oferta
            </label>
          ) : null}

          {feedback.text && (
            <div
              role="alert"
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {loadingProcuras ? (
            <LoadingSkeleton />
          ) : !sóCompatíveis && todasProcuras.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid="driver-procuras-empty-todas">
              Ainda não há procuras ou grupos no marketplace.
            </p>
          ) : sóCompatíveis && procurasVisiveis.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid="driver-procuras-empty-filtrado">
              Ainda não há procuras ou grupos compatíveis com esta oferta.
            </p>
          ) : (
            <>
              {procurasVisiveis
                .filter((procura) => !matchWaitlistIds.has(procura.id))
                .map((procura) => {
                  const isDirect =
                    !ofertaSeleccionada || matchDirectIds.has(procura.id);
                  const enviada = isDirect && procurasComPropostaEnviada.has(procura.id);
                  const podePropor = isDirect && !enviada;
                  const incompativel = Boolean(ofertaSeleccionada) && !isDirect && !sóCompatíveis;
                  const mostrarCta = podePropor || incompativel || enviada;
                  return (
                    <div key={procura.id} data-testid="driver-procura-match-card">
                      <OpportunityCard
                        kind={kindDaProcura(procura)}
                        item={procura}
                        nota={incompativel ? 'Sem compatibilidade com esta oferta' : undefined}
                        ctaDisabled={!podePropor || busyId === procura.id}
                        ctaLabel={enviada ? 'Proposta enviada' : undefined}
                        preco={precoDaOferta(ofertaSeleccionada)}
                        onCta={mostrarCta ? () => { if (podePropor) openProporSheet(procura); } : undefined}
                      />
                    </div>
                  );
                })}

              {procurasVisiveis.some((p) => matchWaitlistIds.has(p.id)) ? (
                <div className="space-y-3 pt-2" data-testid="waitlist-bucket">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                    Lista de espera
                  </h3>
                  <p className="text-sm text-slate-500 text-pretty">
                    Sem lugares suficientes agora. Estes grupos excedem os lugares
                    disponíveis — não podes enviar proposta directa.
                  </p>
                  {procurasVisiveis
                    .filter((procura) => matchWaitlistIds.has(procura.id))
                    .map((procura) => (
                      <div key={procura.id} className="space-y-2">
                        <OpportunityCard
                          kind={kindDaProcura(procura)}
                          item={procura}
                        />
                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                          Grupo maior que os lugares disponíveis
                        </p>
                      </div>
                    ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      )}

      {feedback.text && detailPanel === 'propostas' && !selectedReview ? (
        <div
          role="alert"
          className={`fixed bottom-24 left-4 right-4 z-modal mx-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {selectedOfertaId && detailPanel === 'propostas' && ofertaSeleccionada && !selectedReview ? (
        <ProposalSheet
          tituloOferta={tituloOfertaLabel(ofertaSeleccionada)}
          horario={formatIdaRegresso(ofertaSeleccionada.departure_time, ofertaSeleccionada.return_time)}
          reviews={sheetReviews}
          summaryCounts={{
            recebidas: reviews.length,
            enviadas: enviadas.length,
            concluidas: terminadasRecebidas.length + terminadasEnviadas.length,
          }}
          loading={loadingPropostas}
          onClose={closePropostasFlow}
          onVerReview={setSelectedReview}
        />
      ) : null}

      {selectedReview && ofertaSeleccionada ? (
        (() => {
          const meta = resolveReviewDetailMeta(selectedReview);
          return (
            <PropostaDetailSheet
              review={selectedReview}
              busy={busyId === selectedReview.proposta.id || loadingPropostas}
              precoPublicadoKz={ofertaSeleccionada.valor_mensal_ask_kz ?? null}
              modo={meta.modo}
              secao={meta.secao}
              onClose={() => setSelectedReview(null)}
              onAceitar={
                meta.modo === 'contraparte'
                  ? (memberIds) => handleAceitar(selectedReview.proposta.id, memberIds)
                  : undefined
              }
              onRecusar={
                meta.modo === 'contraparte'
                  ? () => handleRecusar(selectedReview.proposta.id)
                  : undefined
              }
              onCancelar={
                meta.modo === 'criador'
                  ? () => handleCancelarEnviada(selectedReview.proposta.id)
                  : undefined
              }
              onContraProposta={
                meta.modo === 'contraparte' && !jaEnviouContraProposta(selectedReview)
                  ? () => handleAbrirContraProposta(selectedReview)
                  : undefined
              }
            />
          );
        })()
      ) : null}

      {ofertaDetalhe ? (
        <OfertaDetailSheet
          oferta={ofertaDetalhe}
          tituloRota={<OfertaRotaTitulo oferta={ofertaDetalhe} />}
          horario={formatIdaRegresso(ofertaDetalhe.departure_time, ofertaDetalhe.return_time)}
          chipLabel={estadoChip(ofertaDetalhe.estado).label}
          chipClassName={estadoChip(ofertaDetalhe.estado).className}
          tipoRota={labelTipoRota(ofertaDetalhe)}
          modoLabel={labelModo(ofertaDetalhe.modo_preco)}
          onClose={() => setOfertaDetailId(null)}
          onVerProcuras={() => {
            setOfertaDetailId(null);
            handleVerProcuras(ofertaDetalhe, { sóCompatíveis: true });
          }}
          onVerPropostas={() => {
            setOfertaDetailId(null);
            handleVerPropostas(ofertaDetalhe.id);
          }}
        />
      ) : null}

      {proporSheet?.sheetOportunidade ? (
        <OpportunityProposalSheet
          papel="motorista"
          alvo={alvoPropostaHub(proporSheet.procura)}
          item={proporSheet.procura}
          nProposto={proporSheet.procura.n_candidato ?? 1}
          valorKz={Number(proporSheet.valor_mensal_ask_kz)}
          modoPreco={proporSheet.modo_preco || 'POR_PASSAGEIRO'}
          onClose={() => setProporSheet(null)}
          onSubmit={() => {
            void handleProporSheetSubmit();
          }}
        />
      ) : proporSheet ? (
        <OverlayShell
          variant="bottom"
          overlayClassName="bg-slate-900/60 dark:bg-black/80"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-5 pt-4 space-y-4"
          testId="driver-propor-sheet"
          onDismiss={() => setProporSheet(null)}
        >
          <div className="space-y-4">
            <div className="flex h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white text-balance">
              Confirmar proposta
            </h2>
            <p className="text-sm text-slate-500 text-pretty">
              Revê o valor mensal — podes propor outro preço antes de enviar ao passageiro.
            </p>
            <form onSubmit={handleProporSheetSubmit} className="space-y-4">
              <PropostaValorInput
                modoPreco={proporSheet.modo_preco || ofertaSeleccionada?.modo_preco || 'POR_PASSAGEIRO'}
                value={proporSheet.valor_mensal_ask_kz}
                askKz={ofertaSeleccionada?.valor_mensal_ask_kz ?? null}
                disabled={busyId === proporSheet.procura.id}
                onChange={(e) =>
                  setProporSheet((prev) =>
                    prev ? { ...prev, valor_mensal_ask_kz: e.target.value } : prev,
                  )
                }
              />
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
                  disabled={busyId === proporSheet.procura.id}
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
        isOpen={Boolean(confirmDespublicarId)}
        title="Despublicar oferta?"
        message="A oferta deixa de aparecer no marketplace. Propostas abertas serão canceladas; acordos existentes mantêm-se."
        confirmText="Despublicar"
        onConfirm={() => handleDespublicar(confirmDespublicarId)}
        onCancel={() => setConfirmDespublicarId(null)}
        busy={ofertaBusy}
      />
    </PageShell>
  );
};

export default DriverDashboard;
