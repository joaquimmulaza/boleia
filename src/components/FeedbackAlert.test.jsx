import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeedbackAlert from './FeedbackAlert';

describe('FeedbackAlert', () => {
  it('não renderiza sem texto', () => {
    const { container } = render(<FeedbackAlert type="success" text="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sucesso: role status, ícone e superfície tonal', () => {
    render(<FeedbackAlert type="success" text="Procura criada." />);
    const alert = screen.getByRole('status');
    expect(alert).toHaveTextContent(/Procura criada/i);
    expect(alert).toHaveAttribute('data-variant', 'success');
    expect(alert.querySelector('svg')).toBeTruthy();
    expect(screen.getByText(/Sucesso:/i)).toHaveClass('sr-only');
  });

  it('erro: role alert assertivo', () => {
    render(<FeedbackAlert type="error" text="Falha ao guardar." />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('data-variant', 'error');
    expect(alert).toHaveTextContent(/Falha ao guardar/i);
  });

  it('offline: role status com aviso de rede', () => {
    render(
      <FeedbackAlert type="offline" text="Sem ligação à Internet. Usa a cache local." />,
    );
    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('data-variant', 'offline');
    expect(banner).toHaveTextContent(/Sem ligação/i);
    expect(screen.getByText(/Aviso de rede:/i)).toHaveClass('sr-only');
  });

  it('aceita children em vez de text', () => {
    render(
      <FeedbackAlert type="error">
        <span>Erro custom</span>
      </FeedbackAlert>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Erro custom');
  });
});
