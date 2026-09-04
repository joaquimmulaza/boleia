import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renderiza título e subtítulo', () => {
    render(
      <PageHeader title="Os Meus Acordos" subtitle="Gerir pedidos activos" />
    );

    expect(screen.getByRole('heading', { name: 'Os Meus Acordos' })).toBeInTheDocument();
    expect(screen.getByText('Gerir pedidos activos')).toBeInTheDocument();
  });

  it('mostra botão voltar quando onBack está definido', () => {
    const onBack = vi.fn();
    render(
      <PageHeader title="Perfil" onBack={onBack} />
    );

    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('renderiza acção opcional', () => {
    const onAction = vi.fn();
    render(
      <PageHeader
        title="Rotas"
        actionLabel="Publicar rota"
        onAction={onAction}
      />
    );

    expect(screen.getByRole('button', { name: 'Publicar rota' })).toBeInTheDocument();
  });
});
