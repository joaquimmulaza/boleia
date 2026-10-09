import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import BoleiaSwitch from './BoleiaSwitch';

const VIEWPORT_WIDTHS = [320, 390, 430];

function renderSwitch(overrides = {}) {
  const props = {
    checked: false,
    disabled: false,
    loading: false,
    onCheckedChange: vi.fn(),
    ...overrides,
  };
  return render(<BoleiaSwitch {...props} />);
}

function getThumb() {
  const root = screen.getByRole('switch');
  return root.querySelector('[data-state]');
}

describe('BoleiaSwitch — shadcn + geometria', () => {
  it('OFF: thumb dentro do track em várias larguras', () => {
    for (const width of VIEWPORT_WIDTHS) {
      document.documentElement.style.width = `${width}px`;
      const { unmount } = renderSwitch({ checked: false });
      const root = screen.getByRole('switch');
      const thumb = getThumb();
      expect(root.className).toMatch(/overflow-hidden/);
      expect(thumb).toHaveAttribute('data-state', 'unchecked');
      expect(thumb?.className).toMatch(/data-\[state=unchecked\]:translate-x-0/);
      expect(thumb?.className).toMatch(/data-\[state=checked\]:translate-x-\[1\.25rem\]/);
      unmount();
    }
  });

  it('ON: thumb dentro do track em várias larguras', () => {
    for (const width of VIEWPORT_WIDTHS) {
      document.documentElement.style.width = `${width}px`;
      const { unmount } = renderSwitch({ checked: true });
      const thumb = getThumb();
      expect(thumb).toHaveAttribute('data-state', 'checked');
      expect(thumb?.className).toMatch(/data-\[state=checked\]:translate-x-\[1\.25rem\]/);
      unmount();
    }
  });

  it('mantém aria-checked e focus ring no Switch', () => {
    renderSwitch({ checked: true });
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw.className).toMatch(/focus-visible:ring-2/);
  });

  it('activating: aria-busy, disabled e spinner', () => {
    renderSwitch({ checked: true, loading: true });
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-busy', 'true');
    expect(sw).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('blocked: aria-disabled e sem toggle', () => {
    const onCheckedChange = vi.fn();
    renderSwitch({ disabled: true, onCheckedChange });
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(sw);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  describe('snapshot dos 6 estados push (DOM + classes thumb)', () => {
    const states = [
      { name: 'on', props: { checked: true } },
      { name: 'off', props: { checked: false } },
      { name: 'activating-on', props: { checked: true, loading: true } },
      { name: 'activating-off', props: { checked: false, loading: true } },
      { name: 'disabled-off', props: { checked: false, disabled: true } },
      { name: 'disabled-on', props: { checked: true, disabled: true } },
    ];

    for (const { name, props } of states) {
      it(`estado ${name}`, () => {
        const { container } = renderSwitch(props);
        expect(container).toMatchSnapshot();
        const thumb = getThumb();
        expect(thumb).toBeTruthy();
        if (props.checked && !props.loading) {
          expect(thumb?.className).toMatch(/translate-x-\[1\.25rem\]/);
        }
        if (!props.checked && !props.loading) {
          expect(thumb?.className).toMatch(/translate-x-0/);
        }
      });
    }
  });
});
