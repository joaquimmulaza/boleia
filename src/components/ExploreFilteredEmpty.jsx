import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

/**
 * @param {{ onCriarProcura?: () => void }} props
 */
export default function ExploreFilteredEmpty({ onCriarProcura }) {
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
        onClick={onCriarProcura || (() => navigate('/auth?mode=register&role=passenger'))}
      >
        Criar procura
      </Button>
      <button
        type="button"
        onClick={() => navigate('/explorar')}
        className="block w-full text-sm font-bold text-primary rounded-md hover:bg-primary/5 dark:hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 px-3 py-1.5"
      >
        Ver todas as boleias
      </button>
    </div>
  );
}
