# Relojería Bacatá · inventario y publicaciones

Node.js 22.13+ · SQLite integrado en Node · ExcelJS.

## Iniciar

1. Ejecuta `npm ci`.
2. Copia `.env.example` a `.env`. Configura `ADMIN_EMAIL`, `ADMIN_PASSWORD` (16 caracteres como mínimo), `SESSION_SECRET` (32 como mínimo) y `APP_ORIGIN`.
3. Ejecuta `npm start` y abre `http://localhost:3000/#/admin`.

Para desarrollo: `npm run dev`. La base es `data/aurel.sqlite`; se puede cambiar con `DB_PATH`. Una instalación nueva inicia sin productos ficticios. `SEED_DEMO=true` permite crear borradores de prueba.

## Flujo

1. **Importar base en crudo:** analiza el XLSX del proveedor con las hojas Base comparada / Base lujo y Supuestos. Revisa filtros, costos y margen; guarda la selección. Analizar no modifica productos.
2. **Exportar plantilla de fichas:** desde el análisis o desde Oportunidades. La selección comprende todas las páginas; sin selección se exportan los resultados del filtro. La hoja `catalogo` contiene exactamente 16 columnas técnicas, sin precios ni costos.
3. **Importar fichas y publicar:** sube la plantilla completada, revisa y guarda. Los vacíos conservan datos existentes; no se alteran nombre, descripción, precios ni costos. Las fichas completas, con comparable válido y margen suficiente, se publican automáticamente. El resumen permite descargar pendientes con motivo.
4. **Publicaciones:** filtra, busca, ordena y exporta; pausa, reactiva o confirma referencias individualmente o en masa. El editor individual conserva la edición manual y subida de fotografías.

Costos, márgenes y enlaces del proveedor son privados. Administración configura tasa de cambio, importación e impuestos, comisión, colchón logístico, descuento, margen mínimo, entrega, garantía y envío. Las fichas publicadas se muestran como **Disponible**, sin unidades de existencias.

Después de más de 72 horas sin confirmación, una publicación aparece como **Requiere confirmación** y desaparece de la tienda. Una nueva carga guardada confirma las referencias procesadas; también existe **Confirmar y mantener activa**. Si una recarga reduce el margen por debajo del mínimo, la publicación se pausa. Las pausas manuales se conservan hasta reactivar.

## Actualizar una instalación existente

1. Detén el servidor y respalda `data`, `.env` y `public/uploads`.
2. Actualiza el repositorio con `git pull --ff-only`; conserva los archivos de datos y las imágenes subidas.
3. Ejecuta `npm ci` y `npm start`.
4. La migración transaccional conserva productos, contenido técnico, fotos, precios aprobados, pedidos e historial; retira el esquema del flujo reemplazado.
5. Revisa los parámetros globales en Administración. Se aplican a todas las referencias; los antiguos supuestos financieros por archivo ya no deciden la rentabilidad.
6. Pulsa Ctrl+F5 en el navegador.

## Pruebas

- `npm test`: reglas, importaciones, exportaciones, migración, vistas administrativas y flujo HTTP real con base temporal.
- `npm run test:inventory -- "ruta/al/inventario.xlsx"`: analiza y guarda un archivo real en una base temporal, sin tocar la tienda.
- `npm run demo:inventory`: genera dos XLSX con cuatro referencias ficticias para recorrer el flujo. Instrucciones y resultados esperados en [docs/INVENTARIO.md](docs/INVENTARIO.md).

## Documentación

- [Inventario y prueba con cuatro referencias](docs/INVENTARIO.md).
- [Mapa del frontend](docs/FRONTEND.md).
- [Validación y límites](docs/QA.md).
- [Cambios](docs/CHANGELOG.md).

La pasarela de pagos continúa pendiente. La bolsa crea solicitudes de prueba sin cobro ni reserva. Configura contactos y textos comerciales antes de operar. Sesiones, vistas previas y enlaces temporales de descarga se pierden al reiniciar el servidor. Conserva la base y las fotos en disco persistente y respalda ambas.
