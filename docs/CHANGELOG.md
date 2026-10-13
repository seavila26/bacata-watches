# Cambios · flujo simplificado

- Importación de base en crudo con vista previa y cálculos globales privados.
- Plantilla técnica de 16 columnas exportable desde selecciones y filtros de todas las páginas.
- Importación de fichas con actualización no destructiva y publicación automática.
- Publicaciones con pausas, reactivaciones, confirmación a 72 horas y exportación.
- Condiciones globales, disponibilidad sin unidades y API pública con campos explícitos.
- Migración preservando fichas, imágenes, precios aprobados, pedidos e historial.
- Retirados enriquecimiento web, IA, catálogo JSON, plantillas comerciales y sincronización CSV.

## Corrección del panel de publicaciones

- Estado administrativo y visibilidad pública usan los mismos requisitos.
- Reparación de fechas ausentes en fichas publicadas al iniciar o importar.
- Publicaciones heredadas incompletas se pausan con el motivo, conservando contenido y fotografías.
- 19 pruebas aprobadas, incluyendo seis estados heredados con una sola ficha visible.

## Experiencia visual y administración · 11 octubre 2026

- Modos claro y oscuro con preferencia persistente y logo original sin invertir.
- Resumen operativo con estados efectivos, prioridad de revisión y accesos a cuatro etapas.
- Navegación administrativa lateral en escritorio y horizontal en móvil, rutas por sección y teclado.
- Filtros removibles, orden por precio/marca y búsqueda por movimiento en el catálogo; filtros y orden en la URL.
- Transiciones sutiles, movimiento reducido, áreas de selección de 44 px y fechas legibles en Bogotá.
- Confirmación de vigencia visible en referencias activas, acceso a publicaciones después de importar fichas y mejor separación de formularios.
- Sin cambios de backend, dependencias, inventarios ni fórmula. Validación descrita en `QA-EXPERIENCIA.md`.

## Encabezado compacto · 12 octubre 2026

- Barra superior de aproximadamente 82 px en escritorio y 75 px en móvil, en lugar del encabezado alto con logo de 180 px.
- Navegación y acciones en una sola fila, conservando áreas táctiles de al menos 44 px.
- Logo original contenido sin recortar; márgenes del modo oscuro ajustados a la barra.
- Posición fija del menú administrativo alineada con la nueva altura.

## Preparación operativa · 13 octubre 2026

- Override de uuid 11.1.1 para ExcelJS; conservadas versión y funciones de importación.
- Copias SQLite conscientes del WAL, fotografías locales, SHA-256, integridad y conteos.
- Retención de 14 copias verificadas, rutas privadas y comprobación de imágenes referenciadas.
- Servicio y timer diarios a las 03:00 de Bogotá, con registro de fallos y bloqueo de concurrencia.
- Pruebas de recuperación, foto ausente, alteración de archivos, rotación y formato condicional extendido.
- 25 pruebas aprobadas y auditoría de dependencias sin vulnerabilidades conocidas al comprobar esta entrega. Configuración externa del respaldo pendiente; instrucciones en `RESPALDOS.md`.

## Seguridad de administración y cargas · 13 octubre 2026

- Limitación de intentos, scrypt asíncrono y sesiones con vencimiento absoluto e inactividad.
- Cookies malformadas rechazadas, rotación al ingresar y revocación al salir.
- JSON/base64 estrictos, límites por bytes y protección de origen.
- XLSX revisado al descomprimir y procesado en un worker con recursos acotados.
- Fotografías nuevas decodificadas, limitadas y normalizadas a WebP; imágenes existentes conservadas.
- Dirección local de escucha e IP real solo desde proxy de loopback configurado.
- 32 pruebas y auditoría sin vulnerabilidades conocidas al comprobar la entrega; actualización descrita en `SEGURIDAD.md`.

## Versiones anteriores

v0.3 incorporó el diseño Bacatá y la organización del frontend. v0.4 incorporó importación XLSX y editor persistente. v0.5 incorporó un flujo de preparación de catálogo que esta versión reemplaza por completo.

## Contacto y garantía — 2026-10-13

- WhatsApp con consulta por referencia y cobertura Colombia.
- Página de garantía conectada desde fichas, contacto y pie; distingue cobertura del proveedor y derechos en Colombia.
- Identificación legal y condiciones de venta siguen pendientes; no se habilitan cobros.

## Información comercial administrable — 2026-10-13

- Sección privada para editar contacto, identidad legal, envíos, garantía, cambios y privacidad.
- Persistencia SQLite, auditoría, validación y lectura pública; textos provisionales iniciales sin identificaciones ficticias.
- Las condiciones públicas usan los valores guardados; guardar no altera rentabilidad ni publicaciones.

## Seguimiento de solicitudes — 2026-10-13

- Listado completo paginado con filtros y detalle de artículos/precios históricos.
- Estados internos y notas privadas auditadas, con control de concurrencia.
- Conserva las solicitudes existentes; no habilita pagos, reservas ni envíos.
