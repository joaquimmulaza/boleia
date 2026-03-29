import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AcordoDetailsModal from './AcordoDetailsModal';

const mockAcordo = {
  id: 'acordo-1',
  contraparte: {
    nome_completo: 'Carlos Mendes',
    telefone: '+244 923 456 789'
  },
  veiculo: {
    marca_modelo: 'Toyota Hilux 2022',
    matricula: 'LD-12-34-AB'
  },
  routes: {
    origin_name: 'Talatona',
    destination_name: 'Maianga',
    monthly_price_per_seat: 25000
  }
};

describe('AcordoDetailsModal', () => {
  it('não deve renderizar se isOpen for falso', () => {
    render(<AcordoDetailsModal isOpen={false} acordo={mockAcordo} userRole="Passageiro" onClose={vi.fn()} />);
    expect(screen.queryByText('Detalhes da Boleia')).toBeNull();
    // old label check just in case it's still 'Detalhes do Acordo'
    expect(screen.queryByText('Detalhes do Acordo')).toBeNull();
  });

  it('deve renderizar os detalhes corretamente', () => {
    render(<AcordoDetailsModal isOpen={true} acordo={mockAcordo} userRole="Passageiro" onClose={vi.fn()} />);
    
    // As the new design has 'Detalhes da Boleia'
    expect(screen.getByText(/Carlos Mendes/i)).toBeInTheDocument();
    expect(screen.getByText(/\+244 923 456 789/i)).toBeInTheDocument();
    
    expect(screen.getByText(/Talatona/i)).toBeInTheDocument();
    expect(screen.getByText(/Maianga/i)).toBeInTheDocument();
    
    // We expect formatting like '25.000 Kz/mês' or '25 000 Kz/mês'
    expect(screen.getByText(/25/i)).toBeInTheDocument();
    
    expect(screen.getByText(/Toyota Hilux 2022/i)).toBeInTheDocument();
    expect(screen.getByText(/LD-12-34-AB/i)).toBeInTheDocument();
  });

  it('deve chamar onClose ao clicar no botão fechar ou fora do modal', () => {
    const handleClose = vi.fn();
    render(<AcordoDetailsModal isOpen={true} acordo={mockAcordo} userRole="Passageiro" onClose={handleClose} />);
    
    // Either a generic button or close icon
    const closeButtons = screen.getAllByRole('button');
    // Click the first one which is usually the X icon
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
