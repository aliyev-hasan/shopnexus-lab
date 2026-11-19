(function () {
    const percentageError = 'Faiz endirimi 1% ilə 100% arasında olmalıdır.';
    const fixedError = 'Sabit endirim 1 ₼ ilə 1000 ₼ arasında olmalıdır.';
  const usageError = 'Kupon istifadə limiti 1 ilə 1000 arasında olmalıdır.';

  document.querySelectorAll('[data-coupon-form]').forEach(function (form) {
    const type = form.querySelector('[name="discount_type"]');
    const value = form.querySelector('[name="discount_value"]');
    const usage = form.querySelector('[name="usage_limit"]');
    if (!type || !value || !usage) return;

    function syncConstraints() {
      const percentage = type.value === 'percentage' || type.value === 'first_order';
      const fixed = type.value === 'fixed';
      value.min = percentage || fixed ? '1' : '0';
      if (percentage) value.max = '100';
      else if (fixed) value.max = '1000';
      else value.removeAttribute('max');
    }

    form.addEventListener('submit', function (event) {
      value.setCustomValidity('');
      usage.setCustomValidity('');
      const discount = Number(value.value);
      const limit = Number(usage.value);
      if (type.value === 'percentage' && (value.value === '' || !Number.isFinite(discount) || discount < 1 || discount > 100)) value.setCustomValidity(percentageError);
      if (type.value === 'first_order' && (value.value === '' || !Number.isFinite(discount) || discount < 1 || discount > 100)) value.setCustomValidity(percentageError);
      if (type.value === 'fixed' && (value.value === '' || !Number.isFinite(discount) || discount < 1 || discount > 1000)) value.setCustomValidity(fixedError);
      if (usage.value === '' || !Number.isInteger(limit) || limit < 1 || limit > 1000) usage.setCustomValidity(usageError);
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
      }
    });
    type.addEventListener('change', syncConstraints);
    value.addEventListener('input', function () { value.setCustomValidity(''); });
    usage.addEventListener('input', function () { usage.setCustomValidity(''); });
    syncConstraints();
  });
})();
