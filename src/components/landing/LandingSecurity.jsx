import { ShieldCheck, FileCheck2, CalendarCheck } from 'lucide-react';

const POINTS = [
  {
    icon: ShieldCheck,
    title: 'Perfis',
    text: 'Cada pessoa tem perfil na plataforma — sabes com quem estás a combinar a boleia.',
  },
  {
    icon: FileCheck2,
    title: 'Acordos claros',
    text: 'Preço e condições ficam registados no acordo mensal, em Kz, sem ambiguidade.',
  },
  {
    icon: CalendarCheck,
    title: 'Faltas rastreáveis',
    text: 'Faltas e descontos seguem regras transparentes — confiança utilitária, não turismo.',
  },
];

/**
 * Secção «Segurança».
 * @typedef {Readonly<{}>} LandingSecurityProps
 */
export default function LandingSecurity() {
  return (
    <section id="seguranca" className="bg-background-light py-16 dark:bg-background-dark">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 flex max-w-2xl flex-col gap-3">
          <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
            Segurança
          </h2>
          <p className="text-pretty text-slate-600 dark:text-slate-400">
            Confiança no dia a dia da boleia casa–trabalho — regras transparentes, sem surpresas.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {POINTS.map((point) => {
            const PointIcon = point.icon;
            return (
              <div
                key={point.title}
                className="flex flex-col gap-3 rounded-xl border border-primary/10 bg-white p-6 dark:bg-slate-800/50"
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PointIcon size={22} aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{point.title}</h3>
                <p className="text-pretty text-sm text-slate-600 dark:text-slate-400">{point.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
