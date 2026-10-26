const mongoose = require('mongoose');

const shift = { enabled: { type: Boolean }, open: { type: String }, close: { type: String }, _id: false };

// morning / afternoon: horario cortado. open / close son del formato viejo (un solo tramo)
// y se migran solos al arrancar (ver config/seed.js).
const dayHours = {
  isOpen: { type: Boolean, default: false },
  morning: shift,
  afternoon: shift,
  open: { type: String },
  close: { type: String },
};

const businessConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'Pato Barber',
    },
    barberName: {
      type: String,
      default: 'Pato',
    },
    address: {
      type: String,
      default: 'Batalla de Chacabuco 1159, San Miguel de Tucumán',
    },
    phone: {
      type: String,
      default: '',
    },
    // Enlaces de reels/publicaciones de Instagram que se muestran en la portada (máx. 6).
    reels: { type: [String], default: [] },
    // Enlace para dejar una reseña en Google Maps (opcional; si falta se usa una búsqueda del local).
    googleReviewUrl: { type: String, default: '' },
    instagram: {
      type: String,
      default: '',
    },
    workingHours: {
      monday: dayHours,
      tuesday: dayHours,
      wednesday: dayHours,
      thursday: dayHours,
      friday: dayHours,
      saturday: dayHours,
      sunday: dayHours,
    },
    paymentMethods: [
      {
        name: { type: String, required: true, trim: true },
        enabled: { type: Boolean, default: true },
        _id: false,
      },
    ],
    // Datos del responsable que aparecen en la Política de Privacidad y los Términos.
    legal: {
      ownerName: { type: String, default: '', trim: true, maxlength: 120 }, // titular / razón social
      cuit: { type: String, default: '', trim: true },
      address: { type: String, default: '', trim: true, maxlength: 200 }, // domicilio legal
      email: { type: String, default: '', trim: true, maxlength: 120 }, // contacto para consultas de privacidad
      cancellationHours: { type: Number, default: 0, min: 0, max: 72 }, // 0 = se puede cancelar hasta la hora del turno
    },
    slotDuration: {
      type: Number,
      default: 30,
      min: 10,
      max: 120,
    },
    maxDaysAhead: {
      type: Number,
      default: 30,
      min: 1,
      max: 365,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BusinessConfig', businessConfigSchema);
