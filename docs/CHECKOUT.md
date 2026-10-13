# Checkout en tres pasos

1. `#/carrito`: revisar referencias, cantidades y subtotal. El envío se calcula en Datos.
2. `#/datos`: nombre, correo, teléfono, Colombia, departamento (32 departamentos + Bogotá D.C.), ciudad, dirección y notas opcionales. Bogotá D.C. fija ciudad Bogotá y usa la tarifa administrable correspondiente. Otras ciudades usan tarifa nacional. Confirmar términos y autorización de tratamiento para gestionar el pedido, separadas y sin publicidad. Crear pedido dirige a Wompi si sandbox está configurado.
3. `#/pago` (retorno de Wompi): estado verificado en servidor, referencia, artículos, cantidades, subtotal, envío, total, ciudad y plazo informado. Aprobado, rechazado, pendiente, error o anulado se distinguen. Sin cobros reales ni reserva de inventario en sandbox.

Los enlaces de términos y privacidad son de Bacatá: `#/condiciones` y `#/privacidad`. No se usan enlaces del comercio de celulares. El plazo inicial es 1 a 5 días hábiles desde confirmación del pedido, actualizando solo valores iniciales conocidos y conservando textos personalizados. Si existen condiciones personalizadas, revisar que Parámetros e Información comercial expresen el mismo compromiso.

## Privacidad y almacenamiento

Contacto/dirección/notas se guardan en `order_customer` dentro de la misma transacción que crea solicitud/pago/destino, y se muestran únicamente en endpoints administrativos autenticados. El token del retorno permite consultar importes/artículos/ciudad, sin nombre, correo, teléfono o dirección. No se agregan datos personales a la URL de Wompi ni a sus firmas públicas.

La aceptación registra fecha, políticas vigentes (snapshot), estado provisional y ausencia de autorización publicitaria. No se mandan correos o mensajes automáticos. Los datos se incluyen en los respaldos privados SQLite existentes.

El borrador de contacto permanece únicamente en memoria durante la navegación entre Carrito y Datos. No se almacena en localStorage/sessionStorage; se pierde al recargar o salir a Wompi. La clave de reintento y el carrito/destino conservan el mecanismo previo. El servidor vincula el intento a los datos del comprador mediante un HMAC, conservando la idempotencia al reintentar y evitando reescribir datos de un intento existente.

## Límites del recorrido

Sandbox sigue siendo la única modalidad de Wompi habilitable. Usar datos ficticios para pruebas mientras las políticas comerciales estén provisionales. La expiración del enlace es de 30 minutos: no es una reserva de stock. El abastecimiento desde proveedor y la asignación de stock requieren su propio mecanismo; no se anuncian reservas inexistentes.

La selección de departamento/ciudad valida la coherencia de Bogotá y la tarifa, pero no acredita una dirección postal real ni consulta un listado de municipios. La confirmación financiera no programa despachos automáticamente.

## Organización

- `public/js/checkout-model.js`: departamentos, campos y validación compartida.
- `public/js/views/checkout.js`: formulario y pasos visuales.
- `src/checkout-customer.js`: persistencia privada, consentimiento y snapshot de entrega.
- `src/wompi.js`: precio/firma/pago, incluye comprador en la transacción de creación.
- `public/js/views/payments.js`: confirmación del estado recibido desde el backend.

Despliegue: backup, git pull, npm test y reinicio de servicio. No hay nuevas dependencias ni cambios en claves o URL de eventos Wompi. Repetir un checkout sandbox aprobado y otro rechazado con datos ficticios; verificar comprador/dirección y desglose en Solicitudes.

Validación: 39 pruebas aprobadas con Node 22.23.3. Navegador: tres pasos, Bogotá/otras ciudades, borrador al volver, consentimientos, checkout externo interceptado, confirmación y lectura privada del comprador/dirección; escritorio y móvil sin desborde ni errores JavaScript. No se hizo una nueva transacción contra la cuenta Wompi del cliente desde este entorno.
