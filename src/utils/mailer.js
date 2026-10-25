const nodemailer = require('nodemailer');

// Envío de emails (recuperar contraseña). Se configura con SMTP_* en el .env; si no está configurado,
// no se envía nada y la app sigue funcionando (ver DEPLOY.md para activar uno gratis).
const configured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter;
function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (!configured()) return false;
  await getTransporter().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
  return true;
}

module.exports = { sendMail, mailConfigured: configured };
