# Legalidad — lista para el dueño de Pato Barber

La web ya incluye **Términos y condiciones**, **Política de privacidad** y **Política de cookies** (`/terminos`, `/privacidad`, `/cookies`), consentimiento al registrarse y herramientas para que los clientes ejerzan sus derechos. Los textos son un **modelo**: no reemplazan el asesoramiento de un abogado o contador.

## Lo que tenés que hacer vos

1. **Cargar los datos legales**: Administración → Configuración → *Datos legales* (nombre o razón social, CUIT/CUIL, domicilio legal, email de contacto). Mientras falten, las páginas legales muestran avisos amarillos «[completar: …]» y el panel muestra un cartel.
2. **Revisar los textos con un abogado o contador** antes de publicar la web.
3. **Registrar la base de datos de clientes ante la AAIP** (Agencia de Acceso a la Información Pública, Registro Nacional de Bases de Datos Personales). Consultá con tu contador/abogado si corresponde en tu caso: argentina.gob.ar/aaip.
4. **Defensa del Consumidor (Ley 24.240)**: tené a la vista en el local el botón/enlace de «Defensa del Consumidor» y de «Baja de servicios» si la normativa de tu jurisdicción lo pide, y la dirección de la oficina de Tucumán.
5. **Definir la política de cancelación** (horas mínimas) en *Datos legales*; los Términos la toman de ahí.
6. **Atender los pedidos de datos**: acceso en 10 días corridos, rectificación/supresión en 5 días hábiles. Casi todo lo hace el cliente solo en *Mi cuenta*; si te escribe por email, usá *Eliminar datos* en Clientes.
7. **Configurar el envío de emails** (ver `DEPLOY.md`) para que funcione «Olvidé mi contraseña».
8. **Hacer copias de seguridad** (`npm run backup`) y guardarlas fuera del servidor.
9. **Facturación**: la web no emite facturas; seguí facturando como corresponda a tu situación fiscal (monotributo/responsable inscripto).

## Qué guarda el sistema

Nombre, apellido, email, teléfono (cifrado), contraseña (hash), turnos (con notas cifradas), fecha de consentimiento. No guarda tarjetas ni usa cookies de publicidad: solo una cookie de sesión necesaria.

## Cuando cambies los textos

Subí `LEGAL_VERSION` en el backend (`src/config/constants.js`) y en el front (`client/src/lib/legal.js`) y la fecha `LEGAL_DATE`.
