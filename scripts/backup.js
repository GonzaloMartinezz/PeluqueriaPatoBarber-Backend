// Copia de seguridad CIFRADA de toda la base:  npm run backup
// Crea backups/pato-barber-AAAA-MM-DD_HH-MM.enc  (AES-256-GCM con ENCRYPTION_KEY).
// Sin la clave de cifrado el archivo no se puede abrir. Guardá la copia fuera de esta PC (nube, pendrive).
const fs = require('fs');
const path = require('path');
const { validateEnv } = require('../src/config/env');
validateEnv();

const mongoose = require('mongoose');
const { EJSON } = require('bson');
const connectDB = require('../src/config/db');
const { encrypt } = require('../src/utils/crypto');

(async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const dump = { version: 1, creadoEl: new Date().toISOString(), colecciones: {} };

  for (const { name } of await db.listCollections().toArray()) {
    dump.colecciones[name] = await db.collection(name).find({}).toArray();
  }

  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const file = path.join(dir, `pato-barber-${stamp}.enc`);
  fs.writeFileSync(file, encrypt(EJSON.stringify(dump)), { mode: 0o600 });

  const counts = Object.entries(dump.colecciones).map(([k, v]) => `${k}: ${v.length}`).join(' · ');
  console.log(`Copia lista: ${file}\n${counts}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error('No se pudo hacer la copia:', e.message);
  process.exit(1);
});
