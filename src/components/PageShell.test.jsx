import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageShell from './PageShell';

describe('PageShell', () => {
  it('renderiza conteúdo filho', () => {
    render(
      <PageShell>
        <p>Conteúdo da página</p>
      </PageShell>
    );

    expect(screen.getByText('Conteúdo da página')).toBeInTheDocument();
  });
});
