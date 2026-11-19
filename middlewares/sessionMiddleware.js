const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const User = require('../models/User');
const { tokenForRequest, clearAuthCookies } = require('../services/authSession');

// Token versiya yoxlaması: istifadəçi şifrəni dəyişdikdən sonra verilmiş bütün köhnə
// tokenlər etibarsızlaşır. authenticate-dən ayrı saxlanılır ki, əsas auth axını dəyişməsin.
async function requireCurrentAuthVersion(req, res, next) {
  try {
    const token = tokenForRequest(req);
    if (!token) return next();
    const decoded = jwt.verify(token, jwtConfig.secret);
    if (!decoded.iat) return next();
    const user = await User.findById(decoded.id);
    if (user && user.passwordChangedAt) {
      const changedAt = Date.parse(user.passwordChangedAt);
      if (Number.isFinite(changedAt) && decoded.iat * 1000 < changedAt) {
        clearAuthCookies(res);
        req.flash('error', 'Şifrə dəyişdirilib. Təhlükəsizlik üçün yenidən giriş edin.');
        return res.redirect('/auth/login');
      }
    }
    next();
  } catch (err) {
    next();
  }
}

module.exports = { requireCurrentAuthVersion };
