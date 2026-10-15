/**
 * Layout do form Nova/Editar procura — scroll só no `<main>` do Layout (sem max-h interno).
 * Footer sticky com offset da bottom nav (`--shell-bottom-inset` em src/index.css).
 */

/** @type {string} */
export const PROCURA_FORM_CLASS =
  'flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm';

/** @type {string} */
export const PROCURA_FORM_BODY_CLASS = 'space-y-4 p-5';

/**
 * Sticky acima da bottom nav fixa (h-16 + pb-safe → `--shell-bottom-inset`).
 * @type {string}
 */
export const PROCURA_FORM_SUBMIT_FOOTER_CLASS =
  'sticky bottom-[var(--shell-bottom-inset)] z-[1] shrink-0 border-t border-slate-100 bg-white p-5 pt-3 dark:border-slate-800 dark:bg-slate-900';
