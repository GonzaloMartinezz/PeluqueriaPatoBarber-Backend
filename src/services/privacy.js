const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');

// Derecho de supresión (Ley 25.326, art. 16): se borra la cuenta y los datos personales.
// Los turnos pasados se conservan SIN datos personales, para no alterar la contabilidad del negocio.
async function eraseUser(userId) {
  await Appointment.updateMany(
    { client: userId },
    { $set: { client: null, guestName: 'Cliente eliminado', guestPhone: '', notes: '' } }
  );
  await User.deleteOne({ _id: userId });
}

// Derecho de acceso (art. 14): todo lo que la app guarda sobre la persona, en un archivo legible.
async function exportUser(user) {
  const appts = await Appointment.find({ client: user._id }).sort({ date: 1, startTime: 1 }).lean();
  return {
    generadoEl: new Date().toISOString(),
    usuario: {
      nombre: user.name,
      apellido: user.lastName,
      email: user.email,
      telefono: user.phone,
      ingresaConGoogle: !!user.googleId,
      registradoEl: user.createdAt,
      ultimoIngreso: user.lastLoginAt || null,
      aceptoTerminosEl: user.consentAt || null,
      versionDeTerminos: user.consentVersion || null,
    },
    turnos: appts.map((a) => ({
      fecha: a.date,
      desde: a.startTime,
      hasta: a.endTime,
      servicio: a.serviceName,
      precio: a.price,
      metodoDePago: a.paymentMethod,
      estado: a.status,
      notas: decrypt(a.notes),
    })),
  };
}

module.exports = { eraseUser, exportUser };
