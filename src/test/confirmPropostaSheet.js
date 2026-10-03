import { screen, fireEvent, within } from '@testing-library/react';

/**
 * Confirma o sheet de proposta aberto.
 * No hub do motorista, procura e grupo usam OpportunityProposalSheet.
 * Os outros fluxos mantêm «Confirmar proposta».
 */
export async function confirmPropostaSheet() {
  const oportunidade = screen.queryByTestId('opportunity-proposal-sheet');
  if (oportunidade) {
    fireEvent.click(within(oportunidade).getByRole('button', { name: 'Enviar proposta' }));
    return;
  }
  fireEvent.click(await screen.findByRole('button', { name: /Confirmar proposta/i }));
}
