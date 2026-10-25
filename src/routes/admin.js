const express = require('express');
const { body } = require('express-validator');
const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');
const Service = require('../models/Service');
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminGuard = require('../middleware/adminGuard');
const validate = require('../middleware/validate');
const httpError = require('../utils/httpError');
const { decrypt } = require('../utils/crypto');
const { getConfig, buildDays, bookAppointment, apptSummary } = require('../services/schedule');
const {
  isYMD,
  isHHMM,
  toMin,
  daysBetween,
  todayYMD,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  toInstant,
} = require('../utils/time');
const { ROLES, APPOINTMENT_STATUS, DAY_KEYS } = require('../config/constants');

const router = express.Router();
router.use(auth, adminGuard);

const range = (req, maxDays) => {
  const { from, to } = req.query;
  if (!isYMD(from) || !isYMD(to) || to < from || daysBetween(from, to) > maxDays) {
    throw httpError(400, 'Rango de fechas inválido');
  }
  return { from, to };
};

/* ------------------------------ Estadísticas ------------------------------ */

async function periodStats(from, to) {
  const [r] = await Appointment.aggregate([
    { $match: { date: { $gte: from, $lte: to }, active: true } },
    {
      $group: {
        _id: null,
        clients: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$price', 0] } },
        projected: { $sum: '$price' },
      },
    },
  ]);
  return { clients: r?.clients || 0, completed: r?.completed || 0, revenue: r?.revenue || 0, projected: r?.projected || 0 };
}

