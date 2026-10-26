const express = require('express');
const Service = require('../models/Service');
const Availability = require('../models/Availability');
const { getConfig, hoursFor } = require('../services/schedule');
const { todayYMD, nowMinutes, toMin } = require('../utils/time');
const { publicWeek } = require('../services/hours');
const { getReel } = require('../services/reels');

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
      tiktok: c.tiktok || '',
      reels: c.reels || [],
      googleReviewUrl: c.googleReviewUrl || '',
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

// Reels configurados con su portada (la imagen se sirve desde acá, no desde Instagram).
router.get('/reels', async (req, res) => {
  const c = await getConfig();
  const urls = (c.reels || []).slice(0, 6);
  const items = await Promise.all(
    urls.map(async (url, i) => {
      const r = await getReel(url);
      return { url, title: r.ok ? r.title : '', thumb: r.ok ? `/api/reels/${i}/thumb` : '' };
    })
  );
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ success: true, reels: items });
});

router.get('/reels/:i/thumb', async (req, res) => {
  const c = await getConfig();
  const url = (c.reels || []).slice(0, 6)[Number(req.params.i)];
  const r = url ? await getReel(url) : null;
  if (!r?.ok) return res.status(404).end();
  res.set({ 'Content-Type': r.type, 'Cache-Control': 'public, max-age=86400', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  res.send(r.buf);
});

module.exports = router;
