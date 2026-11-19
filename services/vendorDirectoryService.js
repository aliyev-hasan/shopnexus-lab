const Vendor = require('../models/Vendor');
const Product = require('../models/Product');

async function getVendorSummaries({ activeOnly = true } = {}) {
  const [vendors, products] = await Promise.all([Vendor.findAll(), Product.findAll()]);
  const productsByVendor = products.reduce((map, product) => {
    (map[product.vendor_id] = map[product.vendor_id] || []).push(product);
    return map;
  }, {});
  return vendors.filter(vendor => !activeOnly || (vendor.status || 'ACTIVE') === 'ACTIVE').map(vendor => {
    const vendorProducts = productsByVendor[vendor.user_id] || [];
    const categories = [...new Set(vendorProducts.map(product => product.category).filter(Boolean))];
    const totalReviews = vendorProducts.reduce((sum, product) => sum + Number(product.reviews_count || 0), 0);
    const totalStars = vendorProducts.reduce((sum, product) => sum + Number(product.rating || 0) * Number(product.reviews_count || 0), 0);
    const rating = totalReviews ? totalStars / totalReviews : 0;
    return { vendor, productCount: vendorProducts.length, categories, rating, totalReviews };
  });
}

async function getFeaturedVendors(limit = 8) {
  const summaries = await getVendorSummaries({ activeOnly: true });
  return summaries.filter(item => item.vendor.featured === true && item.productCount >= 4 && item.vendor.store_logo && item.vendor.store_banner && item.vendor.store_description).sort((a, b) => b.rating - a.rating || b.productCount - a.productCount).slice(0, limit);
}

module.exports = { getVendorSummaries, getFeaturedVendors };
