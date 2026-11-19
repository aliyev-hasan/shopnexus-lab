const Notification = require('../models/Notification');

exports.index = async (req, res) => {
  try {
    const notifications = await Notification.findByRecipient(req.user.id);
    res.render('notifications/index', { title: 'Bildirişlər', notifications });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

exports.open = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification || notification.recipient_user_id !== req.user.id) return res.status(404).render('errors/404', { title: 'Bildiriş tapılmadı' });
    await Notification.markRead(notification._id, req.user.id);
    const target = notification.target_route && String(notification.target_route).startsWith('/') ? notification.target_route : '/notifications';
    res.redirect(target);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/notifications');
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.markAllRead(req.user.id);
    req.flash('success', 'Bütün bildirişlər oxunmuş kimi işarələndi.');
    res.redirect('/notifications');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/notifications');
  }
};
