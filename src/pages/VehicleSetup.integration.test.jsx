import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import VehicleSetup from './VehicleSetup';
import { createTestUser, deleteTestUser } from '../test/supabaseTestUtils';
import { supabase } from '../lib/supabase'; // import the global client used by the app

describe('VehicleSetup Integration (Supabase Local - TDD)', () => {
  let testUser;

  beforeAll(async () => {
    // Criamos e autenticamos o utilizador no Supabase local de testes.
    const setup = await createTestUser();
    if (setup.error) {
      console.warn('Supabase local não está ativo. A ignorar teste de integração.');
      return;
    }
    testUser = setup.user;

    await supabase.auth.setSession({
      access_token: setup.session.access_token,
      refresh_token: setup.session.refresh_token,
    });
  });

  afterAll(async () => {
    if (!testUser) return;
    await deleteTestUser(testUser?.id);
    await supabase.auth.signOut();
  });

  it('[TDD Red] Deve conseguir registar com sucesso um veículo, preenchendo automaticamente o id_motorista e contornando RLS', async () => {
    if (!testUser) return;
    render(
      <MemoryRouter>
        <VehicleSetup />
      </MemoryRouter>
    );

    // O utilizador recém criado não tem veículo preenchido.
    // Preenchemos os dados iniciais.
    const marcaInput = screen.getByLabelText(/marca\/modelo/i);
    const matriculaInput = screen.getByLabelText(/matrícula/i);
    const lugaresInput = screen.getByLabelText(/capacidade do veículo/i);
    const btn = screen.getByRole('button', { name: /guardar veículo/i });

    fireEvent.change(marcaInput, { target: { value: 'Toyota Yaris' } });
    fireEvent.change(matriculaInput, { target: { value: 'LD-11-22-BB' } });
    fireEvent.change(lugaresInput, { target: { value: '5' } });

    // Ao clicar em guardar
    fireEvent.click(btn);

    // A asserção TDD para verificar o GREEN (falhará agora):
    await waitFor(() => {
      // Como a API devolverá um "403 Forbidden" (seja RLS ou duplicate pk com id nulo), 
      // e aparecerá uma faixa de erro vermelha com a mensagem getFriendlyErrorMessage(error),
      // o nosso teste espera que a mensagem de *Sucesso* conste no layout.
      expect(screen.getByText('Veículo guardado com sucesso!')).toBeInTheDocument();
    });
    
    // Testar se os dados ficaram efetivamente salvos na BD (Double check):
    const { data } = await supabase.from('veiculos').select('*').eq('id_motorista', testUser.id);
    expect(data).toHaveLength(1);
    expect(data[0].marca_modelo).toBe('Toyota Yaris');
  });
});
