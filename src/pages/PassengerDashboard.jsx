import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Clock, Users, MapPin, Banknote } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AddressInput from '../components/AddressInput';
import PageHeader from '../components/PageHeader';
import PageShell from '../components/PageShell';
import EmptyState from '../components/EmptyState';
import FeedbackAlert from '../components/FeedbackAlert';
import LoadingSkeleton from '../components/LoadingSkeleton';
import GrupoProcuraPanel from '../components/GrupoProcuraPanel';
import GrupoDescobertaPanel from '../components/GrupoDescobertaPanel';
import OfertaMatchCard from '../components/OfertaMatchCard';
import PropostaReviewCard from '../components/PropostaReviewCard';
import { createProcura, listProcurasByOwner } from '../services/ProcuraService';
import { findCompatibleOfertas } from '../services/MatchingService';
import {
  createProposta,
  listPropostasByProcura,
  enrichPropostasForReview,
  rejectProposta,
  cancelProposta,
} from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';
import { enqueueWaitlist, listWaitlistByProcura } from '../services/WaitlistService';
import { getGrupoByProcura, listMembrosGrupo } from '../services/GrupoService';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { formatKwanza } from '../utils/formatKwanza';
import {
  filterPropostasParaInbox,
  filterPropostasEnviadas,
} from '../utils/propostaInbox';

/** ISO: 1=Seg … 7=Dom (duplicado de PublishRoute — evitar conflito de ficheiros). */
const DIAS_SEMANA = [
  { valor: 1, label: 'Seg' },
  { valor: 2, label: 'Ter' },
  { valor: 3, label: 'Qua' },
  { valor: 4, label: 'Qui' },
  { valor: 5, label: 'Sex' },
  { valor: 6, label: 'Sáb' },
  { valor: 7, label: 'Dom' },
];

const DIAS_UTEIS_DEFAULT = [1, 2, 3, 4, 5];

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
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [inboxReviews, setInboxReviews] = useState([]);
  const [enviadasReviews, setEnviadasReviews] = useState([]);
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
          if (g) {
            const membros = await listMembrosGrupo(g.id);
            setMembrosCount(membros.length);
          } else {
            setMembrosCount(0);
          }
          const inbox = filterPropostasParaInbox(propostas, user.id);
          const enviadas = filterPropostasEnviadas(propostas, user.id);
          const [enrichedInbox, enrichedEnviadas] = await Promise.all([
            enrichPropostasForReview(inbox),
            enrichPropostasForReview(enviadas),
          ]);
          setInboxReviews(enrichedInbox);
          setEnviadasReviews(enrichedEnviadas);
          const result = await findCompatibleOfertas({
            preferred_time: String(activa.preferred_time).slice(0, 5),
            origin_lat: Number(activa.origin_lat),
            origin_lng: Number(activa.origin_lng),
            destination_lat: Number(activa.destination_lat),
            destination_lng: Number(activa.destination_lng),
            n_candidato: activa.n_candidato,
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
        setLoadingInbox(false);
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
      const criada = await createProcura({
        preferred_time: form.preferred_time,
        origin_name: form.origin_name,
        origin_lat: form.origin_lat,
        origin_lng: form.origin_lng,
        destination_name: form.destination_name,
        destination_lat: form.destination_lat,
        destination_lng: form.destination_lng,
        dias_semana: form.dias_semana,
        teto_mensal_kz: tetoNumero,
      });
      setProcura(criada);
      setView('matches');
      await carregar();
      setFeedback({ type: 'success', text: 'Procura criada.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getFriendlyErrorMessage(err) });
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
    if (!procura) return;
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
    if (!procura) return;
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
      setInboxReviews((prev) => prev.filter((r) => r.proposta.id !== propostaId));
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
      setInboxReviews((prev) => prev.filter((r) => r.proposta.id !== propostaId));
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
      setEnviadasReviews((prev) => prev.filter((r) => r.proposta.id !== propostaId));
      setFeedback({ type: 'success', text: 'Proposta cancelada.' });
      await carregar();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || getFriendlyErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const waitlistEstadoOferta = (ofertaId) =>
    waitlistEntries.find((e) => e.oferta_id === ofertaId)?.estado ?? null;

  const temPromocaoWaitlist = waitlistEntries.some((e) => e.estado === 'notificada');

  const nDisplayGrupo = grupo
    ? (membrosCount > 0 ? membrosCount : procura?.n_candidato ?? 1)
    : (procura?.n_candidato ?? 1);
  const chipProcura = procura ? chipEstadoProcura(procura.estado) : null;

  return (
    <PageShell>
      <PageHeader
        title={view === 'form' ? 'Nova procura' : 'A minha procura'}
        subtitle={
          view === 'form'
            ? 'Define a tua rota diária casa–trabalho.'
            : 'Encontra ofertas compatíveis com o teu horário.'
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
        <EmptyState
          icon={MapPin}
          title="Sem procura activa"
          message="Cria uma procura para ver ofertas compatíveis."
          actionLabel="Criar procura"
          onAction={() => setView('form')}
        />
      )}

      {!loading && view === 'form' && (
        <form onSubmit={handleCriarProcura} className="space-y-4 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 shadow-sm">
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
            Hora preferida
            <input
              type="time"
              name="preferred_time"
              value={form.preferred_time}
              onChange={handleChange}
              required
              className="h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3"
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

          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <Banknote size={16} aria-hidden="true" />
              Teto mensal
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
                aria-label="Teto mensal"
                className="flex-1 h-12 rounded-lg bg-light-gray dark:bg-slate-800 px-3 tabular-nums outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-sm font-medium text-slate-500 shrink-0">Kz</span>
            </div>
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
              <span className="flex items-center gap-1">
                <Clock size={14} aria-hidden="true" />
                {String(procura.preferred_time).slice(0, 5)}
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
                  Teto mensal {formatKwanza(procura.teto_mensal_kz)} Kz
                </span>
              )}
            </div>
            <button
              type="button"
              className="text-sm font-bold text-primary"
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
                  busy={busyId === review.proposta.id}
                  onCancelar={() => handleCancelarEnviada(review.proposta.id)}
                />
              ))
            )}
          </section>

          {(view === 'matches' || view === 'hub') && (
            <>
              <p className="text-sm font-semibold text-slate-500">
                {(() => {
                  const n = matches.direct.length + matches.waitlist.length;
                  return n === 1 ? '1 oferta compatível' : `${n} ofertas compatíveis`;
                })()}
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

              {temPromocaoWaitlist && (
                <div
                  role="status"
                  className="rounded-xl px-4 py-3 text-sm font-medium bg-amber-50 text-amber-900 border border-amber-200"
                >
                  Abriu-se uma vaga numa oferta em que estás em espera. Podes propor
                  acordo — não foste aceite automaticamente.
                </div>
              )}

              {matches.waitlist.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
                    Lista de espera
                  </h3>
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
                </>
              )}

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
