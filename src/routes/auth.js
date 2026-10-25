const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const httpError = require('../utils/httpError');
const { csrfFor, safeEqual, startSession, endSession } = require('../utils/session');
const { sendMail } = require('../utils/mailer');
const { eraseUser, exportUser } = require('../services/privacy');
const { LEGAL_VERSION, ROLES } = require('../config/constants');
const { allowedOrigins } = require('../config/env');

const router = express.Router();

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  lastName: u.lastName,
  email: u.email,
  phone: u.phone,
  role: u.role,
  avatar: u.avatar,
  provider: u.googleId ? 'google' : 'email', // las cuentas de Google no tienen contraseña propia
});

const session = (res, user, status = 200) => startSession(res, user, publicUser, status);

// bcrypt solo mira los primeros 72 bytes: se limita el largo para que la contraseña completa cuente.
const COMMON_PASSWORDS = new Set(['12345678', '123456789', '1234567890', 'password', 'contraseña', 'qwertyui', '11111111', 'abcd1234', 'patobarber']);
const passwordRule = (field = 'password') => body(field)
  .isString()
  .isLength({ min: 8, max: 72 })
  .withMessage('La contraseña debe tener entre 8 y 72 caracteres')
  .bail()
  .custom((v, { req }) => !COMMON_PASSWORDS.has(v.toLowerCase()) && v.toLowerCase() !== String(req.body.email || '').toLowerCase())
  .withMessage('Esa contraseña es demasiado común. Elegí otra.');

const phoneRule = (required) => {
  const rule = body('phone').trim();
  return (required ? rule.notEmpty().withMessage('Ingresá tu teléfono').bail() : rule.optional({ values: 'falsy' })).matches(/^[0-9+()\-\s]{6,20}$/).withMessage('El teléfono no es válido');
};

// Hash falso para gastar el mismo tiempo cuando el email no existe (evita saber qué emails están registrados).
let dummyHash;
const burnTime = async (password) => {
  dummyHash ??= await bcrypt.hash('relleno-para-igualar-tiempos', 12);
  await bcrypt.compare(String(password), dummyHash);
};

router.post(
  '/register',
  validate([
    body('name').trim().notEmpty().withMessage('Ingresá tu nombre').isLength({ max: 60 }).withMessage('El nombre es muy largo'),
    body('lastName').trim().notEmpty().withMessage('Ingresá tu apellido').isLength({ max: 60 }).withMessage('El apellido es muy largo'),
    body('email').trim().isEmail().withMessage('El email no es válido').isLength({ max: 120 }),
    phoneRule(true),
    passwordRule(),
    body('acceptTerms').custom((v) => v === true).withMessage('Tenés que aceptar los Términos y la Política de Privacidad'),
  ]),
  async (req, res) => {
    const { name, lastName, email, phone, password } = req.body;
    if (await User.findOne({ email: email.toLowerCase() })) {
      throw httpError(409, 'Ya existe una cuenta con ese email');
    }
    // El rol siempre es 'client': nunca se toma del body.
    const user = await User.create({
      name, lastName, email, phone, password,
      lastLoginAt: new Date(),
      consentAt: new Date(),
      consentVersion: LEGAL_VERSION,
    });
    session(res, user, 201);
  }
);

router.post(
  '/login',
  validate([
    body('email').isString().trim().isEmail().withMessage('Email inválido'),
    body('password').isString().notEmpty().isLength({ max: 200 }).withMessage('Ingresá tu contraseña'),
  ]),
  async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
    const valid = user?.password ? await user.matchPassword(req.body.password) : (await burnTime(req.body.password), false);
    // Mismo mensaje y misma demora para "no existe", "cuenta de Google" y "contraseña mala".
    if (!user || !valid) throw httpError(401, 'Email o contraseña incorrectos');
    if (!user.isActive) throw httpError(403, 'Tu cuenta está deshabilitada');
    user.lastLoginAt = new Date();
    await user.save();
    session(res, user);
  }
);

