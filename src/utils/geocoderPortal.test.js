import { describe, it, expect, afterEach } from 'vitest';
import { resolveGeocoderPortalContainer } from './geocoderPortal';

describe('resolveGeocoderPortalContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('usa o dialog aria-modal quando o campo está dentro dele', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const anchor = document.createElement('div');
    dialog.appendChild(anchor);
    document.body.appendChild(dialog);

    expect(resolveGeocoderPortalContainer(anchor)).toBe(dialog);
  });

  it('cai para document.body fora de dialog', () => {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);

    expect(resolveGeocoderPortalContainer(anchor)).toBe(document.body);
  });
});
