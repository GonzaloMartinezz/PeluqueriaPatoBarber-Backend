// Defensa contra inyección NoSQL: ninguna clave del body puede empezar con "$" ni contener ".".
// (Un body como {"email": {"$ne": null}} no llega nunca a una consulta de Mongo.)
const hasDangerousKey = (value, depth = 0) => {
  if (depth > 8) return true; // anidamiento absurdo
  if (Array.isArray(value)) return value.some((v) => hasDangerousKey(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => k.startsWith('$') || k.includes('.') || hasDangerousKey(v, depth + 1));
  }
  return false;
};

module.exports = (req, res, next) => {
  if (hasDangerousKey(req.body)) {
    return res.status(400).json({ success: false, message: 'Solicitud inválida' });
  }
  next();
};
