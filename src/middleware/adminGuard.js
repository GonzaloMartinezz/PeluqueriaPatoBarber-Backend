const { ROLES } = require('../config/constants');

const adminGuard = (req, res, next) => {
  if (req.user && req.user.role === ROLES.ADMIN) {
    return next();
  }
  res.status(403).json({ success: false, message: 'Solo el administrador puede hacer esto' });
};

module.exports = adminGuard;
