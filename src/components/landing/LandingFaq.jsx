const FAQ = [
  {
    q: 'O grupo tem de estar completo?',
    a: 'Não. Duas pessoas no mesmo caminho já fecham. Não é preciso lotar o carro.',
  },
  {
    q: 'O que acontece se alguém sair?',
    a: 'Essa pessoa sai. O valor mensal dos outros mantém-se. Um acerto de preço só entra no mês seguinte.',
  },
  {
    q: 'Como se paga?',
    a: 'O lugar fica reservado quando o acordo é aceite. Pagamento com comprovativo na app.',
  },
];

/**
 * Perguntas — cartões FAQ estáticos.
 * @typedef {Readonly<{}>} LandingFaqProps
 */
export default function LandingFaq() {
  return (
    <section id="perguntas" className="bg-background-light px-4 py-16 dark:bg-background-dark md:px-[7.5rem] md:py-[4.5rem]">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">Perguntas</h2>
        <dl className="flex flex-col gap-4">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <dt className="text-base font-bold text-foreground">{item.q}</dt>
              <dd className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
