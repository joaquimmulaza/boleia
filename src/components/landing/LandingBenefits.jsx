import { User, Car } from 'lucide-react';

const PASSAGEIRO = [
  {
    title: 'Sem a luta da paragem',
    text: 'Sem puxarem a mala ao subir no táxi.',
  },
  {
    title: 'Preço do mês em Kz',
    text: 'Sabes o que pagas antes de entrar.',
  },
  {
    title: 'O mesmo carro todos os dias',
    text: 'Ponto e hora combinados. Dois colegas já começam.',
  },
];

const MOTORISTA = [
  {
    title: 'Renda extra todos os meses',
    text: 'Lugares vazios no teu percurso passam a render em Kz.',
  },
  {
    title: 'Sem rota marcada',
    text: 'Fazes Yango, Heetch ou táxi? Diz os dias e as horas.',
  },
  {
    title: 'Clientes certos',
    text: 'Quem faz sempre o mesmo caminho. Valor do mês combinado.',
  },
];

/**
 * @param {{ title: string, points: typeof PASSAGEIRO, testId: string, icon: typeof User }} props
 */
function RoleColumn({ title, points, testId, icon: Icon }) {
  return (
    <article
      data-testid={testId}
      className="flex flex-col gap-6 rounded-xl border border-primary/10 bg-white p-6 shadow-sm dark:bg-slate-800"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon size={22} aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <ul className="flex flex-col gap-5">
        {points.map((point) => (
          <li key={point.title} className="flex flex-col gap-1">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">{point.title}</h4>
            <p
              data-testid="o-que-muda-ponto"
              className="text-pretty text-sm text-slate-600 dark:text-slate-400"
            >
              {point.text}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Secção «O que muda» — duas colunas, passageiro e motorista.
 * @typedef {Readonly<{}>} LandingBenefitsProps
 */
export default function LandingBenefits() {
  return (
    <section id="o-que-muda" className="px-4 py-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="flex max-w-[720px] flex-col gap-4">
          <h2 className="text-balance text-4xl font-black leading-tight text-slate-900 dark:text-white md:text-5xl">
            O que muda
          </h2>
          <p className="text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Sai da paragem. Enche os lugares vazios. O preço do mês fica em Kz.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RoleColumn
            title="Passageiro"
            points={PASSAGEIRO}
            testId="o-que-muda-passageiro"
            icon={User}
          />
          <RoleColumn
            title="Motorista"
            points={MOTORISTA}
            testId="o-que-muda-motorista"
            icon={Car}
          />
        </div>
      </div>
    </section>
  );
}
