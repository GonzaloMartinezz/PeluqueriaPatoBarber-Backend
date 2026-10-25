const User = require('../models/User');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const { getConfig } = require('../services/schedule');
const { editableWeek, isLegacy, isUntouchedOldDefault, DEFAULT_WORKING_HOURS } = require('../services/hours');
const { ROLES, DEFAULT_SERVICES } = require('./constants');

// Pasa el horario guardado en el formato viejo (un solo tramo por día) al de mañana / tarde.
// - Si era el horario que traía la app sin tocar, se actualiza al nuevo (martes a sábado, cortado).
// - Si el barbero ya lo había personalizado, se conserva: cada día queda como turno de mañana.
async function migrateSchedule() {
  const config = await getConfig();
  const wh = config.toObject().workingHours || {};
  if (!Object.values(wh).some(isLegacy)) return;

  config.workingHours = isUntouchedOldDefault(wh) ? DEFAULT_WORKING_HOURS : editableWeek(wh);
  config.markModified('workingHours');
  await config.save();
  console.log('Horario migrado al formato mañana / tarde');
}

// Deja la base lista para usar: configuración, servicios y cuenta del barbero.
async function seed() {
  await Appointment.init(); // asegura el índice único anti doble-reserva
  await getConfig();
  await migrateSchedule();

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
module.exports.migrateSchedule = migrateSchedule;
