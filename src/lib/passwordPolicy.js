export const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: 'At least 8 characters', test: (value = '') => value.length >= 8 },
  { key: 'lowercase', label: 'One lowercase letter (a-z)', test: (value = '') => /[a-z]/.test(value) },
  { key: 'uppercase', label: 'One uppercase letter (A-Z)', test: (value = '') => /[A-Z]/.test(value) },
  { key: 'number', label: 'One number (0-9)', test: (value = '') => /\d/.test(value) },
  { key: 'special', label: 'One special character', test: (value = '') => /[^A-Za-z0-9]/.test(value) },
];

export function validateStrongPassword(password = '') {
  const missing = PASSWORD_REQUIREMENTS.filter((rule) => !rule.test(password)).map((rule) => rule.label);
  return { valid: missing.length === 0, missing };
}

export function strongPasswordMessage() {
  return 'Password must have at least 8 characters, one lowercase letter, one uppercase letter, one number, and one special character.';
}