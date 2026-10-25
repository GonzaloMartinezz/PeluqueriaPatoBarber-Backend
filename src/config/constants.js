const ROLES = {
  CLIENT: 'client',
  ADMIN: 'admin',
};

const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const DEFAULT_SLOT_MINUTES = 30;

// Argentina (Tucumán) no usa horario de verano: UTC-3 fijo.
const TZ_OFFSET_MIN = -180;

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DEFAULT_WORKING_HOURS = {
  monday: { isOpen: true, open: '09:00', close: '20:00' },
  tuesday: { isOpen: true, open: '09:00', close: '20:00' },
  wednesday: { isOpen: true, open: '09:00', close: '20:00' },
  thursday: { isOpen: true, open: '09:00', close: '20:00' },
  friday: { isOpen: true, open: '09:00', close: '20:00' },
  saturday: { isOpen: true, open: '09:00', close: '18:00' },
  sunday: { isOpen: false, open: '09:00', close: '13:00' },
};

const DEFAULT_PAYMENT_METHODS = [
  { name: 'Efectivo', enabled: true },
  { name: 'Transferencia', enabled: true },
  { name: 'Mercado Pago', enabled: true },
  { name: 'Tarjeta', enabled: false },
];

const DEFAULT_SERVICES = [
  {
    name: 'Fade Clásico',
    description: 'Corte degradado con navaja, precisión milimétrica y peinado final con productos premium.',
    price: 8000,
    duration: 60,
    order: 1,
  },
  {
    name: 'Corte + Barba',
    description: 'El combo completo. Diseño de barba, toalla caliente y fade a elección.',
    price: 11000,
    duration: 60,
    isPopular: true,
    order: 2,
  },
  {
    name: 'Solo Barba',
    description: 'Alineación, rebaje y perfilado con navaja. Hidratación final con aceites esenciales.',
    price: 5500,
    duration: 30,
    order: 3,
  },
];

module.exports = {
  ROLES,
  APPOINTMENT_STATUS,
  DEFAULT_SLOT_MINUTES,
  TZ_OFFSET_MIN,
  DAY_KEYS,
  DEFAULT_WORKING_HOURS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SERVICES,
};
