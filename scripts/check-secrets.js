// Antes de subir a GitHub: verifica que .env esté cifrado y que ninguna clave privada vaya a viajar.
//   npm run secrets:check
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const problems = [];

const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  problems.push('No existe .env');
} else {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (key === 'DOTENV_PUBLIC_KEY' || value === '') continue; // la clave pública no es secreta
    if (!value.startsWith('encrypted:')) problems.push(`.env tiene "${key}" SIN cifrar → corré: npx dotenvx encrypt`);
  }
}

const gitignore = fs.existsSync(path.join(root, '.gitignore')) ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
for (const must of ['.env.keys', 'node_modules', '.data']) {
  if (!gitignore.split(/\r?\n/).some((l) => l.trim() === must)) problems.push(`.gitignore no ignora ${must}`);
}

if (problems.length) {
  console.error('✖ No subas todavía:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('✔ .env cifrado, .env.keys ignorado. Es seguro hacer commit.');
