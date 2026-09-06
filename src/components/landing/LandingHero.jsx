import { useNavigate } from 'react-router-dom';

/**
 * Hero full-bleed da landing — gradiente CSS + mock produto (sem stock externo).
 * @typedef {Readonly<{}>} LandingHeroProps
 */
export default function LandingHero() {
  const navigate = useNavigate();

  return (
    <section
      className="relative overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/25 via-background-light to-background-light dark:from-primary/20 dark:via-background-dark dark:to-background-dark"
      aria-labelledby="landing-hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgb(16 183 72 / 0.35), transparent 45%), radial-gradient(circle at 80% 10%, rgb(16 183 72 / 0.2), transparent 40%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-14 md:px-8 md:py-20 lg:flex-row lg:items-center lg:gap-12">
        <div className="flex flex-1 flex-col gap-6 text-left">
          <img
            src="/boleia-logo.png"
            alt="Boleia Certa"
            className="h-14 w-auto object-contain self-start md:h-16"
          />
          <p className="text-xs font-extrabold uppercase text-primary">
            A boleia que faz sentido · Luanda
          </p>
          <h1
            id="landing-hero-heading"
            className="text-balance text-4xl font-black leading-tight text-slate-900 dark:text-slate-100 md:text-5xl lg:text-6xl"
          >
            Casa e trabalho. No mesmo caminho.
          </h1>
          <p className="max-w-xl text-pretty text-lg text-slate-600 dark:text-slate-300 md:text-xl">
            Partilha a viagem casa–trabalho todos os dias em Luanda. Diz o teu percurso, encontra
            motorista ou passageiros, e fecha um acordo mensal com preço claro em Kwanza.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => navigate('/auth?mode=register&role=passenger')}
              className="flex min-w-[160px] cursor-pointer items-center justify-center rounded-xl bg-primary px-6 h-14 text-base font-bold text-slate-900 shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] active:scale-95"
            >
              Sou Passageiro
            </button>
            <button
              type="button"
              onClick={() => navigate('/auth?mode=register&role=driver')}
              className="flex min-w-[160px] cursor-pointer items-center justify-center rounded-xl border-2 border-primary/30 bg-white px-6 h-14 text-base font-bold text-slate-900 transition-colors hover:border-primary/60 active:scale-95 dark:bg-slate-800 dark:text-white"
            >
              Sou Motorista
            </button>
          </div>
        </div>

        <div
          className="flex w-full max-w-md flex-col gap-3 self-stretch lg:max-w-sm"
          aria-label="Pré-visualização do produto"
        >
          <div className="rounded-2xl border border-primary/15 bg-white/90 p-4 shadow-sm dark:bg-slate-900/80">
            <p className="text-xs font-bold uppercase text-primary">Lugares do motorista</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Talatona → Centro · Seg–Sex
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">3 vagas · a partir de 25.000 Kz</p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-white/90 p-4 shadow-sm dark:bg-slate-900/80">
            <p className="text-xs font-bold uppercase text-primary">Quem precisa de boleia</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Viana → Mutamba · manhã
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Grupo · 2 colegas</p>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-primary">Acordo mensal</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              1 motorista · vários passageiros · preço congelado
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Total 75.000 Kz</p>
          </div>
        </div>
      </div>
    </section>
  );
}
