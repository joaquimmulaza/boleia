import { Search, Handshake, PiggyBank } from 'lucide-react';

const STEPS = [
  {
    icon: Search,
    title: 'Publica caminho ou lugares',
    text: 'Passageiro diz o caminho. Motorista oferece lugares — rota própria ou sem rota marcada.',
  },
  {
    icon: Handshake,
    title: 'A outra pessoa aceita',
    text: 'Qualquer um envia. Só a outra pessoa aceita ou recusa.',
  },
  {
    icon: PiggyBank,
    title: 'Preço do mês registado',
    text: 'O preço do mês em Kz fica escrito. Se alguém sair, a quota dos outros não muda.',
  },
];

/**
 * Secção «Como funciona» — três passos de uma frase.
 * @typedef {Readonly<{}>} LandingHowItWorksProps
 */
export default function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-16 dark:bg-slate-900/50">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 flex flex-col items-center">
          <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white">
            Como funciona
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.title}
                className="flex flex-col gap-4 rounded-xl border border-primary/10 bg-background-light p-8 dark:bg-slate-800/40"
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <StepIcon size={24} aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                  <p
                    data-testid="como-funciona-passo"
                    className="text-pretty text-sm leading-relaxed text-slate-600 dark:text-slate-400"
                  >
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
