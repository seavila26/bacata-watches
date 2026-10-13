# Envíos por destino

Tarifas iniciales confirmadas: Bogotá $0 COP; demás ciudades de Colombia $25.000 COP por pedido. Editable en Centro de control > Información comercial > Envíos. Ambas tarifas aceptan pesos enteros no negativos (máximo $1.000.000). No dependen del número de piezas ni del valor del reloj.

El texto adicional de envío describe condiciones/logística; no calcula precios. Las tarifas estructuradas son las que muestra el catálogo/contacto/condiciones y usa el checkout. La zona Bogotá corresponde a la ciudad, no a municipios cercanos como Soacha.

La bolsa exige elegir Bogotá u otra ciudad de Colombia. Para otra ciudad, requiere su nombre. Se guarda el destino en sessionStorage para conservarlo al volver de Wompi. No se ha añadido la captura de dirección completa o datos personales del comprador; esa fase y los cobros reales siguen pendientes.

Antes de crear el pago, el servidor recalcula precios vigentes y tarifa; el comprador debe revisar cualquier cambio. Wompi recibe el importe en centavos de productos más envío, firmado en el servidor. No se admite modificar monto/envío desde el navegador. El backend valida coherencia de zona/ciudad; esto no acredita una dirección real de entrega.

Cada solicitud nueva guarda ciudad/zona, subtotal y envío en `order_delivery`, dentro de la misma transacción de creación. El detalle administrativo y el retorno de pago muestran el desglose. Cambiar tarifas no reescribe solicitudes ni intentos anteriores. Las solicitudes antiguas sin destino muestran esa ausencia y conservan sus totales.

La creación de checkouts exige destino y total esperado. `/api/shipping/quote` devuelve únicamente subtotal/envío/total/destino a partir de los precios actuales. Los precios, margen y publicación de relojes no cambian al modificar las tarifas al comprador: se mantiene separado el cálculo financiero de importación del flete final.

Las tarifas se almacenan en el perfil comercial, con auditoría y respaldo SQLite. Perfiles anteriores reciben las tarifas iniciales sin reemplazar sus textos o identificadores. El texto inicial obsoleto que decía que no se anunciaba envío gratis se sustituye solo si coincide exactamente con aquel valor inicial.

Despliegue: respaldo, actualización de Git, pruebas y reinicio del servicio. No requiere nuevas dependencias ni cambios en Nginx o claves Wompi. Repetir sandbox para Bogotá y otra ciudad: verificar subtotal, envío y total en la bolsa, Wompi y Solicitudes.

Validación: 38 pruebas aprobadas en Node 22.23.3, incluidas tarifas, ciudades, importes firmados y conservación del historial. QA de navegador en escritorio/móvil: selección de Bogotá y Medellín, guardado de tarifa administrativa, cambio de tarifa con bolsa abierta, nueva aceptación y pago con el nuevo total. Wompi se interceptó localmente; repetir las dos zonas con la cuenta sandbox configurada en producción.
