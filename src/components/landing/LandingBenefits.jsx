import { PiggyBank, Clock, Users } from 'lucide-react';

const BENEFITS = [
  {
    icon: PiggyBank,
    title: 'Economia',
    text: 'Partilha o custo da rota diária com acordo mensal em Kz — sem surpresas de última hora.',
  },
  {
    icon: Clock,
    title: 'Pontualidade',
    text: 'Horários combinados para a ida e o regresso casa–trabalho, com a rotina que precisas.',
  },
  {
    icon: Users,
    title: 'Grupo de colegas',
    text: 'Junta colegas no mesmo percurso e negocia em grupo com o motorista.',
  },
];

/**
 * Secção «Vantagens».
 * @typedef {Readonly<{}>} LandingBenefitsProps
 */
export default function LandingBenefits() {
  return (
    <section id="vantagens" className="py-20 px-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="flex max-w-[720px] flex-col gap-4">
          <h2 className="text-balance text-4xl font-black leading-tight text-slate-900 dark:text-white md:text-5xl">
            Vantagens
          </h2>
          <p className="text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Mobilidade urbana útil para Luanda: poupar, chegar a horas e viajar com quem partilha o caminho.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => {
            const BenefitIcon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="group flex flex-1 gap-4 rounded-xl border border-primary/5 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800"
              >
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <BenefitIcon size={28} aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{benefit.title}</h3>
                  <p className="text-pretty text-sm text-slate-600 dark:text-slate-400">{benefit.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
