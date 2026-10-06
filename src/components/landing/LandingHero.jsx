import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import LandingHeroSearchCard from './LandingHeroSearchCard';
import { parseExploreSearchParams } from '../../utils/exploreSearchParams';

/**
 * Hero da landing — chip, copy, pesquisa OD e CTA Criar conta.
 * @typedef {Readonly<{}>} LandingHeroProps
 */
export default function LandingHero() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const prefilledSearch = useMemo(() => parseExploreSearchParams(searchParams), [searchParams]);

  const initialOriginCoords = prefilledSearch?.origin_lat != null && prefilledSearch?.origin_lng != null
    ? { lat: prefilledSearch.origin_lat, lng: prefilledSearch.origin_lng }
    : null;
  const initialDestinationCoords = prefilledSearch?.destination_lat != null && prefilledSearch?.destination_lng != null
    ? { lat: prefilledSearch.destination_lat, lng: prefilledSearch.destination_lng }
    : null;

  return (
    <section
      className="border-b border-border bg-background-light dark:bg-background-dark"
      aria-labelledby="landing-hero-heading"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-12 lg:flex-row lg:items-center lg:gap-12 lg:px-[7.5rem] lg:py-16">
        <div className="flex min-w-0 flex-1 flex-col gap-5 text-left">
          <p className="inline-flex w-fit rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            A boleia que faz sentido · Luanda · casa–trabalho
          </p>
          <h1
            id="landing-hero-heading"
            className="text-balance text-4xl font-black leading-tight text-foreground md:text-5xl lg:text-[3.25rem]"
          >
            Deixa a luta pelo táxi. Vai no mesmo carro.
          </h1>
          <p
            data-testid="landing-hero-support"
            className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Em Luanda a paragem enche, o trânsito come o dia, e o preço muda. Reserva um lugar no
            mesmo carro, todos os dias, com o preço do mês em Kz — ou enche os teus lugares vazios.
          </p>
          <div className="hidden flex-wrap gap-3 pt-1 lg:flex">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-full border-border bg-card px-6 font-bold text-foreground"
              onClick={() => navigate('/auth?mode=register')}
            >
              Criar conta
            </Button>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-4 lg:max-w-[440px]">
          <LandingHeroSearchCard
            key={prefilledSearch
              ? `${prefilledSearch.origem}|${prefilledSearch.destino}|${prefilledSearch.origin_lat}|${prefilledSearch.destination_lat}`
              : 'empty'}
            initialOrigem={prefilledSearch?.origem || ''}
            initialDestino={prefilledSearch?.destino || ''}
            initialOriginCoords={initialOriginCoords}
            initialDestinationCoords={initialDestinationCoords}
          />
          <div className="flex lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full rounded-full border-border bg-card px-6 font-bold text-foreground"
              onClick={() => navigate('/auth?mode=register')}
            >
              Criar conta
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
