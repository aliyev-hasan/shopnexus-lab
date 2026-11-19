const Question = require('../models/Question');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Məhsul haqqında sual ver (müştəri)
exports.askQuestion = async (req, res) => {
  try {
    const { productId, questionText } = req.body;
    const text = (questionText || '').trim();
    if (!text) {
      req.flash('error', 'Sual mətni boş ola bilməz!');
      return res.redirect(`/products/${productId}`);
    }
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Məhsul tapılmadı!');
      return res.redirect('back');
    }
    const question = await Question.create(req.user.id, productId, product.vendor_id, text);
    await Notification.create({ recipientUserId: product.vendor_id, recipientRole: 'Vendor', type: 'PRODUCT_QUESTION_NEW', contextKey: 'questions', title: 'Yeni məhsul sualı', message: `${product.name} məhsulu haqqında yeni sual var.`, targetRoute: '/vendor/questions', targetEntityId: question._id });
    const admins = (await User.findAll()).filter(user => user.role === 'Admin' && user.isActive !== false);
    await Promise.all(admins.map(admin => Notification.create({ recipientUserId: admin._id, recipientRole: 'Admin', type: 'PRODUCT_QUESTION_NEW', contextKey: 'questions', title: 'Yeni məhsul sualı', message: `${product.name} məhsulu haqqında yeni sual yaradıldı.`, targetRoute: '/admin/questions', targetEntityId: question._id })));
    req.flash('success', 'Sualınız göndərildi! Cavab verildikdən sonra bu səhifədə görünəcək.');
    res.redirect(`/products/${productId}#qa`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};

exports.deleteMyQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      req.flash('error', 'Sual tapılmadı!');
      return res.redirect('/user/profile?tab=questions');
    }
    if (question.user_id !== req.user.id) {
      return res.status(403).render('errors/403', { title: 'Giriş qadağandır' });
    }
    await Question.delete(question._id);
    await Notification.deleteByEntity(question._id);
    req.flash('success', 'Sual bütün əlaqəli bölmələrdən silindi!');
    res.redirect('/user/profile?tab=questions');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/user/profile?tab=questions');
  }
};

// İstifadəçinin öz sualları (profil üçün, opsional istifadə)
exports.getMyQuestions = async (req, res) => {
  try {
    const questions = await Question.findByUserId(req.user.id);
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
