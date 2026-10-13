# Datos comerciales y garantía

Marca conservada según el manual: Relojería Bacatá. WhatsApp confirmado: +57 324 687 1623. Cobertura: Colombia. Datos editables desde Información comercial del centro de control; valores iniciales en `public/js/commercial-model.js` y presentación en `public/js/views/store.js`.

La ruta `#/garantia` diferencia la garantía limitada de Jomashop y la garantía legal frente al vendedor colombiano. No asigna cinco años a todas las referencias ni cambia el campo global de garantía de la base de datos. Antes de una venta, documentar responsable, plazo aplicable, inicio y comprobante por referencia.

El texto recibido de exclusiones y fletes no se traslada como renuncia a derechos legales. Reparación y transporte necesarios son gratuitos cuando procede garantía legal. No se excluye automáticamente toda reclamación por humedad o intervención de terceros: debe evaluarse el origen de la falla. Jomashop contempla excepciones de garantía del fabricante.

Pendientes: identidad legal del vendedor, NIT, dirección de notificación, correo electrónico, plazo/costo de entrega, condiciones de cambios/retracto/devoluciones, privacidad y pasarela. No publicar datos inventados ni indicar que NIT y correo no aplican. La tienda conserva solicitudes de prueba sin cobros ni reservas.

Fuentes revisadas el 13 de octubre de 2026:
- https://help.jomashop.com/hc/en-us/articles/11923055034139-Do-you-give-a-warranty-with-the-watch
- https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306 (Ley 1480, artículos 11, 16 y 50).
- https://sedeelectronica.sic.gov.co/temas/proteccion-al-consumidor/derechos-y-deberes/fallas-en-un-producto

## Edición desde el centro de control

Abrir `#/admin/comercial`. La sección Información comercial permite editar nombre comercial y vendedor legal, NIT, dirección, correo, WhatsApp, cobertura, plazos/costos de envío, garantía, cambios/retracto y privacidad. Los valores iniciales son provisionales y los identificadores desconocidos quedan vacíos.

Los textos se almacenan en la tabla `commercial_profile` de SQLite y quedan incluidos en los respaldos existentes. Cada guardado registra antes/después en la auditoría. El endpoint público `/api/commercial` entrega exclusivamente estos datos comerciales. La escritura exige sesión administrativa y validación de origen. Se renderiza texto plano escapado, conservando saltos de línea.

El aviso provisional solo puede retirarse cuando se completan los datos de identificación y contacto. Esto no certifica cumplimiento jurídico ni activa pagos. Los textos comunes de esta sección no cambian los parámetros financieros, márgenes ni estados de publicación. Los plazos/garantía globales de las fichas siguen gestionándose en Parámetros; la garantía específica por referencia requiere documentación.

Actualización en producción: ejecutar `npm run backup`, `git pull --ff-only`, `npm test` y `sudo systemctl restart bacata`. No hay dependencias nuevas. La tabla se crea automáticamente sin reemplazar los datos del catálogo.

Validación: 34 pruebas aprobadas con Node 22.23.3. Navegador: login, edición, persistencia tras recarga, consulta pública, enlace WhatsApp por referencia y privacidad. Revisado en escritorio 1440 px y móvil 390 px, sin desbordamiento horizontal ni errores JavaScript.
