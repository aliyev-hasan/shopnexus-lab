const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Payment = require('../models/Payment');
const PaymentEvent = require('../models/PaymentEvent');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const SavedCard = require('../models/SavedCard');
const Refund = require('../models/Refund');
const { getCommissionRate } = require('../config/commission');
const { simulateCardPayment, getForcedResult, luhnCheck, detectCardType } = require('../services/cardSimulator');
const { validExpiry } = require('../services/cardAuthorizationService');
const { grantCashback, reverseCashback } = require('../services/cashbackService');
const { calculateDiscount } = require('../services/pricingService');
const { processDueTransitions } = require('../services/orderAutomationService');
const { notifyOrderCreated, notifyRefundRequested } = require('../services/notificationService');
const { createOrderReceipt, createRefundReceipt } = require('../services/receiptService');
const { roundMoney } = require('../services/money');

// Sessiya və ya body-dən sifariş meta məlumatlarını oxu
function readOrderMeta(req) {
  // İlk submit zamanı tam kart məlumatı yalnız request yaddaşında yoxlanır;
  // OTP davamında yalnız maskalanmış təhlükəsiz metadata session-dan oxunur.
  const source = req.body && req.body.payment_method ? req.body : (req.session.pendingOrder || req.body || {});
  const { shipping_address, payment_method, customer_phone, last4, saved_card_id, card_number, card_expiry, brand } = source;
  return {
    shipping_address,
    payment_method,
    customer_phone,
    last4: String(last4 || '').replace(/\D/g, '').slice(-4),
    saved_card_id: saved_card_id || null,
    card_number: String(card_number || '').replace(/\D/g, ''),
    card_expiry: String(card_expiry || '').trim(),
    brand: brand || null
  };
}

async function saveCardAfterSuccessfulPayment(userId, meta) {
  if (!meta || !meta.save_card || meta.saved_card_id || !meta.last4) return null;
  const existing = await SavedCard.findByUserId(userId);
  const duplicate = existing.find(card => card.last4 === meta.last4 && String(card.exp_month || '') === String(meta.exp_month || '') && String(card.exp_year || '') === String(meta.exp_year || ''));
  if (duplicate) return duplicate;
  return SavedCard.create({ user_id: userId, last4: meta.last4, brand: meta.brand || 'visa', exp_month: meta.exp_month || null, exp_year: meta.exp_year || null });
}

// Kart avtorizasiyasını backend-də kart sahibliyi, kart nömrəsi və bitmə tarixi ilə yoxlayır.
// CVV simulyator axınında istifadə və ya saxlanmır.
async function resolveCardAuthorization({ userId, saved_card_id, card_number, card_expiry, last4 }) {
  if (saved_card_id) {
    const card = await SavedCard.findOwnedById(saved_card_id, userId);
    if (!card) {
      return { ok: false, message: 'Seçilmiş yadda saxlanmış kart tapılmadı.' };
    }
    if (card.exp_month && card.exp_year && !validExpiry(`${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`)) {
      return { ok: false, message: 'Yadda saxlanmış kartın istifadə müddəti bitib.' };
    }
    const forced = await getForcedResult();
    const cardResult = forced || simulateCardPayment('000000000000' + card.last4).result;
    return { ok: true, cardResult, brand: card.brand || null, last4: card.last4 };
  }

  const digits = String(card_number || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || !luhnCheck(digits)) return { ok: false, message: 'Kart nömrəsi düzgün deyil.' };
  if (!validExpiry(card_expiry)) return { ok: false, message: 'Kartın bitmə tarixi MM/YY formatında və gələcək tarix olmalıdır.' };
  const forced = await getForcedResult();
  const cardResult = forced || simulateCardPayment(digits).result;
  return { ok: true, cardResult, brand: detectCardType(digits), last4: digits.slice(-4) || last4 };
}

// Google Pay / Apple Pay: kart məlumatı daxil edilmir (tokenləşdirilmiş cüzdan ödənişi
// kimi simulyasiya edilir), lakin ödəniş forması doldurulması ilə avtomatik PAID olunmur —
// nəticə həmişə uğur/uğursuzluq simulyasiyasından keçir (admin tərəfindən məcburi test nəticəsi mümkündür).
async function resolveWalletAuthorization() {
  const forced = await getForcedResult();
  const cardResult = forced || 'SUCCESS';
  return { ok: true, cardResult };
}

