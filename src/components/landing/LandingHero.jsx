import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';

/**
 * Hero da landing — chip, copy, CTAs Explorar + Criar conta, storyboard rota.
 * @typedef {Readonly<{}>} LandingHeroProps
 */
export default function LandingHero() {
  const navigate = useNavigate();

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
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              type="button"
              size="lg"
              className="rounded-full px-6 font-bold"
              onClick={() => navigate('/explorar')}
            >
              Explorar boleias
            </Button>
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

        <div
          className="w-full min-w-0 max-w-[480px] rounded-2xl border border-border bg-card p-6 shadow-sm lg:ml-auto"
          aria-label="Pré-visualização do produto"
          data-testid="hero-route-storyboard"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Lugares do motorista
            </span>
            <span className="text-xs font-medium text-muted-foreground">Seg–Sex</span>
          </div>

          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex flex-col items-start gap-2">
              <span className="size-4 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Talatona</span>
            </div>
            <div
              className="hero-route-line h-0.5 flex-1 rounded-full bg-primary"
              aria-hidden="true"
            />
            <div className="flex flex-col items-end gap-2">
              <span className="size-4 rounded-full bg-primary" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Centro</span>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Condutor
            </span>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-foreground">
              Lugar 1
            </span>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-foreground">
              Lugar 2
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
              Livre
            </span>
          </div>

          <p className="text-sm tabular-nums text-muted-foreground">
            3 vagas · a partir de 25.000 Kz
          </p>
        </div>
      </div>
    </section>
  );
}
