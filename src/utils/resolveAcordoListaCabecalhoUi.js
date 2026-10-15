import { acordoEstadoListaChipProps } from './acordoEstadoDisplay.js';
import { contagemLugaresVivos } from './estadoPassageiro.js';
import {
  mostrarChipLugarPassageiroSemDuplicarAcordo,
} from './estadoPassageiro.js';
import { labelPessoasNoAcordoContrato } from './resolvePessoasAcordoUi.js';

/**
 * Chips + linha «Grupo» do cartão lista e cabeçalho do detalhe (passageiro vs motorista).
 *
 * @param {{
 *   acordo: {
 *     estado?: string | null,
 *     n_passageiros_contrato?: number | null,
 *     acordos_passageiros?: Array<{ passenger_id?: string, estado?: string }>,
 *     encerramento_motivo?: string | null,
 *     rescisao_modo?: string | null,
 *     rescisao_confirmada_em?: string | null,
 *     rescisao_solicitada_por?: string | null,
 *     rescisao_effective_on?: string | null,
 *     driver_id?: string | null,
 *   },
 *   viewerUserId?: string | null,
 *   tipoPerfil?: string | null,
 *   minhaLinha?: { passenger_id?: string, estado?: string } | null,
 *   minhaChipCtx?: { anulacao_motivo?: string | null } | null,
 * }} params
 * @returns {{
 *   estadoChip: ReturnType<typeof acordoEstadoListaChipProps>,
 *   mostrarChipLugar: boolean,
 *   minhaLinha: { passenger_id?: string, estado?: string } | null | undefined,
 *   rotuloPessoas: string | null,
 * }}
 */
export function resolveAcordoListaCabecalhoUi({
  acordo,
  viewerUserId,
  tipoPerfil,
  minhaLinha,
  minhaChipCtx = null,
}) {
  const linhas = acordo?.acordos_passageiros || [];
  const isPassageiro = tipoPerfil === 'Passageiro';
  const { total: nVivos } = contagemLugaresVivos(linhas);

  const estadoChip = acordoEstadoListaChipProps(acordo, viewerUserId, {
    ignorarChipPorLugares: isPassageiro,
  });

  const linha =
    minhaLinha
    ?? (isPassageiro && viewerUserId
      ? linhas.find((p) => String(p.passenger_id) === String(viewerUserId))
      : null);

  const mostrarChipLugar = Boolean(
    linha
      && mostrarChipLugarPassageiroSemDuplicarAcordo(
        estadoChip.label,
        linha.estado,
        minhaChipCtx,
      ),
  );

  const rotuloPessoas = (() => {
    if (isPassageiro) {
      return labelPessoasNoAcordoContrato(acordo?.n_passageiros_contrato);
    }
    const contrato = labelPessoasNoAcordoContrato(acordo?.n_passageiros_contrato);
    if (nVivos === 0) {
      return contrato ?? 'Individual';
    }
    if (nVivos === 1) {
      return 'Individual';
    }
    return `Grupo · ${nVivos} pessoas`;
  })();

  return {
    estadoChip,
    mostrarChipLugar,
    minhaLinha: linha,
    rotuloPessoas,
  };
}
