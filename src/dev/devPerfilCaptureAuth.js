/** UUID fixo para mocks Supabase em capturas DEV. */
export const DEV_PERFIL_CAPTURE_USER_ID = '00000000-0000-4000-a000-000000000001';

/** Valor AuthContext para `/__dev/perfil`. */
const baseCaptureAuth = {
  loading: false,
  profileLoading: false,
  passwordRecoveryPending: false,
  refreshProfile: async () => {},
  clearPasswordRecovery: () => {},
};

/** Valor AuthContext para `/__dev/perfil` (passageiro). */
export const DEV_PERFIL_CAPTURE_AUTH = {
  ...baseCaptureAuth,
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
  tipoPerfil: 'Passageiro',
};

/** Valor AuthContext para `/__dev/perfil-motorista`. */
export const DEV_PERFIL_CAPTURE_AUTH_MOTORISTA = {
  ...baseCaptureAuth,
  session: {
    access_token: 'dev-capture-token',
    user: {
      id: DEV_PERFIL_CAPTURE_USER_ID,
      email: 'motorista@boleia.dev',
      user_metadata: { tipo_perfil: 'Motorista' },
    },
  },
  user: {
    id: DEV_PERFIL_CAPTURE_USER_ID,
    email: 'motorista@boleia.dev',
    user_metadata: { tipo_perfil: 'Motorista' },
  },
  profile: {
    id: DEV_PERFIL_CAPTURE_USER_ID,
    nome_completo: 'Paulo Manuel Domingos',
    tipo_perfil: 'Motorista',
    perfil_completo: true,
    onboarding_completed: true,
  },
  tipoPerfil: 'Motorista',
};
