const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const httpError = require('../utils/httpError');
const { csrfFor, startSession, endSession } = require('../utils/session');

const router = express.Router();

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  lastName: u.lastName,
  email: u.email,
  phone: u.phone,
  role: u.role,
  avatar: u.avatar,
});

const session = (res, user, status = 200) => startSession(res, user, publicUser, status);

// bcrypt solo mira los primeros 72 bytes: se limita el largo para que la contraseña completa cuente.
const COMMON_PASSWORDS = new Set(['12345678', '123456789', '1234567890', 'password', 'contraseña', 'qwertyui', '11111111', 'abcd1234', 'patobarber']);
const passwordRule = body('password')
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
    passwordRule,
  ]),
  async (req, res) => {
    const { name, lastName, email, phone, password } = req.body;
    if (await User.findOne({ email: email.toLowerCase() })) {
      throw httpError(409, 'Ya existe una cuenta con ese email');
    }
    // El rol siempre es 'client': nunca se toma del body.
    const user = await User.create({ name, lastName, email, phone, password, lastLoginAt: new Date() });
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

module.exports = router;
