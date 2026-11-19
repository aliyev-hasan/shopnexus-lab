const { jwtSecret } = require('./security');

module.exports = {
  secret: jwtSecret,
  expiresIn: '24h'
};
