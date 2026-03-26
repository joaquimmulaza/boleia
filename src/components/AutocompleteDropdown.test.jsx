import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AutocompleteDropdown from './AutocompleteDropdown';

describe('AutocompleteDropdown', () => {
  const mockSuggestions = [
    { place_id: '1', description: 'Luanda, Angola' },
    { place_id: '2', description: 'Talatona, Luanda' },
  ];

  it('renders loading state correctly', () => {
    render(<AutocompleteDropdown loading={true} />);
    expect(screen.getByText('A procurar...')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const errorMessage = 'Erro ao carregar sugestões';
    render(<AutocompleteDropdown error={errorMessage} />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('renders null when there are no suggestions', () => {
    const { container } = render(<AutocompleteDropdown suggestions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders suggestions list correctly', () => {
    render(<AutocompleteDropdown suggestions={mockSuggestions} />);

    mockSuggestions.forEach((suggestion) => {
      expect(screen.getByText(suggestion.description)).toBeInTheDocument();
    });
    expect(screen.getByText('Powered by Google')).toBeInTheDocument();
  });

  it('calls onSelect when a suggestion is clicked', () => {
    const onSelectMock = vi.fn();
    render(<AutocompleteDropdown suggestions={mockSuggestions} onSelect={onSelectMock} />);

    const firstSuggestion = screen.getByText(mockSuggestions[0].description);
    fireEvent.click(firstSuggestion);

    expect(onSelectMock).toHaveBeenCalledWith(mockSuggestions[0]);
    expect(onSelectMock).toHaveBeenCalledTimes(1);
  });
});
