const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a service name'],
      trim: true,
    },
    description: {
      type: String,
    },
    price: {
      type: Number,
      required: [true, 'Please add a price'],
    },
    duration: {
      type: Number,
      required: [true, 'Please add duration in minutes'],
      default: 30,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Service', serviceSchema);
