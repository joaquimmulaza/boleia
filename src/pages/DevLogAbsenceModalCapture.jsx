import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import LogAbsenceModal from '../components/LogAbsenceModal';

/**
 * Ecrã estático para captura visual do modal de falta (dev only).
 * Query: ?w=355|390&theme=dark&diasSemana=1,2,3,4,5&ref=2026-10-15&inlineError=1
 */
export default function DevLogAbsenceModalCapture() {
  const [params] = useSearchParams();
  const width = params.get('w') === '355' ? 355 : 390;
  const themeDark = params.get('theme') === 'dark';
  const diasSemana = useMemo(() => {
    const raw = params.get('diasSemana') || '1,2,3,4,5';
    return raw.split(',').map((d) => Number(d.trim())).filter((n) => Number.isFinite(n));
  }, [params]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeDark);
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, [themeDark]);

  const refIso = params.get('ref') || '2026-10-15';
  const refDate = new Date(`${refIso}T20:59:00Z`);

  return (
    <div
      className={`min-h-screen p-3 flex justify-center ${
        themeDark ? 'bg-background-dark' : 'bg-background-light'
      }`}
    >
      <div
        className="w-full"
        style={{ maxWidth: width }}
        data-testid="dev-log-absence-modal-capture"
      >
        <LogAbsenceModal
          isOpen
          tipoPerfil="Passageiro"
          onClose={() => {}}
          onSubmit={() => {}}
          quotaMensalKz={22000}
          diasSemanaAcordo={diasSemana}
          referenceDate={refDate}
        />
      </div>
    </div>
  );
}
