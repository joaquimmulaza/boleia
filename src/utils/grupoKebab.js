/**
 * Kebab do grupo de viagem — só acções reais (PM lock 2026-10-05).
 * Convite e WhatsApp ficam no cartão.
 */

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function acordoBloqueiaApagarGrupo(estado) {
  const normalizado = String(estado || '').trim().toLowerCase();
  if (!normalizado) return false;
  return normalizado !== 'cancelado'
    && normalizado !== 'expirado'
    && normalizado !== 'cancelado_justificado';
}

/**
 * @param {{
 *   isOwner: boolean,
 *   isMember: boolean,
 *   memberCount: number,
 *   hasActiveAgreement: boolean,
 * }} input
 * @returns {{ editar: boolean, apagar: boolean, sair: boolean }}
 */
export function grupoKebabActions({
  isOwner,
  isMember,
  memberCount,
  hasActiveAgreement,
}) {
  const outros = Number(memberCount) > 1;
  const dono = Boolean(isOwner);
  return {
    editar: dono,
    apagar: dono && !outros && !hasActiveAgreement,
    sair: Boolean(isMember) && outros,
  };
}

/**
 * Dono = owner da procura (ou o primeiro membro activo) que ainda está activo.
 * Sair não transfere a procura: quem saiu deixa de ser dono neste painel.
 * @param {{
 *   userId?: string | null,
 *   ownerId?: string | null,
 *   membros?: Array<{ passenger_id?: string, estado?: string, ordem_insercao?: number }>,
 * }} input
 * @returns {{ isOwner: boolean, isMember: boolean, memberCount: number }}
 */
export function resolveGrupoPapel({ userId, ownerId, membros }) {
  const activos = (membros || []).filter((membro) => {
    const estado = String(membro?.estado || 'activo').toLowerCase();
    return estado === 'activo';
  });
  const primeiro = [...activos].sort(
    (a, b) => (Number(a.ordem_insercao) || 0) - (Number(b.ordem_insercao) || 0),
  )[0];
  const donoDaProcura = ownerId ? ownerId === userId : primeiro?.passenger_id === userId;
  const isMember = activos.some((membro) => membro.passenger_id === userId);
  return {
    isOwner: Boolean(donoDaProcura) && isMember,
    isMember,
    memberCount: activos.length,
  };
}
