const { TZ_OFFSET_MIN, DAY_KEYS } = require('../config/constants');

// Las fechas se manejan como strings 'YYYY-MM-DD' y las horas como 'HH:MM'
// para evitar problemas de zona horaria.

const pad = (n) => String(n).padStart(2, '0');

const isYMD = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const isHHMM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// "Ahora" desplazado a la hora local: leer siempre con getUTC*.
const nowLocal = () => new Date(Date.now() + TZ_OFFSET_MIN * 60000);
const todayYMD = () => nowLocal().toISOString().slice(0, 10);
const nowMinutes = () => {
  const d = nowLocal();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

const parseYMD = (s) => new Date(`${s}T00:00:00Z`);

const addDays = (s, n) => {
  const d = parseYMD(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const weekdayKey = (s) => DAY_KEYS[parseYMD(s).getUTCDay()];

// Semana de lunes a domingo.
const startOfWeek = (s) => addDays(s, -((parseYMD(s).getUTCDay() + 6) % 7));
const endOfWeek = (s) => addDays(startOfWeek(s), 6);
const startOfMonth = (s) => `${s.slice(0, 8)}01`;
const endOfMonth = (s) => {
  const d = parseYMD(startOfMonth(s));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (from, to) => Math.round((parseYMD(to) - parseYMD(from)) / 86400000);

const eachDay = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

// Instante real (Date) a partir de fecha/hora locales.
const toInstant = (date, hhmm) => new Date(parseYMD(date).getTime() + toMin(hhmm) * 60000 - TZ_OFFSET_MIN * 60000);

module.exports = {
  isYMD,
  isHHMM,
  toMin,
  toHHMM,
  todayYMD,
  nowMinutes,
  addDays,
  weekdayKey,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  daysBetween,
  eachDay,
  toInstant,
};
