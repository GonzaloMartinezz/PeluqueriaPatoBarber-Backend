const User = require('../models/User');
const { COOKIE_NAME, verifySession } = require('../utils/session');

// La sesión se lee solo de la cookie HttpOnly (no se acepta el header Authorization).
const auth = async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Iniciá sesión para continuar' });
  }

  try {
    const decoded = verifySession(token);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Cuenta no encontrada o deshabilitada' });
    }

    // Si cambió o se restableció la contraseña (o se cerraron todas las sesiones), los tokens anteriores dejan de servir.
    if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > decoded.iat) {
      return res.status(401).json({ success: false, message: 'Sesión vencida, volvé a ingresar' });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Sesión vencida, volvé a ingresar' });
  }
};

module.exports = auth;
