/** Fixture QA Critiquito — acordo 3d9b352b (captura DEV). */
export const FALTAS_CAPTURE_ACORDO_ID = '3d9b352b-0000-0000-0000-000000000001';

export const FALTAS_CAPTURE_USER_ID = 'critiquito-pax-faltas';

export const FALTAS_CAPTURE_AUTH = {
  session: { user: { id: FALTAS_CAPTURE_USER_ID } },
  user: { id: FALTAS_CAPTURE_USER_ID },
  loading: false,
  profileLoading: false,
  tipoPerfil: 'Passageiro',
  profile: { perfil_completo: true },
  passwordRecoveryPending: false,
  clearPasswordRecovery: () => {},
  refreshProfile: async () => {},
};

const MES_REF = '2026-10-01';

/** @returns {boolean} */
function isLiquidadoCaptureUrl() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.includes('/__dev/faltas-capture-liquidado/');
}

/**
 * @param {string} acordoId
 * @returns {Promise<object[]>}
 */
export async function faltasCaptureGetAbsences(acordoId) {
  if (acordoId !== FALTAS_CAPTURE_ACORDO_ID) return [];
  return [
    {
      id: 'f-capture-1',
      id_acordo: acordoId,
      data_falta: '2026-10-08',
      tipo: 'Passageiro',
      passenger_id: FALTAS_CAPTURE_USER_ID,
      desconto_kz: 900,
      viagem: 'ida',
    },
    {
      id: 'f-capture-2',
      id_acordo: acordoId,
      data_falta: '2026-10-14',
      tipo: 'Motorista',
      desconto_kz: 650,
      viagem: 'ambas',
    },
    {
      id: 'f-capture-3',
      id_acordo: acordoId,
      data_falta: '2026-10-28',
      tipo: 'Passageiro',
      passenger_id: FALTAS_CAPTURE_USER_ID,
      desconto_kz: 450,
      viagem: 'regresso',
    },
  ];
}

/**
 * @param {string} acordoId
 * @returns {Promise<object[]>}
 */
export async function faltasCaptureListPagamentos(acordoId) {
  if (acordoId !== FALTAS_CAPTURE_ACORDO_ID) return [];
  if (isLiquidadoCaptureUrl()) {
    return [
      {
        passenger_id: FALTAS_CAPTURE_USER_ID,
        estado: 'liquidado',
        mes_referencia: MES_REF,
        desconto_faltas_kz: 2000,
      },
    ];
  }
  return [
    {
      passenger_id: FALTAS_CAPTURE_USER_ID,
      estado: 'em_custodia',
      mes_referencia: MES_REF,
      desconto_faltas_kz: 0,
    },
  ];
}

/**
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function faltasCaptureGetAgreementsForPassenger(userId) {
  if (userId !== FALTAS_CAPTURE_USER_ID) return [];
  return [
    {
      id: FALTAS_CAPTURE_ACORDO_ID,
      estado: 'activo',
      n_passageiros_contrato: 2,
      valor_mensal_por_passageiro_kz: 40000,
      dias_uteis_mes: 22,
    },
  ];
}
