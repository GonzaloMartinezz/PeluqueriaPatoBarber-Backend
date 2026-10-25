const { validateEnv } = require('./config/env');

validateEnv();

const app = require('./app');
const connectDB = require('./config/db');
const seed = require('./config/seed');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await seed();
  app.listen(PORT, () => {
    console.log(`API Pato Barber en http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
