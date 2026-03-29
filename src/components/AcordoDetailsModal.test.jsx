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
  estado: 'Pendente',
  routes: {
    origin_name: 'Talatona',
    destination_name: 'Maianga',
    departure_time: '07:30',
    return_time: '18:00',
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
    render(<AcordoDetailsModal isOpen={true} acordo={mockAcordo} userRole="Passageiro" onClose={handleClose} onAccept={vi.fn()} onReject={vi.fn()} />);
    
    // Either a generic button or close icon
    const closeButtons = screen.getAllByRole('button');
    // Click the first one which is usually the X icon
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('deve exibir badge de estado e horários corretamente', () => {
    render(<AcordoDetailsModal isOpen={true} acordo={{...mockAcordo, estado: 'Pendente'}} userRole="Passageiro" onClose={vi.fn()} />);
    
    expect(screen.getByText(/Pendente/i)).toBeInTheDocument();
    expect(screen.getByText(/07:30/i)).toBeInTheDocument();
    expect(screen.getByText(/18:00/i)).toBeInTheDocument();
  });

  it('se Motorista e Pendente, deve exibir botões de Aceitar e Recusar', () => {
    const handleAccept = vi.fn();
    const handleReject = vi.fn();
    
    render(
      <AcordoDetailsModal 
        isOpen={true} 
        acordo={{...mockAcordo, estado: 'Pendente'}} 
        userRole="Motorista" 
        onClose={vi.fn()} 
        onAccept={handleAccept} 
        onReject={handleReject} 
      />
    );
    
    const btnAccept = screen.getByText(/Aceitar Pedido/i);
    const btnReject = screen.getByText(/Recusar Pedido|Recusar/i);
    
    expect(btnAccept).toBeInTheDocument();
    expect(btnReject).toBeInTheDocument();
    
    fireEvent.click(btnAccept);
    expect(handleAccept).toHaveBeenCalledWith('acordo-1');
    
    fireEvent.click(btnReject);
    expect(handleReject).toHaveBeenCalledWith('acordo-1');
  });
});
