import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import ModalPortal from './ModalPortal';

describe('ModalPortal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza filhos directamente em document.body', () => {
    render(
      <ModalPortal>
        <div data-testid="portal-child">Conteúdo modal</div>
      </ModalPortal>,
    );

    const child = screen.getByTestId('portal-child');
    expect(document.body.contains(child)).toBe(true);
  });
});
