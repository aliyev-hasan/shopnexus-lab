const SORTS = new Set(['price-asc', 'price-desc', 'newest', 'rating-desc']);

function finiteNonNegative(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeProductQuery(raw = {}) {
  const query = {};
  const search = String(raw.search || '').trim().slice(0, 200);
  if (search) query.search = search;
  const categories = [...new Set(String(raw.category || '').split(',').map(item => item.trim()).filter(Boolean))];
  if (categories.length) query.category = categories.join(',');
  let min = finiteNonNegative(raw.min);
  let max = finiteNonNegative(raw.max);
  let priceRangeAdjusted = false;
  if (min !== null && max !== null && min > max) { [min, max] = [max, min]; priceRangeAdjusted = true; }
  if (min !== null) query.min = String(min);
  if (max !== null) query.max = String(max);
  const rating = Number(raw.rating);
  if (Number.isFinite(rating) && rating >= 1 && rating <= 5) query.rating = String(rating);
  if (SORTS.has(String(raw.sort || ''))) query.sort = String(raw.sort);
  return { query, categories, min, max, rating: query.rating ? Number(query.rating) : null, priceRangeAdjusted };
}

function applyProductFilters(products, rawQuery) {
  const normalized = normalizeProductQuery(rawQuery);
  const searchNeedle = (normalized.query.search || '').toLocaleLowerCase('az-AZ');
  let result = products.filter(product => {
    if (searchNeedle && !`${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLocaleLowerCase('az-AZ').includes(searchNeedle)) return false;
    if (normalized.categories.length && !normalized.categories.includes(product.category)) return false;
    const price = Number(product.price);
    if (normalized.min !== null && (!Number.isFinite(price) || price < normalized.min)) return false;
    if (normalized.max !== null && (!Number.isFinite(price) || price > normalized.max)) return false;
    if (normalized.rating !== null && Number(product.rating || 0) < normalized.rating) return false;
    return true;
  });
  const tie = (a, b) => String(a._id).localeCompare(String(b._id));
  const sort = normalized.query.sort;
  if (sort === 'price-asc') result.sort((a, b) => Number(a.price) - Number(b.price) || tie(a, b));
  else if (sort === 'price-desc') result.sort((a, b) => Number(b.price) - Number(a.price) || tie(a, b));
  else if (sort === 'rating-desc') result.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || tie(a, b));
  else result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) || tie(a, b));
  return { products: result, ...normalized };
}

module.exports = { normalizeProductQuery, applyProductFilters };
