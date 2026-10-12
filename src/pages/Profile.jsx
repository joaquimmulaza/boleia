import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile } from '../services/ProfileService';
import { removeCurrentDevicePushSubscription } from '../utils/pushSubscriptionLogout';
import { clearAppBadge } from '../utils/appBadge';
import PageShell from '../components/PageShell';
import LoadingSkeleton from '../components/LoadingSkeleton';
import InstallAppCard from '../components/InstallAppCard';
import PushNotificationsToggle from '../components/PushNotificationsToggle';
import ProfileIdentityHeader from '../components/profile/ProfileIdentityHeader';
import ProfilePersonalSection from '../components/profile/ProfilePersonalSection';
import ProfileDriverLinks from '../components/profile/ProfileDriverLinks';
import ProfileSignOutButton from '../components/profile/ProfileSignOutButton';
import ProfileLoginMethodsCard from '../components/profile/ProfileLoginMethodsCard';
import ProfileDeleteAccountCard from '../components/profile/ProfileDeleteAccountCard';
import FeedbackAlert from '../components/FeedbackAlert';
import { PROFILE_TITLE } from '../utils/profileCopy';

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountFeedback, setAccountFeedback] = useState(null);
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState({
    nome_completo: '',
    telefone: '',
    tipo_perfil: 'Passageiro',
    avatar_url: '',
  });

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const meta = user.user_metadata || {};
        setUserId(user.id);
        setEmail(user.email || '');

        const perfil = await getProfile(user.id);
        if (perfil) {
          setProfile({
            nome_completo: perfil.nome_completo || '',
            telefone: perfil.telefone || '',
            tipo_perfil: perfil.tipo_perfil || 'Passageiro',
            avatar_url: perfil.avatar_url || meta.avatar_url || meta.picture || '',
          });
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, []);

  const handleSavePersonal = async ({ nome_completo, telefone }) => {
    setSaving(true);
    try {
      await updateProfile(userId, { nome_completo, telefone });
      setProfile((prev) => ({ ...prev, nome_completo, telefone }));
    } catch (error) {
      setSaving(false);
      throw error;
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      try {
        await clearAppBadge();
        await removeCurrentDevicePushSubscription(userId);
      } catch (err) {
        console.warn('[Profile] Falha ao limpar push no logout:', err);
      }
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (err) {
      console.error('Erro ao terminar sessão:', err);
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingSkeleton variant="profile" />
      </PageShell>
    );
  }

  const isMotorista = profile.tipo_perfil === 'Motorista';

  return (
    <PageShell className="pb-shell space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{PROFILE_TITLE}</h1>

      <ProfileIdentityHeader
        nome={profile.nome_completo}
        tipoPerfil={profile.tipo_perfil}
        avatarUrl={profile.avatar_url}
      />

      <ProfilePersonalSection
        email={email}
        initialNome={profile.nome_completo}
        initialTelefone={profile.telefone}
        saving={saving}
        onSave={handleSavePersonal}
      />

      <PushNotificationsToggle />

      <InstallAppCard />

      <ProfileLoginMethodsCard />

      {isMotorista ? <ProfileDriverLinks /> : null}

      {accountFeedback ? (
        <FeedbackAlert type={accountFeedback.type} text={accountFeedback.text} />
      ) : null}

      <ProfileDeleteAccountCard onDeleteError={(text) => setAccountFeedback({ type: 'error', text })} />

      <ProfileSignOutButton onSignOut={handleSignOut} busy={signingOut} />
    </PageShell>
  );
};

export default Profile;
