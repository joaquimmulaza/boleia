import React, { useState } from 'react';
import { Users } from 'lucide-react';
import OverlayShell from '../components/OverlayShell';
import SheetDragHandle from '../components/SheetDragHandle';
import SheetFecharButton from '../components/SheetFecharButton';
import GrupoKebabMenu from '../components/GrupoKebabMenu';
import AddressInput from '../components/AddressInput';
import { getGrupoEditSheetSubtitle } from '../copy/grupoEditSheet';

const CAPACIDADES = [2, 3, 4, 5, 6, 7, 8];

/**
 * Capturas DEV (390px / 355px) — hub passageiro UX Critiquito (#3f72eca2).
 * Só em `import.meta.env.DEV` via `/__dev/hub-passageiro-ux`.
 */
export default function DevHubPassageiroUxCapture() {
  const [editCapacidade, setEditCapacidade] = useState(4);
  const [pickup, setPickup] = useState({ pickup_name: '' });

  return (
    <div
      className="mx-auto min-h-[844px] w-full max-w-[390px] bg-background-light p-4 dark:bg-background-dark"
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

      <section
        className="mt-6 space-y-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        data-testid="hub-ux-editar-procura-form"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Editar procura</h2>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <AddressInput
            name="origin_name"
            label="Origem"
            value="Talatona"
            onChange={() => {}}
            allowFreeTextUse
          />
          <AddressInput
            name="destination_name"
            label="Destino"
            value="Miramar"
            onChange={() => {}}
            allowFreeTextUse
          />
        </form>
      </section>

      <div className="relative mt-6 min-h-[560px]" data-testid="hub-ux-h6a-edit-sheet">
        <OverlayShell
          variant="bottom"
          overlayClassName="bg-slate-900/60 dark:bg-black/80"
          panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
          testId="editar-grupo-sheet"
          onDismiss={() => {}}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editar-grupo-title"
            className="space-y-4 px-4 pb-sheet"
          >
            <SheetDragHandle />
            <div
              className="flex items-center justify-between gap-3"
              data-geocoder-dismiss-chrome
            >
              <h2
                id="editar-grupo-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Editar grupo
              </h2>
              <SheetFecharButton data-testid="editar-grupo-fechar" onClick={() => {}} />
            </div>
            {getGrupoEditSheetSubtitle() ? (
              <p className="text-sm text-slate-500 text-pretty" data-testid="editar-grupo-subtitle">
                {getGrupoEditSheetSubtitle()}
              </p>
            ) : null}
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-sm font-semibold">Tamanho desejado</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {CAPACIDADES.map((n) => {
                  const activo = editCapacidade === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={activo}
                      aria-label={String(n)}
                      onClick={() => setEditCapacidade(n)}
                      className={`size-9 shrink-0 whitespace-nowrap rounded-lg text-sm font-bold tabular-nums ${
                        activo
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <AddressInput
              name="edit_pickup_name"
              label="Ponto de recolha (opcional)"
              required={false}
              value={pickup.pickup_name}
              onChange={(e) => setPickup((prev) => ({ ...prev, pickup_name: e.target.value }))}
            />
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
