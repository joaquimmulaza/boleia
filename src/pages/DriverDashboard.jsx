import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, AlertCircle, ArrowRight, Clock, Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  listOfertasByDriver,
  isOfertaFlexivel,
  labelOfertaRota,
  cancelOferta,
} from '../services/OfertaService';
import { getAgreementsForDriver } from '../services/AgreementService';
import {
  listPropostasByOferta,
  rejectProposta,
  cancelProposta,
  enrichPropostasForReview,
  createProposta,
} from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';
import { findCompatibleProcuras } from '../services/MatchingService';
import { getGrupoByProcura } from '../services/GrupoService';
import { getProcura } from '../services/ProcuraService';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PropostaReviewCard from '../components/PropostaReviewCard';
import { formatKwanza } from '../utils/formatKwanza';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { filterPropostasParaInbox, filterPropostasEnviadas, filterPropostasTerminadasRecebidas, filterPropostasTerminadasEnviadas } from '../utils/propostaInbox';
import { formatIdaRegresso, formatTime24h } from '../utils/formatTime';
import { canEditOferta, canDespublicarOferta } from '../utils/canEditOferta';
import ConfirmationModal from '../components/ConfirmationModal';
import OfertaEditPanel from '../components/OfertaEditPanel';

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

function labelProcuraN(n) {
  if (n === 1) return 'Individual';
  return `Grupo · ${n} pessoas`;
}

/**
 * Título da oferta na lista — flexível sem OD fictício.
 * @param {object} oferta
 */
