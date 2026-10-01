import { describe, it, expect } from 'vitest';
import {
  abbrevNome,
  labelPropostaSheetRow,
  buildPropostasSheetSummary,
  chipPropostaSheet,
} from './propostaSheet.js';

describe('propostaSheet utils', () => {
  it('abbrevNome abrevia apelido', () => {
    expect(abbrevNome('Maria Silva')).toBe('Maria S.');
    expect(abbrevNome('João')).toBe('João');
  });

  it('labelPropostaSheetRow usa primeiro membro e N', () => {
    expect(
      labelPropostaSheetRow({
        membros: [{ nome: 'Maria Silva' }],
        proposta: { n_passageiros_propostos: 1 },
      }),
    ).toBe('Maria S. · 1 pax');
  });

  it('buildPropostasSheetSummary inclui 0 propostas no empty', () => {
    expect(
      buildPropostasSheetSummary({ tituloOferta: 'Oferta flexível', horario: '07:15', count: 0 }),
    ).toBe('Oferta flexível · 07:15 · 0 propostas');
  });

  it('buildPropostasSheetSummary pluraliza recebidas', () => {
    expect(
      buildPropostasSheetSummary({ tituloOferta: 'Oferta flexível', horario: '07:15', count: 2 }),
    ).toBe('Oferta flexível · 07:15 · 2 propostas recebidas');
  });

  it('buildPropostasSheetSummary descreve mix recebidas + enviadas + concluídas', () => {
    expect(
      buildPropostasSheetSummary({
        tituloOferta: 'Oferta flexível',
        horario: '07:15',
        count: 4,
        recebidas: 2,
        enviadas: 1,
        concluidas: 1,
      }),
    ).toBe('Oferta flexível · 07:15 · 2 recebidas · 1 enviada · 1 concluída');
  });

  it('chipPropostaSheet devolve Pendente para aberta', () => {
    expect(chipPropostaSheet('aberta')?.label).toBe('Pendente');
    expect(chipPropostaSheet('aceite')).toBeNull();
  });
});
