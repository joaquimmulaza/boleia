import { Search, Handshake, PiggyBank } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    title: 'Diz o teu percurso',
    text: 'Passageiro pede boleia; motorista diz que tem lugares — rota fixa ou horário flexível.',
  },
  {
    icon: Handshake,
    title: 'Combinam a proposta',
    text: 'Vê quem bate no horário e no caminho — sozinho ou com colegas no mesmo percurso.',
  },
  {
    icon: PiggyBank,
    title: 'Fecha o acordo mensal',
    text: 'Um motorista leva vários passageiros no mesmo caminho, com preço em Kz combinado e registado.',
  },
];

/**
 * Secção «Como funciona» — fluxo boleia casa–trabalho.
 * @typedef {Readonly<{}>} LandingHowItWorksProps
 */
export default function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-16 dark:bg-slate-900/50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 flex flex-col items-center">
          <p className="mb-2 text-sm font-extrabold uppercase text-primary">Processo simples</p>
          <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white">Como funciona</h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.title}
                className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-background-light p-8 transition-transform hover:-translate-y-1 dark:bg-slate-800/40"
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <StepIcon size={24} aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="text-pretty text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {step.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
