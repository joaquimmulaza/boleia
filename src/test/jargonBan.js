import { expect } from 'vitest';

/** Copy de produto proibida na UI (PR #73 + sweep hubs). */
export const PRODUCT_JARGON_RE = /1:N|1:n|matchmaking|marketplace/i;

/** Enums / jargon de domínio — nunca na interface. */
export const DOMAIN_JARGON_RE =
  /N_candidato|N_proposto|N_actual|N_contrato|POR_PASSAGEIRO|TOTAL_ACORDO/;

/**
 * @param {string | null | undefined} text
 */
export function expectNoUserFacingJargon(text) {
  const value = text ?? '';
  expect(value).not.toMatch(PRODUCT_JARGON_RE);
  expect(value).not.toMatch(DOMAIN_JARGON_RE);
}
