const crypto = require('crypto');

/*
  Cifrado de campos sensibles en la base (AES-256-GCM).
  Formato guardado: "enc:v1:<iv>:<tag>:<texto cifrado>" (base64url).
  - GCM autentica: si alguien altera el dato en la base, descifrar falla en vez de devolver basura.
  - Un IV aleatorio por valor: el mismo teléfono cifrado dos veces da textos distintos.
  - decrypt() deja pasar valores sin prefijo, así los datos viejos (sin cifrar) siguen funcionando
    hasta correr `npm run encrypt:backfill`.
*/
const PREFIX = 'enc:v1:';
let cachedKey;

function getKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY || '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser una clave de 32 bytes en base64 (ver .env.example)');
  }
  cachedKey = key;
  return key;
}

const b64 = (buf) => buf.toString('base64url');

function encrypt(value) {
  if (value === undefined || value === null || value === '') return value;
  const text = String(value);
  if (text.startsWith(PREFIX)) return text; // ya cifrado

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${PREFIX}${b64(iv)}:${b64(cipher.getAuthTag())}:${b64(data)}`;
}

function decrypt(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split(':').map((p) => Buffer.from(p, 'base64url'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Clave equivocada o dato alterado: nunca se devuelve el texto cifrado ni se rompe la página.
    console.error('No se pudo descifrar un campo (¿ENCRYPTION_KEY distinta o dato alterado?)');
    return '';
  }
}

const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

module.exports = { encrypt, decrypt, isEncrypted };
