import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AutocompleteDropdown from './AutocompleteDropdown';
import {
  GEOCODER_NETWORK_ERROR_MESSAGE,
  GEOCODER_RETRY_LABEL,
  formatUseFreeTextLabel,
} from '../utils/addressGeocoderCopy';

const LISTBOX_ID = 'test-listbox';

describe('AutocompleteDropdown', () => {
  const mockSuggestions = [
    { place_id: '1', description: 'Luanda, Angola' },
    { place_id: '2', description: 'Talatona, Luanda' },
  ];

  it('renders loading state correctly', () => {
    render(
      <AutocompleteDropdown
        loading={true}
        listboxId={LISTBOX_ID}
        activeIndex={0}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('A procurar...')).toBeInTheDocument();
  });

  it('estado de rede é distinto de sem resultados, retry primário e Usar texto', () => {
    const onRetry = vi.fn();
    const onUseFreeText = vi.fn();
    render(
      <AutocompleteDropdown
        errorKind="network"
        error="Failed to fetch"
        listboxId={LISTBOX_ID}
        activeIndex={0}
        onSelect={vi.fn()}
        onRetry={onRetry}
        freeTextActionLabel={formatUseFreeTextLabel('Talatona')}
        onUseFreeText={onUseFreeText}
      />,
    );

    expect(screen.getByTestId('geocoder-network-error')).toBeInTheDocument();
    expect(screen.getByText(GEOCODER_NETWORK_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByTestId('geocoder-empty-state')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: GEOCODER_RETRY_LABEL }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: formatUseFreeTextLabel('Talatona') }));
    expect(onUseFreeText).toHaveBeenCalledTimes(1);
  });

  it('renders error state correctly', () => {
    const errorMessage = 'Erro ao carregar sugestões';
    render(
      <AutocompleteDropdown
        error={errorMessage}
        listboxId={LISTBOX_ID}
        activeIndex={0}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('renders null when there are no suggestions', () => {
    const { container } = render(
      <AutocompleteDropdown
        suggestions={[]}
        listboxId={LISTBOX_ID}
        activeIndex={0}
        onSelect={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders suggestions listbox com role=option', () => {
    render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        listboxId={LISTBOX_ID}
        activeIndex={1}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole('listbox')).toHaveAttribute('id', LISTBOX_ID);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('id', `${LISTBOX_ID}-option-1`);
  });

  it('mostra mensagem vazia e acção de texto livre quando configurado', () => {
    const onUseFreeText = vi.fn();
    render(
      <AutocompleteDropdown
        suggestions={[]}
        listboxId={LISTBOX_ID}
        activeIndex={0}
        onSelect={vi.fn()}
        emptyMessage="Não encontrámos este local. Podes usar o que escreveste."
        freeTextActionLabel='Usar “Talatona”'
        onUseFreeText={onUseFreeText}
      />,
    );

    expect(
      screen.getByText('Não encontrámos este local. Podes usar o que escreveste.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar “Talatona”' }));
    expect(onUseFreeText).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when a suggestion is clicked', () => {
    const onSelectMock = vi.fn();
    render(
      <AutocompleteDropdown
        suggestions={mockSuggestions}
        listboxId={LISTBOX_ID}
        activeIndex={0}
        onSelect={onSelectMock}
      />,
    );

    fireEvent.click(screen.getByRole('option', { name: /Luanda, Angola/i }));

    expect(onSelectMock).toHaveBeenCalledWith(mockSuggestions[0]);
    expect(onSelectMock).toHaveBeenCalledTimes(1);
  });
});
