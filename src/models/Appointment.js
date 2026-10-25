const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../config/constants');
const { encrypt, decrypt } = require('../utils/crypto');

const appointmentSchema = new mongoose.Schema(
  {
    // Cliente registrado. Los turnos cargados a mano por el barbero (clientes
    // que llegan sin cuenta) usan guestName / guestPhone en su lugar.
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    guestName: { type: String, trim: true, default: '' },
    // Teléfono y notas se guardan cifrados (AES-256-GCM).
    guestPhone: { type: String, trim: true, default: '', set: encrypt, get: decrypt },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    // Copia del nombre del servicio: el historial no cambia si se renombra.
    serviceName: { type: String, required: true },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Falta la fecha'],
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    startTime: { type: String, required: [true, 'Falta la hora de inicio'] },
    endTime: { type: String, required: [true, 'Falta la hora de fin'] },
    // Franjas de agenda que ocupa el turno (ej: ['10:00', '10:30']).
    slots: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.CONFIRMED,
    },
    // Derivado de status; permite un índice único parcial anti doble-reserva.
    active: { type: Boolean, default: true },
    price: { type: Number, required: true },
    paymentMethod: { type: String, default: '' },
    notes: { type: String, default: '', set: encrypt, get: decrypt }, // el largo máximo (500) se valida en las rutas
    createdBy: { type: String, enum: ['client', 'admin'], default: 'client' },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

appointmentSchema.pre('validate', function () {
  this.active = this.status !== APPOINTMENT_STATUS.CANCELLED;
});

appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ client: 1, date: -1 });
// Dos turnos activos no pueden ocupar la misma franja del mismo día.
appointmentSchema.index(
  { date: 1, slots: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
