import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile } from '../services/ProfileService';
import PageShell from '../components/PageShell';
import LoadingSkeleton from '../components/LoadingSkeleton';
import ProfileBankForm from '../components/profile/ProfileBankForm';
import { PROFILE_BANK_SUBTITLE, PROFILE_BANK_TITLE } from '../utils/profileCopy';

export default function ProfileBankDetails() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);
  const [tipoPerfil, setTipoPerfil] = useState('Passageiro');
  const [bank, setBank] = useState({ iban: '', iban_titular: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);
        const perfil = await getProfile(user.id);
        if (perfil) {
          setTipoPerfil(perfil.tipo_perfil || 'Passageiro');
          setBank({
            iban: perfil.iban || '',
            iban_titular: perfil.iban_titular || '',
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados bancários:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <PageShell>
        <LoadingSkeleton variant="profile" />
      </PageShell>
    );
  }

  if (tipoPerfil !== 'Motorista') {
    return <Navigate to="/perfil" replace />;
  }

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      await updateProfile(userId, payload);
      setBank(payload);
    } catch (error) {
      setSaving(false);
      throw error;
    }
    setSaving(false);
  };

  return (
    <PageShell className="pb-shell space-y-4">
      <Link
        to="/perfil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Perfil
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{PROFILE_BANK_TITLE}</h1>
        <p className="text-sm text-muted-foreground mt-1">{PROFILE_BANK_SUBTITLE}</p>
      </div>
      <ProfileBankForm
        initialTitular={bank.iban_titular}
        initialIban={bank.iban}
        saving={saving}
        onSave={handleSave}
      />
    </PageShell>
  );
}
