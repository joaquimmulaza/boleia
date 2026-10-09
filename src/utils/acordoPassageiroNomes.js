/**
 * Junta nomes de passageiros a linhas de acordo sem GET /rest/v1/perfis (embed).
 *
 * @param {object | null | undefined} acordo
 * @param {{ contactos?: { passageiros?: Array<{ passenger_id?: string, nome_completo?: string }> } | null, motoristaPagamentos?: Array<{ passenger_id?: string, passenger_nome?: string }> }} sources
 * @returns {object | null | undefined}
 */
export function mergeNomesPassageirosAcordo(acordo, sources = {}) {
  if (!acordo?.acordos_passageiros?.length) return acordo;

  /** @type {Map<string, string>} */
  const nomes = new Map();

  for (const p of sources.contactos?.passageiros || []) {
    const id = p?.passenger_id;
    const nome = String(p?.nome_completo || '').trim();
    if (id && nome) nomes.set(String(id), nome);
  }

  for (const row of sources.motoristaPagamentos || []) {
    const id = row?.passenger_id;
    const nome = String(row?.passenger_nome || '').trim();
    if (id && nome) nomes.set(String(id), nome);
  }

  if (nomes.size === 0) return acordo;

  let changed = false;
  const acordos_passageiros = acordo.acordos_passageiros.map((linha) => {
    const nome = nomes.get(String(linha.passenger_id || ''));
    if (!nome) return linha;
    if (String(linha.perfis?.nome_completo || '').trim() === nome) return linha;
    changed = true;
    return {
      ...linha,
      perfis: { ...(linha.perfis || {}), nome_completo: nome },
    };
  });

  if (!changed) return acordo;
  return { ...acordo, acordos_passageiros };
}
