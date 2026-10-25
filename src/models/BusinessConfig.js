const mongoose = require('mongoose');

const dayHours = {
  isOpen: { type: Boolean, default: true },
  open: { type: String, default: '09:00' },
  close: { type: String, default: '20:00' },
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
