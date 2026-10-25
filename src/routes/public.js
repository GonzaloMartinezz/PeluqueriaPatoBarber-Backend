const express = require('express');
const Service = require('../models/Service');
const { getConfig } = require('../services/schedule');

const router = express.Router();

// Datos del negocio visibles para cualquiera (landing y reserva).
router.get('/config', async (req, res) => {
  const c = await getConfig();
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
    },
  });
});

router.get('/services', async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ success: true, services });
});

module.exports = router;
