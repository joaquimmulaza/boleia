import React, { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import FeedbackAlert from '../FeedbackAlert';
import {
  PROFILE_DISCARD_EDITS,
  PROFILE_DISCARD_EDITS_NARROW,
  PROFILE_EDIT,
  PROFILE_PERSONAL_DATA,
  PROFILE_PHONE_INVALID,
  PROFILE_SAVE_CHANGES,
  PROFILE_SAVE_ERROR,
  PROFILE_SAVE_SUCCESS,
} from '../../utils/profileCopy';
import {
  buildAngolaPhoneE164,
  formatAngolaPhoneDisplay,
  stripAngolaPhoneLocal,
} from '../../utils/profilePhone';
import { validateTelefone } from '../../utils/validation';
import ProfileReadOnlyField from './ProfileReadOnlyField';

/**
 * @param {{
 *   email: string;
 *   initialNome: string;
 *   initialTelefone: string;
 *   saving?: boolean;
 *   onSave: (payload: { nome_completo: string; telefone: string }) => Promise<void>;
 * }} props
 */
export default function ProfilePersonalSection({
  email,
  initialNome,
  initialTelefone,
  saving = false,
  onSave,
}) {
  const nomeId = useId();
  const telId = useId();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(initialNome);
  const [telefoneLocal, setTelefoneLocal] = useState(() => stripAngolaPhoneLocal(initialTelefone));
  const [phoneError, setPhoneError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const discardLabel =
    typeof window !== 'undefined' && window.innerWidth <= 320
      ? PROFILE_DISCARD_EDITS_NARROW
      : PROFILE_DISCARD_EDITS;

  const handleDiscard = () => {
    setNome(initialNome);
    setTelefoneLocal(stripAngolaPhoneLocal(initialTelefone));
    setPhoneError('');
    setFeedback(null);
    setEditing(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFeedback(null);
    const e164 = buildAngolaPhoneE164(telefoneLocal);
    if (!validateTelefone(e164)) {
      setPhoneError(PROFILE_PHONE_INVALID);
      return;
    }
    setPhoneError('');
    try {
      await onSave({ nome_completo: nome.trim(), telefone: e164 });
      setFeedback({ type: 'success', text: PROFILE_SAVE_SUCCESS });
      setEditing(false);
    } catch {
      setFeedback({ type: 'error', text: PROFILE_SAVE_ERROR });
    }
  };

  return (
    <section className="space-y-2" aria-labelledby="profile-personal-heading">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 id="profile-personal-heading" className="text-xs font-medium text-muted-foreground">
          {PROFILE_PERSONAL_DATA}
        </h2>
        {!editing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => {
              setNome(initialNome);
              setTelefoneLocal(stripAngolaPhoneLocal(initialTelefone));
              setEditing(true);
            }}
          >
            {PROFILE_EDIT}
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-foreground" onClick={handleDiscard}>
            {discardLabel}
          </Button>
        )}
      </div>

      {feedback ? (
        <FeedbackAlert type={feedback.type} text={feedback.text} data-testid="profile-personal-feedback" />
      ) : null}

      <Card>
        <CardContent className="p-4 pt-4">
          {!editing ? (
            <div className="divide-y divide-border">
              <ProfileReadOnlyField label="Nome completo" value={initialNome} />
              <ProfileReadOnlyField label="Telefone" value={formatAngolaPhoneDisplay(initialTelefone)} />
              <ProfileReadOnlyField label="Email" value={email} />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4" data-testid="profile-personal-form">
              <div className="space-y-1.5">
                <label htmlFor={nomeId} className="text-xs text-muted-foreground">
                  Nome completo
                </label>
                <Input
                  id={nomeId}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={telId} className="text-xs text-muted-foreground">
                  Telefone
                </label>
                <div className="flex rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
                  <span className="flex items-center px-3 text-sm text-foreground border-r border-input bg-muted/40">
                    +244
                  </span>
                  <Input
                    id={telId}
                    type="tel"
                    inputMode="numeric"
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                    value={telefoneLocal}
                    onChange={(e) => setTelefoneLocal(e.target.value.replace(/[^\d\s]/g, ''))}
                    aria-invalid={phoneError ? 'true' : undefined}
                    aria-describedby={phoneError ? `${telId}-err` : undefined}
                    required
                    autoComplete="tel-national"
                  />
                </div>
                {phoneError ? (
                  <p id={`${telId}-err`} className="text-xs text-destructive" role="alert">
                    {phoneError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Email</span>
                <Input value={email} readOnly disabled className="opacity-70" />
              </div>
              <Button
                type="submit"
                className="w-full rounded-xl h-12 text-base font-bold"
                disabled={saving}
                data-testid="profile-save-personal"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    {PROFILE_SAVE_CHANGES}
                  </>
                ) : (
                  PROFILE_SAVE_CHANGES
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
