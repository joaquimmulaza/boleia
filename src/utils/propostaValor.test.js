import { describe, it, expect } from 'vitest';
import {
  parseValorPropostaKz,
  validarValorPropostaKz,
  labelValorProposta,
  MENSAGEM_VALOR_PROPOSTA_MINIMO,
  aplicarValidacaoNativaValorProposta,
} from './propostaValor.js';

describe('propostaValor', () => {
  describe('parseValorPropostaKz', () => {
    it('converte string numérica para inteiro', () => {
      expect(parseValorPropostaKz('45000')).toBe(45000);
    });

    it('remove separadores não numéricos', () => {
      expect(parseValorPropostaKz('45 000')).toBe(45000);
    });

    it('aceita número directo', () => {
      expect(parseValorPropostaKz(35000)).toBe(35000);
    });
  });

  describe('validarValorPropostaKz', () => {
    it('aceita valor inteiro positivo', () => {
      expect(validarValorPropostaKz(1)).toEqual({ ok: true, valor: 1 });
      expect(validarValorPropostaKz(45000)).toEqual({ ok: true, valor: 45000 });
    });

    it('rejeita zero ou negativo com copy PT', () => {
      expect(validarValorPropostaKz(0)).toEqual({ ok: false, erro: MENSAGEM_VALOR_PROPOSTA_MINIMO });
      expect(validarValorPropostaKz(-100).ok).toBe(false);
    });

    it('rejeita valor não inteiro', () => {
      expect(validarValorPropostaKz(45000.5).ok).toBe(false);
    });
  });

  describe('aplicarValidacaoNativaValorProposta', () => {
    it('define mensagem PT para min=1 (evita toast EN do browser)', () => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.value = '0';
      input.checkValidity();
      aplicarValidacaoNativaValorProposta(input);
      expect(input.validationMessage).toBe(MENSAGEM_VALOR_PROPOSTA_MINIMO);
    });
  });

  describe('labelValorProposta', () => {
    it('POR_PASSAGEIRO → label por passageiro', () => {
      expect(labelValorProposta('POR_PASSAGEIRO')).toMatch(/passageiro/i);
    });

    it('TOTAL_ACORDO → label valor total do acordo', () => {
      expect(labelValorProposta('TOTAL_ACORDO')).toMatch(/valor.*total do acordo/i);
    });
  });
});
