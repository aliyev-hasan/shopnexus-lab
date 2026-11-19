const Review = require('../models/Review');
const Product = require('../models/Product');

// Məhsulun rating və rəy sayını yenidən hesabla
async function recalcProductRating(productId) {
  const reviews = await Review.findByProductId(productId);
  const count = reviews.length;
  if (count === 0) {
    await Product.update(productId, { rating: 0, reviews_count: 0 });
    return;
  }
  const avg = reviews.reduce((sum, r) => sum + Number(r.rating), 0) / count;
  await Product.update(productId, { rating: Number(avg.toFixed(2)), reviews_count: count });
}

// Yeni rəy yarat
exports.createReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const product = await Product.findById(productId);
    if (!product) {
      req.flash('error', 'Məhsul tapılmadı!');
      return res.redirect('back');
    }
    await Review.create(req.user.id, productId, { rating, comment });
    await recalcProductRating(productId);
    req.flash('success', 'Rəyiniz əlavə edildi!');
    res.redirect(`/products/${productId}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};

// Məhsula aid rəyləri göstər
exports.getReviews = async (req, res) => {
  try {
    const reviews = await Review.findByProductId(req.params.productId);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Rəyi sil
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      req.flash('error', 'Rəy tapılmadı!');
      return res.redirect('back');
    }
    const productId = review.product_id;
    await Review.delete(req.params.id);
    await recalcProductRating(productId);
    req.flash('success', 'Rəy silindi!');
    res.redirect('back');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};

// Rəyi yenilə
exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      req.flash('error', 'Rəy tapılmadı!');
      return res.redirect('back');
    }
    if (review.user_id !== req.user.id && req.user.role !== 'Admin') {
      req.flash('error', 'Bu rəyi yeniləməyə icazəniz yoxdur!');
      return res.redirect('back');
    }
    const { rating, comment } = req.body;
    await Review.update(req.params.id, { rating, comment });
    await recalcProductRating(review.product_id);
    req.flash('success', 'Rəy yeniləndi!');
    res.redirect('back');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
};
