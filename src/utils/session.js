const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'pb_session';
const SESSION_DAYS = 7;

const isProd = () => process.env.NODE_ENV === 'production';

// La sesión viaja en una cookie HttpOnly: el JavaScript de la página no puede leerla,
// así que un XSS no puede robar la sesión.
function cookieOptions() {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const secure = sameSite === 'none' || isProd() || process.env.COOKIE_SECURE === 'true';
  return { httpOnly: true, secure, sameSite, path: '/', maxAge: SESSION_DAYS * 86400 * 1000 };
}

const signSession = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d`, algorithm: 'HS256' });

const verifySession = (token) => jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

// Token anti-CSRF derivado de la sesión (HMAC): un sitio ajeno no puede leerlo ni calcularlo.
const csrfFor = (sessionToken) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`csrf:${sessionToken}`).digest('hex');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function startSession(res, user, publicUser, status = 200) {
  const token = signSession(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  return res.status(status).json({ success: true, user: publicUser(user), csrfToken: csrfFor(token) });
}

function endSession(res) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(COOKIE_NAME, options);
}

module.exports = { COOKIE_NAME, csrfFor, safeEqual, verifySession, startSession, endSession };
