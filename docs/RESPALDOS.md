# Respaldos y actualización de producción

## Qué incluye

`npm run backup` genera una copia consistente de `DB_PATH` mediante `VACUUM INTO`, incluyendo transacciones confirmadas del WAL. No copia por separado archivos WAL/SHM ni modifica la base de origen. Copia `public/uploads`, revisa integridad, claves foráneas y la existencia de imágenes locales referenciadas, y guarda un manifiesto con conteos, tamaño y SHA-256. No incluye `.env`, contraseñas, sesiones ni configuración de Nginx. Las fotografías enlazadas a sitios externos no se descargan ni quedan protegidas por este respaldo.

Solo las copias verificadas pasan de una carpeta `.partial` a `bacata-...`. Si falta una fotografía referenciada, el proceso falla y conserva los respaldos anteriores. Los errores salen con código distinto de cero para que systemd los registre. Fotografías creadas por la aplicación son inmutables; evitar modificar o borrar archivos de uploads manualmente durante el respaldo.

Directorio por defecto: `/home/deploy/bacata-backups` cuando se ejecuta desde `/home/deploy/bacata-app`. Es privado (700); base, fotos y manifiesto tienen permisos 600. `BACKUP_DIR` puede definir otra ruta fuera de los datos de origen y del directorio público. `BACKUP_KEEP` conserva las últimas 14 copias completas por defecto; una ejecución manual también cuenta. La rotación no elimina archivos ni directorios ajenos a esta herramienta.

## Primera copia y actualización

Ejecutar como `deploy`, desde el proyecto, después de comprobar que no hay cambios propios en archivos versionados:

```bash
cd /home/deploy/bacata-app
git status --short
git pull --ff-only
npm run backup
```

Antes de actualizar dependencias, el resultado debe mostrar `integrity: ok`, 159 productos (el corte trasladado), y una fotografía física. El total puede cambiar si ya se modificó el catálogo. Anotar la ruta devuelta.

```bash
sudo systemctl stop bacata
npm ci
npm test
npm audit --omit=dev
sudo systemctl start bacata
curl -I https://relojeriabacata.store
```

Continuar únicamente si cada comando termina correctamente. Si la instalación o las pruebas fallan, conservar el error y los datos, y aplicar la reversión documentada abajo. No usar `npm audit fix --force`.

## Activar horario diario

```bash
install -d -m 700 /home/deploy/bacata-backups
sudo install -m 644 deploy/bacata-backup.service /etc/systemd/system/bacata-backup.service
sudo install -m 644 deploy/bacata-backup.timer /etc/systemd/system/bacata-backup.timer
sudo systemctl daemon-reload
sudo systemctl start bacata-backup.service
sudo systemctl enable --now bacata-backup.timer
sudo systemctl list-timers bacata-backup.timer --all --no-pager
sudo journalctl -u bacata-backup.service -n 30 --no-pager
```

El timer ejecuta el respaldo a las 03:00 de America/Bogota, con hasta cinco minutos de variación. `Persistent=true` recupera una ejecución pendiente tras un apagado. `flock` impide dos ejecuciones simultáneas del servicio. No reinicia ni detiene la tienda. Comprobar registros: un timer activo no garantiza que los respaldos estén pasando. Si una ejecución es cancelada a la fuerza puede quedar una carpeta `.partial` que no se considera válida ni se rota automáticamente.

## Verificar y ensayar recuperación

Usar la ruta real devuelta por el respaldo; no escribir literalmente el ejemplo:

```bash
npm run backup:verify -- /home/deploy/bacata-backups/bacata-FECHA-ID
```

Para ensayar sin tocar producción, copiar todo el respaldo a una carpeta temporal y verificar esa copia:

```bash
bacata_restore_test=$(mktemp -d /home/deploy/bacata-restore-test-XXXXXX)
cp -a /RUTA/DEL/RESPALDO/. "$bacata_restore_test/"
npm run backup:verify -- "$bacata_restore_test"
```

Una restauración real necesita detener `bacata`, respaldar los datos actuales, apartar SQLite/WAL/SHM existentes, instalar la base con permisos 600 y copiar la carpeta uploads completa. Después iniciar y comprobar conteos, catálogo y fotos. No abrir la base de producción para probar una restauración.

## Reversión de esta actualización

La base no cambia de esquema con esta entrega. El commit anterior a respaldos es `3a26cb9`; si instalación/pruebas fallan y es necesario volver temporalmente a él:

```bash
sudo systemctl stop bacata
git switch --detach 3a26cb9
npm ci
sudo systemctl start bacata
curl -I https://relojeriabacata.store
```

Los datos y `.env` están ignorados por Git y deben conservarse. Para retomar la actualización después de corregir el problema, volver a `design/bacata-experience`.

## Copia externa pendiente

Estos archivos están en el mismo Droplet. Protegen frente a errores de datos y permiten restaurar, pero no cubren pérdida total del servidor. Completar con un destino externo privado, retención y prueba de descarga/restauración antes del lanzamiento comercial. La elección del almacenamiento y sus credenciales se configura aparte. No se implementa una transferencia externa ficticia ni se incluyen claves en el repositorio.

## Dependencia corregida

ExcelJS 4.4.0 usa `uuid` mediante CommonJS. El override está limitado a ExcelJS y fija `uuid` 11.1.1, versión parcheada de GHSA-w5hq-g745-h8pq que conserva CommonJS. No se baja ExcelJS. El lockfile registra el cambio. La prueba de formato condicional extendido y los recorridos de importación/exportación verifican compatibilidad.
