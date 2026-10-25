// Carga las variables de entorno. .env puede estar cifrado con dotenvx (valores "encrypted:...");
// la clave privada vive en .env.keys (nunca se sube) o en la variable DOTENV_PRIVATE_KEY del servidor.
require('@dotenvx/dotenvx').config({ quiet: true });

const WEAK_ADMIN_PASSWORDS = new Set(['PatoAdmin2026', 'admin', 'admin123', 'password', '12345678']);

// Corta el arranque si la configuración es insegura, en vez de descubrirlo en producción.
function validateEnv() {
  const prod = process.env.NODE_ENV === 'production';
  const errors = [];

  // Si el servidor no tiene la clave privada, los valores quedan como "encrypted:..." y no sirven.
  const undecrypted = Object.entries(process.env).filter(([, v]) => typeof v === 'string' && v.startsWith('encrypted:'));
  if (undecrypted.length) {
    console.error(
      [
        'El archivo .env está cifrado pero falta la clave para descifrarlo.',
        ' - En tu PC: tiene que existir el archivo .env.keys junto a .env.',
        ' - En el servidor: definí la variable de entorno DOTENV_PRIVATE_KEY (el valor está en .env.keys).',
      ].join(String.fromCharCode(10))
    );
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) errors.push('Falta MONGODB_URI');
  if ((process.env.JWT_SECRET || '').length < 32) errors.push('JWT_SECRET debe tener al menos 32 caracteres');
  if (Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64').length !== 32) {
    errors.push('ENCRYPTION_KEY debe ser una clave de 32 bytes en base64');
  }

  if (prod) {
    const urls = (process.env.CLIENT_URL || '').split(',').map((u) => u.trim());
    if (!urls[0] || urls.some((u) => !u.startsWith('https://'))) errors.push('En producción CLIENT_URL debe ser https://');
    if (WEAK_ADMIN_PASSWORDS.has(process.env.ADMIN_PASSWORD)) errors.push('ADMIN_PASSWORD es una contraseña débil conocida');
    if (process.env.COOKIE_SAMESITE === 'none' && process.env.COOKIE_SECURE === 'false') {
      errors.push('SameSite=None exige cookies Secure');
    }
  }

  // Sin SMTP la app funciona, pero "Olvidé mi contraseña" no puede mandar el email.
  if (prod && !(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
    console.warn('Aviso: SMTP sin configurar. Los clientes no podrán recuperar su contraseña por email (ver DEPLOY.md).');
  }

  if (errors.length) {
    console.error('Configuración insegura o incompleta:\n - ' + errors.join('\n - '));
    process.exit(1);
  }
}

const allowedOrigins = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((u) => u.trim().replace(/\/$/, ''))
    .filter(Boolean);

module.exports = { validateEnv, allowedOrigins };
