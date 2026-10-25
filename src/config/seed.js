const User = require('../models/User');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const { getConfig } = require('../services/schedule');
const { ROLES, DEFAULT_SERVICES } = require('./constants');

// Deja la base lista para usar: configuración, servicios y cuenta del barbero.
async function seed() {
  await Appointment.init(); // asegura el índice único anti doble-reserva
  await getConfig();

  if ((await Service.countDocuments()) === 0) {
    await Service.insertMany(DEFAULT_SERVICES);
    console.log('Servicios iniciales creados');
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && !(await User.findOne({ email }))) {
    await User.create({
      name: process.env.ADMIN_NAME || 'Pato',
      lastName: process.env.ADMIN_LASTNAME || 'Barber',
      email,
      password,
      role: ROLES.ADMIN,
    });
    console.log(`Cuenta de administrador creada: ${email}`);
  }
}

module.exports = seed;
