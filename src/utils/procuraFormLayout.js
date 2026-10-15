/**
 * Layout do form Nova/Editar procura — scroll só no `<main>` do Layout (sem max-h interno).
 * Footer sticky colado ao fundo do scrollport; fundo opaco até à bottom nav (`pb-[shell-bottom-inset]`).
 */

/** @type {string} */
export const PROCURA_FORM_CLASS =
  'flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm';

/** Corpo com reserva para o footer sticky (último campo + help text não ficam por baixo). */
/** @type {string} */
export const PROCURA_FORM_BODY_CLASS =
  'space-y-4 p-5 pb-[var(--procura-form-sticky-footer-reserve)]';

/**
 * Sticky no fundo do `<main>`; padding inferior = inset da nav (fundo tapa a zona da bottom bar).
 * @type {string}
 */
export const PROCURA_FORM_SUBMIT_FOOTER_CLASS =
  'sticky bottom-0 z-[1] shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[var(--shell-bottom-inset)] dark:border-slate-800 dark:bg-slate-900';
