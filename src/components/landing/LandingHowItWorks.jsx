import { Search, Handshake, Check } from 'lucide-react';

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
    icon: Check,
    title: 'Preço do mês registado',
    text: 'O preço do mês em Kz fica escrito. Se alguém sair, a quota dos outros não muda.',
  },
];

/**
 * Secção «Como funciona» — três passos numerados.
 * @typedef {Readonly<{}>} LandingHowItWorksProps
 */
export default function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="bg-card px-4 py-16 md:px-[7.5rem] md:py-[4.5rem]">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="mb-10 text-balance text-3xl font-bold text-foreground md:text-4xl">
          Como funciona
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.title}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-background-light p-6 dark:bg-background-dark"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 min-w-8 items-center justify-center rounded-lg bg-primary/10 px-2 text-sm font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                    <StepIcon size={20} aria-hidden="true" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
                  <p
                    data-testid="como-funciona-passo"
                    className="text-pretty text-sm leading-relaxed text-muted-foreground"
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
