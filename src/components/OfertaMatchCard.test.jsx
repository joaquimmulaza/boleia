import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OfertaMatchCard from './OfertaMatchCard';
import {
  labelCapacidade,
  labelModoPreco,
  labelRotaOferta,
} from '../utils/ofertaLabels';

const ofertaBase = {
  id: 'of-1',
  origin_name: 'Talatona',
  destination_name: 'Miramar',
  departure_time: '07:15:00',
  vagas_disponiveis: 3,
  valor_mensal_ask_kz: 120000,
  modo_preco: 'TOTAL_ACORDO',
};

describe('OfertaMatchCard — labels canónicos', () => {
  it('labelModoPreco usa copy humana, nunca enums', () => {
    expect(labelModoPreco('POR_PASSAGEIRO')).toBe('Por passageiro');
    expect(labelModoPreco('TOTAL_ACORDO')).toBe('Total do acordo');
    expect(labelModoPreco('POR_PASSAGEIRO')).not.toMatch(/POR_PASSAGEIRO/);
  });

  it('labelCapacidade descreve lugares disponíveis (não divisor de preço)', () => {
    expect(labelCapacidade(1)).toBe('1 lugar disponível');
    expect(labelCapacidade(3)).toBe('3 lugares disponíveis');
    expect(labelCapacidade(0)).toBe('0 lugares disponíveis');
  });

  it('labelRotaOferta trata oferta flexível sem OD', () => {
    expect(labelRotaOferta({ flexibilidade_rota: true })).toEqual({
      origem: 'Oferta flexível',
      destino: 'Sem origem/destino fixos',
    });
    expect(labelRotaOferta(ofertaBase)).toEqual({
      origem: 'Talatona',
      destino: 'Miramar',
    });
  });
});

describe('OfertaMatchCard — variante directa', () => {
  it('mostra chip Disponível, capacidade, preço e modo humano com CTA Propor acordo', () => {
    const onPropor = vi.fn();
    render(
      <OfertaMatchCard
        oferta={ofertaBase}
        variant="direct"
        onPropor={onPropor}
      />,
    );

    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText('3 lugares disponíveis')).toBeInTheDocument();
    expect(screen.getByText('Total do acordo')).toBeInTheDocument();
    expect(screen.getByText(/120[\s.]?000/)).toBeInTheDocument();
    expect(screen.queryByText('POR_PASSAGEIRO')).not.toBeInTheDocument();
    expect(screen.queryByText('TOTAL_ACORDO')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Propor acordo/i }));
    expect(onPropor).toHaveBeenCalledTimes(1);
  });

  it('POR_PASSAGEIRO aparece só como «Por passageiro»', () => {
    render(
      <OfertaMatchCard
        oferta={{ ...ofertaBase, modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 40000 }}
        variant="direct"
        onPropor={() => {}}
      />,
    );
    expect(screen.getByText('Por passageiro')).toBeInTheDocument();
    expect(screen.queryByText(/POR_PASSAGEIRO/)).not.toBeInTheDocument();
  });
});

describe('OfertaMatchCard — variante waitlist', () => {
  it('mostra preço/modo iguais à lista directa e CTA Entrar na lista de espera', () => {
    const onWaitlist = vi.fn();
    render(
      <OfertaMatchCard
        oferta={{ ...ofertaBase, vagas_disponiveis: 1, modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 40000 }}
        variant="waitlist"
        waitlistEstado={null}
        onWaitlist={onWaitlist}
      />,
    );

    expect(screen.getByText('Sem vagas')).toBeInTheDocument();
    expect(screen.getByText(/Sem lugares suficientes agora/i)).toBeInTheDocument();
    expect(screen.getAllByText('1 lugar disponível').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Por passageiro')).toBeInTheDocument();
    expect(screen.getByText(/40[\s.]?000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Entrar na lista de espera/i }));
    expect(onWaitlist).toHaveBeenCalledTimes(1);
  });

  it('estado notificada: CTA Propor acordo (igual à oferta directa)', () => {
    const onPropor = vi.fn();
    render(
      <OfertaMatchCard
        oferta={ofertaBase}
        variant="waitlist"
        waitlistEstado="notificada"
        onPropor={onPropor}
      />,
    );

    expect(screen.getByText('Vaga aberta')).toBeInTheDocument();
    expect(screen.getByText(/Há uma vaga — podes propor acordo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Propor acordo/i }));
    expect(onPropor).toHaveBeenCalledTimes(1);
  });

  it('estado activa: mensagem sem CTA duplicado', () => {
    render(
      <OfertaMatchCard
        oferta={ofertaBase}
        variant="waitlist"
        waitlistEstado="activa"
      />,
    );
    expect(screen.getByText(/Estás na lista de espera/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entrar na lista de espera/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();
  });
});

describe('OfertaMatchCard — variante browse (feed sem procura)', () => {
  it('mostra chip Publicada, preço e sem CTAs de acção', () => {
    render(
      <OfertaMatchCard
        oferta={{ ...ofertaBase, flexibilidade_rota: true }}
        variant="browse"
      />,
    );

    expect(screen.getByTestId('oferta-match-browse')).toBeInTheDocument();
    expect(screen.getByText('Publicada')).toBeInTheDocument();
    expect(screen.getByText('Oferta flexível')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entrar na lista de espera/i })).not.toBeInTheDocument();
  });
});

describe('OfertaMatchCard — CTAs só com auth (callback)', () => {
  it('variante directa sem onPropor não mostra botão Propor acordo', () => {
    render(<OfertaMatchCard oferta={ofertaBase} variant="direct" />);
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/120[\s.]?000/)).toBeInTheDocument();
  });

  it('waitlist notificada sem onPropor não mostra botão Propor acordo', () => {
    render(
      <OfertaMatchCard
        oferta={ofertaBase}
        variant="waitlist"
        waitlistEstado="notificada"
      />,
    );
    expect(screen.getByText(/Há uma vaga — podes propor acordo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();
  });

  it('waitlist sem estado e sem onWaitlist não mostra botão Entrar na lista de espera', () => {
    render(
      <OfertaMatchCard
        oferta={{ ...ofertaBase, vagas_disponiveis: 1 }}
        variant="waitlist"
        waitlistEstado={null}
      />,
    );
    expect(screen.queryByRole('button', { name: /Entrar na lista de espera/i })).not.toBeInTheDocument();
  });
});
