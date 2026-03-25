/**
 * Valida se um número de telefone segue o formato de Angola.
 * O formato aceito é um opcional '+244' seguido por 9 dígitos, começando com '9'.
 *
 * @param {string} tel - O número de telefone a validar.
 * @returns {boolean} - True se o telefone for válido, false caso contrário.
 */
export const validateTelefone = (tel) => {
  if (!tel) return false;
  // Remove espaços e hífens para validação
  const cleanTel = tel.replace(/[\s-]/g, '');
  // Regex para Angola: opcional +244, seguido de 9 dígitos começando com 9
  const angolaRegex = /^(\+244)?9\d{8}$/;
  return angolaRegex.test(cleanTel);
};

/**
 * Valida se uma palavra-passe tem o comprimento mínimo necessário.
 * A palavra-passe deve ter pelo menos 8 caracteres.
 *
 * @param {string} password - A palavra-passe a validar.
 * @returns {boolean} - True se a palavra-passe for válida, false caso contrário.
 */
export const validatePassword = (password) => {
  if (!password) return false;
  return password.length >= 8;
};
