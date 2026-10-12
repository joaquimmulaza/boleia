import { describe, it, expect } from 'vitest';
import {
  formatUseFreeTextLabel,
  FLEX_ONLY_FREE_TEXT_WARNING,
  GEOCODER_NETWORK_ERROR_MESSAGE,
  GEOCODER_RETRY_LABEL,
  GEOCODER_FIELD_UNRESOLVED_PROVISIONAL,
  GEOCODER_FIELD_UNRESOLVED_TODO,
} from './addressGeocoderCopy';

describe('addressGeocoderCopy', () => {
  it('formatUseFreeTextLabel usa aspas curvas', () => {
    expect(formatUseFreeTextLabel('Mutamba')).toBe('Usar “Mutamba”');
  });

  it('copy final aviso texto livre (procura)', () => {
    expect(FLEX_ONLY_FREE_TEXT_WARNING).toBe(
      'Como este local não está no mapa, só as ofertas sem percurso fixo aparecem como compatíveis. Para veres mais, escolhe uma sugestão da lista.',
    );
  });

  it('copy final erro de rede geocoder', () => {
    expect(GEOCODER_NETWORK_ERROR_MESSAGE).toBe(
      'Não foi possível procurar locais. Verifica a ligação e tenta outra vez.',
    );
    expect(GEOCODER_RETRY_LABEL).toBe('Tentar outra vez');
  });

  it('campo por resolver: TODO só em código, UI provisória', () => {
    expect(GEOCODER_FIELD_UNRESOLVED_TODO).toMatch(/^TODO\(Copywriter\)/);
    expect(GEOCODER_FIELD_UNRESOLVED_PROVISIONAL).toBe('Escolhe um local da lista.');
    expect(GEOCODER_FIELD_UNRESOLVED_PROVISIONAL).not.toMatch(/TODO/);
  });
});
