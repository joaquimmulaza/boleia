/** Disparado quando um bottom sheet entra em modo drag (translateY). */
export const SHEET_DRAG_START_EVENT = 'boleia:sheet-drag-start';

export function emitSheetDragStart() {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent(SHEET_DRAG_START_EVENT));
}
