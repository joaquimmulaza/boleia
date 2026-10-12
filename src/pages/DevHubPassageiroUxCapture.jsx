import React from 'react';
import { Users } from 'lucide-react';
import OverlayShell from '../components/OverlayShell';
import SheetDragHandle from '../components/SheetDragHandle';
import SheetFecharButton from '../components/SheetFecharButton';
import GrupoKebabMenu from '../components/GrupoKebabMenu';
import { getGrupoEditSheetSubtitle } from '../copy/grupoEditSheet';

/**
 * Capturas DEV (390px) — hub passageiro UX Critiquito (#3f72eca2).
 * Só em `import.meta.env.DEV` via `/__dev/hub-passageiro-ux`.
 */
export default function DevHubPassageiroUxCapture() {
  return (
    <div
      className="mx-auto min-h-[844px] max-w-[390px] bg-background-light p-4 dark:bg-background-dark"
      data-testid="hub-passageiro-ux-capture-root"
    >
      <section
        className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        data-testid="hub-ux-grupo-acao-directa"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Users size={18} className="text-primary" aria-hidden="true" />
            <span>Grupo de viagem</span>
          </div>
          <GrupoKebabMenu
            canEditar={false}
            canApagar={false}
            canSair
            onEditar={() => {}}
            onApagar={() => {}}
            onSair={() => {}}
          />
        </div>
        <p className="text-sm text-slate-500">Grupo · 2 de 4</p>
      </section>

      <div className="relative mt-6 h-[520px]" data-testid="hub-ux-h6a-edit-sheet">
        <OverlayShell
          variant="bottom"
          overlayClassName="bg-slate-900/60 dark:bg-black/80"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
          testId="editar-grupo-sheet"
          onDismiss={() => {}}
        >
          <div className="space-y-4 px-4 pb-sheet">
            <SheetDragHandle />
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Editar grupo</h2>
              <SheetFecharButton data-testid="editar-grupo-fechar" onClick={() => {}} />
            </div>
            {getGrupoEditSheetSubtitle() ? (
              <p className="text-sm text-slate-500 text-pretty" data-testid="editar-grupo-subtitle">
                {getGrupoEditSheetSubtitle()}
              </p>
            ) : null}
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tamanho desejado</p>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`size-10 rounded-lg text-sm font-bold ${
                    n === 3
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="w-full min-h-12 rounded-xl bg-primary font-bold text-white"
            >
              Guardar
            </button>
          </div>
        </OverlayShell>
      </div>
    </div>
  );
}
