import React, { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import FeedbackAlert from '../FeedbackAlert';
import ProfileReadOnlyField from './ProfileReadOnlyField';
import {
  PROFILE_DISCARD_EDITS,
  PROFILE_EDIT,
  PROFILE_SAVE_CHANGES,
  PROFILE_SAVE_ERROR,
  PROFILE_SAVE_SUCCESS,
} from '../../utils/profileCopy';
import { validateAngolaIban } from '../../utils/validation';

/**
 * @param {{
 *   initialTitular: string;
 *   initialIban: string;
 *   saving?: boolean;
 *   onSave: (payload: { iban_titular: string; iban: string }) => Promise<void>;
 *   startInEdit?: boolean;
 * }} props
 */
export default function ProfileBankForm({
  initialTitular,
  initialIban,
  saving = false,
  onSave,
  startInEdit = false,
}) {
  const titularId = useId();
  const ibanId = useId();
  const hasData = Boolean(initialTitular.trim() || initialIban.trim());
  const [editing, setEditing] = useState(startInEdit || !hasData);
  const [showForm, setShowForm] = useState(hasData || startInEdit);
  const [titular, setTitular] = useState(initialTitular);
  const [iban, setIban] = useState(initialIban);
  const [ibanError, setIbanError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    const hadIban = Boolean(initialIban.replace(/\s/g, '').trim());
    if (hadIban && !cleanIban) {
      setIbanError('Indica um IBAN angolano válido (AO06…).');
      return;
    }
    if (cleanIban && !validateAngolaIban(cleanIban)) {
      setIbanError('Indica um IBAN angolano válido (AO06…).');
      return;
    }
    setIbanError('');
    try {
      await onSave({ iban_titular: titular.trim(), iban: cleanIban });
      setFeedback({ type: 'success', text: PROFILE_SAVE_SUCCESS });
      setEditing(false);
      setShowForm(true);
    } catch {
      setFeedback({ type: 'error', text: PROFILE_SAVE_ERROR });
    }
  };

  if (!showForm) {
    return (
      <Card data-testid="profile-banking-empty" className="text-center px-6 py-8">
        <CardContent className="p-0 flex flex-col items-center">
          <p className="font-bold text-foreground">Ainda sem dados bancários</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            Adiciona o titular e o IBAN para receberes os pagamentos das tuas boleias.
          </p>
          <Button
            type="button"
            className="mt-5 w-full rounded-xl h-12 font-bold"
            onClick={() => {
              setShowForm(true);
              setEditing(true);
            }}
          >
            Adicionar dados bancários
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {feedback ? <FeedbackAlert type={feedback.type} text={feedback.text} /> : null}
      {!editing ? (
        <>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(true)}>
              {PROFILE_EDIT}
            </Button>
          </div>
          <Card>
            <CardContent className="p-4 divide-y divide-border">
              <ProfileReadOnlyField label="Titular da conta" value={initialTitular} />
              <ProfileReadOnlyField label="IBAN" value={initialIban} className="pt-3" />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor={titularId} className="text-xs text-muted-foreground">
                  Titular da conta
                </label>
                <Input
                  id={titularId}
                  value={titular}
                  onChange={(e) => setTitular(e.target.value)}
                  placeholder="Nome completo do titular"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={ibanId} className="text-xs text-muted-foreground">
                  IBAN
                </label>
                <Input
                  id={ibanId}
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  placeholder="AO06…"
                  className="font-mono uppercase"
                  aria-invalid={ibanError ? 'true' : undefined}
                />
                {ibanError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {ibanError}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {hasData ? (
                  <Button type="button" variant="ghost" onClick={() => {
                    setTitular(initialTitular);
                    setIban(initialIban);
                    setEditing(false);
                  }}
                  >
                    {PROFILE_DISCARD_EDITS}
                  </Button>
                ) : null}
                <Button type="submit" className="flex-1 rounded-xl font-bold" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {PROFILE_SAVE_CHANGES}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
