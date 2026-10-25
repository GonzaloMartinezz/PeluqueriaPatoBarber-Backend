const express = require('express');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const { getConfig, hoursFor } = require('../services/schedule');
const { todayYMD, nowMinutes, toMin } = require('../utils/time');

const router = express.Router();

// Datos del negocio visibles para cualquiera (landing y reserva).
router.get('/config', async (req, res) => {
  const c = await getConfig();

  // Estado de hoy (hora de Argentina), con feriados y horarios especiales incluidos.
  const date = todayYMD();
  const h = hoursFor(date, c, await Availability.findOne({ date }).lean());
  const now = nowMinutes();
  const today = { date, isOpen: h.isOpen, open: h.open || null, close: h.close || null, reason: h.reason || '' };
  today.status = !h.isOpen ? 'closed' : now < toMin(h.open) ? 'later' : now < toMin(h.close) ? 'open' : 'ended';

  res.json({
    success: true,
    config: {
      name: c.name,
      barberName: c.barberName,
      address: c.address,
      phone: c.phone,
      instagram: c.instagram,
      workingHours: c.workingHours,
      slotDuration: c.slotDuration,
      maxDaysAhead: c.maxDaysAhead,
      paymentMethods: c.paymentMethods.filter((p) => p.enabled).map((p) => p.name),
      today,
    },
  });
});

router.get('/services', async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, services });
});

module.exports = router;
