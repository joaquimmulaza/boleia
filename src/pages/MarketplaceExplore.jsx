import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Clock, Users } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listOfertasDisponiveis, isOfertaFlexivel, labelOfertaRota } from '../services/OfertaService';
import { listProcurasDisponiveis } from '../services/ProcuraService';
import { formatKwanza } from '../utils/formatKwanza';
import { formatTime24h } from '../utils/formatTime';
import { labelModoPreco } from '../utils/ofertaLabels';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Marketplace público — browse ofertas e procuras sem conta.
 * CTAs de acção redireccionam para /auth. Sessão activa → hub do perfil.
 * @typedef {Readonly<{}>} MarketplaceExploreProps
 */
export default function MarketplaceExplore() {
  const navigate = useNavigate();
  const { session, loading: authLoading, tipoPerfil } = useAuth();
  const [tab, setTab] = useState('ofertas'); // 'ofertas' | 'procuras'
  const [ofertas, setOfertas] = useState([]);
  const [procuras, setProcuras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ofs, prs] = await Promise.all([
        listOfertasDisponiveis(),
        listProcurasDisponiveis(),
      ]);
      setOfertas(ofs);
      setProcuras(prs);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) return;
    void carregar();
  }, [carregar, session]);

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center text-slate-500">
        A carregar...
      </div>
    );
  }

  if (session) {
    if (tipoPerfil === 'Motorista') return <Navigate to="/motorista" replace />;
    return <Navigate to="/passageiro" replace />;
  }

  const goAuth = (role) => {
    const q = role ? `?mode=register&role=${role}` : '';
    navigate(`/auth${q}`);
  };

  return (
    <div
      className="relative flex min-h-dvh w-full flex-col bg-background-light font-display text-slate-900 dark:bg-background-dark dark:text-slate-100"
      data-testid="marketplace-explore"
    >
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-background-light/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-background-dark/95">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-bold text-primary"
          >
            Boleia Certa
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-6 pb-16">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-balance">Explorar marketplace</h1>
          <p className="text-sm text-slate-500 text-pretty">
            Vê ofertas e procuras sem criares conta. Para propor ou publicar, entra ou regista-te.
          </p>
        </div>

        <div
          className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
          role="tablist"
          aria-label="Tipo de listagem"
          data-testid="explore-tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ofertas'}
            onClick={() => setTab('ofertas')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
              tab === 'ofertas'
                ? 'bg-white text-primary shadow-sm dark:bg-slate-900'
                : 'text-slate-500'
            }`}
          >
            Ofertas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'procuras'}
            onClick={() => setTab('procuras')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
              tab === 'procuras'
                ? 'bg-white text-primary shadow-sm dark:bg-slate-900'
                : 'text-slate-500'
            }`}
          >
            Procuras
          </button>
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? <LoadingSkeleton /> : null}

        {!loading && tab === 'ofertas' ? (
          <section className="space-y-3" data-testid="explore-ofertas-feed">
            {ofertas.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não há ofertas publicadas.</p>
            ) : (
              ofertas.map((oferta) => {
                const rota = labelOfertaRota(oferta);
                return (
                  <article
                    key={oferta.id}
                    className="space-y-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    data-testid="explore-oferta-card"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {isOfertaFlexivel(oferta) || rota ? (
                        <span>{rota || 'Oferta flexível'}</span>
                      ) : (
                        <>
                          <span>{oferta.origin_name || 'Origem'}</span>
                          <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
                          <span>{oferta.destination_name || 'Destino'}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} aria-hidden="true" />
                        {formatTime24h(oferta.departure_time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={14} aria-hidden="true" />
                        {oferta.vagas_disponiveis ?? oferta.vagas_totais ?? '—'} lugares
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <strong className="tabular-nums text-primary">
                          {formatKwanza(oferta.valor_mensal_ask_kz)} Kz
                        </strong>
                        <p className="text-xs text-slate-400">{labelModoPreco(oferta.modo_preco)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goAuth('passenger')}
                        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
                      >
                        Entrar para propor
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        ) : null}

        {!loading && tab === 'procuras' ? (
          <section className="space-y-3" data-testid="explore-procuras-feed">
            {procuras.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não há procuras no marketplace.</p>
            ) : (
              procuras.map((procura) => (
                <article
                  key={procura.id}
                  className="space-y-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  data-testid="explore-procura-card"
                >
                  <div className="flex items-center gap-2 font-bold">
                    <span>{procura.origin_name || 'Origem'}</span>
                    <ArrowRight size={16} className="text-slate-400" aria-hidden="true" />
                    <span>{procura.destination_name || 'Destino'}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={14} aria-hidden="true" />
                      {formatTime24h(procura.preferred_time)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} aria-hidden="true" />
                      {(procura.n_candidato ?? 1) === 1
                        ? '1 pessoa'
                        : `${procura.n_candidato} pessoas`}
                    </span>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => goAuth('driver')}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
                    >
                      Entrar para propor
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
