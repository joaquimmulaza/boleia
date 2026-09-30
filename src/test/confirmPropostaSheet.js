import { screen, fireEvent } from '@testing-library/react';

/** Confirma sheet de counter-ask (#30) nos testes de proposta. */
export async function confirmPropostaSheet() {
  fireEvent.click(await screen.findByRole('button', { name: /Confirmar proposta/i }));
}
