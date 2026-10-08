import { describe, it, expect } from 'vitest';
import {
  resolveSafeReturnPath,
  buildAuthUrlWithNext,
  AUTH_RETURN_STORAGE_KEY,
} from './authReturnPath';

describe('resolveSafeReturnPath', () => {
  it('aceita caminhos internos com query', () => {
    expect(resolveSafeReturnPath('/explorar?origem=Viana&destino=Talatona')).toBe(
      '/explorar?origem=Viana&destino=Talatona',
    );
  });

  it('aceita caminho simples', () => {
    expect(resolveSafeReturnPath('/passageiro')).toBe('/passageiro');
  });

  it('rejeita URL externa absoluta', () => {
    expect(resolveSafeReturnPath('https://evil.example/phish')).toBeNull();
  });

  it('rejeita protocol-relative', () => {
    expect(resolveSafeReturnPath('//evil.example/phish')).toBeNull();
  });

  it('rejeita valor vazio ou inválido', () => {
    expect(resolveSafeReturnPath('')).toBeNull();
    expect(resolveSafeReturnPath(null)).toBeNull();
    expect(resolveSafeReturnPath('passageiro')).toBeNull();
  });

  it('rejeita barra invertida (browsers normalizam para //)', () => {
    expect(resolveSafeReturnPath('/\\evil.com')).toBeNull();
    expect(resolveSafeReturnPath('/\\\\evil.com')).toBeNull();
    expect(resolveSafeReturnPath('/%5Cevil.com')).toBeNull();
  });

  it('rejeita tab ou protocol-relative após descodificação', () => {
    expect(resolveSafeReturnPath('/\t//evil.com')).toBeNull();
    expect(resolveSafeReturnPath('/%2F%2Fevil.com')).toBeNull();
  });

  it('rejeita espaços internos e newline', () => {
    expect(resolveSafeReturnPath('/ /evil.com')).toBeNull();
    expect(resolveSafeReturnPath('/\nfoo')).toBeNull();
  });
});

describe('buildAuthUrlWithNext', () => {
  it('anexa next seguro ao /auth', () => {
    const url = buildAuthUrlWithNext('/auth', '/explorar?origem=Viana&destino=Talatona');
    expect(url).toContain('/auth?');
    expect(url).toContain('next=%2Fexplorar%3Forigem%3DViana%26destino%3DTalatona');
  });

  it('preserva mode e role existentes', () => {
    const url = buildAuthUrlWithNext(
      '/auth?mode=register&role=passenger',
      '/explorar?origem=A&destino=B',
    );
    expect(url).toMatch(/mode=register/);
    expect(url).toMatch(/role=passenger/);
    expect(url).toMatch(/next=%2Fexplorar/);
  });

  it('omite next quando o caminho é inseguro', () => {
    const url = buildAuthUrlWithNext('/auth', 'https://evil.example');
    expect(url).toBe('/auth');
    expect(buildAuthUrlWithNext('/auth', '/\\evil.com')).toBe('/auth');
  });
});

describe('AUTH_RETURN_STORAGE_KEY', () => {
  it('é constante para OAuth', () => {
    expect(AUTH_RETURN_STORAGE_KEY).toBe('bc_auth_return');
  });
});
