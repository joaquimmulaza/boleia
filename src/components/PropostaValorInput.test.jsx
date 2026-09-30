import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PropostaValorInput from './PropostaValorInput';

describe('PropostaValorInput', () => {
  it('pré-preenche e permite editar valor', () => {
    const onChange = vi.fn();
    render(
      <PropostaValorInput
        modoPreco="POR_PASSAGEIRO"
        value={45000}
        onChange={onChange}
        askKz={45000}
      />,
    );

    const input = screen.getByLabelText(/valor por passageiro na proposta/i);
    expect(input).toHaveValue(45000);
    fireEvent.change(input, { target: { value: '38000' } });
    expect(onChange).toHaveBeenCalled();
  });
});
