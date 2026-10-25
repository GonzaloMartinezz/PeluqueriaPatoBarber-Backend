const path = require('path');
const mongoose = require('mongoose');

// En desarrollo, si no hay un MongoDB corriendo, se levanta uno embebido que
// guarda sus datos en ./.data (mongodb-memory-server). En producción nunca.
async function startEmbedded() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const fs = require('fs');
  const dbPath = path.join(__dirname, '../../.data/mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  const server = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger', port: 27018 },
  });
  return server.getUri('peluqueria_pato_barber');
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`Error de base de datos: ${error.message}`);
      process.exit(1);
    }
    console.warn(`No se pudo conectar a ${uri}. Usando MongoDB embebido (datos en .data/mongo)...`);
    const conn = await mongoose.connect(await startEmbedded());
    console.log(`MongoDB embebido listo: ${conn.connection.host}`);
  }
};

module.exports = connectDB;
