import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(setup.error).toBeNull();
    testUser = setup.user;

    // Para garantir que o client supabase global utilizado pela App 'VehicleSetup'
    // reconhece a mesma sessão autenticada que o nosso cliente local, forçamos o setSession.
    // O storage HappyDOM partilha o localStorage, mas garantir atomicidade no cliente importa.
    await supabase.auth.setSession({
      access_token: setup.session.access_token,
      refresh_token: setup.session.refresh_token,
    });
  });

  afterAll(async () => {
    // Limpeza forçada (Apaga o utilizador e faz signOut globalmente)
    await deleteTestUser(testUser?.id);
    await supabase.auth.signOut();
  });

  it('[TDD Red] Deve conseguir registar com sucesso um veículo, preenchendo automaticamente o id_motorista e contornando RLS', async () => {
    const user = userEvent.setup();
    
    render(
      <MemoryRouter>
        <VehicleSetup />
      </MemoryRouter>
    );

    // O utilizador recém criado não tem veículo preenchido.
    // Preenchemos os dados iniciais.
    const marcaInput = screen.getByLabelText(/marca\/modelo/i);
    const matriculaInput = screen.getByLabelText(/matrícula/i);
    const lugaresInput = screen.getByLabelText(/lugares disponíveis/i);
    const btn = screen.getByRole('button', { name: /guardar veículo/i });

    await user.type(marcaInput, 'Toyota Yaris');
    await user.type(matriculaInput, 'LD-11-22-BB');
    await user.clear(lugaresInput);
    await user.type(lugaresInput, '4');

    // Ao clicar em guardar, nós EXPECTAMOS que seja um sucesso (o teste vai falhar no vermelho
    // devido à atual implementação estar a fazer insert() direto do lado da componente sem auth.uid,
    // esbarrando na política RLS e na nossa nova Unique Constraint).
    await user.click(btn);

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
