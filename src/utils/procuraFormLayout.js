/**
 * Layout do form Nova/Editar procura — scroll no `<main class="pb-shell">` (Layout + bottom nav).
 * Footer sticky `bottom-0` com `pb-3` — não repetir altura da nav (pb-shell do main já reserva).
 */

/** @type {string} */
export const PROCURA_FORM_CLASS =
  'flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm';

/** @type {string} */
export const PROCURA_FORM_BODY_CLASS = 'space-y-4 p-5';

/**
 * Footer sticky com bottom nav (PassengerDashboard / Layout). Só `pb-3` — sem shell inset duplicado.
 * @type {string}
 */
export const PROCURA_FORM_SUBMIT_FOOTER_CLASS =
  'sticky bottom-0 z-[1] shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-3 dark:border-slate-800 dark:bg-slate-900';

/**
 * Safe-area extra quando não há bottom nav (capturas DEV sem Layout).
 * @type {string}
 */
export const PROCURA_FORM_SUBMIT_FOOTER_STANDALONE_SAFE_CLASS = 'pb-safe';
