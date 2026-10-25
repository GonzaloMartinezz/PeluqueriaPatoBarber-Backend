# Publicar Pato Barber

## Piezas
- **Base de datos**: MongoDB Atlas (activá las copias automáticas del cluster si tu plan lo permite).
- **API** (esta carpeta): Render, Railway, Fly.io o un VPS. Comando: `npm start`.
- **Front** (`PeluqueriaPatoBarber/client`): Vercel, Netlify o Cloudflare Pages. `npm run build` → carpeta `dist`.

## Variables de la API
Definí en el hosting:

| Variable | Valor |
|---|---|
| `DOTENV_PRIVATE_KEY` | contenido de `.env.keys` (descifra el `.env` del repo) |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | `https://tu-dominio` (varias, separadas por coma) |

Y dentro del `.env`/`.env.production` cifrado: `MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, y el correo (abajo). Guardá `ENCRYPTION_KEY` y `.env.keys` en un gestor de contraseñas: sin ellas no se recuperan los datos.

## Cookies y HTTPS
La sesión usa cookie `HttpOnly` + `Secure` + `SameSite=Lax`. Para que funcione, el front y la API deben estar en el **mismo sitio** (por ejemplo `https://patobarber.com` y `https://api.patobarber.com`) y con HTTPS. En el front configurá la URL de la API (`VITE_API_URL` o el proxy/rewrite de tu hosting) hacia `https://api…/api`. Agregá el dominio final en Google Cloud → Credenciales → *Orígenes autorizados* del Client ID.

## Emails (recuperar contraseña)
Cualquier SMTP sirve (Brevo gratis, Gmail con *contraseña de aplicación*, Resend SMTP…):

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=tu-usuario
SMTP_PASS=tu-clave          # guardala con: npx dotenvx set SMTP_PASS "..."
MAIL_FROM="Pato Barber <no-responder@tu-dominio>"
```
Sin esto la web funciona igual, pero «Olvidé mi contraseña» no envía el mensaje.

## Antes de publicar
```bash
npm run secrets:check          # nada sin cifrar, .env.keys ignorado
npm run backup                 # copia cifrada de la base
```
Luego completá los *Datos legales* en el panel (ver `LEGAL.md`).

## Rutina
- Semanal: `npm run backup` y guardá el archivo fuera del servidor.
- Actualizá dependencias con `npm audit` / `npm update` de vez en cuando.
- Si sospechás que se filtró una clave: cambiá `JWT_SECRET` (cierra todas las sesiones) y la contraseña del admin.