// Səbət məhsullarını oxu, qiymətləri hesabla və stoku yoxla
async function buildItems(userId) {
  const cartItems = await Cart.getCart(userId);
  const items = [];
  let subtotal = 0;
  for (const item of cartItems) {
    const product = await Product.findById(item.product_id);
    if (!product) continue;
    const available = Number(product.stock_quantity) || 0;
    const requested = Number(item.quantity) || 0;
    if (available < requested) {
      return { cartItems, error: `"${product.name}" məhsulunda kifayət qədər stok yoxdur! (Mövcud: ${available}, Tələb: ${requested})` };
    }
    const price = Number(product.price) || 0;
    items.push({ product_id: product._id, quantity: requested, price, vendor_id: product.vendor_id });
    subtotal = roundMoney(subtotal + price * requested);
  }
  return { cartItems, items, subtotal };
}

// İkiqat submit üçün səbət imzası
function cartSignature(cartItems) {
  return cartItems
    .map(item => `${item.product_id}:${item.quantity}`)
    .sort()
    .join('|');
}

// Yeni sifariş yarat
exports.createOrder = async (req, res) => {
  try {
    const { shipping_address, payment_method, customer_phone, last4, saved_card_id, card_number, card_expiry, brand } = readOrderMeta(req);
    if (!shipping_address) {
      req.flash('error', 'Çatdırılma ünvanı tələb olunur!');
      return res.redirect('/checkout');
    }
    if (!payment_method) {
      req.flash('error', 'Ödəniş üsulu seçilməyib!');
      return res.redirect('/checkout');
    }

    // Yeni kartla ödənişdə CVV tələb olunur; CVV heç vaxt saxlanılmır
    // (yalnız yoxlama üçün oxunur). Saxlanmış kart seçilərsə CVV tələb olunmur.
    const cvv = String(req.body.card_cvv || '').trim();
    const usingNewCard = !saved_card_id && String(card_number || '').length > 0;
    if (usingNewCard && ['CARD_SIMULATOR', 'SPLIT_PAYMENT'].includes(payment_method) && !/^\d{3,4}$/.test(cvv)) {
      req.flash('error', 'Yeni kartla ödənişdə CVV daxil edilməlidir!');
      return res.redirect('/checkout');
    }

    const built = await buildItems(req.user.id);
    if (built.error) {
      req.flash('error', built.error);
      return res.redirect('/cart');
    }
    if (built.items.length === 0) {
      req.flash('error', 'Səbətdə etibarlı məhsul yoxdur!');
      return res.redirect('/cart');
    }

    const { cartItems, items, subtotal } = built;

    // İkiqat submit qorunması
    const signature = cartSignature(cartItems);
    const now = Date.now();
    const lastAttempt = req.session.lastOrderAttempt;
    if (lastAttempt && lastAttempt.userId === req.user.id && lastAttempt.cartSignature === signature && (now - lastAttempt.timestamp) < 5000) {
      req.flash('error', 'Sifariş artıq göndərilir!');
      return res.redirect('/cart');
    }
    req.session.lastOrderAttempt = { userId: req.user.id, cartSignature: signature, timestamp: now };

    // Kupon endirimi
    let totalAmount = roundMoney(subtotal);
    let appliedCouponCode = null;
    if (req.session.couponCode) {
      const coupon = await Coupon.findByCode(req.session.couponCode);
      if (coupon) {
        const lines = items.map(item => ({ price: item.price, quantity: item.quantity, vendor_id: item.vendor_id }));
        const result = calculateDiscount(coupon, lines);
        if (!result.error) {
          if (result.firstOrder) {
            // İlk sifariş endirimi üçün yalnız ödənişi tamamlanmayan/ləğv edilən
            // sifarişləri sayırıq — təhvil verilmiş (delivered/paid) sifarişlər bu
            // kupon üçün maneə yaratmır.
            const orders = await Order.findByUserId(req.user.id);
            const orderCount = orders.filter(o => o.status === 'PENDING_PAYMENT' || o.status === 'CANCELLED').length;
            if (orderCount === 0) {
              totalAmount = roundMoney(subtotal - result.discount);
              appliedCouponCode = coupon.code;
            }
          } else {
            totalAmount = roundMoney(subtotal - result.discount);
            appliedCouponCode = coupon.code;
          }
        }
      }
    }

    // Komissiya faizini snapshot kimi saxla (sifariş anındakı dəyər)
    const commissionRate = await getCommissionRate();

    let authorized = false;
    let wallet = null;
    let cardResult = null;
    let split = null;
    let effectiveMethod = payment_method;
    let cardBrand = brand || null;
    let cardLast4 = last4 || null;

    if (effectiveMethod === 'CASH_ON_DELIVERY') {
      authorized = true;
    } else if (effectiveMethod === 'WALLET') {
      wallet = await Wallet.findByUserId(req.user.id);
      if (!wallet) {
        wallet = await Wallet.create(req.user.id, 0);
      }
      if (Number(wallet.balance) < totalAmount) {
        req.flash('error', 'Cüzdan balansı kifayət deyil!');
        return res.redirect('/wallet');
      }
      authorized = true;
    } else if (effectiveMethod === 'SPLIT_PAYMENT') {
      wallet = await Wallet.findByUserId(req.user.id);
      if (!wallet) {
        wallet = await Wallet.create(req.user.id, 0);
      }
      const walletPart = Math.min(Number(wallet.balance), totalAmount);
      const cardPart = totalAmount - walletPart;

      if (walletPart <= 0) {
        // Cüzdan balansı yoxdursa tam kart ödənişi kimi davran
        effectiveMethod = 'CARD_SIMULATOR';
        const auth = await resolveCardAuthorization({ userId: req.user.id, saved_card_id, card_number, card_expiry, last4 });
        if (!auth.ok && !auth.cardResult) {
          req.flash('error', auth.message);
          return res.redirect('/checkout');
        }
        cardResult = auth.cardResult;
        cardBrand = auth.brand || cardBrand;
        cardLast4 = auth.last4 || cardLast4;
        if (!auth.ok) {
          const order = await Order.create(req.user.id, {
            status: 'CANCELLED',
            shipping_address,
            payment_method: effectiveMethod,
            customer_phone,
            total_amount: totalAmount,
            coupon_code: appliedCouponCode,
            commission_rate: commissionRate
          });
          const payment = await Payment.create({
            order_id: order._id,
            user_id: req.user.id,
            method: effectiveMethod,
            amount: totalAmount,
            status: 'DECLINED'
          });
          await PaymentEvent.create(payment._id, cardResult);
          req.session.pendingOrder = null;
          req.flash('error', auth.message);
          return res.redirect('/checkout');
        }
        if (cardResult === 'SUCCESS') {
          authorized = true;
        } else if (cardResult === 'AUTH_REQUIRED') {
          const order = await Order.create(req.user.id, {
            status: 'PENDING_PAYMENT',
            shipping_address,
            payment_method: effectiveMethod,
            customer_phone,
            total_amount: totalAmount,
            coupon_code: appliedCouponCode,
            commission_rate: commissionRate
          });
          const payment = await Payment.create({
            order_id: order._id,
            user_id: req.user.id,
            method: effectiveMethod,
            amount: totalAmount,
            status: 'REQUIRES_AUTHENTICATION'
          });
          await PaymentEvent.create(payment._id, 'AUTH_REQUIRED');
          req.session.pendingPayment = {
            orderId: order._id,
            paymentId: payment._id,
            shipping_address,
            customer_phone,
            last4,
            totalAmount
          };
          req.session.pendingOrder = null;
          return res.redirect('/checkout/otp');
        } else {
          const paymentStatus = cardResult === 'TIMEOUT' ? 'FAILED' : 'DECLINED';
          const order = await Order.create(req.user.id, {
            status: 'CANCELLED',
            shipping_address,
            payment_method: effectiveMethod,
            customer_phone,
            total_amount: totalAmount,
            coupon_code: appliedCouponCode,
            commission_rate: commissionRate
          });
          const payment = await Payment.create({
            order_id: order._id,
            user_id: req.user.id,
            method: effectiveMethod,
            amount: totalAmount,
            status: paymentStatus
          });
          await PaymentEvent.create(payment._id, cardResult);
          req.session.pendingOrder = null;
          req.flash('error', 'Kart ödənişi uğursuz oldu!');
          return res.redirect('/checkout');
        }
      } else {
        // Split ödəniş: kart hissəsi SUCCESS olmalıdır
        const auth = await resolveCardAuthorization({ userId: req.user.id, saved_card_id, card_number, card_expiry, last4 });
        if (!auth.ok) {
          req.flash('error', auth.message || 'Split ödəniş yalnız kart hissəsi uğurlu olduqda tamamlanır!');
          return res.redirect('/checkout');
        }
        cardResult = auth.cardResult;
        cardBrand = auth.brand || cardBrand;
        cardLast4 = auth.last4 || cardLast4;
        if (cardResult !== 'SUCCESS') {
          req.flash('error', 'Split ödəniş yalnız kart hissəsi uğurlu olduqda tamamlanır!');
          return res.redirect('/checkout');
        }
        split = { walletPart, cardPart };
        authorized = true;
      }
    } else if (effectiveMethod === 'CARD_SIMULATOR') {
      const auth = await resolveCardAuthorization({ userId: req.user.id, saved_card_id, card_number, card_expiry, last4 });
      if (!auth.ok && !auth.cardResult) {
        req.flash('error', auth.message);
        return res.redirect('/checkout');
      }
      cardResult = auth.cardResult;
      cardBrand = auth.brand || cardBrand;
      cardLast4 = auth.last4 || cardLast4;

      if (!auth.ok) {
        // Backend kart validasiyası uğursuzdursa ödəniş rədd edilir.
        const order = await Order.create(req.user.id, {
          status: 'CANCELLED',
          shipping_address,
          payment_method,
          customer_phone,
          total_amount: totalAmount,
          coupon_code: appliedCouponCode,
          commission_rate: commissionRate
        });
        const payment = await Payment.create({
          order_id: order._id,
          user_id: req.user.id,
          method: payment_method,
          amount: totalAmount,
          status: 'DECLINED'
        });
        await PaymentEvent.create(payment._id, cardResult);
        req.session.pendingOrder = null;
        req.flash('error', auth.message);
        return res.redirect('/checkout');
      }

      if (cardResult === 'SUCCESS') {
        authorized = true;
      } else if (cardResult === 'AUTH_REQUIRED') {
        // OTP axını: sifariş və ödəniş gözləmədə qalır, stok/səbət təmizlənmə sonraya buraxılır
        const order = await Order.create(req.user.id, {
          status: 'PENDING_PAYMENT',
          shipping_address,
          payment_method,
          customer_phone,
          total_amount: totalAmount,
          coupon_code: appliedCouponCode,
          commission_rate: commissionRate
        });
        const payment = await Payment.create({
          order_id: order._id,
          user_id: req.user.id,
          method: payment_method,
          amount: totalAmount,
          status: 'REQUIRES_AUTHENTICATION'
        });
        await PaymentEvent.create(payment._id, 'AUTH_REQUIRED');
        req.session.pendingPayment = {
          orderId: order._id,
          paymentId: payment._id,
          shipping_address,
          customer_phone,
          last4,
          totalAmount
        };
        req.session.pendingOrder = null;
        return res.redirect('/checkout/otp');
      } else {
        // Rədd / vəsait çatışmazlığı / timeout
        const paymentStatus = cardResult === 'TIMEOUT' ? 'FAILED' : 'DECLINED';
        const order = await Order.create(req.user.id, {
          status: 'CANCELLED',
          shipping_address,
          payment_method,
          customer_phone,
          total_amount: totalAmount,
          coupon_code: appliedCouponCode,
          commission_rate: commissionRate
        });
        const payment = await Payment.create({
          order_id: order._id,
          user_id: req.user.id,
          method: payment_method,
          amount: totalAmount,
          status: paymentStatus
        });
        await PaymentEvent.create(payment._id, cardResult);
        req.session.pendingOrder = null;
        req.flash('error', 'Kart ödənişi uğursuz oldu!');
        return res.redirect('/checkout');
      }
    } else if (effectiveMethod === 'GOOGLE_PAY' || effectiveMethod === 'APPLE_PAY') {
      const walletLabel = effectiveMethod === 'GOOGLE_PAY' ? 'Google Pay' : 'Apple Pay';
      const auth = await resolveWalletAuthorization();
      cardResult = auth.cardResult;

      if (cardResult === 'SUCCESS') {
        authorized = true;
      } else if (cardResult === 'AUTH_REQUIRED') {
        const order = await Order.create(req.user.id, {
          status: 'PENDING_PAYMENT',
          shipping_address,
          payment_method,
          customer_phone,
          total_amount: totalAmount,
          coupon_code: appliedCouponCode,
          commission_rate: commissionRate
        });
        const payment = await Payment.create({
          order_id: order._id,
          user_id: req.user.id,
          method: payment_method,
          amount: totalAmount,
          status: 'REQUIRES_AUTHENTICATION'
        });
        await PaymentEvent.create(payment._id, 'AUTH_REQUIRED');
        req.session.pendingPayment = {
          orderId: order._id,
          paymentId: payment._id,
          shipping_address,
          customer_phone,
          last4,
          totalAmount
        };
        req.session.pendingOrder = null;
        return res.redirect('/checkout/otp');
      } else {
        const paymentStatus = cardResult === 'TIMEOUT' ? 'FAILED' : 'DECLINED';
        const order = await Order.create(req.user.id, {
          status: 'CANCELLED',
          shipping_address,
          payment_method,
          customer_phone,
          total_amount: totalAmount,
          coupon_code: appliedCouponCode,
          commission_rate: commissionRate
        });
        const payment = await Payment.create({
          order_id: order._id,
          user_id: req.user.id,
          method: payment_method,
          amount: totalAmount,
          status: paymentStatus
        });
        await PaymentEvent.create(payment._id, cardResult);
        req.session.pendingOrder = null;
        req.flash('error', `${walletLabel} ödənişi uğursuz oldu!`);
        return res.redirect('/checkout');
      }
    } else {
      req.flash('error', 'Yanlış ödəniş üsulu!');
      return res.redirect('/checkout');
    }

    // Authorized axın: sifariş PAID, ödəniş CAPTURED
    const order = await Order.create(req.user.id, {
      status: 'PAID',
      shipping_address,
      payment_method: split ? payment_method : effectiveMethod,
      customer_phone,
      total_amount: totalAmount,
      coupon_code: appliedCouponCode,
      commission_rate: commissionRate
    });

    if (split) {
      // Split ödəniş: iki ayrı Payment qeydi
      const walletPayment = await Payment.create({
        order_id: order._id,
        user_id: req.user.id,
        method: 'WALLET',
        amount: split.walletPart,
        status: 'CAPTURED'
      });
      await PaymentEvent.create(walletPayment._id, 'CAPTURED');

      const cardPayment = await Payment.create({
        order_id: order._id,
        user_id: req.user.id,
        method: 'CARD_SIMULATOR',
        amount: split.cardPart,
        status: 'CAPTURED',
        card_brand: cardBrand,
        card_last4: cardLast4
      });
      await PaymentEvent.create(cardPayment._id, 'CAPTURED');

      // Cüzdan hissəsini balansdan çıx
      const newBalance = roundMoney(Number(wallet.balance) - split.walletPart);
      await Wallet.updateBalance(wallet._id, newBalance);
      await WalletTransaction.create({
        wallet_id: wallet._id,
        type: 'PURCHASE',
        amount: split.walletPart,
        balance_after: newBalance,
        related_payment_id: walletPayment._id
      });
    } else {
      const payment = await Payment.create({
        order_id: order._id,
        user_id: req.user.id,
        method: effectiveMethod,
        amount: totalAmount,
        status: 'CAPTURED',
        card_brand: ['CARD_SIMULATOR','GOOGLE_PAY','APPLE_PAY'].includes(effectiveMethod) ? cardBrand : null,
        card_last4: ['CARD_SIMULATOR','GOOGLE_PAY','APPLE_PAY'].includes(effectiveMethod) ? cardLast4 : null
      });
      await PaymentEvent.create(payment._id, 'CAPTURED');

      // WALLET üçün balansdan çıx və əməliyyatı yaz
      if (effectiveMethod === 'WALLET') {
        const newBalance = roundMoney(Number(wallet.balance) - totalAmount);
        await Wallet.updateBalance(wallet._id, newBalance);
        await WalletTransaction.create({
          wallet_id: wallet._id,
          type: 'PURCHASE',
          amount: totalAmount,
          balance_after: newBalance,
          related_payment_id: payment._id
        });
      }
    }

    // Order items yaz, stoku azalt, səbəti təmizlə, kuponu sil
    await OrderItem.createBulk(order._id, items);
    for (const item of items) {
      await Product.decrementStock(item.product_id, item.quantity);
    }
    await Cart.clearCart(req.user.id);
    req.session.couponCode = null;
    const safePendingOrder = req.session.pendingOrder;
    await saveCardAfterSuccessfulPayment(req.user.id, safePendingOrder).catch(() => null);
    req.session.pendingOrder = null;
    req.session.pendingPayment = null;

    // Cashback: PAID/CAPTURED sonrası dərhal verilir (idempotent)
    await grantCashback(order._id).catch(() => null);
    if (appliedCouponCode) await Coupon.incrementUsageByCode(appliedCouponCode).catch(() => null);
    await notifyOrderCreated(order._id, items).catch(() => null);
    await createOrderReceipt(order._id).catch(() => null);

    req.flash('success', 'Sifarişiniz uğurla qəbul edildi!');
    res.redirect(`/orders/${order._id}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/cart');
  }
};

// Checkout başlat
exports.initiateCheckout = async (req, res) => {
  try {
    const { shipping_address, payment_method, customer_phone, last4, card_number, save_card, brand, card_expiry, saved_card_id } = req.body;
    if (!shipping_address) {
      req.flash('error', 'Çatdırılma ünvanı tələb olunur!');
      return res.redirect('/checkout');
    }
    if (!payment_method) {
      req.flash('error', 'Ödəniş üsulu seçilməyib!');
      return res.redirect('/checkout');
    }
    // Tam kart nömrəsi saxlanmır; yalnız son 4 rəqəm (və ya frontend-in göndərdiyi last4)
    const last4Clean = String(last4 || card_number || '').replace(/\D/g, '').slice(-4);

    const expiryMatch = String(card_expiry || '').trim().match(/^(\d{2})\/(\d{2})$/);
    req.session.pendingOrder = {
      shipping_address, payment_method, customer_phone, last4: last4Clean,
      saved_card_id: saved_card_id || null, brand: brand || null,
      save_card: ['on', 'true', '1'].includes(String(save_card || '')) && ['CARD_SIMULATOR', 'SPLIT_PAYMENT'].includes(payment_method),
      exp_month: expiryMatch ? expiryMatch[1] : null,
      exp_year: expiryMatch ? `20${expiryMatch[2]}` : null
    };
    return exports.createOrder(req, res);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/checkout');
  }
};

// OTP səhifəsini göstər
exports.showOtp = (req, res) => {
  if (!req.session.pendingPayment) {
    req.flash('error', 'Checkout sessiyası tapılmadı. Yenidən cəhd edin.');
    return res.redirect('/checkout');
  }
  res.render('checkout/otp', { title: 'OTP Təsdiqi' });
};

// OTP kodunu yoxla
exports.verifyOtp = async (req, res) => {
  try {
    const { sms_code } = req.body;
    const pending = req.session.pendingPayment;
    if (!pending) {
      return res.status(400).json({ success: false, message: 'Checkout sessiyası tapılmadı. Yenidən cəhd edin.' });
    }

    // SMS təsdiq kodunun yoxlanması
    if (sms_code !== '4545') {
      await PaymentEvent.create(pending.paymentId, 'AUTH_FAILED').catch(() => null);
      return res.status(400).json({ success: false, message: 'Yanlış OTP kodu!' });
    }

    const built = await buildItems(req.user.id);
    if (built.error) {
      return res.status(400).json({ success: false, message: built.error });
    }
    if (built.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Səbətdə etibarlı məhsul yoxdur!' });
    }
    const { items } = built;

    const authorized = await Payment.transition(pending.paymentId, ['REQUIRES_AUTHENTICATION'], 'AUTHORIZED');
    if (!authorized) {
      return res.status(400).json({ success: false, message: 'Ödəniş statusu dəyişdirilə bilmədi!' });
    }
    const captured = await Payment.transition(pending.paymentId, ['AUTHORIZED'], 'CAPTURED');
    if (!captured) {
      return res.status(400).json({ success: false, message: 'Ödəniş təsdiqlənə bilmədi!' });
    }
    await PaymentEvent.create(pending.paymentId, 'AUTH_SUCCEEDED');
    const orderPaid = await Order.transition(pending.orderId, ['PENDING_PAYMENT'], 'PAID');
    if (!orderPaid) {
      return res.status(400).json({ success: false, message: 'Sifariş statusu dəyişdirilə bilmədi!' });
    }

    // Təsdiqdən sonra order items + stok + səbət təmizləmə
    await OrderItem.createBulk(pending.orderId, items);
    for (const item of items) {
      await Product.decrementStock(item.product_id, item.quantity);
    }
    const safePendingOrder = req.session.pendingOrder;
    await Cart.clearCart(req.user.id);
    req.session.couponCode = null;
    await saveCardAfterSuccessfulPayment(req.user.id, safePendingOrder).catch(() => null);
    req.session.pendingOrder = null;
    req.session.pendingPayment = null;

    // Cashback: OTP sonrası PAID olduqda dərhal verilir
    await grantCashback(pending.orderId).catch(() => null);
    const paidOrder = await Order.findById(pending.orderId);
    if (paidOrder && paidOrder.coupon_code) await Coupon.incrementUsageByCode(paidOrder.coupon_code).catch(() => null);
    await notifyOrderCreated(pending.orderId, items).catch(() => null);
    await createOrderReceipt(pending.orderId).catch(() => null);

    res.json({ success: true, redirectUrl: `/orders/${pending.orderId}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Müştəri sifarişlərində axtarış/filtrasiya.
exports.searchCustomerOrders = async (req, res) => {
  try {
    const rawFilter = req.body.filter || req.query.filter || {};
    const userFilter = typeof rawFilter === 'string' ? JSON.parse(rawFilter) : rawFilter;

    const query = {
      user_id: req.user.id,
      ...userFilter
    };

    const orders = await Order.findByFilter(query);
    return res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// Sifarişləri göstər
exports.getOrders = async (req, res) => {
  try {
    // Baxılan an hazır olan avtomatik keçidləri icra et — köhnəlmiş status göstərilməsin
    await processDueTransitions().catch(() => null);
    const orders = (await Order.findByUserId(req.user.id)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.render('orders/index', { title: 'Sifarişlərim', orders });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/');
  }
};

// Sifariş detalları
exports.getOrderById = async (req, res) => {
  try {
    await processDueTransitions().catch(() => null);
    const order = await Order.findById(req.params.id);
    if (!order || order.user_id !== req.user.id) {
      req.flash('error', 'Sifariş tapılmadı!');
      return res.redirect('/orders');
    }
    const orderItems = await OrderItem.findByOrderId(order._id);
    const items = [];
    for (const item of orderItems) {
      const product = await Product.findById(item.product_id);
      items.push({ ...item, product_name: product ? product.name : 'Məhsul silinib', lineTotal: item.price * item.quantity });
    }
    const payments = await Payment.findAllByOrderId(order._id);
    const payment = payments && payments.length ? payments[0] : null;
    let paymentId = payment ? payment._id : null;
    let paymentEvents = [];
    if (payment) {
      paymentEvents = await PaymentEvent.findByPaymentId(payment._id);
    }
    res.render('orders/show', { title: 'Sifariş Detalları', order, items, paymentId, paymentEvents });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/orders');
  }
};

// Qəbz səhifəsi
exports.getReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.user_id !== req.user.id) {
      req.flash('error', 'Sifariş tapılmadı!');
      return res.redirect('/orders');
    }
    const receipt = await createOrderReceipt(order._id);
    if (!receipt) throw new Error('Qəbz yaradıla bilmədi.');
    res.redirect(`/receipts/${receipt.public_token}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/orders');
  }
};

// Geri qaytarma tələbi
exports.requestRefund = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.user_id !== req.user.id) {
      req.flash('error', 'Sifariş tapılmadı!');
      return res.redirect('/orders');
    }
    // Phase 10.2 — geri qaytarma tələbi yalnız DELIVERED statusunda mümkündür (backend-də məcburi yoxlanılır)
    if (order.status !== 'DELIVERED') {
      req.flash('error', 'Geri qaytarma tələbi yalnız sifariş təhvil verildikdən sonra mümkündür!');
      return res.redirect(`/orders/${order._id}`);
    }
    const { reason } = req.body;
    const refund = await Refund.create({
      order_id: order._id,
      user_id: req.user.id,
      amount: Number(order.total_amount),
      reason,
      status: 'PENDING'
    });
    await notifyRefundRequested(refund, order).catch(() => null);
    req.flash('success', 'Geri qaytarma tələbiniz qeydə alındı!');
    res.redirect(`/orders/${order._id}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/orders');
  }
};

// Sifarişi ləğv et
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order || order.user_id !== req.user.id) {
      req.flash('error', 'Sifariş tapılmadı!');
      return res.redirect('/orders');
    }
    if (order.status === 'CANCELLED') {
      req.flash('error', 'Sifariş artıq ləğv edilib!');
      return res.redirect(`/orders/${order._id}`);
    }
    if (!['PENDING_PAYMENT', 'PAID', 'PROCESSING'].includes(order.status)) {
      req.flash('error', 'Yalnız gözləmədə olan sifarişi ləğv etmək olar!');
      return res.redirect(`/orders/${order._id}`);
    }

    // Stoku geri qaytar
    const orderItems = await OrderItem.findByOrderId(order._id);
    for (const item of orderItems) {
      await Product.incrementStock(item.product_id, item.quantity);
    }

    // Tutulmuş (CAPTURED) ödəniş varsa müştəriyə qaytar.
    // Qapıda ödəniş (CASH_ON_DELIVERY) üçün pul tutulmayıb — refund edilmir.
    const payments = await Payment.findAllByOrderId(order._id);
    const capturedTotal = payments
      .filter(p => p.status === 'CAPTURED')
      .reduce((sum, p) => roundMoney(sum + Number(p.amount || 0)), 0);
    const existingRefunds = await Refund.findByOrderId(order._id);
    const alreadyRefunded = existingRefunds.some(r => r.status === 'APPROVED');

    if (capturedTotal > 0 && !alreadyRefunded && order.payment_method !== 'CASH_ON_DELIVERY') {
      let wallet = await Wallet.findByUserId(req.user.id);
      if (!wallet) wallet = await Wallet.create(req.user.id, 0);
      const newBalance = roundMoney(Number(wallet.balance) + capturedTotal);
      await Wallet.updateBalance(wallet._id, newBalance);
      await WalletTransaction.create({
        wallet_id: wallet._id,
        type: 'REFUND',
        amount: capturedTotal,
        balance_after: newBalance,
        status: 'AVAILABLE',
        description: `Sifariş ləğvi — Order #${order._id.slice(0, 8)}`
      });
      await Refund.create({
        order_id: order._id,
        user_id: req.user.id,
        amount: capturedTotal,
        reason: 'Sifariş ləğvi',
        status: 'APPROVED'
      });
      const cancellationRefund = (await Refund.findByOrderId(order._id)).find(item => item.status === 'APPROVED');
      if (cancellationRefund) await createRefundReceipt({ refund: cancellationRefund, order, paymentIds: payments.map(payment => payment._id) }).catch(() => null);
    }

    // Cashback verilmişdisə geri al
    await reverseCashback(order._id).catch(() => ({ reversed: false }));

    await Order.updateStatus(order._id, 'CANCELLED');
    req.flash('success', 'Sifariş ləğv edildi!');
    res.redirect(`/orders/${order._id}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/orders');
  }
};
