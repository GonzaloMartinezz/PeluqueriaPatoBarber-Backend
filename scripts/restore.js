// Restaura una copia hecha con "npm run backup":
//   npm run restore -- backups/pato-barber-2026-10-25_21-30.enc --yes
// OJO: BORRA lo que hay hoy en la base y lo reemplaza por la copia. Sin --yes solo muestra qué contiene.
const fs = require('fs');
const { validateEnv } = require('../src/config/env');
validateEnv();

const mongoose = require('mongoose');
const { EJSON } = require('bson');
const connectDB = require('../src/config/db');
const { decrypt } = require('../src/utils/crypto');

const file = process.argv[2];
const yes = process.argv.includes('--yes');

(async () => {
  if (!file || !fs.existsSync(file)) throw new Error('Indicá el archivo .enc de la copia');
  const text = decrypt(fs.readFileSync(file, 'utf8').trim());
  if (!text) throw new Error('No se pudo descifrar: ¿es la ENCRYPTION_KEY correcta?');
  const dump = EJSON.parse(text);

  console.log(`Copia del ${dump.creadoEl}`);
  for (const [name, docs] of Object.entries(dump.colecciones)) console.log(` - ${name}: ${docs.length}`);
  if (!yes) return console.log('\nNo se cambió nada. Agregá --yes para restaurar (reemplaza lo actual).');

  await connectDB();
  const db = mongoose.connection.db;
  for (const [name, docs] of Object.entries(dump.colecciones)) {
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs);
  }
  console.log('\nRestauración completa.');
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
