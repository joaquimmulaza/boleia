import React, { useState } from 'react';
import OverlayShell from '../components/OverlayShell';
import AddressInput from '../components/AddressInput';
import SheetDragHandle from '../components/SheetDragHandle';
import SheetFecharButton from '../components/SheetFecharButton';

/**
 * Captura DEV (390px) — sheet Editar grupo com listbox flutuante (Critiquito #273).
 */
export default function DevGeocoderEditarGrupoCapture() {
  const [open, setOpen] = useState(true);
  const [pickup, setPickup] = useState({ pickup_name: 'Talatona' });

  if (!open) {
    return <div data-testid="sheet-fechado" className="p-4 text-sm text-slate-500">Sheet fechado</div>;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPickup((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <OverlayShell
      variant="bottom"
      overlayClassName="bg-slate-900/60 dark:bg-black/80"
      panelClassName="bg-white dark:bg-slate-900 shadow-2xl"
      testId="editar-grupo-sheet"
      dialogLabelledBy="editar-grupo-title"
      onDismiss={() => setOpen(false)}
    >
      <div className="flex flex-col gap-4 px-4 pb-sheet">
        <div data-geocoder-sheet-header>
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
            <SheetFecharButton
              data-testid="editar-grupo-fechar"
              onClick={() => setOpen(false)}
            />
          </div>
        </div>
        <AddressInput
          name="pickup_name"
          label="Ponto de recolha (opcional)"
          required={false}
          value={pickup.pickup_name}
          onChange={handleChange}
        />
      </div>
    </OverlayShell>
  );
}
