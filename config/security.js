const production = process.env.NODE_ENV === 'production';

function requiredSecret(name, developmentFallback) {
  const value = process.env[name];
  if (value) return value;
  if (production) throw new Error(`${name} production mühitində təyin edilməlidir.`);
  return developmentFallback;
}

module.exports = {
  jwtSecret: requiredSecret('JWT_SECRET', 'development-only-jwt-key'),
  sessionSecret: requiredSecret('SESSION_SECRET', 'development-only-session-key')
};
