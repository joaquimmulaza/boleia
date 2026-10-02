import React from 'react';
import { ArrowLeft } from 'lucide-react';
import OverlayShell from './OverlayShell';
import SheetDragHandle from './SheetDragHandle';
import PropostaReviewCard from './PropostaReviewCard';

/**
 * Detalhe de uma proposta — abre a partir da row «Ver ›» na ProposalSheet.
 * @param {{
 *   review: object,
 *   busy?: boolean,
 *   precoPublicadoKz?: number | null,
 *   onClose: () => void,
 *   onAceitar?: (memberIds?: string[]) => void,
 *   onRecusar?: () => void,
 *   onCancelar?: () => void,
 *   onContraProposta?: () => void,
 *   modo?: 'contraparte' | 'criador' | 'historico',
 *   secao?: 'recebidas' | 'enviadas',
 * }} props
 */
function PropostaDetailSheet({
  review,
  busy = false,
  precoPublicadoKz = null,
  onClose,
  onAceitar,
  onRecusar,
  onCancelar,
  onContraProposta,
  modo = 'contraparte',
  secao = 'recebidas',
}) {
  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-black/45"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl px-4 pt-2.5"
      testId="proposta-detail-sheet"
      onDismiss={onClose}
    >
      <div className="flex flex-col gap-4 max-h-[85dvh] overflow-y-auto">
        <SheetDragHandle onDismiss={onClose} />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar
          </button>
        </div>

        <PropostaReviewCard
          review={review}
          busy={busy}
          modo={modo}
          secao={secao}
          precoPublicadoKz={precoPublicadoKz}
          onAceitar={onAceitar}
          onRecusar={onRecusar}
          onCancelar={onCancelar}
          onContraProposta={onContraProposta}
        />
      </div>
    </OverlayShell>
  );
}

export default PropostaDetailSheet;
