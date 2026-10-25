const mongoose = require('mongoose');

// Excepciones al horario semanal: días cerrados (feriados, vacaciones) o
// días con horario especial.
const availabilitySchema = new mongoose.Schema(
  {
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    type: {
      type: String,
      enum: ['blocked', 'custom'],
      default: 'blocked',
    },
    reason: {
      type: String,
      default: '',
    },
    customHours: {
      open: String,
      close: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Availability', availabilitySchema);
