const ORDER_STATUSES = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  RETURN_REQUESTED: 'RETURN_REQUESTED',
  RETURNED: 'RETURNED',
  REFUNDED: 'REFUNDED'
};
const NON_REVENUE_STATUSES = ['CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'];

// Phase 8 — avtomatik keçid ardıcıllığı: PAID -> PROCESSING -> SHIPPED -> DELIVERED.
// PENDING_PAYMENT -> PAID heç vaxt taymerlə deyil, yalnız uğurlu ödənişdən sonra baş verir.
const AUTOMATIC_TRANSITIONS = {
  PAID: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED'
};

// Admin Settings > Order Automation üçün defolt dəyərlər (sürətli lokal test üçün saniyələr)
const ORDER_AUTOMATION_DEFAULTS = {
  enabled: true,
  unit: 'seconds', // 'seconds' | 'minutes' | 'hours'
  delay_paid_to_processing: 30,
  delay_processing_to_shipped: 40,
  delay_shipped_to_delivered: 60
};

const AUTOMATION_UNIT_TO_MS = { seconds: 1000, minutes: 60 * 1000, hours: 60 * 60 * 1000 };

module.exports = { ORDER_STATUSES, NON_REVENUE_STATUSES, AUTOMATIC_TRANSITIONS, ORDER_AUTOMATION_DEFAULTS, AUTOMATION_UNIT_TO_MS };
