const QRCode = require('qrcode');
const Receipt = require('../models/Receipt');
const { getPublicBaseUrl } = require('../config/publicUrl');

async function renderReceipt(req, res, receipt, isOwner) {
  const receiptUrl = `${getPublicBaseUrl(req)}/receipts/${receipt.public_token}`;
  const qrDataUrl = await QRCode.toDataURL(receiptUrl, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
  res.render('receipts/show', { title: 'Qəbz', receipt, receiptUrl, qrDataUrl, isOwner });
}

exports.publicView = async (req, res, next) => {
  try {
    const receipt = await Receipt.findByPublicToken(req.params.token);
    if (!receipt) return res.status(404).render('errors/404', { title: 'Qəbz tapılmadı' });
    const isOwner = !!(res.locals.user && res.locals.user.id === receipt.user_id);
    return await renderReceipt(req, res, receipt, isOwner);
  } catch (error) { return next(error); }
};

exports.ownerView = async (req, res, next) => {
  try {
    const receipt = await Receipt.findByPublicToken(req.params.token);
    if (!receipt || receipt.user_id !== req.user.id) return res.status(404).render('errors/404', { title: 'Qəbz tapılmadı' });
    return await renderReceipt(req, res, receipt, true);
  } catch (error) { return next(error); }
};
