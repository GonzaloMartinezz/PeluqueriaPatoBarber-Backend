const BusinessConfig = require('../models/BusinessConfig');
const Availability = require('../models/Availability');
const Appointment = require('../models/Appointment');
const httpError = require('../utils/httpError');
const { decrypt } = require('../utils/crypto');
const { shiftsOf } = require('./hours');
const {
  DEFAULT_WORKING_HOURS,
  DEFAULT_PAYMENT_METHODS,
  APPOINTMENT_STATUS,
} = require('../config/constants');
const {
  toMin,
  toHHMM,
  todayYMD,
  nowMinutes,
  addDays,
  weekdayKey,
  eachDay,
  isYMD,
  isHHMM,
} = require('../utils/time');

async function getConfig() {
  const existing = await BusinessConfig.findOne();
  if (existing) return existing;
  return BusinessConfig.create({
    workingHours: DEFAULT_WORKING_HOURS,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
  });
}

// Horario efectivo de un día: excepción (cerrado / especial) o horario semanal.
function hoursFor(date, config, exception) {
  if (exception && exception.type === 'blocked') {
    return { isOpen: false, shifts: [], reason: exception.reason || 'Cerrado' };
  }
  // Horario especial de un día: un solo tramo.
  if (exception && exception.type === 'custom' && exception.customHours?.open && exception.customHours?.close) {
    const { open, close } = exception.customHours;
    return { isOpen: true, shifts: [{ open, close }], open, close, reason: exception.reason || 'Horario especial' };
  }
  const shifts = shiftsOf(config.workingHours?.[weekdayKey(date)]);
  if (!shifts.length) return { isOpen: false, shifts: [], reason: 'Cerrado' };
  return { isOpen: true, shifts, open: shifts[0].open, close: shifts[shifts.length - 1].close };
}

function apptSummary(a) {
  const client = a.client && typeof a.client === 'object' ? a.client : null;
  return {
    id: a._id,
    name: client ? `${client.name} ${client.lastName || ''}`.trim() : a.guestName || 'Cliente',
    phone: decrypt(client?.phone) || decrypt(a.guestPhone) || '',
    email: client?.email || '',
    isGuest: !client,
    serviceName: a.serviceName,
    status: a.status,
    startTime: a.startTime,
    endTime: a.endTime,
    price: a.price,
    paymentMethod: a.paymentMethod,
    notes: decrypt(a.notes),
  };
}

/**
 * Arma la agenda de un rango de días.
 * Estado de cada franja: 'free' (verde), 'busy' (rojo), 'unavailable' (gris:
 * pasada, fuera de rango o sin lugar para la duración pedida).
 * Con admin=true las franjas ocupadas incluyen los datos del turno.
 */
async function buildDays(from, to, { config, duration = 0, admin = false }) {
  const [exceptions, appts] = await Promise.all([
    Availability.find({ date: { $gte: from, $lte: to } }).lean(),
    Appointment.find({ date: { $gte: from, $lte: to }, active: true })
      .populate('client', 'name lastName phone email')
      .lean(),
  ]);

  const exByDate = new Map(exceptions.map((e) => [e.date, e]));
  const apptsByDate = new Map();
  for (const a of appts) {
    if (!apptsByDate.has(a.date)) apptsByDate.set(a.date, []);
    apptsByDate.get(a.date).push(a);
  }

  const step = config.slotDuration;
  const needed = Math.max(1, Math.ceil(duration / step));
  const today = todayYMD();
  const nowMin = nowMinutes();
  const lastBookable = addDays(today, config.maxDaysAhead);

  return eachDay(from, to).map((date) => {
    const hours = hoursFor(date, config, exByDate.get(date));
    const dayAppts = apptsByDate.get(date) || [];
    const base = {
      date,
      isOpen: hours.isOpen,
      reason: hours.reason || '',
      open: hours.open || null,
      close: hours.close || null,
      shifts: hours.shifts,
      appointments: admin ? dayAppts.map(apptSummary) : undefined,
    };

    if (!hours.isOpen) return { ...base, slots: [], free: 0, busy: 0 };

    const busyBySlot = new Map();
    for (const a of dayAppts) for (const t of a.slots) busyBySlot.set(t, a);

    // Las franjas se generan por turno: en el descanso del mediodía no hay horarios.
    const mins = [];
    hours.shifts.forEach((sh, shift) => {
      for (let m = toMin(sh.open); m + step <= toMin(sh.close); m += step) mins.push({ m, shift });
    });

    // Primera pasada: estado de cada franja por separado.
    const slots = mins.map(({ m, shift }) => {
      const time = toHHMM(m);
      if (busyBySlot.has(time)) {
        const slot = { time, min: m, shift, status: 'busy' };
        if (admin) {
          const a = busyBySlot.get(time);
          slot.appointment = { ...apptSummary(a), first: a.slots[0] === time };
        }
        return slot;
      }
      // El cliente no puede reservar una franja ya iniciada; el barbero sí
      // (clientes que llegan en el momento).
      const past = date < today || (date === today && m + (admin ? step : 0) <= nowMin);
      const outOfRange = !admin && date > lastBookable;
      return { time, min: m, shift, status: past || outOfRange ? 'unavailable' : 'free' };
    });

    // Segunda pasada: un servicio de varias franjas necesita franjas libres seguidas.
    if (needed > 1) {
      slots.forEach((slot, i) => {
        if (slot.status !== 'free') return;
        for (let k = 1; k < needed; k++) {
          const next = slots[i + k];
          // La franja siguiente tiene que ser contigua: un turno largo no puede cruzar el descanso.
          if (!next || next.min !== slot.min + k * step || next.status === 'busy' || (next.status === 'unavailable' && !admin)) {
            slot.status = 'unavailable';
            return;
          }
        }
      });
    }

    return {
      ...base,
      slots,
      free: slots.filter((s) => s.status === 'free').length,
      busy: slots.filter((s) => s.status === 'busy').length,
    };
  });
}

/**
 * Crea un turno validando que la franja siga libre. Lanza 409 si se ocupó.
 * `who` = { client } o { guestName, guestPhone }.
 */
async function bookAppointment({ date, startTime, service, who, paymentMethod, notes, createdBy }) {
  if (!isYMD(date) || !isHHMM(startTime)) throw httpError(400, 'Fecha u hora inválida');

  const config = await getConfig();
  const admin = createdBy === 'admin';
  const [day] = await buildDays(date, date, { config, duration: service.duration, admin });
  const slot = day.slots.find((s) => s.time === startTime);
  if (!day.isOpen || !slot || slot.status !== 'free') {
    throw httpError(409, 'Ese horario ya no está disponible. Elegí otro.');
  }

  const step = config.slotDuration;
  const needed = Math.max(1, Math.ceil(service.duration / step));
  const start = toMin(startTime);
  const slots = Array.from({ length: needed }, (_, i) => toHHMM(start + i * step));

  try {
    return await Appointment.create({
      ...who,
      service: service._id,
      serviceName: service.name,
      date,
      startTime,
      endTime: toHHMM(start + needed * step),
      slots,
      price: service.price,
      paymentMethod,
      notes,
      createdBy,
      status: APPOINTMENT_STATUS.CONFIRMED,
    });
  } catch (err) {
    // El índice único atrapa la carrera entre dos reservas simultáneas.
    if (err.code === 11000) throw httpError(409, 'Ese horario acaba de ser reservado. Elegí otro.');
    throw err;
  }
}

module.exports = { getConfig, buildDays, bookAppointment, apptSummary, hoursFor };
