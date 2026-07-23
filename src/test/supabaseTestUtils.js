import { createClient } from '@supabase/supabase-js';

// Inicializar cliente Supabase local para testes de integração isolados
export const supabaseLocal = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Cria um utilizador de teste no ambiente local e autentica a sessão.
 * Ideal para chamar no `beforeEach` de testes de integração.
 * @returns {Promise<{ user: object, session: object, error: object }>}
 */
export const createTestUser = async () => {
  const email = `testuser_${Date.now()}@example.com`;
  const password = 'testpassword123';

  // 1. Criar o utilizador (signup)
  const { data, error } = await supabaseLocal.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome: 'Test Driver',
        telefone: '900000000'
      }
    }
  });

  if (error) {
    console.error('Erro ao criar TestUser:', error);
    return { error };
  }

  // No ambiente local, por padrão a confirmação de email pode estar desativada,
  // resultando num login imediato no signUp se `data.session` vier preenchido.
  // Caso contrário tentamos aceder explicitamente usando signInWithPassword.
  let session = data.session;
  let user = data.user;

  if (!session) {
    const loginResult = await supabaseLocal.auth.signInWithPassword({
      email,
      password,
    });
    session = loginResult.data.session;
    user = loginResult.data.user;
    
    if (loginResult.error) {
      console.error('Erro ao autenticar TestUser:', loginResult.error);
      return { error: loginResult.error };
    }
  }

  return { user, session, email, password, error: null };
};

/**
 * Elimina os dados e a conta de um utilizador de teste para manter a DB limpa.
 * Ideal para chamar no `afterEach` ou `afterAll`.
 * Requer o id do user a apagar e muitas vezes uso da *service_role* local para apagar o utilizador por trás (auth.admin).
 * Como estamos a criar uma versão "anon", usaremos um rpc explícito ou apenas faremos sign out se não tivermos a service_role_key explícita aqui.
 * Por simplicidade atómica local para este fix: 
 * Apagamos registos na tabela pública e fazemos signOut da sessão.
 */
export const deleteTestUser = async (userId) => {
  if (!userId) return;

  try {
    // Apagar os registos dependentes deste utilizador para isolamento de estado
    await supabaseLocal.from('veiculos').delete().eq('id_motorista', userId);
    await supabaseLocal.auth.signOut();
  } catch (error) {
    console.warn('Erro ao limpar utilizador de teste:', error);
  }
};
