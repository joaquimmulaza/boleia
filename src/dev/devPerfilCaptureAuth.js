/** UUID fixo para mocks Supabase em capturas DEV. */
export const DEV_PERFIL_CAPTURE_USER_ID = '00000000-0000-4000-a000-000000000001';

/** Valor AuthContext para `/__dev/perfil`. */
export const DEV_PERFIL_CAPTURE_AUTH = {
  session: {
    access_token: 'dev-capture-token',
    user: {
      id: DEV_PERFIL_CAPTURE_USER_ID,
      email: 'captura@boleia.dev',
      user_metadata: { tipo_perfil: 'Passageiro' },
    },
  },
  user: {
    id: DEV_PERFIL_CAPTURE_USER_ID,
    email: 'captura@boleia.dev',
    user_metadata: { tipo_perfil: 'Passageiro' },
  },
  profile: {
    id: DEV_PERFIL_CAPTURE_USER_ID,
    nome_completo: 'Captura Visual',
    tipo_perfil: 'Passageiro',
    perfil_completo: true,
    onboarding_completed: true,
  },
  loading: false,
  profileLoading: false,
  tipoPerfil: 'Passageiro',
  passwordRecoveryPending: false,
  refreshProfile: async () => {},
  clearPasswordRecovery: () => {},
};
