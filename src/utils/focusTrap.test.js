import { describe, it, expect } from 'vitest';
import {
  getFocusableElements,
  handleFocusTrapTabKey,
  isActiveElementInNestedModal,
  isElementFocusReturnable,
  focusReturnableElement,
} from './focusTrap';

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

  it('não rouba Tab quando o foco está num dialog empilhado', () => {
    document.body.innerHTML = `
      <div id="sheet-dialog">
        <button type="button" id="fechar">Fechar</button>
      </div>
      <div id="nested-dialog" role="dialog" aria-modal="true">
        <button type="button" id="nested-last">Confirmar</button>
      </div>
    `;
    const sheet = document.getElementById('sheet-dialog');
    const nestedLast = document.getElementById('nested-last');
    nestedLast.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const handled = handleFocusTrapTabKey(event, sheet);

    expect(handled).toBe(false);
    expect(document.activeElement?.id).toBe('nested-last');
  });

  it('isElementFocusReturnable rejeita nulo e nós destacados', () => {
    expect(isElementFocusReturnable(null)).toBe(false);
    const btn = document.createElement('button');
    expect(isElementFocusReturnable(btn)).toBe(false);
    document.body.appendChild(btn);
    expect(isElementFocusReturnable(btn)).toBe(true);
    btn.remove();
    expect(isElementFocusReturnable(btn)).toBe(false);
  });

  it('focusReturnableElement não foca elemento destacado', () => {
    const btn = document.createElement('button');
    btn.id = 'detached-focus';
    document.body.appendChild(btn);
    btn.focus();
    btn.remove();
    expect(() => focusReturnableElement(btn)).not.toThrow();
  });

  it('isActiveElementInNestedModal detecta portal sibling', () => {
    document.body.innerHTML = `
      <div id="sheet"><button id="a">A</button></div>
      <div id="nested" role="dialog" aria-modal="true"><button id="b">B</button></div>
    `;
    const sheet = document.getElementById('sheet');
    document.getElementById('b').focus();
    expect(isActiveElementInNestedModal(sheet)).toBe(true);
  });
});
