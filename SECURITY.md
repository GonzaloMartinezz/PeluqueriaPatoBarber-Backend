# Seguridad — Pato Barber API

## Qué se sube a GitHub y qué no

| Archivo | ¿Se sube? | Por qué |
|---|---|---|
| `.env` | **Sí, pero cifrado** | Cada valor está cifrado con [dotenvx](https://dotenvx.com) (`encrypted:…`). Sin la clave privada no sirve de nada. |
| `.env.keys` | **NUNCA** | Es la clave privada que descifra `.env`. Ya está en `.gitignore`. |
| `.env.example` | Sí | Plantilla sin valores reales. |
| `.data/` | No | Base de datos local de desarrollo. |
| `node_modules/` | No | Dependencias. |

> **Guardá `.env.keys` en un gestor de contraseñas (Bitwarden, 1Password…).** Si lo perdés no hay forma de
> recuperar el `.env` cifrado, y si lo subís a GitHub todo el cifrado queda inútil.

Antes de cada `git push`:

```bash
npm run secrets:check     # falla si hay algún valor sin cifrar o si .gitignore no protege las claves
```

### Cambiar un valor del `.env`
```bash
npx dotenvx set CLAVE "valor"      # lo guarda ya cifrado
npx dotenvx get ADMIN_PASSWORD     # ver un valor (descifra en tu PC)
```
Si editás `.env` a mano con un valor nuevo, volvé a correr `npx dotenvx encrypt`.

### Publicar el servidor (Render, Railway, Fly, VPS…)
No subas `.env.keys`. En el panel del hosting definí **una sola variable**:

```
DOTENV_PRIVATE_KEY = <el valor que está dentro de .env.keys>
```
y el servidor descifra el `.env` del repositorio al arrancar. Para producción creá además un archivo
`.env.production` cifrado con `NODE_ENV=production`, `CLIENT_URL=https://tu-dominio` y tus valores reales
(`npx dotenvx set NODE_ENV production -f .env.production`).

## Qué está protegido

### Sesión y cuentas
- **Cookie `HttpOnly`** (`pb_session`): el JWT nunca llega al JavaScript de la página ni al `localStorage`,
  así que un XSS no puede robar la sesión. `Secure` en producción, `SameSite=Lax`, vence a los 7 días.
- **CSRF en dos capas**: se valida el header `Origin` y, con sesión, un token `X-CSRF-Token` derivado
  por HMAC de la sesión (un sitio ajeno no puede leerlo). Aplica a todo POST/PUT/PATCH/DELETE.
- **Contraseñas**: bcrypt costo 12, entre 8 y 72 caracteres, se rechazan las más comunes.
- **Sin enumeración de usuarios**: mismo mensaje y mismo tiempo de respuesta si el email no existe o la clave es mala.
- **Fuerza bruta**: 10 intentos fallidos / 15 min por (IP + email), 40 por IP; 15 registros / hora por IP.
- **Google**: se valida `aud`, `iss` y que el email esté verificado.
- **Permisos**: el rol viene siempre de la base de datos, nunca del request; un cliente bloqueado pierde la sesión al instante.

### API
- **Inyección NoSQL**: se rechaza todo body con claves que empiecen con `$` o contengan `.`; los campos se validan como texto.
- **Cabeceras** (helmet): CSP restrictiva, `nosniff`, `no-referrer`, HSTS en producción, sin `X-Powered-By`.
- **CORS** solo para los orígenes de `CLIENT_URL`, con credenciales.
- **Límite de cuerpo** de 50 KB, respuestas con `Cache-Control: no-store`, errores sin detalles internos en producción.
- **Doble reserva** imposible: índice único en la base de datos.
- **El servidor no arranca** si `JWT_SECRET` es corto, falta `ENCRYPTION_KEY`, o (en producción) la URL no es `https` o la clave del admin es débil.

### Frontend
- CSP en el build (`<meta>`) y en `client/public/_headers`: solo scripts propios y de Google.
- Sin token en `localStorage`. Las sesiones viejas se descartan solas.

## Datos cifrados en la base (AES-256-GCM)

| Dato | Cifrado |
|---|---|
| Teléfono del cliente (`users.phone`) | Sí |
| Teléfono de clientes sin cuenta (`appointments.guestPhone`) | Sí |
| Notas del turno (`appointments.notes`) | Sí |
| Contraseña | Hash bcrypt (no se puede descifrar) |
| Nombre, apellido, email | No: se necesitan para ingresar, buscar y ordenar. |

Cada valor usa un IV aleatorio y GCM detecta si alguien lo modificó. La clave es `ENCRYPTION_KEY`
(32 bytes en base64). **Si la perdés, esos datos no se pueden recuperar**; guardala junto a `.env.keys`.
Como el teléfono está cifrado, el buscador de clientes busca solo por nombre y email.

Si ya tenías datos en texto plano, cifralos una vez con:
```bash
npm run encrypt:backfill
```
(es seguro repetirlo).

Además, activá en MongoDB Atlas el cifrado en reposo (viene activado por defecto) y limitá el acceso por IP.

## Si algo se filtró
1. **Contraseña de MongoDB Atlas**: Database Access → editar usuario → nueva contraseña → actualizar `MONGODB_URI`.
2. **`JWT_SECRET`**: cambiarlo cierra todas las sesiones (es lo esperado).
3. **`ENCRYPTION_KEY`**: no se cambia a la ligera, porque los datos ya cifrados dejan de abrirse. Primero descifrá y recifrá con la clave nueva.
4. Sacar el secreto del historial de git (`git filter-repo`) **no alcanza**: asumí que está comprometido y rotalo.

## Checklist antes de publicar
- [ ] `npm run secrets:check` en verde y `.env.keys` fuera del repositorio.
- [ ] `NODE_ENV=production`, `CLIENT_URL=https://…`, `TRUST_PROXY` según tu hosting.
- [ ] Front y API en el **mismo sitio** (ej. `app.tudominio.com` y `api.tudominio.com`) para que la cookie `SameSite=Lax` viaje. Si están en dominios distintos: `COOKIE_SAMESITE=none` (exige https).
- [ ] Cambiaste la contraseña del admin y `GOOGLE_CLIENT_ID` tiene tu dominio autorizado.
- [ ] `npm audit --omit=dev` sin vulnerabilidades altas.
- [ ] En Atlas: usuario con permisos mínimos, acceso solo desde las IP del servidor, backups activos.

## Privacidad y cuentas (Ley 25.326)

- **Consentimiento**: para crear una cuenta hay que aceptar los Términos y la Política de Privacidad. Se guarda cuándo y qué versión (`consentAt`, `consentVersion`; versión actual en `LEGAL_VERSION`, `src/config/constants.js`). Si cambiás los textos, subí esa versión (y la del front en `client/src/lib/legal.js`).
- **Acceso**: `GET /api/auth/me/export` descarga todos los datos de la persona en JSON (botón en *Mi cuenta*).
- **Rectificación**: la persona edita nombre, apellido y teléfono en *Mi cuenta*.
- **Supresión**: `DELETE /api/auth/me` (o *Eliminar datos* en Clientes del panel admin) borra la cuenta; los turnos pasados quedan anónimos (sin nombre, teléfono ni notas) porque forman parte de la contabilidad.
- **Recuperar contraseña**: enlace de un solo uso que vale 30 minutos; solo se guarda su hash. La respuesta es siempre la misma exista o no el email. Requiere SMTP (ver `DEPLOY.md`).
- **Sesiones revocables**: al cambiar o restablecer la contraseña, o con *Cerrar sesión en todos lados*, las sesiones anteriores dejan de valer (`passwordChangedAt` vs. `iat` del JWT).
- **Política de cancelación**: el administrador define las horas mínimas para cancelar online; el servidor la hace cumplir.
- **Mínimo de datos**: no se guardan tarjetas; el mapa de Google y las fuentes no cargan de terceros salvo que la persona pida el mapa.

## Copias de seguridad cifradas

```bash
npm run backup                 # crea backups/pato-barber-AAAA-MM-DD_HH-MM.enc (AES-256-GCM, misma ENCRYPTION_KEY)
npm run restore -- backups/archivo.enc     # restaura (pide confirmación; --yes la omite)
```
`backups/` está en `.gitignore`. Guardá las copias fuera del servidor (Drive, disco externo) y probá restaurar de vez en cuando.
Sin `ENCRYPTION_KEY` una copia no se puede abrir: guardala aparte, junto con `.env.keys`.
