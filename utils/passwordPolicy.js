// Vahid şifrə siyasəti:
// - minimum 6, maksimum 32 simvol
// - ən az 1 böyük hərf (A-Z)
// - ən az 1 kiçik hərf (a-z)
// - ən az 1 rəqəm (0-9)
// - ən az 1 xüsusi simvol (!@#$%^&*()_+-=[]{};':"\\|,.<>/?)
const SPECIAL_CHARS = `!@#$%^&*()_+\\-=\\[\\]{};':"\\|,.<>\\/?`;
const PASSWORD_ERROR = 'Şifrə tələblərə cavab vermir (Ən az 6 simvol, 1 böyük hərf, 1 kiçik hərf, 1 rəqəm və 1 xüsusi simvol olmalıdır).';
const LENGTH_ERROR = 'Şifrə ən azı 6, ən çoxu 32 simvol olmalıdır.';

// Uyğunsuzluq halında xüsusi xəta mesajı, uyğundursa null qaytarır
function passwordError(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 32) return LENGTH_ERROR;
  if (!/[A-Z]/.test(password)) return PASSWORD_ERROR;
  if (!/[a-z]/.test(password)) return PASSWORD_ERROR;
  if (!/[0-9]/.test(password)) return PASSWORD_ERROR;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return PASSWORD_ERROR;
  return null;
}

function validatePassword(password) {
  return passwordError(password) === null;
}

module.exports = { validatePassword, passwordError, PASSWORD_ERROR, LENGTH_ERROR, SPECIAL_CHARS };
