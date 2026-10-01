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
 * Perguntas — três respostas curtas, fluxo real.
 * @typedef {Readonly<{}>} LandingFaqProps
 */
export default function LandingFaq() {
  return (
    <section id="perguntas" className="bg-white py-16 dark:bg-slate-900/40">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4">
        <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white">Perguntas</h2>
        <dl className="flex flex-col gap-6">
          {FAQ.map((item) => (
            <div key={item.q} className="flex flex-col gap-2 border-b border-primary/10 pb-6">
              <dt className="text-lg font-bold text-slate-900 dark:text-white">{item.q}</dt>
              <dd className="text-pretty text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
