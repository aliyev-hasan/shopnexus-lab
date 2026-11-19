const User = require('../models/User');
const Wallet = require('../models/Wallet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const jwtConfig = require('../config/jwt');
const { setAuthToken, clearAuthCookies } = require('../services/authSession');
const { validatePassword, passwordError } = require('../utils/passwordPolicy');

exports.showLogin = (req, res) => {
  res.render('auth/login', { title: 'Giriş', portalRole: req.authPortal, authPaths: req.authPaths, user: null });
};

exports.showRegister = (req, res) => {
  if (req.authPortal === 'Admin') return res.status(404).render('errors/404', { title: 'Admin qeydiyyatı mövcud deyil' });
  res.render('auth/register', { title: 'Qeydiyyat', portalRole: req.authPortal, authPaths: req.authPaths, user: null });
};

// Qeydiyyat
exports.register = async (req, res) => {
  try {
    if (req.authPortal === 'Admin') return res.status(404).render('errors/404', { title: 'Admin qeydiyyatı mövcud deyil' });
    const { full_name, email, password } = req.body;
    const pwdError = passwordError(password);
    if (pwdError) {
      return res.status(400).json({ success: false, error: pwdError });
    }
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      req.flash('error', 'Bu email artıq istifadə olunur!');
      return res.redirect(req.authPaths.register);
    }
    const safeRole = req.authPortal === 'Vendor' ? 'Vendor' : 'Customer';
    const user = await User.create({ full_name, email, password, role: safeRole });
    await Wallet.create(user._id, 0);
    const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    setAuthToken(req, res, user.role, token);
    req.flash('success', 'Qeydiyyat uğurla tamamlandı!');
    res.redirect(safeRole === 'Vendor' ? '/vendor/onboarding' : '/products');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(req.authPaths.register || req.authPaths.login);
  }
};

// Giriş
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (user && user.isActive === false) {
      req.flash('error', 'Hesabınız bloklanıb! Administratorla əlaqə saxlayın.');
      return res.redirect(req.authPaths.login);
    }
    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.flash('error', 'Email və ya şifrə yanlışdır!');
      return res.redirect(req.authPaths.login);
    }
    if (user.role !== req.authPortal) {
      req.flash('error', `Bu portal yalnız ${req.authPortal} hesabları üçündür.`);
      return res.redirect(req.authPaths.login);
    }
    const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
    setAuthToken(req, res, user.role, token);
    res.redirect(user.role === 'Admin' ? '/admin' : user.role === 'Vendor' ? '/vendor/dashboard' : '/products');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(req.authPaths.login);
  }
};

// Çıxış
exports.logout = (req, res) => {
  clearAuthCookies(res);
  req.flash('success', 'Çıxış edildi!');
  res.redirect('/');
};

// Şifrəni dəyiş
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      req.flash('error', 'Cari şifrə yanlışdır!');
      return res.redirect('/user/profile');
    }
    if (!newPassword) {
      req.flash('error', 'Yeni şifrə boş ola bilməz!');
      return res.redirect('/user/profile');
    }
    const pwdError = passwordError(newPassword);
    if (pwdError) {
      return res.status(400).json({ success: false, error: pwdError });
    }
    // Eyni şifrə qoruması: yeni şifrə cari şifrə ilə eynidirsə rədd edilir
    if (await bcrypt.compare(newPassword, user.password)) {
      req.flash('error', 'Yeni şifrə mövcud şifrə ilə eynidir.');
      return res.redirect('/user/profile');
    }
    await User.updatePassword(req.user.id, newPassword);
    // Şifrə dəyişdiyi üçün bütün köhnə tokenlər etibarsızlaşır — istifadəçi yenidən giriş etməlidir.
    clearAuthCookies(res);
    req.flash('success', 'Şifrə uğurla dəyişdirildi. Təhlükəsizlik üçün yenidən giriş edin.');
    res.redirect('/auth/login');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile');
  }
};