router.get('/stats', async (req, res) => {
  const today = todayYMD();
  const month = { from: startOfMonth(today), to: endOfMonth(today) };
  const seriesFrom = addDays(today, -29);

  const [day, week, monthStats, series, byPayment, topServices, totalClients, newClients] = await Promise.all([
    periodStats(today, today),
    periodStats(startOfWeek(today), endOfWeek(today)),
    periodStats(month.from, month.to),
    Appointment.aggregate([
      { $match: { date: { $gte: seriesFrom, $lte: today }, active: true } },
      {
        $group: {
          _id: '$date',
          clients: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$price', 0] } },
        },
      },
    ]),
    Appointment.aggregate([
      { $match: { date: { $gte: month.from, $lte: month.to }, active: true } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$price' } } },
      { $sort: { total: -1 } },
    ]),
    Appointment.aggregate([
      { $match: { date: { $gte: month.from, $lte: month.to }, active: true } },
      { $group: { _id: '$serviceName', count: { $sum: 1 }, total: { $sum: '$price' } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    User.countDocuments({ role: ROLES.CLIENT }),
    User.countDocuments({ role: ROLES.CLIENT, createdAt: { $gte: toInstant(month.from, '00:00') } }),
  ]);

  const byDate = new Map(series.map((s) => [s._id, s]));
  const chart = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(seriesFrom, i);
    return { date, clients: byDate.get(date)?.clients || 0, revenue: byDate.get(date)?.revenue || 0 };
  });

  res.json({
    success: true,
    today,
    day,
    week: { ...week, from: startOfWeek(today), to: endOfWeek(today) },
    month: monthStats,
    chart,
    byPayment: byPayment.map((p) => ({ method: p._id || 'Sin especificar', count: p.count, total: p.total })),
    topServices: topServices.map((s) => ({ name: s._id, count: s.count, total: s.total })),
    registeredClients: totalClients,
    newClientsThisMonth: newClients,
  });
});

/* --------------------------------- Agenda --------------------------------- */

// Misma grilla que ve el cliente, pero con los datos de cada turno.
router.get('/slots', async (req, res) => {
  const { from, to } = range(req, 62);
  const config = await getConfig();
  const days = await buildDays(from, to, { config, admin: true });
  res.json({ success: true, slotDuration: config.slotDuration, days });
});

// Lista de turnos del rango (día / semana / mes), con datos del cliente.
router.get('/appointments', async (req, res) => {
  const { from, to } = range(req, 400);
  const filter = { date: { $gte: from, $lte: to } };
  if (req.query.status) filter.status = req.query.status;
  const appts = await Appointment.find(filter)
    .populate('client', 'name lastName phone email')
    .sort({ date: 1, startTime: 1 })
    .lean();
  res.json({
    success: true,
    appointments: appts.map((a) => ({ ...apptSummary(a), date: a.date, createdBy: a.createdBy })),
  });
});

// Turno cargado por el barbero (cliente sin cuenta o por teléfono).
router.post(
  '/appointments',
  validate([
    body('serviceId').isMongoId().withMessage('Elegí un servicio'),
    body('date').custom(isYMD).withMessage('Fecha inválida'),
    body('startTime').custom(isHHMM).withMessage('Hora inválida'),
    body('clientId').optional({ values: 'falsy' }).isMongoId(),
    body('notes').optional().isString().isLength({ max: 500 }).withMessage('Las notas son muy largas'),
    body('guestPhone').optional().isString().isLength({ max: 30 }),
    body('guestName').if(body('clientId').not().exists({ values: 'falsy' })).trim().notEmpty().withMessage('Ingresá el nombre del cliente'),
  ]),
  async (req, res) => {
    const { serviceId, date, startTime, clientId, guestName, guestPhone = '', paymentMethod = '', notes = '' } = req.body;
    const service = await Service.findById(serviceId);
    if (!service) throw httpError(404, 'Servicio no encontrado');

    let who = { guestName, guestPhone };
    if (clientId) {
      if (!(await User.exists({ _id: clientId, role: ROLES.CLIENT }))) throw httpError(404, 'Cliente no encontrado');
      who = { client: clientId };
    }

    const appointment = await bookAppointment({ date, startTime, service, who, paymentMethod, notes, createdBy: 'admin' });
    res.status(201).json({ success: true, appointment });
  }
);

router.patch('/appointments/:id', async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw httpError(404, 'Turno no encontrado');

  const { status, price, paymentMethod, notes } = req.body;
  if (status !== undefined) {
    if (!Object.values(APPOINTMENT_STATUS).includes(status)) throw httpError(400, 'Estado inválido');
    appointment.status = status;
  }
  if (price !== undefined) {
    if (!(Number(price) >= 0)) throw httpError(400, 'Precio inválido');
    appointment.price = Number(price);
  }
  if (paymentMethod !== undefined) appointment.paymentMethod = paymentMethod;
  if (notes !== undefined) {
    if (typeof notes !== 'string' || notes.length > 500) throw httpError(400, 'Las notas son muy largas');
    appointment.notes = notes;
  }

  try {
    await appointment.save(); // reactivar un turno cancelado vuelve a chequear el índice único
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'Ese horario ya fue tomado por otro turno');
    throw err;
  }
  res.json({ success: true, appointment });
});

/* -------------------------------- Clientes -------------------------------- */

router.get('/clients', async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = { role: ROLES.CLIENT };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    // El teléfono está cifrado en la base, por eso no se puede buscar por teléfono.
    filter.$or = [{ name: rx }, { lastName: rx }, { email: rx }];
  }

  const [users, stats] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).lean(),
    Appointment.aggregate([
      { $match: { client: { $ne: null } } },
      {
        $group: {
          _id: '$client',
          total: { $sum: 1 },
          cancelled: { $sum: { $cond: ['$active', 0, 1] } },
          spent: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$price', 0] } },
          lastDate: { $max: '$date' },
        },
      },
    ]),
  ]);
  const byClient = new Map(stats.map((s) => [String(s._id), s]));

  res.json({
    success: true,
    clients: users.map((u) => {
      const s = byClient.get(String(u._id));
      return {
        id: u._id,
        name: u.name,
        lastName: u.lastName,
        email: u.email,
        phone: decrypt(u.phone),
        avatar: u.avatar,
        viaGoogle: !!u.googleId,
        isActive: u.isActive,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        appointments: s?.total || 0,
        cancelled: s?.cancelled || 0,
        spent: s?.spent || 0,
        lastAppointment: s?.lastDate || null,
      };
    }),
  });
});

router.patch('/clients/:id', async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: ROLES.CLIENT });
  if (!user) throw httpError(404, 'Cliente no encontrado');
  if (req.body.isActive !== undefined) user.isActive = !!req.body.isActive;
  await user.save();
  res.json({ success: true });
});

/* -------------------------------- Servicios ------------------------------- */

