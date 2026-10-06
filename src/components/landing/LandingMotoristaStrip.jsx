import { useNavigate } from 'react-router-dom';

/** Mesmo destino do botão «Sou Motorista» no CTA final. */
const MOTORISTA_REGISTER_PATH = '/auth?mode=register&role=driver';

/**
 * Faixa motorista — imediatamente após o hero.
 * @typedef {Readonly<{}>} LandingMotoristaStripProps
 */
export default function LandingMotoristaStrip() {
  const navigate = useNavigate();

  return (
    <section
      data-testid="landing-motorista-strip"
      className="border-y border-border bg-inverse px-4 py-10 md:py-12"
      aria-labelledby="landing-motorista-strip-heading"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <h2
          id="landing-motorista-strip-heading"
          className="text-balance text-xl font-bold text-inverse-fg md:text-2xl"
        >
          Já fazes este caminho?
        </h2>
        <p className="text-pretty text-base text-inverse-muted md:text-lg">
          Partilha os lugares com quem vai no mesmo sentido.
        </p>
        <button
          type="button"
          onClick={() => navigate(MOTORISTA_REGISTER_PATH)}
          className="mt-1 w-full max-w-xs cursor-pointer rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-slate-900 transition-all hover:brightness-105 sm:w-auto"
        >
          Sou Motorista
        </button>
      </div>
    </section>
  );
}
