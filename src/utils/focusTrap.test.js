import { describe, it, expect } from 'vitest';
import { getFocusableElements, handleFocusTrapTabKey } from './focusTrap';

describe('focusTrap', () => {
  it('lista botões focáveis dentro do contentor', () => {
    document.body.innerHTML = `
      <div id="root">
        <button type="button" id="outside">Fora</button>
        <div id="dialog">
          <button type="button" id="first">Fechar</button>
          <button type="button" id="last" disabled>Desactivado</button>
          <button type="button" id="second">Acção</button>
        </div>
      </div>
    `;

    const dialog = document.getElementById('dialog');
    const focusables = getFocusableElements(dialog);
    expect(focusables.map((el) => el.id)).toEqual(['first', 'second']);
  });

  it('Tab no último focável salta para o primeiro', () => {
    document.body.innerHTML = `
      <div id="dialog">
        <button type="button" id="first">A</button>
        <button type="button" id="last">Z</button>
      </div>
    `;
    const dialog = document.getElementById('dialog');
    const last = document.getElementById('last');
    last.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const handled = handleFocusTrapTabKey(event, dialog);

    expect(handled).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('first');
  });
});
