import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Clock, Users, Banknote } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AddressInput from '../components/AddressInput';
import TimeInput from '../components/TimeInput';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import FeedbackAlert from '../components/FeedbackAlert';
import LoadingSkeleton from '../components/LoadingSkeleton';
import GrupoProcuraPanel from '../components/GrupoProcuraPanel';
import GrupoDescobertaPanel from '../components/GrupoDescobertaPanel';
import OfertaMatchCard from '../components/OfertaMatchCard';
import PropostaReviewCard from '../components/PropostaReviewCard';
import {
  createProcura,
  createProcuraWithGrupo,
  listProcurasByOwner,
} from '../services/ProcuraService';
import { findCompatibleOfertas } from '../services/MatchingService';
import { listOfertasDisponiveis } from '../services/OfertaService';
import { getGrupoByProcura, listMembrosGrupo } from '../services/GrupoService';
import {
  createProposta,
  listPropostasByProcura,
  enrichPropostasForReview,
  rejectProposta,
  cancelProposta,
} from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';
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
import { DIAS_SEMANA, DIAS_UTEIS_DEFAULT } from '../utils/diasSemana';
import { getModoTetoPreferido, setModoTetoPreferido } from '../utils/procuraTetoPrefs';
import { resolveCapacityN } from '../utils/capacityGate.js';

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
 * Hub passageiro — procura, matches, inbox (B), enviadas + cancel, lista de espera.
 * Grupo = procura colectiva viva: N_proposto = N_actual no instante da proposta
 * (não exige «grupo completo» vs capacidade pretendida).
 */