const serviceRules = [
  body('name').trim().notEmpty().withMessage('Ingresá el nombre del servicio'),
  body('price').isFloat({ min: 0 }).withMessage('Precio inválido'),
  body('duration').isInt({ min: 10, max: 480 }).withMessage('Duración inválida (10 a 480 min)'),
];

router.get('/services', async (req, res) => {
  res.json({ success: true, services: await Service.find().sort({ order: 1, createdAt: 1 }) });
});

router.post('/services', validate(serviceRules), async (req, res) => {
  const { name, description, price, duration, isPopular, isActive } = req.body;
  const order = (await Service.countDocuments()) + 1;
  const service = await Service.create({ name, description, price, duration, isPopular, isActive, order });
  res.status(201).json({ success: true, service });
});

router.put('/services/:id', validate(serviceRules), async (req, res) => {
  const { name, description, price, duration, isPopular, isActive } = req.body;
  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { name, description, price, duration, isPopular, isActive },
    { new: true, runValidators: true }
  );
  if (!service) throw httpError(404, 'Servicio no encontrado');
  res.json({ success: true, service });
});

// Baja lógica: los turnos viejos conservan su servicio.
router.delete('/services/:id', async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!service) throw httpError(404, 'Servicio no encontrado');
  res.json({ success: true });
});

/* ------------------------------ Configuración ----------------------------- */

router.get('/config', async (req, res) => {
  res.json({ success: true, config: await getConfig() });
});

router.put('/config', async (req, res) => {
  const config = await getConfig();
  const b = req.body;

  for (const k of ['name', 'barberName', 'address', 'phone', 'instagram']) {
    if (typeof b[k] === 'string') config[k] = b[k].trim();
  }

  if (b.workingHours) {
    for (const day of DAY_KEYS) {
      const h = b.workingHours[day];
      if (!h) continue;
      if (h.isOpen && (!isHHMM(h.open) || !isHHMM(h.close) || toMin(h.open) >= toMin(h.close))) {
        throw httpError(400, 'Horario inválido: la apertura debe ser antes del cierre');
      }
      config.workingHours[day] = {
        isOpen: !!h.isOpen,
        open: isHHMM(h.open) ? h.open : config.workingHours[day].open,
        close: isHHMM(h.close) ? h.close : config.workingHours[day].close,
      };
    }
  }

  if (Array.isArray(b.paymentMethods)) {
    const methods = b.paymentMethods
      .map((p) => ({ name: String(p.name || '').trim(), enabled: !!p.enabled }))
      .filter((p) => p.name);
    if (!methods.some((p) => p.enabled)) throw httpError(400, 'Dejá al menos un método de pago habilitado');
    config.paymentMethods = methods;
  }

  if (b.slotDuration !== undefined && Number(b.slotDuration) !== config.slotDuration) {
    const pending = await Appointment.countDocuments({ active: true, date: { $gte: todayYMD() } });
    if (pending > 0) {
      throw httpError(409, 'No se puede cambiar la duración de las franjas mientras haya turnos futuros');
    }
    config.slotDuration = Number(b.slotDuration);
  }
  if (b.maxDaysAhead !== undefined) config.maxDaysAhead = Number(b.maxDaysAhead);

  await config.save();
  res.json({ success: true, config });
});

/* -------------------- Días cerrados / horarios especiales ------------------ */

router.get('/exceptions', async (req, res) => {
  const exceptions = await Availability.find({ date: { $gte: todayYMD() } }).sort({ date: 1 });
  res.json({ success: true, exceptions });
});

router.post(
  '/exceptions',
  validate([body('date').custom(isYMD).withMessage('Fecha inválida'), body('type').isIn(['blocked', 'custom'])]),
  async (req, res) => {
    const { date, type, reason = '', customHours } = req.body;
    if (type === 'custom' && (!isHHMM(customHours?.open) || !isHHMM(customHours?.close) || toMin(customHours.open) >= toMin(customHours.close))) {
      throw httpError(400, 'Horario especial inválido');
    }
    const exception = await Availability.findOneAndUpdate(
      { date },
      { date, type, reason, customHours: type === 'custom' ? customHours : undefined },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const affected = await Appointment.countDocuments({ date, active: true });
    res.status(201).json({ success: true, exception, affectedAppointments: type === 'blocked' ? affected : 0 });
  }
);

router.delete('/exceptions/:id', async (req, res) => {
  await Availability.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
