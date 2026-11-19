// Kupon endirimini hesablayan MƏRKƏZİ funksiya.
// Bütün checkout/cart axınları YALNIZ bu funksiyadan istifadə etməlidir (qayda: kupon
// yoxlaması bir yerdə mərkəzləşdirilməlidir).
//
// `lines` səbətdəki hər məhsul sətrini təmsil edir: [{ price, quantity, vendor_id }, ...]
// Geriyə uyğunluq üçün `lines` bir ədəd (köhnə subtotal) kimi də ötürülə bilər — bu halda
// bütün cəm tək bir "vendor_id: null" sətri kimi qəbul olunur (yalnız qlobal kuponlar üçün
// dəqiq işləyir; satıcıya məxsus kuponlar üçün mütləq sətir massivi tələb olunur).
const { roundMoney } = require('./money');

function calculateDiscount(coupon, lines) {
  if (!coupon) return { discount: 0 };
  if (Number(coupon.used_count || 0) >= Number(coupon.usage_limit || 1000)) return { error: 'Kuponun istifadə limiti bitib.' };

  const allLines = Array.isArray(lines)
    ? lines
    : [{ price: Number(lines) || 0, quantity: 1, vendor_id: null }];

  const subtotal = allLines.reduce((sum, l) => sum + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0);

  // Satıcıya məxsus kuponlar YALNIZ həmin satıcının məhsullarına tətbiq olunur.
  const isVendorCoupon = !!coupon.vendor_id;
  const eligibleLines = isVendorCoupon
    ? allLines.filter(l => String(l.vendor_id) === String(coupon.vendor_id))
    : allLines;
  const eligibleSubtotal = eligibleLines.reduce((sum, l) => sum + (Number(l.price) || 0) * (Number(l.quantity) || 0), 0);

  if (isVendorCoupon && eligibleSubtotal <= 0) {
    return { error: 'Bu kupon yalnız müvafiq satıcının məhsullarına şamil edilir. Səbətinizdə həmin satıcının məhsulu yoxdur.' };
  }

  // Minimum sifariş dəyəri yalnız forma tərəfində yoxlanılır; burada backend
  // kuponun tətbiq edilməsinə mane olmur (endirim hər halda yuxarıda clamp edilir).
  if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
    return { error: 'Kuponun istifadə müddəti bitib.' };
  }

  if (coupon.discount_type === 'free_shipping') {
    return { discount: 0, freeShipping: true, eligibleSubtotal };
  }
  if (coupon.discount_type === 'first_order') {
    return { discount: roundMoney((eligibleSubtotal * coupon.discount_value) / 100), firstOrder: true, eligibleSubtotal: roundMoney(eligibleSubtotal) };
  }

  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = (eligibleSubtotal * coupon.discount_value) / 100;
  } else {
    discount = coupon.discount_value;
  }
  return { discount: roundMoney(Math.min(discount, eligibleSubtotal)), eligibleSubtotal: roundMoney(eligibleSubtotal) };
}

module.exports = { calculateDiscount };
