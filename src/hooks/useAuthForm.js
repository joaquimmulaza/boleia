import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { validateTelefone, validatePassword, MIN_PASSWORD_LENGTH } from '../utils/validation';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { getPasswordRecoveryRedirectUrl } from '../utils/appOrigin';
import { useAuth } from '../contexts/AuthContext';

/**
 * Resolve modo especial a partir da query (forgot / update-password / register).
 * @param {string | null} modeParam
 * @returns {'login' | 'register' | 'forgot' | 'update-password'}
 */
export const resolveAuthMode = (modeParam) => {
  if (modeParam === 'forgot') return 'forgot';
  if (modeParam === 'update-password') return 'update-password';
  if (modeParam === 'completar-perfil') return 'completar-perfil';
  if (modeParam === 'register') return 'register';
  return 'login';
};

export const useAuthForm = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const modeFromUrl = resolveAuthMode(queryParams.get('mode'));
  const initialRole = queryParams.get('role') === 'driver' ? 'Motorista' : 'Passageiro';

  const navigate = useNavigate();
  const auth = useAuth();
  const clearPasswordRecovery = auth?.clearPasswordRecovery;
  const tipoPerfil = auth?.tipoPerfil;
  const authUser = auth?.user;
  const authProfile = auth?.profile;
  const refreshProfile = auth?.refreshProfile;

  /** Toggle login ↔ registo (estado local; URL `mode=register` só inicializa). */
  const [isLogin, setIsLogin] = useState(modeFromUrl !== 'register');
  const [profileType, setProfileTypeState] = useState(initialRole);
  const [roleEdited, setRoleEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nome, setNomeState] = useState('');
  const [nomeEdited, setNomeEdited] = useState(false);
  const [telefone, setTelefoneState] = useState('');
  const [telefoneEdited, setTelefoneEdited] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const isForgot = modeFromUrl === 'forgot';
  const isUpdatePassword = modeFromUrl === 'update-password';
  const isCompleteProfile = modeFromUrl === 'completar-perfil';
  const isRegister = !isForgot && !isUpdatePassword && !isCompleteProfile && !isLogin;

  const meta = authUser?.user_metadata || {};
  const suggestedNome = authProfile?.nome_completo || meta.nome_completo || meta.full_name || meta.name || '';
  const suggestedTelefone = authProfile?.telefone || meta.telefone || '';
  const suggestedRole = authProfile?.tipo_perfil || meta.tipo_perfil;
  const nomeValue = nomeEdited ? nome : (nome || suggestedNome);
  const telefoneValue = telefoneEdited ? telefone : (telefone || suggestedTelefone);
  const profileTypeValue = !roleEdited && (suggestedRole === 'Passageiro' || suggestedRole === 'Motorista')
    ? suggestedRole
    : profileType;

  const setNome = (value) => {
    setNomeEdited(true);
    setNomeState(value);
  };
  const setTelefone = (value) => {
    setTelefoneEdited(true);
    setTelefoneState(value);
  };
  const setProfileType = (value) => {
    setRoleEdited(true);
    setProfileTypeState(value);
  };
  const authMode = isForgot
    ? 'forgot'
    : isUpdatePassword
      ? 'update-password'
      : isLogin
        ? 'login'
        : 'register';

  const navigateToHub = (role) => {
    const destino = role === 'Motorista' ? '/motorista' : '/passageiro';
    setTimeout(() => navigate(destino), 1000);
  };

  const handleCompleteProfileSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});

    const nextErrors = {};
    if (!nomeValue.trim()) {
      nextErrors.nome = 'Indica o teu nome.';
    }
    if (!validateTelefone(telefoneValue)) {
      nextErrors.telefone = 'Número de telefone inválido. Use o formato: +244 9XXXXXXXX';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    if (!authUser?.id) {
      setFeedback({ type: 'error', message: 'A sessão expirou. Entra novamente.' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from('perfis')
      .update({
        nome_completo: nomeValue.trim(),
        telefone: telefoneValue,
        tipo_perfil: profileTypeValue,
        perfil_completo: true,
      })
      .eq('id', authUser.id);

    if (error) {
      console.error('Erro ao completar perfil:', error);
      setIsLoading(false);
      setFeedback({ type: 'error', message: getFriendlyErrorMessage(error) });
      return;
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        nome_completo: nomeValue.trim(),
        telefone: telefoneValue,
        tipo_perfil: profileTypeValue,
      },
    });
    setIsLoading(false);

    if (metaError) {
      console.error('Erro ao actualizar metadata:', metaError);
      setFeedback({ type: 'error', message: getFriendlyErrorMessage(metaError) });
      return;
    }

    if (typeof refreshProfile === 'function') {
      await refreshProfile();
    }
    setFeedback({ type: 'success', message: 'Perfil guardado.' });
    navigateToHub(profileTypeValue);
  };

  const handleLeaveComplete = async () => {
    await supabase.auth.signOut();
    setIsLogin(true);
    navigate('/auth', { replace: true });
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});
    setIsLoading(true);

    const redirectTo = getPasswordRecoveryRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setIsLoading(false);

    if (error) {
      setFeedback({ type: 'error', message: getFriendlyErrorMessage(error) });
      return;
    }

    setFeedback({
      type: 'success',
      message: 'Se existir conta com este email, enviámos instruções.',
    });
  };

  const handleUpdatePasswordSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});

    const nextErrors = {};
    if (!validatePassword(password)) {
      nextErrors.password = `A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password !== passwordConfirm) {
      nextErrors.passwordConfirm = 'As palavras-passe não coincidem.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      setFeedback({ type: 'error', message: getFriendlyErrorMessage(error) });
      return;
    }

    if (typeof clearPasswordRecovery === 'function') {
      clearPasswordRecovery();
    }
    setFeedback({ type: 'success', message: 'Palavra-passe actualizada com sucesso!' });
    navigateToHub(tipoPerfil || 'Passageiro');
  };

  const handleSubmit = async (e) => {
    if (isForgot) {
      return handleForgotSubmit(e);
    }
    if (isUpdatePassword) {
      return handleUpdatePasswordSubmit(e);
    }
    if (isCompleteProfile) {
      return handleCompleteProfileSubmit(e);
    }

    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});
    setIsLoading(true);

    if (!isLogin && !validateTelefone(telefoneValue)) {
      setErrors((prev) => ({
        ...prev,
        telefone: 'Número de telefone inválido. Use o formato: +244 9XXXXXXXX'
      }));
      setIsLoading(false);
      return;
    }

    if (!isLogin && password.length < 8) {
      setErrors((prev) => ({
        ...prev,
        password: 'A password deve ter pelo menos 8 caracteres.'
      }));
      setIsLoading(false);
      return;
    }

    let error;
    let sessionUser = null;

    if (isLogin) {
      const result = await supabase.auth.signInWithPassword({ email, password });
      error = result.error;
      sessionUser = result.data?.user;
    } else {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            tipo_perfil: profileTypeValue,
            nome_completo: nomeValue,
            telefone: telefoneValue,
          },
        },
      });
      error = result.error;
      sessionUser = result.data?.user;
    }

    setIsLoading(false);

    if (error) {
      setFeedback({ type: 'error', message: getFriendlyErrorMessage(error) });
    } else if (!isLogin) {
      setFeedback({ type: 'success', message: 'Registo efetuado! Verifique o seu email para confirmar a conta.' });

      const role = sessionUser?.user_metadata?.tipo_perfil || profileTypeValue;
      navigateToHub(role);
    } else {
      setFeedback({ type: 'success', message: 'Bem-vindo de volta!' });

      const role = sessionUser?.user_metadata?.tipo_perfil || 'Passageiro';
      navigateToHub(role);
    }
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setFeedback({ type: '', message: '' });
    setErrors({});
    setNome('');
    setTelefone('');
    setPassword('');
    setPasswordConfirm('');
    setProfileTypeState('Passageiro');
    setRoleEdited(false);
    setNomeEdited(false);
    setTelefoneEdited(false);
  };

  const handleForgotClick = () => {
    setFeedback({ type: '', message: '' });
    setErrors({});
    setPassword('');
    navigate('/auth?mode=forgot', { replace: true });
  };

  const handleBackToLogin = () => {
    setFeedback({ type: '', message: '' });
    setErrors({});
    setPassword('');
    setPasswordConfirm('');
    setIsLogin(true);
    navigate('/auth', { replace: true });
  };

  return {
    authMode,
    isLogin: authMode === 'login',
    isForgot,
    isUpdatePassword,
    isCompleteProfile,
    isRegister,
    userEmail: authUser?.email || '',
    profileType: profileTypeValue,
    showPassword,
    email,
    password,
    passwordConfirm,
    nome: nomeValue,
    telefone: telefoneValue,
    feedback,
    errors,
    isLoading,
    setEmail,
    setPassword,
    setPasswordConfirm,
    setNome,
    setTelefone,
    setProfileType,
    setShowPassword,
    setErrors,
    handleSubmit,
    handleToggleMode,
    handleForgotClick,
    handleBackToLogin,
    handleLeaveComplete,
  };
};
