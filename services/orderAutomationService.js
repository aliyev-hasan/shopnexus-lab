// Phase 8 — Order State Machine and Automation
//
// Tək mərkəzləşdirilmiş keçid mühərriki. Sifariş avtomatlaşdırması ilə bağlı BÜTÜN
// məntiq buradadır — UI komponentlərinin içində ayrı-ayrı taymerlər YOXDUR.
//
// Qayda: PENDING_PAYMENT -> PAID heç vaxt bu mühərrik tərəfindən idarə olunmur.
// Bu keçid yalnız uğurlu ödənişdən sonra (orderController) baş verir.
// Taymer avtomatlaşdırması yalnız PAID statusundan sonra başlayır:
//   PAID -> PROCESSING -> SHIPPED -> DELIVERED
const Order = require('../models/Order');
const Setting = require('../models/Setting');
const { AUTOMATIC_TRANSITIONS, ORDER_AUTOMATION_DEFAULTS, AUTOMATION_UNIT_TO_MS } = require('../config/orderStatuses');
const { notifyOrderStatus } = require('./notificationService');

const SETTINGS_KEY = 'order_automation';

// Cari avtomatlaşdırma tənzimləmələrini oxu (yoxdursa defolt dəyərləri qaytarır)
async function getSettings() {
  const stored = await Setting.get(SETTINGS_KEY, null);
  if (!stored || typeof stored !== 'object') {
    return { ...ORDER_AUTOMATION_DEFAULTS };
  }
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : ORDER_AUTOMATION_DEFAULTS.enabled,
    unit: AUTOMATION_UNIT_TO_MS[stored.unit] ? stored.unit : ORDER_AUTOMATION_DEFAULTS.unit,
    delay_paid_to_processing: Number.isFinite(Number(stored.delay_paid_to_processing)) ? Number(stored.delay_paid_to_processing) : ORDER_AUTOMATION_DEFAULTS.delay_paid_to_processing,
    delay_processing_to_shipped: Number.isFinite(Number(stored.delay_processing_to_shipped)) ? Number(stored.delay_processing_to_shipped) : ORDER_AUTOMATION_DEFAULTS.delay_processing_to_shipped,
    delay_shipped_to_delivered: Number.isFinite(Number(stored.delay_shipped_to_delivered)) ? Number(stored.delay_shipped_to_delivered) : ORDER_AUTOMATION_DEFAULTS.delay_shipped_to_delivered
  };
}

// Yeni avtomatlaşdırma tənzimləmələrini saxla
async function updateSettings(next) {
  const current = await getSettings();
  const merged = { ...current, ...next };
  await Setting.set(SETTINGS_KEY, merged);
  return merged;
}

// Verilmiş status üçün lazımi gecikməni (raw ədəd, vahid ilə birlikdə) millisaniyəyə çevir
function delayMsFor(status, settings) {
  const unitMs = AUTOMATION_UNIT_TO_MS[settings.unit] || AUTOMATION_UNIT_TO_MS.seconds;
  let rawDelay;
  if (status === 'PAID') rawDelay = settings.delay_paid_to_processing;
  else if (status === 'PROCESSING') rawDelay = settings.delay_processing_to_shipped;
  else if (status === 'SHIPPED') rawDelay = settings.delay_shipped_to_delivered;
  else return null;
  return Number(rawDelay) * unitMs;
}

// Bir sifarişin taymer baxımından hazır olub-olmadığını müəyyən et
function isDue(order, settings, now = Date.now()) {
  const nextStatus = AUTOMATIC_TRANSITIONS[order.status];
  if (!nextStatus) return null;
  const requiredMs = delayMsFor(order.status, settings);
  if (requiredMs == null) return null;
  const basis = order.status_changed_at || order.updated_at || order.created_at;
  const elapsed = now - new Date(basis).getTime();
  return elapsed >= requiredMs ? nextStatus : null;
}

// Bütün hazır olan sifarişləri irəli sürüşdür. Həm periodik taymer, həm də admin
// tərəfindən sifariş siyahısına baxılanda (dərhal sinxronlaşma üçün) çağırıla bilər.
async function processDueTransitions() {
  const settings = await getSettings();
  if (!settings.enabled) return { processed: 0, transitions: [] };

  const candidates = await Order.findByStatuses(Object.keys(AUTOMATIC_TRANSITIONS));
  const now = Date.now();
  const transitions = [];

  for (const order of candidates) {
    const nextStatus = isDue(order, settings, now);
    if (!nextStatus) continue;
    // Mərkəzi keçid mühərriki: yalnız VALID_TRANSITIONS-da icazə verilən keçidləri icra edir
    const updated = await Order.transitionTo(order._id, nextStatus);
    if (updated) {
      transitions.push({ orderId: order._id, from: order.status, to: nextStatus });
      await notifyOrderStatus(order._id, nextStatus).catch(() => null);
    }
  }

  return { processed: transitions.length, transitions };
}

let intervalHandle = null;

// Fon taymerini başlat (server açılışında bir dəfə çağırılır)
function startAutomationLoop(tickMs = 2000) {
  if (intervalHandle) return intervalHandle;
  intervalHandle = setInterval(() => {
    processDueTransitions().catch(err => console.error('Order automation error:', err.message));
  }, tickMs);
  if (intervalHandle.unref) intervalHandle.unref();
  return intervalHandle;
}

module.exports = { getSettings, updateSettings, processDueTransitions, startAutomationLoop, isDue, delayMsFor };
