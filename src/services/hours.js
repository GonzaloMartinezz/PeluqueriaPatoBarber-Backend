const { DAY_KEYS, DEFAULT_WORKING_HOURS } = require('../config/constants');

/*
  Horario semanal con "horario cortado": cada día tiene un turno de mañana y uno de tarde,
  cada uno activable por separado.

    { isOpen, morning: { enabled, open, close }, afternoon: { enabled, open, close } }

  El formato viejo (un solo tramo: { isOpen, open, close }) se sigue entendiendo: se lee como
  "solo mañana".
*/
const DEFAULT_MORNING = { open: '09:00', close: '13:00' };
const DEFAULT_AFTERNOON = { open: '16:00', close: '20:00' };

const slice = (s, def) => ({ enabled: !!s?.enabled, open: s?.open || def.open, close: s?.close || def.close });

function editableDay(h) {
  if (h && (h.morning || h.afternoon)) {
    return { isOpen: !!h.isOpen, morning: slice(h.morning, DEFAULT_MORNING), afternoon: slice(h.afternoon, DEFAULT_AFTERNOON) };
  }
  // Formato viejo.
  return {
    isOpen: !!h?.isOpen,
    morning: { enabled: true, open: h?.open || DEFAULT_MORNING.open, close: h?.close || DEFAULT_MORNING.close },
    afternoon: { enabled: false, ...DEFAULT_AFTERNOON },
  };
}

// Tramos en los que se atiende ese día: [{ open, close }]. Vacío = cerrado.
function shiftsOf(h) {
  const d = editableDay(h);
  if (!d.isOpen) return [];
  return [d.morning, d.afternoon].filter((s) => s.enabled).map(({ open, close }) => ({ open, close }));
}

const editableWeek = (workingHours) => Object.fromEntries(DAY_KEYS.map((k) => [k, editableDay(workingHours?.[k])]));
const publicWeek = (workingHours) =>
  Object.fromEntries(
    DAY_KEYS.map((k) => {
      const shifts = shiftsOf(workingHours?.[k]);
      return [k, { isOpen: shifts.length > 0, shifts }];
    })
  );

const isLegacy = (h) => !!h && !h.morning && !h.afternoon;

// ¿El horario guardado es exactamente el que traía la app antes (sin tocar)?
const OLD_DEFAULTS = {
  monday: ['09:00', '20:00', true], tuesday: ['09:00', '20:00', true], wednesday: ['09:00', '20:00', true],
  thursday: ['09:00', '20:00', true], friday: ['09:00', '20:00', true], saturday: ['09:00', '18:00', true],
  sunday: ['09:00', '13:00', false],
};
const isUntouchedOldDefault = (workingHours) =>
  DAY_KEYS.every((k) => {
    const h = workingHours?.[k];
    const [open, close, isOpen] = OLD_DEFAULTS[k];
    return isLegacy(h) && !!h.isOpen === isOpen && h.open === open && h.close === close;
  });

module.exports = { editableDay, editableWeek, publicWeek, shiftsOf, isLegacy, isUntouchedOldDefault, DEFAULT_WORKING_HOURS };
