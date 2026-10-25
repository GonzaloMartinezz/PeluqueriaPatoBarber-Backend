const { allowedOrigins } = require('../config/env');
const { COOKIE_NAME, csrfFor, safeEqual } = require('../utils/session');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Antes de iniciar sesión no hay token: ahí solo se valida el origen.
const NO_TOKEN_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/auth/forgot', '/api/auth/reset']);

const forbidden = (res, message) => res.status(403).json({ success: false, message });

/*
  Protección CSRF en dos capas para todo lo que modifica datos:
  1) Origin: si el navegador manda Origin, debe ser el sitio propio (CLIENT_URL o el mismo host).
  2) Token: con sesión activa, el header X-CSRF-Token debe coincidir con el derivado de la cookie.
  A esto se suma SameSite=Lax en la cookie.
*/
module.exports = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin) {
    let sameHost = false;
    try {
      sameHost = new URL(origin).host === req.get('host');
    } catch {
      return forbidden(res, 'Origen no permitido');
    }
    if (!sameHost && !allowedOrigins().includes(origin)) return forbidden(res, 'Origen no permitido');
  }

  const session = req.cookies?.[COOKIE_NAME];
  if (session && !NO_TOKEN_PATHS.has(req.originalUrl.split('?')[0])) {
    const sent = req.get('x-csrf-token') || '';
    if (!safeEqual(sent, csrfFor(session))) return forbidden(res, 'Falta el token de seguridad. Recargá la página.');
  }

  next();
};
