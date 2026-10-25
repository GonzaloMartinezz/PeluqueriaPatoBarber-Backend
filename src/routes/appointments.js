const express = require('express');
const { body } = require('express-validator');
const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const httpError = require('../utils/httpError');
const { getConfig, buildDays, bookAppointment } = require('../services/schedule');
const { isYMD, daysBetween, todayYMD, nowMinutes, toMin } = require('../utils/time');

const router = express.Router();
router.use(auth);

// Agenda del peluquero para el cliente: solo libre / ocupado, sin datos de otros clientes.
router.get('/slots', async (req, res) => {
  const { from, to, serviceId } = req.query;
  if (!isYMD(from) || !isYMD(to) || to < from || daysBetween(from, to) > 62) {
    throw httpError(400, 'Rango de fechas inválido');
  }
  let duration = 0;
  if (serviceId) {
    const service = await Service.findOne({ _id: serviceId, isActive: true });
    if (!service) throw httpError(404, 'Servicio no encontrado');
    duration = service.duration;
  }
  const config = await getConfig();
  const days = await buildDays(from, to, { config, duration });
  res.json({ success: true, slotDuration: config.slotDuration, days });
});

router.post(
  '/',
  validate([
    body('serviceId').isMongoId().withMessage('Elegí un servicio'),
    body('date').custom(isYMD).withMessage('Elegí una fecha'),
    body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Elegí un horario'),
    body('paymentMethod').trim().notEmpty().withMessage('Elegí un método de pago'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Las notas son muy largas'),
  ]),
  async (req, res) => {
    const { serviceId, date, startTime, paymentMethod, notes = '' } = req.body;

    const [service, config] = await Promise.all([
      Service.findOne({ _id: serviceId, isActive: true }),
      getConfig(),
    ]);
    if (!service) throw httpError(404, 'Servicio no encontrado');
    if (!config.paymentMethods.some((p) => p.enabled && p.name === paymentMethod)) {
      throw httpError(400, 'Método de pago no disponible');
    }
    if (!req.user.phone) throw httpError(400, 'Cargá tu teléfono antes de reservar');

    const appointment = await bookAppointment({
      date,
      startTime,
      service,
      who: { client: req.user._id },
      paymentMethod,
      notes,
      createdBy: 'client',
    });
    res.status(201).json({ success: true, appointment });
  }
);

router.get('/mine', async (req, res) => {
  const appointments = await Appointment.find({ client: req.user._id }).sort({ date: -1, startTime: -1 });
  res.json({ success: true, appointments });
});

router.patch('/:id/cancel', async (req, res) => {
  const appointment = await Appointment.findOne({ _id: req.params.id, client: req.user._id });
  if (!appointment) throw httpError(404, 'Turno no encontrado');
  if (!['pending', 'confirmed'].includes(appointment.status)) {
    throw httpError(400, 'Este turno ya no se puede cancelar');
  }
  const today = todayYMD();
  if (appointment.date < today || (appointment.date === today && toMin(appointment.startTime) <= nowMinutes())) {
    throw httpError(400, 'No se puede cancelar un turno que ya empezó');
  }
  appointment.status = 'cancelled';
  await appointment.save();
  res.json({ success: true, appointment });
});

module.exports = router;
