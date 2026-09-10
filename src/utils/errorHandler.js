export function getFriendlyErrorMessage(error) {
  if (!error) return 'Ocorreu um erro inesperado. Tente novamente.';
  
  const msg = typeof error === 'string' ? error : error.message || '';
  
  if (msg.includes('row-level security policy')) {
    return 'Não tem permissão para realizar esta operação.';
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

  return 'Ocorreu um erro inesperado. Tente novamente.';
}
