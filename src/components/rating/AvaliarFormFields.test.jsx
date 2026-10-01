import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AvaliarFormFields from './AvaliarFormFields';

describe('AvaliarFormFields', () => {
  it('CTA desactivado com 0 estrelas mostra «Escolhe uma classificação»', () => {
    render(
      <AvaliarFormFields
        estrelas={0}
        onEstrelasChange={() => {}}
        comentario=""
        onComentarioChange={() => {}}
        onSubmit={vi.fn()}
        contraparteLabel="João M."
      />,
    );
    const btn = screen.getByTestId('avaliar-submit');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Escolhe uma classificação');
  });

  it('permite submeter com estrelas seleccionadas', () => {
    const onSubmit = vi.fn();
    render(
      <AvaliarFormFields
        estrelas={4}
        onEstrelasChange={() => {}}
        comentario="Só plataforma"
        onComentarioChange={() => {}}
        onSubmit={onSubmit}
        contraparteLabel="João M."
      />,
    );
    fireEvent.click(screen.getByTestId('avaliar-submit'));
    expect(onSubmit).toHaveBeenCalled();
  });
});