const PassengerDashboard = () => {
  const { user } = useAuth();
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

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lista = await listProcurasByOwner(user.id);
      const activa = lista.find((p) => p.estado === 'activa' || p.estado === 'em_negociacao') || null;
      setProcura(activa);
      if (activa) {
        setLoadingInbox(true);
        try {
          const [g, enrolled, propostas] = await Promise.all([
            getGrupoByProcura(activa.id),
            listWaitlistByProcura(activa.id),
            listPropostasByProcura(activa.id),
          ]);
          setGrupo(g);
          setWaitlistEntries(enrolled);
          let membrosActivos = 0;
          if (g) {
            const membros = await listMembrosGrupo(g.id);
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
          setInboxReviews(enrichedInbox);
          setEnviadasReviews(enrichedEnviadas);
          setTerminadasRecebidas(enrichedTermR);
          setTerminadasEnviadas(enrichedTermE);
          const result = await findCompatibleOfertas({
            preferred_time: String(activa.preferred_time).slice(0, 5),
            origin_lat: Number(activa.origin_lat),
            origin_lng: Number(activa.origin_lng),
            destination_lat: Number(activa.destination_lat),
            destination_lng: Number(activa.destination_lng),
            n_candidato: nCapacidade,
            dias_semana: activa.dias_semana,
          });
          setMatches({ direct: result.direct, waitlist: result.waitlist });
        } finally {
          setLoadingInbox(false);
        }
      } else {
        setGrupo(null);
        setMembrosCount(0);
        setWaitlistEntries([]);
        setMatches({ direct: [], waitlist: [] });
        setInboxReviews([]);
        setEnviadasReviews([]);
        setTerminadasRecebidas([]);
        setTerminadasEnviadas([]);
        setLoadingInbox(false);
        setLoadingBrowse(true);
        try {
          const ofertas = await listOfertasDisponiveis();
          setBrowseOfertas(ofertas);
        } catch (err) {
          console.error(err);
          setBrowseOfertas([]);
          setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
        } finally {
          setLoadingBrowse(false);
        }
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

  const handleCriarProcura = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', text: '' });
    if (form.origin_lat == null || form.destination_lat == null) {
      setFeedback({
        type: 'error',
        text: 'Seleccione origem e destino na lista de sugestões.',
      });
      return;
    }
    if (!form.dias_semana?.length) {
      setFeedback({
        type: 'error',
        text: 'Selecciona pelo menos um dia da semana.',
      });
      return;
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
        return;
      }
    }
    try {
      const payload = {
        preferred_time: form.preferred_time,
        origin_name: form.origin_name,
        origin_lat: form.origin_lat,
        origin_lng: form.origin_lng,
        destination_name: form.destination_name,
        destination_lat: form.destination_lat,
        destination_lng: form.destination_lng,
        dias_semana: form.dias_semana,
        teto_mensal_kz: tetoNumero,
      };

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
      setView('matches');
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

  const handlePropor = async (oferta) => {
    if (!procura) {
      setFeedback({
        type: 'error',
        text: 'Cria uma procura com origem, destino e horário antes de propor acordo.',
      });
      setView('form');
      return;
    }
    setBusyId(oferta.id);
    setFeedback({ type: '', text: '' });

    const { nProposto, grupoId, erro } = resolverPropostaN();
    if (erro) {
      setFeedback({ type: 'error', text: erro });
      setBusyId(null);
      return;
    }

    try {
      await createProposta({
        oferta_id: oferta.id,
        procura_id: procura.id,
        grupo_id: grupoId,
        modo_preco: oferta.modo_preco,
        valor_mensal_ask_kz: oferta.valor_mensal_ask_kz,
        n_passageiros_propostos: nProposto,
      });
      setFeedback({ type: 'success', text: 'Proposta enviada ao motorista.' });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
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
    try {
      if (Array.isArray(memberIds) && memberIds.length > 0) {
        await createAgreementFromProposal(propostaId, { memberIds });
      } else {
        await createAgreementFromProposal(propostaId);
      }
      setFeedback({ type: 'success', text: 'Proposta aceite. Acordo criado.' });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

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

  return (
    <PageShell>
      <PageHeader
        title={
          view === 'form'
            ? 'Nova procura'
            : procura
              ? 'A minha procura'
              : 'Explorar'
        }
        subtitle={
          view === 'form'
            ? 'Define a tua rota diária casa–trabalho.'
            : procura
              ? 'Encontra ofertas compatíveis com o teu horário.'
              : 'Vê motoristas e grupos disponíveis. A procura filtra e permite propor acordo.'
        }
        {...(view !== 'hub'
          ? { onBack: () => setView(procura ? 'matches' : 'hub') }
          : {})}
      />

      {feedback.text ? (
        <FeedbackAlert
          type={feedback.type === 'success' ? 'success' : 'error'}
          text={feedback.text}
          data-testid="passenger-feedback"
        />
      ) : null}

      {loading && <LoadingSkeleton />}

      {!loading && view === 'hub' && !procura && (
        <div className="space-y-4">
          <section className="space-y-3" data-testid="browse-ofertas-feed">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-balance">Ofertas disponíveis</h2>
              <button
                type="button"
                className="text-sm font-bold text-primary shrink-0"
                onClick={() => setView('form')}
              >
                Criar procura
              </button>
            </div>
            <p className="text-sm text-slate-500 text-pretty">
              Motoristas com lugares publicados. Cria uma procura quando quiseres filtrar e propor acordo.
            </p>

            {loadingBrowse ? (
              <LoadingSkeleton />
            ) : browseOfertas.length === 0 ? (
              <p className="text-sm text-slate-500 text-pretty">
                Ainda não há ofertas publicadas. Volta mais tarde.
              </p>
            ) : (
              browseOfertas.map((oferta) => (
                <OfertaMatchCard
                  key={oferta.id}
                  oferta={oferta}
                  variant="browse"
                />
              ))
            )}
          </section>

          <GrupoDescobertaPanel userId={user.id} />
        </div>
      )}

      {!loading && view === 'form' && (
        <form onSubmit={handleCriarProcura} className="space-y-4 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm">
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
          >
            Guardar procura
          </button>
        </form>
      )}

      {!loading && procura && (view === 'hub' || view === 'matches') && (
        <div className="space-y-4">
          <section className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              {chipProcura && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${chipProcura.className}`}>
                  {chipProcura.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <span>{procura.origin_name}</span>
              <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
              <span>{procura.destination_name}</span>
            </div>
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
              onClick={() => setView('matches')}
            >
              Ver ofertas compatíveis
            </button>
          </section>

          <GrupoProcuraPanel
            procura={procura}
            userId={user.id}
            onGrupoChange={carregar}
          />

          <GrupoDescobertaPanel
            userId={user.id}
            excludeGrupoId={grupo?.id ?? null}
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
                    onPropor={() => handlePropor(oferta)}
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

          <section className="space-y-3">
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
                  onAceitar={(memberIds) => handleAceitarInbox(review.proposta.id, memberIds)}
                  onRecusar={() => handleRecusarInbox(review.proposta.id)}
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
            </section>
          )}

          {(view === 'matches' || view === 'hub') && (
            <>
              <h2 className="text-lg font-bold text-balance">Ofertas compatíveis</h2>
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
                  onPropor={() => handlePropor(oferta)}
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
    </PageShell>
  );
};

export default PassengerDashboard;
