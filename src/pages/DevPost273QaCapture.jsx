import React from 'react';
import { useSearchParams } from 'react-router-dom';
import OverlayShell from '../components/OverlayShell';
import AcordoDetalheSheetHeader from '../components/AcordoDetalheSheetHeader';
import SheetDragHandle from '../components/SheetDragHandle';
import NotificationListItem from '../components/NotificationListItem';
import GrupoKebabMenu from '../components/GrupoKebabMenu';
import { Button } from '../components/ui/button';

function AcordoSheetMock() {
  return (
    <section data-testid="capture-acordo-sheet" className="relative min-h-[560px]">
      <OverlayShell
        variant="bottom"
        onDismiss={() => {}}
        panelTestId="acordo-detalhe-sheet"
        panelClassName="bg-white dark:bg-slate-900 shadow-2xl flex flex-col !overflow-hidden max-h-[90dvh]"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="acordo-detail-title"
          className="flex min-h-0 flex-1 flex-col"
        >
          <AcordoDetalheSheetHeader
            acordoId="dev-acordo"
            estadoAcordo="activo"
            tipoPerfil="Passageiro"
            viewerUserId="dev-pax"
            minhaLinhaEstado="activo"
            onClose={() => {}}
            podeRegistarFaltas
            podeEncerrar
            onRegistarFalta={() => {}}
            onEncerrar={() => {}}
          />
          <div
            data-testid="acordo-detalhe-sheet-body"
            className="flex-1 min-h-0 overflow-y-auto px-5 pb-safe space-y-4"
          >
            <p className="font-semibold pt-2 text-slate-900 dark:text-white">Viana → Talatona</p>
            <p className="text-sm text-slate-500">Corpo scrollável do detalhe do acordo (mock DEV).</p>
          </div>
        </div>
      </OverlayShell>
    </section>
  );
}

function BellSheetMock() {
  return (
    <section data-testid="capture-bell-sheet" className="relative min-h-[560px]">
      <OverlayShell
        variant="bottom"
        onDismiss={() => {}}
        panelTestId="notification-panel"
        panelClassName="bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
      >
        <SheetDragHandle />
        <div role="dialog" aria-modal="true" aria-labelledby="notification-sheet-title" className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between px-5 pb-2 pt-1 shrink-0">
            <h2 id="notification-sheet-title" className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Notificações
            </h2>
            <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-sm font-bold">
              Fechar
            </Button>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/50 px-1">
            <NotificationListItem
              notif={{
                id: 'n-dev',
                mensagem: 'Nova proposta recebida',
                tipo: 'info',
                lida: false,
                created_at: new Date().toISOString(),
              }}
              onActivate={() => {}}
              onDelete={() => {}}
            />
          </ul>
        </div>
      </OverlayShell>
    </section>
  );
}

function KebabMock() {
  return (
    <section data-testid="capture-grupo-kebab" className="min-h-[560px] p-6 flex justify-end items-start bg-background-light dark:bg-background-dark">
      <GrupoKebabMenu
        canEditar
        canApagar
        canSair={false}
        onEditar={() => {}}
        onApagar={() => {}}
        onSair={() => {}}
      />
    </section>
  );
}

/**
 * Captura DEV 390px — drag/focus QA pós-#273. `?view=acordo|bell|kebab`.
 */
export default function DevPost273QaCapture() {
  const [params] = useSearchParams();
  const view = params.get('view') || 'acordo';

  return (
    <div className="min-h-dvh bg-background-light dark:bg-background-dark">
      {view === 'bell' ? <BellSheetMock /> : null}
      {view === 'acordo' ? <AcordoSheetMock /> : null}
      {view === 'kebab' ? <KebabMock /> : null}
    </div>
  );
}
