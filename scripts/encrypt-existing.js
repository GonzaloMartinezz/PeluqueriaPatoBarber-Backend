// Cifra los datos personales que ya estaban guardados en texto plano (se corre una sola vez):
//   npm run encrypt:backfill
// Es seguro repetirlo: lo que ya está cifrado se saltea.
const { validateEnv } = require('../src/config/env');
validateEnv();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { encrypt, isEncrypted } = require('../src/utils/crypto');

const TARGETS = [
  { collection: 'users', fields: ['phone'] },
  { collection: 'appointments', fields: ['guestPhone', 'notes'] },
];

(async () => {
  await connectDB();
  const db = mongoose.connection.db;
  let total = 0;

  for (const { collection, fields } of TARGETS) {
    for await (const doc of db.collection(collection).find({})) {
      const $set = {};
      for (const f of fields) {
        if (typeof doc[f] === 'string' && doc[f] !== '' && !isEncrypted(doc[f])) $set[f] = encrypt(doc[f]);
      }
      if (Object.keys($set).length) {
        await db.collection(collection).updateOne({ _id: doc._id }, { $set });
        total++;
      }
    }
  }

  console.log(`Listo: ${total} documento(s) cifrado(s).`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
