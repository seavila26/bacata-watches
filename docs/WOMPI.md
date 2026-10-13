# Wompi: etapa sandbox

Esta entrega integra exclusivamente pruebas. Por defecto `WOMPI_MODE=disabled`; la tienda mantiene sus solicitudes de demostración. El modo `sandbox` exige las cuatro claves de prueba del mismo comercio. Las claves de producción y `WOMPI_MODE=production` se rechazan: no se habilitan cobros reales con esta entrega.

## Configuración en el servidor

Obtener en el dashboard de comercios Wompi de Bacatá las claves del ambiente Sandbox. Editar `/home/deploy/bacata-app/.env` directamente en el servidor:

```dotenv
WOMPI_MODE=sandbox
WOMPI_PUBLIC_KEY=pub_test_VALOR_DEL_DASHBOARD
WOMPI_PRIVATE_KEY=prv_test_VALOR_DEL_DASHBOARD
WOMPI_INTEGRITY_SECRET=test_integrity_VALOR_DEL_DASHBOARD
WOMPI_EVENTS_SECRET=test_events_VALOR_DEL_DASHBOARD
```

Son marcadores: reemplazar con los valores de la cuenta. Nunca pegarlos en el chat ni guardarlos en Git. No reutilizar claves de otro comercio. Configurar la URL de eventos sandbox en Wompi:

`https://relojeriabacata.store/api/payments/wompi/events`

`APP_ORIGIN` debe seguir siendo `https://relojeriabacata.store`, sin barra final. Nginx existente sirve `/pago` y reenvía los eventos al backend, sin nuevas reglas ni apertura de puertos.

Después de guardar: `chmod 600 .env`, `sudo systemctl restart bacata` y comprobar `sudo systemctl status bacata --no-pager`. GET `/api/payments/config` informa solo modo y disponibilidad, sin claves. Para mantener la integración preparada pero desactivada, usar `WOMPI_MODE=disabled`.

## Recorrido de prueba

1. Elegir una referencia publicada y vigente, añadir a la bolsa y aceptar las condiciones de demostración. El botón pasa a «Probar pago con Wompi» cuando sandbox está configurado.
2. Se crea una solicitud y un intento con monto calculado por el servidor, referencia única, firma de integridad, vencimiento de 30 minutos y checkout alojado de Wompi. Usar únicamente los datos de prueba oficiales de Wompi; nunca una tarjeta real en sandbox.
3. Al regresar, la tienda muestra el estado confirmado por el servidor. Una redirección no acredita aprobación. El servidor consulta con llave privada y recibe eventos firmados; la pantalla reconsulta cada 15 segundos durante un máximo de dos minutos si sigue pendiente, y ofrece consulta manual. Un error de conexión conserva el estado previo y pide reintentar.
4. Centro de control > Solicitudes muestra los artículos, importes y estado sandbox. Aprobado en pruebas no acredita una venta real, no reserva inventario y no genera despacho. Las notas/revisión siguen separadas del estado de pago.

El monto de prueba incluye el subtotal y el envío configurado para el destino. Se solicita ciudad/zona; los datos completos de comprador y dirección aún están pendientes. Los datos financieros de tarjeta se introducen en Wompi; no llegan a Bacatá.

## Verificación y persistencia

Tabla `payment_attempts` relacionada con `orders`, incluida en respaldos SQLite. La creación es transaccional y usa una clave de idempotencia para evitar solicitudes duplicadas ante un reintento del mismo checkout. El navegador conserva esa clave en sessionStorage; conserva la bolsa hasta una aprobación verificada del mismo carrito. Ante rechazo/error/anulación, permite volver a la bolsa y preparar un intento nuevo. Si el intento vence sin confirmación, revisar su estado antes de repetir un pago.

Los eventos validan SHA256 usando la lista dinámica de propiedades, timestamp y secreto de eventos. Para transacciones debe estar firmada la identidad; el servidor obtiene el resto desde la API privada y verifica referencia, monto y moneda. La transacción queda asociada a un único intento. Repeticiones no duplican auditoría ni regresan un estado final a pendiente. Una anulación puede seguir a una aprobación. No se guardan payloads de tarjetas o datos del pagador ni se exponen secretos. El token de consulta es aleatorio; no compartir el enlace de regreso.

La API de consulta usa siempre llave privada desde el servidor. No se usa la llave pública para consultar transacciones. Solo el backend actualiza la tabla de pagos, sin un botón de aprobación manual.

## Antes de activar dinero real

Pendientes: comprobar una transacción sandbox aprobada y otra rechazada contra la cuenta de Bacatá, entrega efectiva de eventos/reintentos, cuenta comercial habilitada, políticas e identificación comercial definitivas, datos del comprador/destino, aceptación documentada, precio final con flete y tratamiento tributario, y operación de despacho/posventa. La habilitación de producción será una entrega posterior; cambiar claves no la activa.

## Fuentes oficiales revisadas el 13 de octubre de 2026

- https://docs.wompi.co/docs/colombia/widget-checkout-web/
- https://docs.wompi.co/docs/colombia/eventos/
- https://docs.wompi.co/docs/colombia/transacciones/
- https://docs.wompi.co/docs/colombia/ambientes-y-llaves/
- https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/

Validación local: 37 pruebas aprobadas en Node 22.23.3, incluida persistencia tras reinicio, idempotencia, precios, firma, eventos falsificados/repetidos, referencia y moneda/monto, estados terminales y errores de API. Recorrido del navegador revisado en escritorio/móvil con checkout externo interceptado y estados locales controlados; no se ha ejecutado una transacción contra la cuenta de Bacatá porque faltan sus claves.
