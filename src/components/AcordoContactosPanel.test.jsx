import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AcordoContactosPanel from './AcordoContactosPanel.jsx';

describe('AcordoContactosPanel', () => {
  it('mostra aviso quando contactos bloqueados', () => {
    render(
      <AcordoContactosPanel
        contactos={{
          bloqueado: true,
          motivo: 'Aguarda validação do comprovativo.',
          motorista: { nome_completo: 'João', telefone: '+244923000001' },
        }}
      />,
    );
    expect(screen.getByTestId('contactos-bloqueados')).toBeInTheDocument();
    expect(screen.queryByText('+244923000001')).not.toBeInTheDocument();
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
