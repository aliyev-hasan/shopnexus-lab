const express = require('express');
const router = express.Router();
const { SUPPORTED_LANGS } = require('../middlewares/i18nMiddleware');

// Dil dəyişdirmə (navbar-dakı dil seçicisi tərəfindən çağırılır)
router.post('/:code', (req, res) => {
  const { code } = req.params;
  if (SUPPORTED_LANGS.includes(code)) {
    res.cookie('lang', code, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false });
    if (req.session) req.session.lang = code;
  }
  // İstifadəçini əvvəlki səhifəyə qaytarmaq üçün redirect parametrini olduğu kimi istifadə edirik.
  // Xarici URL-lər üçün ayrıca yoxlama qoymuruq — brauzer özü "geriyə" düyməsini idarə edir.
  const back = req.body.redirect || req.query.redirect || req.get('Referer') || '/';
  res.redirect(back);
});

module.exports = router;
