import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';

/**
 * CTA final — card verde, Sou Passageiro / Sou Motorista.
 * @typedef {Readonly<{}>} LandingCtaProps
 */
export default function LandingCta() {
  const navigate = useNavigate();

  return (
    <section className="px-4 py-16 md:px-[7.5rem]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 rounded-[2rem] bg-primary px-6 py-12 text-center md:px-[9.375rem] md:py-12">
        <h2 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
          Todos os dias, no mesmo carro.
        </h2>
        <p className="max-w-xl text-pretty text-foreground/80">
          Passageiro ou motorista: o preço do mês em Kz fica combinado antes de arrancar.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="rounded-full bg-card px-8 font-bold text-foreground hover:bg-card/90"
            onClick={() => navigate('/auth?mode=register&role=passenger')}
          >
            Sou Passageiro
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full border-2 border-foreground/20 bg-primary px-8 font-bold text-foreground hover:bg-primary/90"
            onClick={() => navigate('/auth?mode=register&role=driver')}
          >
            Sou Motorista
          </Button>
        </div>
      </div>
    </section>
  );
}
