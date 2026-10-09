import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AcordoContactosPanel from './AcordoContactosPanel.jsx';

describe('AcordoContactosPanel', () => {
  it('passageiro reservado + pendente: mostra próximo passo quando contactos bloqueados', () => {
    render(
      <AcordoContactosPanel
        contactos={{
          bloqueado: true,
          motivo: 'Aguarda validação do comprovativo.',
          motorista: { nome_completo: 'João', telefone: '+244923000001' },
        }}
        mostrarProximoPassoPagamento
      />,
    );
    expect(screen.getByTestId('contactos-bloqueados')).toBeInTheDocument();
    expect(screen.queryByText('+244923000001')).not.toBeInTheDocument();
    expect(screen.getByTestId('contactos-proximo-passo')).toHaveTextContent(
      /envia o comprovativo/i,
    );
    expect(screen.queryByTestId('contactos-aguardar-pagamento')).not.toBeInTheDocument();
  });

  it('passageiro: prop false (ex. comprovativo já enviado) — sem próximo passo', () => {
    render(
      <AcordoContactosPanel
        contactos={{
          bloqueado: true,
          motivo: 'Aguarda validação do comprovativo.',
        }}
        mostrarProximoPassoPagamento={false}
      />,
    );
    expect(screen.queryByTestId('contactos-proximo-passo')).not.toBeInTheDocument();
  });

  it('motorista: aguardar pagamento por passageiro reservado, sem próximo passo', () => {
    render(
      <AcordoContactosPanel
        contactos={{
          bloqueado: true,
          motivo: 'Disponíveis após pagamento em custódia.',
        }}
        passageirosAguardarPagamento={[{ nome: 'João Pedro' }]}
      />,
    );
    expect(screen.getByTestId('contactos-bloqueados')).toBeInTheDocument();
    expect(screen.queryByTestId('contactos-proximo-passo')).not.toBeInTheDocument();
    expect(screen.getByTestId('contactos-aguardar-pagamento')).toHaveTextContent(
      /A aguardar o pagamento de João Pedro\./,
    );
  });

  it('mostra telefone do motorista após em_custodia', () => {
    render(
      <AcordoContactosPanel
        contactos={{
          bloqueado: false,
          motorista: { nome_completo: 'João', telefone: '+244923000001' },
          passageiros: [],
        }}
      />,
    );
    expect(screen.getByTestId('contactos-desbloqueados')).toBeInTheDocument();
    expect(screen.getByText('+244923000001')).toBeInTheDocument();
  });
});
