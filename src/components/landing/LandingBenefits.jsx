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
 * @param {{ title: string; points: typeof PASSAGEIRO; testId: string; icon: typeof User }} props
 */
function RoleColumn({ title, points, testId, icon: Icon }) {
  return (
    <article
      data-testid={testId}
      className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <Icon size={22} aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{title}</h3>
      </div>
      <ul className="flex flex-col gap-5">
        {points.map((point) => (
          <li key={point.title} className="flex flex-col gap-1">
            <h4 className="text-base font-bold text-foreground">{point.title}</h4>
            <p
              data-testid="o-que-muda-ponto"
              className="text-pretty text-sm text-muted-foreground"
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
    <section id="o-que-muda" className="bg-background-light px-4 py-16 dark:bg-background-dark md:px-[7.5rem] md:py-[4.5rem]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
        <div className="flex max-w-[640px] flex-col gap-3">
          <h2 className="text-balance text-3xl font-black text-foreground md:text-4xl">
            O que muda
          </h2>
          <p className="text-pretty text-base text-muted-foreground md:text-lg">
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
