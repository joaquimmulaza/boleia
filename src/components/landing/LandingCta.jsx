import { useNavigate } from 'react-router-dom';

/**
 * CTA final — mesmo carro, preço do mês, dois papéis.
 * @typedef {Readonly<{}>} LandingCtaProps
 */
export default function LandingCta() {
  const navigate = useNavigate();

  return (
    <section className="bg-primary/10 px-4 py-16">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white">
          Todos os dias, no mesmo carro.
        </h2>
        <p className="text-pretty text-slate-700 dark:text-slate-300">
          Passageiro ou motorista: o preço do mês em Kz fica combinado antes de arrancar.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate('/auth?mode=register&role=passenger')}
            className="w-full cursor-pointer rounded-xl bg-primary px-10 py-4 text-lg font-bold text-slate-900 transition-all hover:brightness-105 sm:w-auto"
          >
            Sou Passageiro
          </button>
          <button
            type="button"
            onClick={() => navigate('/auth?mode=register&role=driver')}
            className="w-full cursor-pointer rounded-xl border-2 border-primary/40 bg-white px-10 py-4 text-lg font-bold text-slate-900 transition-colors hover:border-primary/60 dark:bg-slate-800 dark:text-white sm:w-auto"
          >
            Sou Motorista
          </button>
        </div>
      </div>
    </section>
  );
}
