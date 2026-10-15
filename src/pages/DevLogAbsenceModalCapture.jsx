import React from 'react';
import LogAbsenceModal from '../components/LogAbsenceModal';

/**
 * Ecrã estático para captura visual do modal de falta (passageiro, dev only).
 * @typedef {Readonly<{}>} DevLogAbsenceModalCaptureProps
 */
export default function DevLogAbsenceModalCapture() {
  return (
    <div className="min-h-screen bg-background-light p-3 dark:bg-background-dark flex justify-center">
      <div className="w-full max-w-[390px]" data-testid="dev-log-absence-modal-capture">
        <LogAbsenceModal
          isOpen
          tipoPerfil="Passageiro"
          onClose={() => {}}
          onSubmit={() => {}}
          quotaMensalKz={22000}
          diasUteisMes={22}
        />
      </div>
    </div>
  );
}
