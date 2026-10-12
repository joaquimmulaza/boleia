import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileBankForm from './ProfileBankForm';

describe('ProfileBankForm', () => {
  it('bloqueia guardar IBAN vazio quando já existia IBAN guardado', async () => {
    const onSave = vi.fn();
    render(
      <ProfileBankForm
        initialTitular="Titular"
        initialIban="AO06004000000000000000000"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar/i }));
    fireEvent.change(screen.getByLabelText(/IBAN/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar alterações/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/IBAN angolano válido/i);
    expect(onSave).not.toHaveBeenCalled();
  });
});