function OfertaRotaTitulo({ oferta }) {
  const flexLabel = labelOfertaRota(oferta);
  if (flexLabel) {
    return (
      <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
        <span>{flexLabel}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
      <span>{oferta.origin_name}</span>
      <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
      <span>{oferta.destination_name}</span>
    </div>
  );
}

/**
 * Hub motorista — ofertas + rever/aceitar propostas (A) + propor a procuras (B).
 */
const DriverDashboard = () => {
  const navigate = useNavigate();
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
  const [procurasMatch, setProcurasMatch] = useState({ direct: [], waitlist: [] });
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
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ofertasActivas = useMemo(
    () => ofertas.filter((o) => o.estado !== 'inactiva'),
    [ofertas],
  );
  const ofertaSeleccionada =
    ofertasActivas.find((o) => o.id === selectedOfertaId) ||
    ofertas.find((o) => o.id === selectedOfertaId) ||
    null;

  const carregarProcurasMatch = useCallback(async (oferta) => {
    if (!oferta) {
      setProcurasMatch({ direct: [], waitlist: [] });
      return;
    }
    setLoadingProcuras(true);
    try {
      const result = await findCompatibleProcuras(oferta);
      setProcurasMatch({
        direct: result.direct || [],
        waitlist: result.waitlist || [],
      });
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoadingProcuras(false);
    }
  }, []);

  useEffect(() => {
    if (hubTab !== 'procuras' || isLoading || hasVehicle !== true) return;
    if (ofertasActivas.length === 0) {
      setProcurasMatch({ direct: [], waitlist: [] });
      return;
    }
    const alvo =
      ofertasActivas.find((o) => o.id === selectedOfertaId) || ofertasActivas[0];
    if (!ofertasActivas.some((o) => o.id === selectedOfertaId)) {
      setSelectedOfertaId(alvo.id);
      return;
    }
    void carregarProcurasMatch(alvo);
  }, [hubTab, isLoading, hasVehicle, selectedOfertaId, ofertasActivas, carregarProcurasMatch]);

  const handleVerPropostas = async (ofertaId, opts = {}) => {
    setSelectedOfertaId(ofertaId);
    setHubTab('ofertas');
    setDetailPanel('propostas');
    setReviews([]);
    setEnviadas([]);
    setTerminadasRecebidas([]);
    setTerminadasEnviadas([]);
    setProcurasMatch({ direct: [], waitlist: [] });
    setLoadingPropostas(true);
    if (!opts.preserveFeedback) {
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

  const handleVerProcuras = (oferta) => {
    setDetailPanel(null);
    setHubTab('procuras');
    setSelectedOfertaId(oferta.id);
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

  const handleProporB = async (procura) => {
    if (!ofertaSeleccionada) return;
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

      await createProposta({
        oferta_id: ofertaSeleccionada.id,
        procura_id: procura.id,
        grupo_id: grupoId,
        modo_preco: ofertaSeleccionada.modo_preco,
        valor_mensal_ask_kz: ofertaSeleccionada.valor_mensal_ask_kz,
        n_passageiros_propostos: nProposto,
      });
      setFeedback({ type: 'success', text: 'Proposta enviada ao passageiro.' });
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
      setFeedback({ type: 'success', text: 'Proposta aceite. Acordo criado.' });
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

  const handleRecusar = async (propostaId) => {
    setBusyId(propostaId);
    try {
      await rejectProposta(propostaId);
      setFeedback({ type: 'success', text: 'Proposta recusada.' });
      if (selectedOfertaId) {
        await handleVerPropostas(selectedOfertaId, { preserveFeedback: true });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const temAcordoActivo = (ofertaId) => ofertasComAcordoActivo.has(ofertaId);

  const handleStartEditOferta = async (ofertaId) => {
    setEditingOfertaId(ofertaId);
    setSelectedOfertaId(null);
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
          return (
            <section
              key={oferta.id}
              className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${chip.className}`}>
                    {chip.label}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {tipoRota}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{labelModo(oferta.modo_preco)}</span>
              </div>
              <OfertaRotaTitulo oferta={oferta} />
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock size={15} aria-hidden="true" /> {horario}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={15} aria-hidden="true" />{' '}
                  {oferta.vagas_disponiveis}{' '}
                  {oferta.vagas_disponiveis === 1 ? 'lugar disponível' : 'lugares disponíveis'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                <strong className="text-primary tabular-nums">
                  {formatKwanza(oferta.valor_mensal_ask_kz)} Kz
                </strong>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleVerProcuras(oferta)}
                    className="text-sm font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1"
                  >
                    Procuras compatíveis <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerPropostas(oferta.id)}
                    className="text-sm font-bold text-primary flex items-center gap-1"
                  >
                    Ver propostas <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {canEditOferta(oferta) ? (
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-50 dark:border-slate-800">
                  {editingOfertaId !== oferta.id ? (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={ofertaBusy}
                        onClick={() => handleStartEditOferta(oferta.id)}
                        className="w-full min-h-11 border border-slate-200 dark:border-slate-700 font-bold py-2.5 rounded-xl text-sm"
                      >
                        Editar oferta
                      </button>
                      {canDespublicarOferta(oferta, { temAcordoActivo: temAcordoActivo(oferta.id) }) ? (
                        <button
                          type="button"
                          disabled={ofertaBusy}
                          onClick={() => setConfirmDespublicarId(oferta.id)}
                          className="w-full min-h-11 text-red-600 dark:text-red-400 font-semibold py-2 text-sm"
                        >
                          Despublicar oferta
                        </button>
                      ) : temAcordoActivo(oferta.id) ? (
                        <p className="text-xs text-slate-500 text-pretty">
                          Com acordo activo, encerra o acordo em Acordos antes de despublicar.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <OfertaEditPanel
                      oferta={oferta}
                      busy={ofertaBusy}
                      propostas={editPropostas}
                      procurasById={editProcurasById}
                      onCancel={() => {
                        setEditingOfertaId(null);
                        setEditPropostas([]);
                        setEditProcurasById({});
                      }}
                      onSaved={handleOfertaSaved}
                    />
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      )}

      {hubTab === 'procuras' && hasVehicle === true && (
        <section className="space-y-4" data-testid="driver-procuras-grupos-section">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-balance">Procuras e grupos</h2>
            <p className="text-sm text-slate-500 text-pretty">
              Procuras e grupos compatíveis com a tua oferta. Envia proposta in-app — o passageiro aceita ou recusa.
            </p>
          </div>

          {ofertasActivas.length === 0 ? (
            <div
              className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
              data-testid="driver-procuras-empty-sem-oferta"
            >
              <p className="text-sm text-slate-600 dark:text-slate-300 text-pretty">
                Precisas de uma oferta activa publicada para ver procuras compatíveis e enviar propostas.
                O marketplace não é só «Publicar» — aqui encontras quem procura boleia no teu horário.
              </p>
              <button
                type="button"
                onClick={() => navigate('/publicar-trajeto')}
                className="bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2.5 px-4 rounded-lg"
              >
                Publicar oferta
              </button>
            </div>
          ) : (
            <>
              {ofertasActivas.length > 1 && (
                <div className="flex flex-wrap gap-2" data-testid="driver-procuras-oferta-picker">
                  {ofertasActivas.map((oferta) => {
                    const selected = oferta.id === selectedOfertaId;
                    const rotulo = isOfertaFlexivel(oferta)
                      ? 'Oferta flexível'
                      : `${oferta.origin_name || 'Origem'} → ${oferta.destination_name || 'Destino'}`;
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

              {ofertaSeleccionada && isOfertaFlexivel(ofertaSeleccionada) ? (
                <p className="text-sm text-slate-500 text-pretty">
                  Oferta flexível: matching por horário, dias e lugares — sem exigir origem/destino na tua oferta.
                </p>
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
              ) : procurasMatch.direct.length === 0 && procurasMatch.waitlist.length === 0 ? (
                <p className="text-sm text-slate-500" data-testid="driver-procuras-empty-match">
                  Ainda não há procuras ou grupos compatíveis com esta oferta.
                </p>
              ) : (
                <>
                  {procurasMatch.direct.map((procura) => (
                    <section
                      key={procura.id}
                      className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3"
                      data-testid="driver-procura-match-card"
                    >
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <span>{procura.origin_name || 'Origem'}</span>
                        <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
                        <span>{procura.destination_name || 'Destino'}</span>
                      </div>
                      <div className="flex gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={14} aria-hidden="true" />
                          {formatTime24h(procura.preferred_time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={14} aria-hidden="true" />
                          {labelProcuraN(procura.n_candidato ?? 1)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <strong className="text-primary tabular-nums">
                            {formatKwanza(ofertaSeleccionada?.valor_mensal_ask_kz)} Kz
                          </strong>
                          <p className="text-xs text-slate-400">
                            {labelModo(ofertaSeleccionada?.modo_preco)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyId === procura.id}
                          onClick={() => handleProporB(procura)}
                          className="bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-60"
                        >
                          Enviar proposta
                        </button>
                      </div>
                    </section>
                  ))}

                  {procurasMatch.waitlist.length > 0 && (
                    <div className="space-y-3 pt-2" data-testid="waitlist-bucket">
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                        Lista de espera
                      </h3>
                      <p className="text-sm text-slate-500 text-pretty">
                        Sem lugares suficientes agora. Estes grupos excedem os lugares
                        disponíveis — não podes enviar proposta directa.
                      </p>
                      {procurasMatch.waitlist.map((procura) => (
                        <section
                          key={procura.id}
                          className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3"
                        >
                          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                            <span>{procura.origin_name || 'Origem'}</span>
                            <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
                            <span>{procura.destination_name || 'Destino'}</span>
                          </div>
                          <div className="flex gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock size={14} aria-hidden="true" />
                              {formatTime24h(procura.preferred_time)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users size={14} aria-hidden="true" />
                              {labelProcuraN(procura.n_candidato ?? 1)}
                            </span>
                          </div>
                          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                            Grupo maior que os lugares disponíveis
                          </p>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {selectedOfertaId && detailPanel === 'propostas' && (
        <div className="mt-8 space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-balance">Rever propostas</h2>
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
            {loadingPropostas ? (
              <LoadingSkeleton />
            ) : reviews.length === 0 ? (
              <p className="text-sm text-slate-500">Não há propostas para rever nesta oferta.</p>
            ) : (
              reviews.map((review) => (
                <PropostaReviewCard
                  key={review.proposta.id}
                  review={review}
                  busy={busyId === review.proposta.id || loadingPropostas}
                  onAceitar={(memberIds) => handleAceitar(review.proposta.id, memberIds)}
                  onRecusar={() => handleRecusar(review.proposta.id)}
                />
              ))
            )}
          </div>

          {!loadingPropostas && enviadas.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-balance">Propostas enviadas</h2>
              <p className="text-sm text-slate-500 text-pretty">
                Propostas que enviaste aos passageiros. Podes cancelar enquanto estiverem abertas.
              </p>
              {enviadas.map((review) => (
                <PropostaReviewCard
                  key={review.proposta.id}
                  review={review}
                  modo="criador"
                  secao="enviadas"
                  busy={busyId === review.proposta.id || loadingPropostas}
                  onCancelar={() => handleCancelarEnviada(review.proposta.id)}
                />
              ))}
            </div>
          ) : null}

          {!loadingPropostas && (terminadasRecebidas.length > 0 || terminadasEnviadas.length > 0) ? (
            <div className="space-y-3" data-testid="propostas-terminadas">
              <h2 className="text-lg font-bold text-balance">Propostas concluídas</h2>
              <p className="text-sm text-slate-500 text-pretty">
                Aceites, recusadas ou canceladas — já não podes actuar sobre estas propostas.
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
            </div>
          ) : null}
        </div>
      )}

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
