import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

/**
 * @typedef {Readonly<{}>} ExploreFilteredEmptyProps
 */
export default function ExploreFilteredEmpty() {
  const navigate = useNavigate();

  return (
    <div
      className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-border bg-card px-6 py-8 text-center"
      data-testid="explore-filtered-empty"
    >
      <h2 className="text-xl font-bold text-foreground">Nenhuma boleia neste caminho</h2>
      <p className="text-sm text-muted-foreground text-pretty">
        Cria uma procura e espera quem faz o mesmo caminho.
      </p>
      <Button
        type="button"
        className="rounded-full px-6 font-bold"
        onClick={() => navigate('/auth?mode=register&role=passenger')}
      >
        Criar procura
      </Button>
      <button
        type="button"
        onClick={() => navigate('/explorar')}
        className="block w-full text-sm font-bold text-primary"
      >
        Ver todas as boleias
      </button>
    </div>
  );
}
