import { describe, it, expect } from 'vitest';
import {
  copyMotoristaJustaCausaParcial,
  copyMotoristaJustaCausaUltimoPassageiro,
  resolveMotoristaJustaCausaPassageiroAlerts,
} from './driverJustaCausaPassageiroCopy';

describe('copy motorista — justa causa passageiro v1.10', () => {
  it('B) parcial — copy FINAL com nome e data', () => {
    expect(
      copyMotoristaJustaCausaParcial({
        nome: 'Ana',
        dataFormatada: '12 de outubro de 2026',
      }),
    ).toBe(
      'O lugar de Ana terminou por justa causa a 12 de outubro de 2026. Recebes a parte do mês desse lugar até essa data, menos a comissão da Boleia Certa. Os outros passageiros continuam no acordo e não há penalização para ti.',
    );
  });

  it('B2) último passageiro — copy FINAL com nome e data', () => {
    expect(
      copyMotoristaJustaCausaUltimoPassageiro({
        nome: 'Ana',
        dataFormatada: '12 de outubro de 2026',
      }),
    ).toBe(
      'O lugar de Ana terminou por justa causa a 12 de outubro de 2026, e o acordo foi encerrado porque era o último passageiro. Recebes a parte do mês até essa data, menos a comissão da Boleia Certa. A tua oferta continua publicada e não há penalização para ti.',
    );
  });

  it('resolveMotoristaJustaCausaPassageiroAlerts — B quando acordo activo', () => {
    const alerts = resolveMotoristaJustaCausaPassageiroAlerts(
      {
        estado: 'activo',
        encerramento_motivo: null,
      },
      [
        {
          id: 'ap-1',
          passenger_id: 'p1',
          lugar_rescisao_modo: 'justa_causa',
          lugar_rescisao_em: '2026-10-12T10:00:00.000Z',
          perfis: { nome_completo: 'Ana Costa' },
        },
        { id: 'ap-2', passenger_id: 'p2', estado: 'activo' },
      ],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].variant).toBe('B');
    expect(alerts[0].corpo).toContain('Os outros passageiros continuam no acordo');
    expect(alerts[0].corpo).toContain('Ana');
  });

  it('resolveMotoristaJustaCausaPassageiroAlerts — B2 quando sem_lugares_vivos', () => {
    const alerts = resolveMotoristaJustaCausaPassageiroAlerts(
      {
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
      },
      [
        {
          id: 'ap-solo',
          passenger_id: 'p1',
          lugar_rescisao_modo: 'justa_causa',
          lugar_rescisao_em: '2026-10-12T10:00:00.000Z',
          perfis: { nome_completo: 'Ana Costa' },
        },
      ],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].variant).toBe('B2');
    expect(alerts[0].corpo).toContain('era o último passageiro');
    expect(alerts[0].corpo).toContain('oferta continua publicada');
  });

  it('B2 só no lugar com lugar_rescisao_em mais recente quando acordo fechou', () => {
    const alerts = resolveMotoristaJustaCausaPassageiroAlerts(
      {
        estado: 'cancelado',
        encerramento_motivo: 'sem_lugares_vivos',
      },
      [
        {
          id: 'ap-antigo',
          passenger_id: 'p-antigo',
          estado: 'saiu',
          lugar_rescisao_modo: 'justa_causa',
          lugar_rescisao_em: '2026-10-01T10:00:00.000Z',
          perfis: { nome_completo: 'Ana Antiga' },
        },
        {
          id: 'ap-recente',
          passenger_id: 'p-recente',
          estado: 'saiu',
          lugar_rescisao_modo: 'justa_causa',
          lugar_rescisao_em: '2026-10-12T10:00:00.000Z',
          perfis: { nome_completo: 'Bruno Recente' },
        },
      ],
    );
    expect(alerts).toHaveLength(2);
    const b2 = alerts.filter((a) => a.variant === 'B2');
    const b = alerts.filter((a) => a.variant === 'B');
    expect(b2).toHaveLength(1);
    expect(b2[0].id).toBe('ap-recente');
    expect(b2[0].corpo).toContain('Bruno');
    expect(b).toHaveLength(1);
    expect(b[0].corpo).toContain('Os outros passageiros continuam no acordo');
    expect(b[0].corpo).toContain('Ana');
  });

  it('banner B — data civil Luanda com timestamp perto da meia-noite UTC', () => {
    const alerts = resolveMotoristaJustaCausaPassageiroAlerts(
      { estado: 'activo', encerramento_motivo: null },
      [
        {
          id: 'ap-1',
          passenger_id: 'p1',
          lugar_rescisao_modo: 'justa_causa',
          lugar_rescisao_em: '2026-10-12T23:30:00.000Z',
          perfis: { nome_completo: 'Ana Costa' },
        },
        { id: 'ap-2', passenger_id: 'p2', estado: 'activo' },
      ],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].corpo).toMatch(/13 de outubro de 2026/i);
    expect(alerts[0].corpo).not.toMatch(/12 de outubro de 2026/i);
  });

  it('ignora saída normal (sem lugar_rescisao_modo justa_causa)', () => {
    const alerts = resolveMotoristaJustaCausaPassageiroAlerts(
      { estado: 'activo', encerramento_motivo: null },
      [{ id: 'ap-1', estado: 'saiu', perfis: { nome_completo: 'Ana' } }],
    );
    expect(alerts).toHaveLength(0);
  });
});
