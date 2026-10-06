import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listOfertasDisponiveis } from '../services/OfertaService';
import { listProcurasDisponiveis } from '../services/ProcuraService';
import {
  COPY_A_CARREGAR,
  COPY_ERRO_OPORTUNIDADES,
  COPY_TENTAR_NOVAMENTE,
  isLiveOpportunity,
} from '../utils/opportunityCard';
import { filterOfertasBySearchOd, isSearchOdActive } from '../utils/exploreOdFilter';
import {
  exploreFilteredTitle,
  hasExploreSearchLabels,
  parseExploreSearchParams,
} from '../utils/exploreSearchParams';
import LoadingSkeleton from '../components/LoadingSkeleton';
import OpportunityCard from '../components/OpportunityCard';
import OpportunityDetailSheet from '../components/OpportunityDetailSheet';
import ExploreFilteredHeader from '../components/ExploreFilteredHeader';
import ExploreFilteredEmpty from '../components/ExploreFilteredEmpty';
import BrandLockup from '../components/BrandLockup';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Marketplace público — browse ofertas e procuras sem conta.
 * CTAs de acção redireccionam para /auth. Sessão activa → hub do perfil.
 * @typedef {Readonly<{}>} MarketplaceExploreProps
 */
export default function MarketplaceExplore() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading, tipoPerfil } = useAuth();
  const [tab, setTab] = useState('ofertas');
  const [ofertas, setOfertas] = useState([]);
  const [procuras, setProcuras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  const routeSearch = useMemo(
    () => parseExploreSearchParams(searchParams),
    [searchParams],
  );
  const isFiltered = hasExploreSearchLabels(routeSearch);

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
      console.error('Erro ao carregar oportunidades:', err);
      setError(COPY_ERRO_OPORTUNIDADES);
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

  const ofertasVivas = ofertas.filter((oferta) => isLiveOpportunity('oferta', oferta));
  const procurasVivas = procuras.filter((procura) => isLiveOpportunity('procura', procura));

  const ofertasVisiveis = isFiltered && isSearchOdActive(routeSearch)
    ? filterOfertasBySearchOd(ofertasVivas, routeSearch)
    : isFiltered
      ? ofertasVivas.filter((o) => !o.flexibilidade_rota)
      : ofertasVivas;

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
            className="rounded-lg"
            aria-label="Boleia Certa"
          >
            <BrandLockup />
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-6 pb-16">
        {isFiltered && routeSearch ? (
          <ExploreFilteredHeader
            search={routeSearch}
            title={exploreFilteredTitle(routeSearch)}
          />
        ) : (
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-balance">Explorar marketplace</h1>
            <p className="text-sm text-slate-500 text-pretty">
              Vê ofertas e procuras sem criares conta. Para propor ou publicar, entra ou regista-te.
            </p>
          </div>
        )}

        {!isFiltered ? (
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
              onClick={() => { setTab('ofertas'); setDetalhe(null); }}
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
              onClick={() => { setTab('procuras'); setDetalhe(null); }}
              className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${
                tab === 'procuras'
                  ? 'bg-white text-primary shadow-sm dark:bg-slate-900'
                  : 'text-slate-500'
              }`}
            >
              Procuras
            </button>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => { void carregar(); }}
              className="font-bold text-red-800"
            >
              {COPY_TENTAR_NOVAMENTE}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div role="status" className="space-y-3">
            <p className="text-sm text-slate-500">{COPY_A_CARREGAR}</p>
            <LoadingSkeleton />
          </div>
        ) : null}

        {!loading && (isFiltered || tab === 'ofertas') ? (
          <section className="space-y-3" data-testid="explore-ofertas-feed">
            {ofertasVisiveis.length === 0 && isFiltered ? (
              <ExploreFilteredEmpty />
            ) : null}
            {ofertasVisiveis.length === 0 && !isFiltered ? (
              <p className="text-sm text-slate-500">Ainda não há ofertas publicadas.</p>
            ) : null}
            {ofertasVisiveis.map((oferta) => (
              <div key={oferta.id} data-testid="explore-oferta-card">
                <OpportunityCard
                  kind="oferta"
                  item={oferta}
                  onOpen={() => setDetalhe({ kind: 'oferta', item: oferta })}
                  onCta={() => goAuth('passenger')}
                />
              </div>
            ))}
          </section>
        ) : null}

        {!loading && !isFiltered && tab === 'procuras' ? (
          <section className="space-y-3" data-testid="explore-procuras-feed">
            {procurasVivas.length === 0 ? (
              <p className="text-sm text-slate-500">Ainda não há procuras no marketplace.</p>
            ) : (
              procurasVivas.map((procura) => (
                <div key={procura.id} data-testid="explore-procura-card">
                  <OpportunityCard
                    kind="procura"
                    item={procura}
                    onOpen={() => setDetalhe({ kind: 'procura', item: procura })}
                    onCta={() => goAuth('driver')}
                  />
                </div>
              ))
            )}
          </section>
        ) : null}
      </main>

      {detalhe ? (
        <OpportunityDetailSheet
          kind={detalhe.kind}
          item={detalhe.item}
          onClose={() => setDetalhe(null)}
          onCta={() => goAuth(detalhe.kind === 'oferta' ? 'passenger' : 'driver')}
        />
      ) : null}
    </div>
  );
}
