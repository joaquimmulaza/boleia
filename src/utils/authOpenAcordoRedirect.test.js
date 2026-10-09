import { describe, it, expect } from 'vitest';
import {
  sanitizeOpenAcordoId,
  buildAuthUrlWithOpenAcordo,
  parseOpenAcordoIdFromSearch,
  resolvePostLoginPathWithOpenAcordo,
} from './authOpenAcordoRedirect.js';

const VALID = '3f42eca2-03c9-8153-b9ea-c6e621e03656';

describe('authOpenAcordoRedirect — segurança openAcordoId', () => {
  it('aceita UUID válido', () => {
    expect(sanitizeOpenAcordoId(VALID)).toBe(VALID);
    expect(sanitizeOpenAcordoId(VALID.toUpperCase())).toBe(VALID);
  });

  it('rejeita valores maliciosos ou não-UUID', () => {
    const malicious = [
      'abc-123',
      '../../../etc/passwd',
      '/acordos?openAcordoId=x',
      'https://evil.example',
      '3f42eca2-03c9-8153-b9ea-c6e621e03656%0a%0d',
      '3f42eca2-03c9-8153-b9ea-c6e621e03656&next=/evil',
      'javascript:alert(1)',
      `${VALID}extra`,
      '00000000-0000-0000-0000-000000000000',
    ];
    malicious.forEach((value) => {
      expect(sanitizeOpenAcordoId(value)).toBeNull();
    });
  });

  it('buildAuthUrlWithOpenAcordo nunca inclui next nem path completo', () => {
    const url = buildAuthUrlWithOpenAcordo({
      openAcordoId: VALID,
      sessionEnded: true,
    });
    expect(url).toBe(`/auth?openAcordoId=${VALID}&sessionEnded=1`);
    expect(url).not.toContain('next=');
    expect(url).not.toContain('/acordos');
  });

  it('ID inválido omitido da URL de auth', () => {
    expect(buildAuthUrlWithOpenAcordo({ openAcordoId: 'not-uuid', sessionEnded: true }))
      .toBe('/auth?sessionEnded=1');
  });

  it('parseOpenAcordoIdFromSearch extrai só UUID da query', () => {
    expect(parseOpenAcordoIdFromSearch(`?openAcordoId=${VALID}&focus=pagamento`)).toBe(VALID);
    expect(parseOpenAcordoIdFromSearch(`?openAcordoId=evil`)).toBeNull();
  });

  it('pós-login reconstrói /acordos?openAcordoId= ou /acordos se inválido', () => {
    expect(resolvePostLoginPathWithOpenAcordo(null, VALID, 'Passageiro')).toBe(
      `/acordos?openAcordoId=${VALID}`,
    );
    expect(resolvePostLoginPathWithOpenAcordo('/evil', 'bad-id', 'Passageiro')).toBe('/acordos');
    expect(resolvePostLoginPathWithOpenAcordo('/explorar', null, 'Passageiro')).toBe('/explorar');
  });
});
