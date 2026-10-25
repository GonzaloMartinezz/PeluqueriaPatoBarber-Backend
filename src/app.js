// Las variables de entorno (posiblemente cifradas) se cargan antes de requerir el resto.
const { allowedOrigins } = require('./config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');
const sanitizeBody = require('./middleware/sanitize');
const csrfGuard = require('./middleware/csrf');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const appointmentRoutes = require('./routes/appointments');
const adminRoutes = require('./routes/admin');

const app = express();
const prod = process.env.NODE_ENV === 'production';

// Detrás de un proxy (Render, Railway, Nginx…) hay que decir cuántos saltos confiar,
// si no el límite de intentos vería siempre la IP del proxy. Ej: TRUST_PROXY=1
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Esta API solo habla JSON: no necesita cargar nada, ni que la embeban en un iframe.
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: prod ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  })
);
app.use(cors({ origin: allowedOrigins(), credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], maxAge: 600 }));
app.use(morgan(prod ? 'combined' : 'dev'));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(sanitizeBody);

// Nada de la API se guarda en caché (hay datos personales y de sesión).
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(csrfGuard);

app.get('/', (req, res) => {
  res.json({ message: 'Pato Barber API' });
});

// Frena la fuerza bruta: se cuentan los ingresos fallidos por IP + email, y los registros por IP.
const limiterOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
};
const loginLimiter = rateLimit({
  ...limiterOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').toLowerCase().slice(0, 120)}`,
});
const loginIpLimiter = rateLimit({ ...limiterOptions, windowMs: 15 * 60 * 1000, limit: 40, skipSuccessfulRequests: true });
const registerLimiter = rateLimit({ ...limiterOptions, windowMs: 60 * 60 * 1000, limit: Number(process.env.REGISTER_LIMIT) || 15 });

const byIpAndEmail = (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').toLowerCase().slice(0, 120)}`;
// Recuperar contraseña: pocos pedidos por hora (evita llenar de emails a alguien).
const forgotLimiter = rateLimit({ ...limiterOptions, windowMs: 60 * 60 * 1000, limit: 5, keyGenerator: byIpAndEmail });
const resetLimiter = rateLimit({ ...limiterOptions, windowMs: 60 * 60 * 1000, limit: 10 });
// Cambiar contraseña, descargar o eliminar la cuenta.
const sensitiveLimiter = rateLimit({ ...limiterOptions, windowMs: 60 * 60 * 1000, limit: 20 });

app.post('/api/auth/forgot', forgotLimiter);
app.post('/api/auth/reset', resetLimiter);
app.post('/api/auth/password', sensitiveLimiter);
app.get('/api/auth/me/export', sensitiveLimiter);
app.delete('/api/auth/me', sensitiveLimiter);
app.post(['/api/auth/login', '/api/auth/google'], loginIpLimiter, loginLimiter);
app.post('/api/auth/register', registerLimiter);
app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

app.use(errorHandler);

module.exports = app;
