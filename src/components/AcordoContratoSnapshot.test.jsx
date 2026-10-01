import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AcordoContratoSnapshot from './AcordoContratoSnapshot';

describe('AcordoContratoSnapshot', () => {
  it('renderiza modalidade, N, total e por pessoa quando complete', () => {
    render(
      <AcordoContratoSnapshot
        snapshot={{
          complete: true,
          modalidade: 'Por passageiro',
          nLabel: 'Grupo · 3 pessoas',
          nContrato: 3,
          totalMensalKz: 120000,
          porPassageiroKz: 40000,
          valorReferenciaLabel: 'Valor por passageiro',
          valorReferenciaKz: 40000,
          temResto: false,
        }}
      />,
    );

    expect(screen.getByTestId('acordo-contrato-snapshot')).toBeInTheDocument();
    expect(screen.getByText('Contrato acordado')).toBeInTheDocument();
    expect(screen.getByText('Modalidade')).toBeInTheDocument();
    expect(screen.getAllByText('Por passageiro').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Grupo · 3 pessoas')).toBeInTheDocument();
    expect(screen.getAllByText(/120\.?\s?000 Kz/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/40\.?\s?000 Kz/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/N_contrato/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/POR_PASSAGEIRO/i)).not.toBeInTheDocument();
  });

  it('mostra aviso quando snapshot incomplete', () => {
    render(
      <AcordoContratoSnapshot
        snapshot={{
          complete: false,
          missingFields: ['modo_preco'],
        }}
      />,
    );

    expect(screen.getByTestId('acordo-contrato-incomplete')).toBeInTheDocument();
    expect(screen.getByText(/dados do contrato incompletos/i)).toBeInTheDocument();
  });

  it('variant compact omite título longo', () => {
    render(
      <AcordoContratoSnapshot
        variant="compact"
        snapshot={{
          complete: true,
          modalidade: 'Total do acordo',
          nLabel: 'Individual',
          nContrato: 1,
          totalMensalKz: 45000,
          porPassageiroKz: 45000,
          valorReferenciaLabel: 'Total do acordo',
          valorReferenciaKz: 45000,
          temResto: false,
        }}
      />,
    );

    expect(screen.queryByText('Contrato acordado')).not.toBeInTheDocument();
    expect(screen.getByTestId('acordo-contrato-snapshot')).toBeInTheDocument();
  });
});
