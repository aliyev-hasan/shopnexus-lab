const { PORTALS, isLocalHostname, portalForHostname } = require('./authPortal');

const COOKIE_BY_ROLE = Object.freeze({
  [PORTALS.Customer]: 'token_customer',
  [PORTALS.Vendor]: 'token_vendor',
  [PORTALS.Admin]: 'token_admin'
});

function portalForRequest(req) {
  if (!isLocalHostname(req.hostname)) return portalForHostname(req.hostname);
  const pathname = String(req.originalUrl || req.url || '').split('?')[0];
  if (/^\/(?:auth\/)?admin(?:\/|$)/.test(pathname)) return PORTALS.Admin;
  if (/^\/(?:auth\/)?vendor(?:\/|$)/.test(pathname)) return PORTALS.Vendor;
  return PORTALS.Customer;
}

function cookieNameForRole(role) {
  return COOKIE_BY_ROLE[role] || COOKIE_BY_ROLE[PORTALS.Customer];
}

function tokenForRequest(req) {
  // Portal-a uyğun rol cookie-si, yoxdursa ümumi `token` cookie-si (lokal inkişafda
  // admin/vendor-ın profil və digər səhifələrə girişi üçün geriyə uyğunluq).
  return req.cookies[cookieNameForRole(portalForRequest(req))] || req.cookies.token || null;
}

function cookieOptions(req) {
  return {
    httpOnly: true,
    // Cross-site sorğularda (məs. link paylaşımı, bəzi ödəniş keçidləri) cookie-nin
    // göndərilməsi üçün SameSite='none' qoyduq. SameSite=None üçün brauzer Secure
    // atributunu tələb edir — localhost secure kontekst sayıldığından http üzərində də işləyir.
    sameSite: 'none',
    secure: true
  };
}

function setAuthToken(req, res, role, token) {
  const options = cookieOptions(req);
  res.cookie(cookieNameForRole(role), token, options);
  // Köhnə sessiyalar və mövcud istifadəçilər üçün geriyə uyğun ümumi cookie.
  res.cookie('token', token, options);
}

function clearAuthCookies(res) {
  res.clearCookie('token');
  Object.values(COOKIE_BY_ROLE).forEach(name => res.clearCookie(name));
}

module.exports = {
  COOKIE_BY_ROLE,
  portalForRequest,
  cookieNameForRole,
  tokenForRequest,
  setAuthToken,
  clearAuthCookies
};
