const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');
const { encrypt, decrypt } = require('../utils/crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ingresá tu nombre'],
      trim: true,
    },
    lastName: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Ingresá tu email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El email no es válido'],
    },
    password: {
      type: String,
      // Las cuentas creadas con Google no tienen contraseña.
      required: [
        function () {
          return !this.googleId;
        },
        'Ingresá una contraseña',
      ],
      minlength: 6,
      select: false,
    },
    googleId: {
      type: String,
      index: true,
      sparse: true,
    },
    // Cifrado en la base (AES-256-GCM); se descifra al leer el documento.
    phone: {
      type: String,
      default: '',
      trim: true,
      set: encrypt,
      get: decrypt,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CLIENT,
    },
    avatar: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
    // Aceptación de Términos y Política de Privacidad (cuándo y qué versión).
    consentAt: { type: Date },
    consentVersion: { type: String },
    // Cambiar o restablecer la contraseña cierra todas las sesiones anteriores a esta fecha.
    passwordChangedAt: { type: Date },
    // Recuperación de contraseña: solo se guarda el hash del enlace, y vence en 30 minutos.
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

userSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.virtual('fullName').get(function () {
  return `${this.name} ${this.lastName}`.trim();
});

module.exports = mongoose.model('User', userSchema);
