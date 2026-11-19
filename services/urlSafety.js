// Redirect hədəflərini yalnız daxili (relative) yollarla məhdudlaşdırır.
// Xarici URL-lər, protokol-relative (//) və ya backslash ehtiva edən dəyərlər rədd edilir.
function safeInternalUrl(value, fallback = '/') {
  const raw = String(value || '');
  if (!raw) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (/^https?:/i.test(raw)) return fallback;
  if (/[\\\r\n]/.test(raw)) return fallback;
  if (!raw.startsWith('/')) return fallback;
  return raw;
}

module.exports = { safeInternalUrl };
