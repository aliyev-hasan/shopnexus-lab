const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const User = require('../models/User');
const { isLocalHostname } = require('../services/authPortal');
const { tokenForRequest, clearAuthCookies } = require('../services/authSession');

function loginPath(req) {
  if (!isLocalHostname(req.hostname)) return '/auth/login';
  if (req.path.startsWith('/vendor') || req.originalUrl.startsWith('/vendor')) return '/auth/vendor/login';
  if (req.path.startsWith('/admin') || req.originalUrl.startsWith('/admin')) return '/auth/admin/login';
  return '/auth/login';
}

// JWT tokenini yoxla
const authenticate = async (req, res, next) => {
  const token = tokenForRequest(req);
  if (!token) {
    req.flash('error', 'Giriş etmək tələb olunur!');
    return res.redirect(loginPath(req));
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const user = await User.findById(decoded.id);
    if (!user) {
      clearAuthCookies(res);
      req.flash('error', 'İstifadəçi tapılmadı!');
      return res.redirect(loginPath(req));
    }
    if (user.isActive === false) {
      clearAuthCookies(res);
      req.flash('error', 'Hesabınız bloklanıb!');
      return res.redirect(loginPath(req));
    }
    req.user = { id: decoded.id, role: decoded.role || user.role, email: decoded.email || user.email };
    next();
  } catch (err) {
    req.flash('error', 'Etibarsız token!');
    res.redirect(loginPath(req));
  }
};

// Rol əsaslı giriş nəzarəti
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      req.flash('error', 'Giriş etmək tələb olunur!');
      return res.redirect(loginPath(req));
    }

    if (!roles.includes(req.user.role)) {
      req.flash('error', 'Bu səhifəyə giriş icazəniz yoxdur!');
      return res.status(403).render('errors/403', { title: 'Giriş qadağandır' });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
