import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DriverOfertaCard from './DriverOfertaCard';

const oferta = {
  id: 'of-1',
  origin_name: 'Talatona',
  destination_name: 'Mutual',
  departure_time: '07:15',
  vagas_disponiveis: 3,
  valor_mensal_ask_kz: 120000,
  flexibilidade_rota: false,
};

const defaultProps = {
  oferta,
  chip: { label: 'Disponível', className: 'bg-emerald-100' },
  horario: '07:15',
  tipoRota: 'Fixa',
  modoLabel: 'Por passageiro',
  canEdit: true,
  canDespublicar: true,
  editing: false,
  ofertaBusy: false,
  editPropostas: [],
  editProcurasById: {},
  onOpenDetail: vi.fn(),
  onVerProcuras: vi.fn(),
  onVerPropostas: vi.fn(),
  onEditar: vi.fn(),
  onDespublicar: vi.fn(),
  onCancelEdit: vi.fn(),
  onSaved: vi.fn(),
};

describe('DriverOfertaCard', () => {
  it('kebab não é descendente do botão de detalhe (sem interactive aninhado)', () => {
    render(<DriverOfertaCard {...defaultProps} />);

    const detailBtn = screen.getByTestId('driver-oferta-detail-trigger');
    const kebabBtn = screen.getByRole('button', { name: /Mais acções/i });

    expect(detailBtn.contains(kebabBtn)).toBe(false);
    expect(detailBtn).toContainElement(screen.getByText('120 000 Kz'));
    expect(detailBtn).toContainElement(screen.getByText(/07:15/));
    expect(detailBtn.querySelector('button')).toBeNull();
  });

  it('tap na rota/preço abre detalhe; kebab Editar não dispara detalhe', () => {
    const onOpenDetail = vi.fn();
    const onEditar = vi.fn();

    render(
      <DriverOfertaCard
        {...defaultProps}
        onOpenDetail={onOpenDetail}
        onEditar={onEditar}
      />,
    );

    fireEvent.click(screen.getByText('120 000 Kz'));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);

    onOpenDetail.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Mais acções/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Editar oferta/i }));

    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).not.toHaveBeenCalled();
  });
});
