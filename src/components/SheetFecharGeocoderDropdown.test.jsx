import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddressInput from './AddressInput';
import SheetFecharButton from './SheetFecharButton';

const fetchPredictions = vi.fn();
const selectPlace = vi.fn();
const clearSuggestions = vi.fn();
let mockSuggestions = [];
let mockLoading = false;
let mockErrorKind = null;
let mockResolvedInput = null;
const retryLastFetch = vi.fn();

vi.mock('../hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    suggestions: mockSuggestions,
    loading: mockLoading,
    error: null,
    errorKind: mockErrorKind,
    resolvedInput: mockResolvedInput,
    fetchPredictions,
    retryLastFetch,
    selectPlace,
    clearSuggestions,
  }),
}));

/**
 * Reproduz layout do sheet Editar grupo: Fechar fora do wrapperRef do AddressInput.
 */
function EditarGrupoSheetStub() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return <div data-testid="sheet-fechado" />;
  }
  return (
    <div data-testid="editar-grupo-sheet">
      <div className="flex justify-between">
        <h2>Editar grupo</h2>
        <SheetFecharButton
          data-testid="editar-grupo-fechar"
          onClick={() => setOpen(false)}
        />
      </div>
      <AddressInput
        name="edit_pickup_name"
        label="Ponto de recolha (opcional)"
        required={false}
        value="Talatona"
        onChange={vi.fn()}
      />
    </div>
  );
}

describe('SheetFecharButton com dropdown de erro Photon aberto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestions = [];
    mockLoading = false;
    mockErrorKind = 'network';
    mockResolvedInput = 'Talatona';
  });

  it('um clique em Fechar fecha o sheet (não só o painel de erro)', () => {
    render(<EditarGrupoSheetStub />);

    const input = screen.getByRole('combobox', { name: /Ponto de recolha \(opcional\)/i });
    fireEvent.focus(input);
    expect(screen.getByTestId('geocoder-network-error')).toBeInTheDocument();

    const fechar = screen.getByTestId('editar-grupo-fechar');
    fireEvent.mouseDown(fechar);
    fireEvent.click(fechar);

    expect(screen.getByTestId('sheet-fechado')).toBeInTheDocument();
    expect(screen.queryByTestId('editar-grupo-sheet')).not.toBeInTheDocument();
  });
});
