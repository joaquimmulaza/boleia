import { describe, it, expect } from 'vitest';
import { getFriendlyErrorMessage } from './errorHandler';

describe('getFriendlyErrorMessage', () => {
  it('Cenário 1: Deve retornar mensagem de permissão para erros de RLS', () => {
    const error = { message: 'new row violates row-level security policy' };
    expect(getFriendlyErrorMessage(error)).toBe('Não tem permissão para realizar esta operação.');
  });

  it('Cenário 2: Deve retornar mensagem de erro de login', () => {
    const error = { message: 'Invalid login credentials' };
    expect(getFriendlyErrorMessage(error)).toBe('Email ou palavra-passe incorretos.');
  });

  it('Cenário 3: Deve retornar alerta de email já registado', () => {
    const error = { message: 'User already registered' };
    expect(getFriendlyErrorMessage(error)).toBe('Este email já está registado na plataforma.');
  });

  it('Cenário 4: Deve avisar sobre falha na rede (Failed to fetch)', () => {
    const error = { message: 'Failed to fetch' };
    expect(getFriendlyErrorMessage(error)).toBe('Sem ligação à internet. Verifique a sua rede.');
  });

  it('Cenário 5: Deve retornar mensagem genérica para erros desconhecidos ou indefinidos', () => {
    const error = { message: 'Some weird unknown database error' };
    expect(getFriendlyErrorMessage(error)).toBe('Ocorreu um erro inesperado. Tente novamente.');
    
    expect(getFriendlyErrorMessage(undefined)).toBe('Ocorreu um erro inesperado. Tente novamente.');
    expect(getFriendlyErrorMessage(null)).toBe('Ocorreu um erro inesperado. Tente novamente.');
  });
});
