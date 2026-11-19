(function () {
  window.passwordPolicyError = function (pw) {
    if (typeof pw !== 'string' || pw.length < 6 || pw.length > 32) {
      return 'Şifrə ən azı 6, ən çoxu 32 simvol olmalıdır.';
    }
    if (!/[A-Z]/.test(pw)) return window.PASSWORD_POLICY_MSG;
    if (!/[a-z]/.test(pw)) return window.PASSWORD_POLICY_MSG;
    if (!/[0-9]/.test(pw)) return window.PASSWORD_POLICY_MSG;
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return window.PASSWORD_POLICY_MSG;
    return null;
  };
  window.validateStrongPassword = function (pw) { return window.passwordPolicyError(pw) === null; };
  window.PASSWORD_POLICY_MSG = 'Şifrə tələblərə cavab vermir (Ən az 6 simvol, 1 böyük hərf, 1 kiçik hərf, 1 rəqəm və 1 xüsusi simvol olmalıdır).';

  function bindForm(form) {
    var field = form.querySelector('[name="password"]') || form.querySelector('[name="newPassword"]');
    if (!field) return;
    form.addEventListener('submit', function (e) {
      var err = window.passwordPolicyError(field.value);
      if (err) {
        e.preventDefault();
        field.setCustomValidity(err);
        field.reportValidity();
      } else {
        field.setCustomValidity('');
      }
    });
  }

  function bindAll() {
    document.querySelectorAll('form[data-password-policy]').forEach(bindForm);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAll);
  } else {
    bindAll();
  }
})();
