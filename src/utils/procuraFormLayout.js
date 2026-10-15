/**
 * Layout do form Nova/Editar procura — scroll só no `<main class="pb-shell">` do Layout.
 * Footer sticky `bottom-0` com `-mb-[shell-bottom-inset]` compensa o pb-shell do main;
 * `pb-[shell-bottom-inset]` no footer mantém o botão acima da nav com fundo opaco.
 */

/** @type {string} */
export const PROCURA_FORM_CLASS =
  'flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm';

/** @type {string} */
export const PROCURA_FORM_BODY_CLASS = 'space-y-4 p-5';

/**
 * Sticky no fundo do scrollport do main; margem negativa anula o pb-shell duplicado.
 * @type {string}
 */
export const PROCURA_FORM_SUBMIT_FOOTER_CLASS =
  'sticky bottom-0 z-[1] shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[var(--shell-bottom-inset)] -mb-[var(--shell-bottom-inset)] dark:border-slate-800 dark:bg-slate-900';
