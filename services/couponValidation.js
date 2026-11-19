const PERCENTAGE_ERROR = 'Faiz endirimi 1% ilə 100% arasında olmalıdır.';
const FIXED_ERROR = 'Sabit endirim 1 ₼ ilə 1000 ₼ arasında olmalıdır.';
const USAGE_LIMIT_ERROR = 'Kupon istifadə limiti 1 ilə 1000 arasında olmalıdır.';

function parseRequiredNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateCouponInput(input = {}) {
  const errors = [];
  const discountType = String(input.discount_type || '').trim();
  const discountValue = parseRequiredNumber(input.discount_value);
  const usageLimit = parseRequiredNumber(input.usage_limit);

  if ((discountType === 'percentage' || discountType === 'first_order') && (discountValue === null || discountValue < 1 || discountValue > 100)) {
    errors.push(PERCENTAGE_ERROR);
  } else if (discountType === 'fixed' && (discountValue === null || discountValue < 1 || discountValue > 1000)) {
    errors.push(FIXED_ERROR);
  } else if (!['percentage', 'first_order', 'fixed'].includes(discountType) && (discountValue === null || discountValue < 0)) {
    errors.push('Kupon endirim dəyəri düzgün rəqəm olmalıdır.');
  }

  if (usageLimit === null || !Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 1000) {
    errors.push(USAGE_LIMIT_ERROR);
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      ...input,
      code: String(input.code || '').trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      usage_limit: usageLimit,
      min_order_value: input.min_order_value === '' || input.min_order_value == null
        ? 0
        : Number(input.min_order_value)
    }
  };
}

function assertValidCouponInput(input) {
  const result = validateCouponInput(input);
  if (!result.valid) {
    const error = new Error(result.errors[0]);
    error.statusCode = 400;
    error.validationErrors = result.errors;
    throw error;
  }
  return result.value;
}

module.exports = {
  PERCENTAGE_ERROR,
  FIXED_ERROR,
  USAGE_LIMIT_ERROR,
  validateCouponInput,
  assertValidCouponInput
};
