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

// Versión de los textos legales (Términos y Privacidad). Si cambian, se actualiza para saber qué aceptó cada persona.
const LEGAL_VERSION = '2026-10';

const DEFAULT_SLOT_MINUTES = 30;

// Argentina (Tucumán) no usa horario de verano: UTC-3 fijo.
const TZ_OFFSET_MIN = -180;

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Martes a sábado con horario cortado (mañana y tarde). Lunes y domingo cerrado.
// Todo se puede cambiar desde Administración > Configuración.
const closedDay = { isOpen: false, morning: { enabled: true, open: '09:00', close: '13:00' }, afternoon: { enabled: true, open: '16:00', close: '20:00' } };
const splitDay = { isOpen: true, morning: { enabled: true, open: '09:00', close: '13:00' }, afternoon: { enabled: true, open: '16:00', close: '20:00' } };
const DEFAULT_WORKING_HOURS = {
  monday: closedDay,
  tuesday: splitDay,
  wednesday: splitDay,
  thursday: splitDay,
  friday: splitDay,
  saturday: splitDay,
  sunday: closedDay,
};

const DEFAULT_PAYMENT_METHODS = [
  { name: 'Efectivo', enabled: true },
  { name: 'Transferencia', enabled: true },
  { name: 'Mercado Pago', enabled: true },
  { name: 'Tarjeta', enabled: false },
];

const DEFAULT_SERVICES = [
  {
    name: 'Corte de Pelo / Fade',
    description: 'Corte degradado a navaja, precisión milimétrica, lavado y peinado final con fijación premium.',
    price: 12000,
    duration: 45,
    isPopular: true,
    order: 1,
  },
  {
    name: 'Corte + Barba VIP',
    description: 'Servicio integral con toalla caliente, perfilado de barba a navaja y fade completo.',
    price: 17500,
    duration: 60,
    isPopular: false,
    order: 2,
  },
  {
    name: 'Perfilado de Barba',
    description: 'Alineación milimétrica a navaja, toalla caliente y aceites esenciales hidratantes.',
    price: 7500,
    duration: 30,
    isPopular: false,
    order: 3,
  },
  {
    name: 'Platinado Global / Coloración',
    description: 'Decoloración profesional uniforme sin reflejos amarillos, matizado exclusivo y baño de crema reparador.',
    price: 50000,
    duration: 120,
    isPopular: false,
    order: 4,
  },
];

module.exports = {
  ROLES,
  APPOINTMENT_STATUS,
  DEFAULT_SLOT_MINUTES,
  LEGAL_VERSION,
  TZ_OFFSET_MIN,
  DAY_KEYS,
  DEFAULT_WORKING_HOURS,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SERVICES,
};
