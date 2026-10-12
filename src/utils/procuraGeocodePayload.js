/**
 * @typedef {{
 *   name: string,
 *   lat: number | null,
 *   lng: number | null,
 *   freeText: boolean,
 *   savedName?: string,
 *   savedLat?: number | null,
 *   savedLng?: number | null,
 *   savedFreeText?: boolean,
 *   lastSelectedName?: string | null,
 * }} ProcuraOdFieldInput
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   unresolved?: boolean,
 *   lat: number | null,
 *   lng: number | null,
 * }} ProcuraOdFieldResolution
 */

/**
 * Resolve origem/destino para payload: nunca combina texto novo com lat/lng antigas;
 * texto igual ao guardado reutiliza coords guardadas; Usar confirma texto livre (null).
 * @param {ProcuraOdFieldInput} field
 * @returns {ProcuraOdFieldResolution}
 */
export function resolveProcuraOdFieldForPayload(field) {
  const name = String(field.name || '').trim();
  const savedName = String(field.savedName || '').trim();
  const lastSelectedName = String(field.lastSelectedName || '').trim();

  if (field.freeText) {
    return { ok: true, lat: null, lng: null };
  }

  if (savedName && name === savedName) {
    const savedFree = Boolean(field.savedFreeText);
    const savedLat = field.savedLat ?? null;
    const savedLng = field.savedLng ?? null;
    if (savedFree || (savedLat == null && savedLng == null)) {
      return { ok: true, lat: null, lng: null };
    }
    if (savedLat != null && savedLng != null) {
      return { ok: true, lat: savedLat, lng: savedLng };
    }
  }

  if (
    lastSelectedName
    && name === lastSelectedName
    && field.lat != null
    && field.lng != null
  ) {
    return { ok: true, lat: field.lat, lng: field.lng };
  }

  if (!name) {
    return { ok: false, unresolved: false, lat: null, lng: null };
  }

  return { ok: false, unresolved: true, lat: null, lng: null };
}

/**
 * @param {ProcuraOdFieldInput} field
 * @returns {boolean}
 */
export function isProcuraOdFieldUnresolved(field) {
  const result = resolveProcuraOdFieldForPayload(field);
  return Boolean(result.unresolved);
}
