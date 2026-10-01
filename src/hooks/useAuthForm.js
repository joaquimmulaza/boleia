import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { validateTelefone, validatePassword, MIN_PASSWORD_LENGTH } from '../utils/validation';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { useAuth } from '../contexts/AuthContext';

/**
 * Resolve modo especial a partir da query (forgot / update-password / register).
 * @param {string | null} modeParam
 * @returns {'login' | 'register' | 'forgot' | 'update-password'}
 */
export const resolveAuthMode = (modeParam) => {
  if (modeParam === 'forgot') return 'forgot';
  if (modeParam === 'update-password') return 'update-password';
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

  /** Toggle login ↔ registo (estado local; URL `mode=register` só inicializa). */
  const [isLogin, setIsLogin] = useState(modeFromUrl !== 'register');
  const [profileType, setProfileType] = useState(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const isForgot = modeFromUrl === 'forgot';
  const isUpdatePassword = modeFromUrl === 'update-password';
  const isRegister = !isForgot && !isUpdatePassword && !isLogin;
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

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});
    setIsLoading(true);

    const redirectTo = `${window.location.origin}/auth?mode=update-password`;
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

    e.preventDefault();
    setFeedback({ type: '', message: '' });
    setErrors({});
    setIsLoading(true);

    if (!isLogin && !validateTelefone(telefone)) {
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
            tipo_perfil: profileType,
            nome_completo: nome,
            telefone: telefone,
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

      const role = sessionUser?.user_metadata?.tipo_perfil || profileType;
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
    setProfileType('Passageiro');
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
    isRegister,
    profileType,
    showPassword,
    email,
    password,
    passwordConfirm,
    nome,
    telefone,
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
  };
};
