/**
 * @typedef {{ lat?: number | null, lng?: number | null }} StoredOdCoords
 * @typedef {{ lat: number | null, lng: number | null, freeText: boolean }} FormOdField
 */

/**
 * Origem/destino no payload: texto livre confirmado anula coords;
 * senão form; senão (edição) coords já guardados na procura.
 * @param {FormOdField} formField
 * @param {StoredOdCoords | null | undefined} storedRow
 * @returns {{ lat: number | null, lng: number | null }}
 */
export function resolveProcuraOdFieldForPayload(formField, storedRow) {
  if (formField.freeText) {
    return { lat: null, lng: null };
  }
  if (formField.lat != null && formField.lng != null) {
    return { lat: formField.lat, lng: formField.lng };
  }
  const storedLat = storedRow?.lat ?? null;
  const storedLng = storedRow?.lng ?? null;
  if (storedLat != null && storedLng != null) {
    return { lat: storedLat, lng: storedLng };
  }
  return { lat: formField.lat ?? null, lng: formField.lng ?? null };
}
