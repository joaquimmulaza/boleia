export function getFriendlyErrorMessage(error) {
  if (!error) return 'Ocorreu um erro inesperado. Tente novamente.';
  
  const msg = typeof error === 'string' ? error : error.message || '';
  
  if (msg.includes('row-level security policy')) {
    return 'Não tem permissão para realizar esta operação.';
  }
  const code = typeof error === 'object' && error ? error.code : '';
  if (code === 'email_not_confirmed' || msg.includes('Email not confirmed')) {
    return 'Confirme o email antes de entrar. Abra a mensagem que enviámos para activar a conta.';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Email ou palavra-passe incorretos.';
  }
  if (msg.includes('User already registered')) {
    return 'Este email já está registado na plataforma.';
  }
  if (msg.includes('Failed to fetch')) {
    return 'Sem ligação à internet. Verifique a sua rede.';
  }
  if (/sem IBAN ou titular/i.test(msg)) {
    return 'O motorista precisa de IBAN e titular no perfil antes de liquidar.';
  }
  if (/sem IBAN configurado/i.test(msg)) {
    return 'O motorista precisa de IBAN no perfil antes de liquidar.';
  }
  if (/New password should be different/i.test(msg)) {
    return 'A nova palavra-passe deve ser diferente da actual.';
  }
  if (/only request this after|rate.?limit|security purposes/i.test(msg)) {
    return 'Aguarde um momento antes de pedir novamente a recuperação.';
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}