// Inicio de sesión con Google: el front manda el ID token de Google Identity Services.
router.post('/google', validate([body('credential').isString().notEmpty().isLength({ max: 4000 })]), async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) throw httpError(501, 'El ingreso con Google no está configurado');

  const r = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.credential)}`
  );
  if (!r.ok) throw httpError(401, 'No se pudo validar la cuenta de Google');
  const g = await r.json();
  const issuerOk = g.iss === 'accounts.google.com' || g.iss === 'https://accounts.google.com';
  if (g.aud !== process.env.GOOGLE_CLIENT_ID || !issuerOk || String(g.email_verified) !== 'true') {
    throw httpError(401, 'Cuenta de Google no válida');
  }

  const email = g.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: g.sub }, { email }] });
  if (!user) {
    user = await User.create({
      name: g.given_name || g.name || email.split('@')[0],
      lastName: g.family_name || '',
      email,
      googleId: g.sub,
      avatar: g.picture || '',
      // En la pantalla de ingreso figura que continuar implica aceptar los Términos y la Privacidad.
      consentAt: new Date(),
      consentVersion: LEGAL_VERSION,
    });
  } else {
    if (!user.googleId) user.googleId = g.sub;
    if (!user.avatar && g.picture) user.avatar = g.picture;
  }
  if (!user.isActive) throw httpError(403, 'Tu cuenta está deshabilitada');
  user.lastLoginAt = new Date();
  await user.save();
  session(res, user);
});

// Devuelve el usuario y un token CSRF fresco (el front lo pide al cargar la página).
router.get('/me', auth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user), csrfToken: csrfFor(req.sessionToken) });
});

router.post('/logout', (req, res) => {
  endSession(res);
  res.json({ success: true });
});

// El teléfono es obligatorio para reservar; las cuentas de Google lo completan acá.
router.patch(
  '/me',
  auth,
  validate([
    body('name').optional().trim().notEmpty().isLength({ max: 60 }),
    body('lastName').optional().trim().isLength({ max: 60 }),
    phoneRule(false),
  ]),
  async (req, res) => {
    for (const k of ['name', 'lastName', 'phone']) if (req.body[k] !== undefined) req.user[k] = req.body[k];
    await req.user.save();
    res.json({ success: true, user: publicUser(req.user) });
  }
);

/* ------------------------- Contraseña y sesiones ------------------------- */

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const frontUrl = () => allowedOrigins()[0] || 'http://localhost:5173';

// Cambiar la contraseña estando dentro. Cierra las demás sesiones y mantiene esta.
router.post(
  '/password',
  auth,
  validate([body('currentPassword').isString().notEmpty().withMessage('Ingresá tu contraseña actual'), passwordRule('newPassword')]),
  async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    if (!user.password) throw httpError(400, 'Tu cuenta ingresa con Google y no tiene contraseña propia.');
    if (!(await user.matchPassword(req.body.currentPassword))) throw httpError(400, 'La contraseña actual no es correcta');
    user.password = req.body.newPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    session(res, user);
  }
);

// Cierra la sesión en todos los dispositivos (por ejemplo, si se perdió el celular).
router.post('/logout-all', auth, async (req, res) => {
  req.user.passwordChangedAt = new Date();
  await req.user.save();
  endSession(res);
  res.json({ success: true });
});

// Recuperar contraseña: siempre responde lo mismo (no revela qué emails están registrados).
router.post('/forgot', validate([body('email').isString().trim().isEmail()]), async (req, res) => {
  const generic = {
    success: true,
    message: 'Si ese email está registrado, te enviamos un enlace para crear una contraseña nueva. Revisá también el spam.',
  };
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email }).select('+password');
  if (user && user.isActive && user.password) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = sha256(token);
    user.resetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const link = `${frontUrl()}/restablecer?token=${token}&email=${encodeURIComponent(email)}`;
    // Sin await: así la respuesta tarda lo mismo exista o no el email.
    sendMail({
      to: email,
      subject: 'Restablecé tu contraseña · Pato Barber',
      text: `Hola ${user.name}.

Para crear una contraseña nueva entrá a este enlace (vale 30 minutos):
${link}

Si no lo pediste vos, ignorá este mensaje: tu contraseña no cambia.`,
      html: `<p>Hola ${user.name.replace(/[<>&]/g, '')}.</p><p>Para crear una contraseña nueva entrá a este enlace (vale 30 minutos):</p><p><a href="${link}">Crear contraseña nueva</a></p><p>Si no lo pediste vos, ignorá este mensaje: tu contraseña no cambia.</p>`,
    })
      .then((sent) => {
        if (!sent) {
          console.warn('SMTP sin configurar: no se envió el email de recuperación.');
          if (process.env.NODE_ENV !== 'production') console.log('Enlace de recuperación (solo desarrollo):', link);
        }
      })
      .catch((e) => console.error('No se pudo enviar el email de recuperación:', e.message));
  }
  res.json(generic);
});

router.post(
  '/reset',
  validate([
    body('email').isString().trim().isEmail(),
    body('token').isString().isLength({ min: 32, max: 128 }),
    passwordRule('password'),
  ]),
  async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password +resetTokenHash +resetExpiresAt');
    const valid =
      user?.resetTokenHash && user.resetExpiresAt > new Date() && safeEqual(sha256(req.body.token), user.resetTokenHash);
    if (!valid) throw httpError(400, 'El enlace no es válido o venció. Pedí uno nuevo.');

    user.password = req.body.password;
    user.passwordChangedAt = new Date();
    user.resetTokenHash = undefined; // el enlace sirve una sola vez
    user.resetExpiresAt = undefined;
    await user.save();
    res.json({ success: true, message: 'Listo, ya podés ingresar con tu contraseña nueva.' });
  }
);

/* --------------------- Derechos sobre los datos personales --------------------- */

// Acceso: descargar todo lo que se guarda de la persona.
router.get('/me/export', auth, async (req, res) => {
  const data = await exportUser(req.user);
  res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-pato-barber.json"');
  res.json(data);
});

// Supresión: elimina la cuenta; los turnos pasados quedan anónimos.
router.delete('/me', auth, validate([body('confirm').equals('ELIMINAR').withMessage('Escribí ELIMINAR para confirmar')]), async (req, res) => {
  if (req.user.role === ROLES.ADMIN) throw httpError(403, 'La cuenta de administrador no se puede eliminar desde acá.');
  await eraseUser(req.user._id);
  endSession(res);
  res.json({ success: true });
});

module.exports = router;
