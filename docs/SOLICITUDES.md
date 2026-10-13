# Seguimiento de solicitudes

Centro de control > Solicitudes (`#/admin/pedidos`) muestra todas las solicitudes mediante paginación de 25 registros, búsqueda por identificador/referencia/pieza y filtro por estado. Los contadores cubren todos los registros, independientemente del filtro activo.

El detalle conserva los artículos, cantidades, precios al crear la solicitud y total. Los cambios posteriores del catálogo no reescriben esos importes. No se recolectan datos de contacto o dirección en estas solicitudes de prueba.

Estados internos: Pendiente de revisión, Revisada y Archivada. Revisar o archivar no acredita pago, no reserva inventario y no genera despacho. Archivar conserva los datos. No se permite registrar estados de pago desde esta sección.

Las notas son privadas. Cambios de estado/notas quedan auditados y se controla la versión del registro para evitar sobrescribir la revisión de otra sesión. Ante conflicto, volver a abrir la solicitud.

La actualización agrega `admin_note`, `version` y `updated_at` a la tabla existente `orders`, sin sustituir solicitudes anteriores ni cambiar precios/publicaciones. Los respaldos SQLite incluyen estos campos.

Endpoints administrativos protegidos por sesión: GET `/api/admin/orders` (`q`, `status`, `page`), GET y PATCH `/api/admin/orders/:id`. La escritura comprueba origen y campos permitidos. No hay acceso público a notas ni detalle de solicitudes.

Despliegue: respaldo, git pull, npm test y reinicio de bacata. Sin dependencias nuevas. La integración de pasarela y los pedidos reales con contacto/dirección siguen pendientes.

Validación: 35 pruebas aprobadas en Node 22.23.3, incluida conservación de registros previos, paginación de 61 solicitudes, filtros, autenticación y conflictos de revisión. Navegador: detalle, guardado de nota/estado, paginación, filtros/estados vacíos, navegación por teclado y presentación móvil sin desborde de página.
