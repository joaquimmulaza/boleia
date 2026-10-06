import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';

/**
 * CTA final — card verde, Sou Passageiro / Sou Motorista.
 * @typedef {Readonly<{}>} LandingCtaProps
 */
export default function LandingCta() {
  const navigate = useNavigate();

  return (
    <section className="px-4 py-16 lg:px-[7.5rem]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 rounded-[2rem] bg-primary px-6 py-12 text-center text-[#17231c] lg:px-[9.375rem] lg:py-12">
        <h2 className="text-balance text-3xl font-bold md:text-4xl">
          Todos os dias, no mesmo carro.
        </h2>
        <p className="max-w-xl text-pretty">
          Passageiro ou motorista: o preço do mês em Kz fica combinado antes de arrancar.
        </p>
        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:justify-center">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="rounded-full bg-white px-8 font-bold text-[#17231c] hover:bg-white/90"
            onClick={() => navigate('/auth?mode=register&role=passenger')}
          >
            Sou Passageiro
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="rounded-full border-2 border-[#17231c]/25 bg-primary px-8 font-bold text-[#17231c] hover:bg-primary/90"
            onClick={() => navigate('/auth?mode=register&role=driver')}
          >
            Sou Motorista
          </Button>
        </div>
      </div>
    </section>
  );
}
