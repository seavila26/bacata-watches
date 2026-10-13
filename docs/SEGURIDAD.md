# Revisión de seguridad · 13 octubre 2026

## Correcciones implementadas

- Login: 10 intentos por dirección en 15 minutos, con respuesta 429 y Retry-After. Las credenciales válidas limpian el contador de esa dirección. Hay además un límite global de 60 intentos por minuto y un máximo de dos verificaciones simultáneas. La derivación de contraseña usa scrypt asíncrono, para conservar disponible el proceso HTTP. Los límites son en memoria y se reinician con el servicio.
- Sesiones: cookie HttpOnly, SameSite=Strict, Secure cuando APP_ORIGIN es HTTPS, Path=/ y sin Domain. Firma hexagonal estricta y comparación en tiempo constante; una cookie malformada no provoca excepciones. Vencimiento absoluto a ocho horas e inactividad a una hora; limpieza periódica y capacidad máxima de 100 sesiones. Nuevo ingreso revoca la sesión anterior de ese navegador y logout la invalida. Reiniciar el servicio requiere volver a ingresar.
- Origen y cuerpos: rechaza Origin diferente al configurado y Sec-Fetch-Site cross-site. Operaciones JSON exigen application/json y un objeto. Límites por bytes, incluyendo UTF-8 y solicitudes fragmentadas; base64 validado estrictamente. No se habilitan CORS ni credenciales para otros orígenes. Clientes de servidor sin Origin siguen admitidos si cumplen las demás validaciones.
- Solicitudes de prueba: máximo de 20 por dirección en diez minutos y 120 globales por minuto, para limitar creación anónima de registros. Los precios siguen calculándose en el servidor. No hay cobros ni reservas.
- Excel: máximo comprimido de 15 MiB; ZIP validado antes de ExcelJS, con máximo de 2.000 entradas, 20 MiB por entrada y 64 MiB descomprimidos. Se verifica la lectura real de cada entrada, sin confiar solo en sus tamaños declarados. Se rechazan cifrado, macros, enlaces simbólicos, nombres duplicados y declaraciones XML DOCTYPE/ENTITY. El procesamiento se realiza en un worker con límite de heap de 256 MiB, 30 segundos y una carga simultánea. Límite de 32 hojas, 10.005 filas y 200 columnas por hoja; continúan las restricciones de cada plantilla.
- Fotos: entrada máxima de 5 MiB y 24 millones de píxeles. Solo PNG/JPEG/WebP estáticos. Se revisa la firma y se decodifica la imagen completa; firmas falsas y archivos truncados se rechazan. Fotografías nuevas se orientan y reescriben a WebP, máximo de 2.400 px por lado, sin metadatos originales. Nombres aleatorios, sin sobrescritura y permisos privados. Una conversión simultánea y timeout de 15 segundos. Fotografías existentes se conservan.
- Servidor: escucha en 127.0.0.1 por defecto, detrás de Nginx. No sirve .env, SQLite o respaldos. API privada continúa autenticada y la API pública conserva su allowlist. No se devuelven rutas internas ni trazas; los registros generales no incluyen el cuerpo, las contraseñas ni las cookies.
- Respuestas: nosniff y Referrer-Policy para todas las rutas; HSTS de 180 días cuando APP_ORIGIN es HTTPS. No se habilita preload ni se fuerza HSTS en subdominios futuros. CSP existente se conserva.

## IP real en este servidor

Nginx ya reenvía X-Real-IP usando $remote_addr. Para que cada visitante tenga su propio contador, añadir a `/home/deploy/bacata-app/.env`:

```dotenv
HOST=127.0.0.1
TRUST_PROXY=loopback
```

Solo se acepta X-Real-IP si la conexión viene de 127.0.0.1 o ::1 y TRUST_PROXY=loopback. No se confía en X-Forwarded-For ni en valores enviados desde otras direcciones. En uso local directo, dejar TRUST_PROXY=none. Si en el futuro se agrega CDN o un proxy adicional, revisar esa cadena antes de cambiar confianza.

## Actualizar producción

Primero generar el respaldo local, descargar el commit y modificar las dos variables anteriores. No cambiar las credenciales ni el dominio ya configurados. Antes de detener el servicio, comprobar que la copia pasó integridad y sus conteos son los esperados:

```bash
cd /home/deploy/bacata-app
npm run backup
git pull --ff-only
nano .env
```

Después, un comando a la vez, detenerse si alguno falla:

```bash
sudo systemctl stop bacata
npm ci
npm test
npm audit --omit=dev
sudo systemctl start bacata
sudo systemctl status bacata --no-pager
curl -I https://relojeriabacata.store
```

Verificar ingreso, consulta de oportunidades, carga de Excel y fotografía nueva desde el navegador. Las dependencias sharp y yauzl están en el lockfile; sharp utiliza un binario precompilado compatible con Node.js 22 y Ubuntu amd64. No ejecutar npm audit fix --force. Si falla instalación o prueba, conservar los datos y volver temporalmente a `9ad0dc0` con `git switch --detach 9ad0dc0`, `npm ci` y reiniciar. Esto conserva datos ignorados por Git. Volver a design/bacata-experience para retomar la actualización.

## Evidencia y alcance

32 pruebas en Node.js 22.23.3: recorrido completo del catálogo, privacidad pública, backup y restauración, cookies falsas, rotación, logout, expiración con reloj controlado, bloqueo por dirección, IP reenviada, solicitudes fragmentadas/UTF-8, JSON/base64 inválido, rechazo de ZIP expandido y DTD, worker concurrente, fotos dañadas o excesivas, normalización y carga HTTP real. La auditoría de dependencias no reportó vulnerabilidades conocidas al comprobar esta entrega.

Se usaron servidores y SQLite temporales; no se hicieron ataques ni modificaciones en el sitio de producción. Estas pruebas son controles específicos y no una certificación ni una prueba de penetración completa. MFA, alertas externas, protección de infraestructura ante DDoS, respaldo fuera del Droplet y pagos permanecen fuera de esta entrega.
