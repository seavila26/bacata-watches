# Verificación de experiencia · 11 octubre 2026

Base: `main` en `6bc9721`. Cambios limitados al frontend, pruebas y documentación. No hay cambios de esquema, API, costos, datos de producción ni dependencias.

## Pruebas automatizadas

`npm test`: 21 pruebas aprobadas. Las 19 anteriores cubren importaciones, conservación de datos, publicación, vigencia de 72 horas, privacidad pública y migración. Las dos nuevas comprueban conteos por estado efectivo (una publicación vencida no cuenta como activa), prioridad de confirmación, búsqueda por movimiento, orden por precio sin mutar el catálogo y escape de filtros removibles.

## Navegador

Chromium mediante Playwright, servidor local y SQLite temporal independiente. Datos de prueba: 55 referencias, cuatro fichas técnicas completas. Las imágenes de tarjetas se interceptaron exclusivamente en la sesión de QA con una ilustración marcada DEMO; no se añadieron esas imágenes ni fichas a los activos o datos de la tienda. La imagen del hero continúa siendo el concepto de marca existente.

- Modo claro inicial, cambio a oscuro y persistencia tras recargar.
- Catálogo: búsqueda, eliminación de filtro, orden y conservación del orden al recargar; foco en búsqueda y selector.
- Cliente: detalle, añadir a bolsa, acceso desde confirmación, aceptación de condiciones y solicitud de prueba sin pago.
- Administrador: ingreso, conteos, accesos a filtros, navegación por flechas y foco; exportación XLSX desde selección.
- Publicaciones: pausa de una referencia, reducción de catálogo y contador, filtro de pausadas desde resumen, reactivación y vuelta a cuatro piezas.
- Importar fichas: selección del archivo, vista previa sin mutación, guardado y acceso a Publicaciones.
- Importar base: carga XLSX y vista previa sin mutación del catálogo.
- 70 comprobaciones de diseño: siete rutas (inicio, catálogo y cinco vistas administrativas) × dos temas × cinco anchos (320, 375, 768, 1024 y 1440 px). Sin desbordamiento horizontal de página. Las tablas y navegación móvil conservan su desplazamiento interno.
- `prefers-reduced-motion`: sin animación de entrada y contenido visible. Sin errores JavaScript en los recorridos comprobados.

Las capturas en `previews/experience/` muestran datos de prueba, no inventario ni ofertas reales. Se revisaron visualmente las versiones de escritorio y móvil en ambos temas.

## Revisión manual adicional antes de producción

Validar el resultado con las fotografías autorizadas definitivas y las referencias reales. Revisar Safari/iOS y lector de pantalla: esta sesión comprobó Chromium y teclado, no una certificación completa de accesibilidad. Las condiciones comerciales y la pasarela siguen pendientes del alcance de producción.
