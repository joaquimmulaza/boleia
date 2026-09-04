import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Car } from 'lucide-react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renderiza mensagem sem acção', () => {
    render(<EmptyState message="Ainda não tens acordos activos." />);

    expect(screen.getByText('Ainda não tens acordos activos.')).toBeInTheDocument();
  });

  it('renderiza título, mensagem e acção', () => {
    const onAction = vi.fn();

    render(
      <EmptyState
        icon={Car}
        title="Sem rotas"
        message="Ainda não publicaste nenhuma rota diária."
        actionLabel="Publicar primeira rota"
        onAction={onAction}
      />
    );

    expect(screen.getByText('Sem rotas')).toBeInTheDocument();
    expect(screen.getByText('Ainda não publicaste nenhuma rota diária.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar primeira rota' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
