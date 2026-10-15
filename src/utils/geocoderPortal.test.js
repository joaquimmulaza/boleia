import { describe, it, expect, afterEach } from 'vitest';
import { resolveGeocoderPortalContainer } from './geocoderPortal';

describe('resolveGeocoderPortalContainer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('prefere o mount fora do painel de drag quando existe', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const boundary = document.createElement('div');
    boundary.setAttribute('data-geocoder-sheet-boundary', '');
    const portal = document.createElement('div');
    portal.setAttribute('data-geocoder-sheet-portal', '');
    const anchor = document.createElement('div');
    boundary.appendChild(anchor);
    dialog.appendChild(boundary);
    dialog.appendChild(portal);
    document.body.appendChild(dialog);

    expect(resolveGeocoderPortalContainer(anchor)).toBe(portal);
  });

  it('usa o dialog aria-modal quando não há mount dedicado', () => {
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
