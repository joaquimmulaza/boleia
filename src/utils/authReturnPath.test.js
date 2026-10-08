import { describe, it, expect } from 'vitest';
import {
  resolveSafeReturnPath,
  buildAuthUrlWithNext,
  resolvePostLoginPath,
  AUTH_RETURN_STORAGE_KEY,
} from './authReturnPath';

describe('resolveSafeReturnPath', () => {
  it('aceita caminhos internos com query', () => {
    expect(resolveSafeReturnPath('/explorar?origem=Viana&destino=Talatona')).toBe(
      '/explorar?origem=Viana&destino=Talatona',
    );
  });

  it('aceita query codificada com espaços e ampersand no valor', () => {
    const kilamba = '/explorar?origem=Kilamba%20Kiaxi&destino=Talatona';
    expect(resolveSafeReturnPath(kilamba)).toBe(kilamba);

    const rua = '/explorar?origem=Rua%20A%26B';
    expect(resolveSafeReturnPath(rua)).toBe(rua);
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
    expect(resolveSafeReturnPath('/%5C%5Cevil.com')).toBeNull();
  });

  it('rejeita tab ou protocol-relative após descodificação', () => {
    expect(resolveSafeReturnPath('/\t//evil.com')).toBeNull();
    expect(resolveSafeReturnPath('/%2F%2Fevil.com')).toBeNull();
    expect(resolveSafeReturnPath('/%2F%2Fevil.com?x=1')).toBeNull();
  });

  it('rejeita espaços literais no raw e newline', () => {
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

  it('round-trip preserva o caminho codificado exacto', () => {
    const paths = [
      '/explorar?origem=Kilamba%20Kiaxi&destino=Talatona',
      '/explorar?origem=Rua%20A%26B',
    ];

    for (const p of paths) {
      const url = buildAuthUrlWithNext('/auth', p);
      const qs = url.split('?')[1] || '';
      const next = new URLSearchParams(qs).get('next');
      expect(next).toBe(p);
      expect(resolvePostLoginPath(next, 'Passageiro')).toBe(p);
    }
  });

  it('round-trip Viana Estalagem e A&B+Talatona', () => {
    const paths = [
      '/explorar?origem=Viana%20Estalagem&destino=Talatona',
      '/explorar?origem=Viana&destino=A%26B+Talatona',
    ];

    for (const p of paths) {
      const url = buildAuthUrlWithNext('/auth', p);
      const qs = url.split('?')[1] || '';
      const next = new URLSearchParams(qs).get('next');
      expect(next).toBe(p);
      expect(resolvePostLoginPath(next, 'Passageiro')).toBe(p);
    }
  });
});

describe('AUTH_RETURN_STORAGE_KEY', () => {
  it('é constante para OAuth', () => {
    expect(AUTH_RETURN_STORAGE_KEY).toBe('bc_auth_return');
  });
});
