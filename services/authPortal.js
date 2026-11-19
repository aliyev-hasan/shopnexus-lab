const PORTALS = Object.freeze({ Customer: 'Customer', Vendor: 'Vendor', Admin: 'Admin' });

function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
}

function isLocalHostname(hostname) {
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host === '::1' || host === '0.0.0.0' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function portalForHostname(hostname) {
  const host = normalizeHostname(hostname);
  if (host === 'admin.shopnexus.cyou') return PORTALS.Admin;
  if (host === 'vendor.shopnexus.cyou') return PORTALS.Vendor;
  return PORTALS.Customer;
}

function authPortal(explicitPortal = null) {
  return (req, res, next) => {
    const local = isLocalHostname(req.hostname);
    const hostnamePortal = portalForHostname(req.hostname);
    if (!local && explicitPortal) {
      return res.status(403).render('errors/403', { title: 'Bu giriş yolu yalnız lokal inkişaf mühitində əlçatandır' });
    }
    const portal = local && explicitPortal ? explicitPortal : hostnamePortal;
    const localPrefix = local && explicitPortal && explicitPortal !== 'Customer'
      ? `/auth/${explicitPortal.toLowerCase()}`
      : '/auth';
    req.authPortal = portal;
    req.authPaths = {
      login: `${localPrefix}/login`,
      register: portal === PORTALS.Admin ? null : `${localPrefix}/register`
    };
    res.locals.authPortal = portal;
    res.locals.authPaths = req.authPaths;
    next();
  };
}

module.exports = { PORTALS, normalizeHostname, isLocalHostname, portalForHostname, authPortal };
