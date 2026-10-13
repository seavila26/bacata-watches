# Gestión comercial y entrega de pedidos

Centro de control > Solicitudes separa tres conceptos: revisión interna (pendiente/revisada/archivada), pago verificado por Wompi y etapa de gestión comercial.

Etapas: Por confirmar → Confirmado → En preparación → Enviado → Entregado. Solo se permite avanzar una etapa a la vez. La primera confirmación marca la revisión pendiente como revisada, sin tocar notas privadas ni pago. Para avanzar se exige pago APPROVED, comprador con dirección registrada y solicitud no archivada. Esto no confirma disponibilidad del proveedor automáticamente: el administrador debe verificarla antes de confirmar comercialmente el pedido.

Transportadora y número de guía son obligatorios al registrar envío o entrega. La nota explica cualquier cambio de etapa o corrección de guía/transportadora. Las fechas de envío y entrega son las del registro administrativo, no eventos consultados a la transportadora. No se compran etiquetas ni se ordenan despachos desde esta sección.

Los pedidos sandbox exigen marcar expresamente la simulación para guardar una gestión. El historial distingue todas sus operaciones como pruebas. Ningún cambio administrativo convierte un pago sandbox en venta real ni marca pagos manualmente como aprobados.

Cada movimiento conserva etapa previa/nueva, operador, nota, guía y fecha en `order_fulfillment_history`, además de la auditoría general. Se muestran los últimos 100 movimientos por pedido con total explícito; se conservan los anteriores en SQLite. Un cambio de nota sin cambio de etapa también queda registrado. Guardar un formulario sin cambios no crea movimientos.

Revisión interna y gestión usan la misma versión del pedido: una edición en otra sesión requiere reabrir antes de guardar. La operación completa es transaccional. No cambia artículos, subtotal, flete, total, datos del comprador o estado Wompi. Una anulación financiera posterior no borra el historial de gestión; debe revisarse operativamente. No se emiten reembolsos desde este flujo.

Se agrega filtrado por gestión y estado de pago y búsqueda por transportadora/guía. Los filtros conservan la paginación del servidor. Las solicitudes anteriores se mantienen y parten como Por confirmar; no se inventan datos de transporte o hitos pasados. Las que no tienen comprador/pago no pueden avanzar.

Endpoint privado PATCH `/api/admin/orders/:id/fulfillment` exige sesión, origen autorizado y campos permitidos. Transportadora, guía y notas son texto plano escapado en la interfaz. No se añaden URLs externas de seguimiento o consultas a proveedores. No se envían mensajes automáticos. Los campos/historial están incluidos en el respaldo SQLite existente.

Despliegue: backup, git pull, npm test y reinicio del servicio. Sin nuevas dependencias ni cambios a las claves Wompi. Probar con pedido sandbox aprobado: confirmar, preparar, registrar guía y envío, entregar; comprobar historial. Rechazados y pendientes deben impedir el avance.

Validación: 40 pruebas aprobadas con Node 22.23.3. Navegador: confirmar, preparar, registrar transportadora/guía, enviar, entregar, historial, pago intacto y filtros combinados. Escritorio/móvil sin desborde; referencias y datos largos se ajustan. Recorrido local con checkout externo interceptado y aprobación sandbox controlada, sin crear despachos externos.
