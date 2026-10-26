const express = require('express');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const { getConfig, hoursFor } = require('../services/schedule');
const { todayYMD, nowMinutes, toMin } = require('../utils/time');
const { publicWeek } = require('../services/hours');

const router = express.Router();

// Datos del negocio visibles para cualquiera (landing y reserva).
router.get('/config', async (req, res) => {
  const c = await getConfig();

  // Estado de hoy (hora de Argentina), con feriados y horarios especiales incluidos.
  const date = todayYMD();
  const h = hoursFor(date, c, await Availability.findOne({ date }).lean());
  const now = nowMinutes();
  // Con horario cortado: "open" si estamos dentro de un turno, "later" si falta que abra el próximo
  // (incluye el descanso del mediodía), "ended" si ya pasó el último.
  const current = h.shifts.find((s) => now >= toMin(s.open) && now < toMin(s.close));
  const next = h.shifts.find((s) => now < toMin(s.open));
  const today = {
    date,
    isOpen: h.isOpen,
    open: (current || next)?.open || null,
    close: current?.close || null,
    shifts: h.shifts,
    reason: h.reason || '',
    status: !h.isOpen ? 'closed' : current ? 'open' : next ? 'later' : 'ended',
  };

  res.json({
    success: true,
    config: {
      name: c.name,
      barberName: c.barberName,
      address: c.address,
      phone: c.phone,
      instagram: c.instagram,
      reels: c.reels || [],
      workingHours: publicWeek(c.workingHours),
      slotDuration: c.slotDuration,
      maxDaysAhead: c.maxDaysAhead,
      paymentMethods: c.paymentMethods.filter((p) => p.enabled).map((p) => p.name),
      legal: {
        ownerName: c.legal?.ownerName || '',
        cuit: c.legal?.cuit || '',
        address: c.legal?.address || '',
        email: c.legal?.email || '',
        cancellationHours: c.legal?.cancellationHours || 0,
      },
      today,
    },
  });
});

router.get('/services', async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, services });
});

module.exports = router;
