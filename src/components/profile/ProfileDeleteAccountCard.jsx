import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import ConfirmationModal from '../ConfirmationModal';
import { deleteOwnAccount } from '../../services/AccountService';
import { clearAppBadge } from '../../utils/appBadge';
import { supabase } from '../../lib/supabase';
import { getFriendlyErrorMessage } from '../../utils/errorHandler';
import { PROFILE_DELETE_ACCOUNT } from '../../utils/profileCopy';

/**
 * @param {{ onDeleteError?: (message: string) => void }} props
 */
export default function ProfileDeleteAccountCard({ onDeleteError }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await deleteOwnAccount();
    } catch (error) {
      console.error('Erro ao apagar conta:', error);
      onDeleteError?.(getFriendlyErrorMessage(error));
      setBusy(false);
      setConfirmOpen(false);
      return;
    }

    try {
      await clearAppBadge();
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Erro ao terminar sessão depois de apagar conta:', error);
    }
  };

  return (
    <>
      <div data-testid="profile-delete-account">
        <Card className="border-destructive/30">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex w-full items-center justify-center px-4 py-4 text-left font-semibold text-destructive hover:bg-destructive/5 transition-colors rounded-xl"
            >
              {PROFILE_DELETE_ACCOUNT}
            </button>
          </CardContent>
        </Card>
      </div>

      <ConfirmationModal
        isOpen={confirmOpen}
        title="Apagar a conta?"
        message="A conta e os dados que lhe pertencem são apagados agora. Não há volta."
        confirmText="Apagar a conta"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        busy={busy}
        testId="profile-delete-account-modal"
      />
    </>
  );
}
