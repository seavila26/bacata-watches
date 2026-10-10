# Importación y fichas · Bacatá v0.4

## Primera carga

1. Abre Administración e inicia sesión.
2. Entra a **Importar inventario** y selecciona el XLSX original. Máximo 15 MB.
3. Pulsa **Analizar y preparar vista previa**. Hasta aquí no se modifica SQLite.
4. Revisa el resumen, las alertas y el precio sugerido. Usa el filtro **Inicio: margen ≥10%, In Stock y compra ≤USD 2.000** para comenzar con los 149 candidatos del corte 07/10/2026. Esto es una selección de revisión, no inventario confirmado.
5. Pulsa **Seleccionar resultados válidos del filtro**. Puedes acumular selección de varios filtros o marcar referencias individualmente. La selección del filtro abarca todas sus páginas, no solo las 50 filas visibles.
6. Pulsa **Guardar selección en el administrador**. Las referencias nuevas quedan pendientes, por cotizar, con stock propio cero y sin precio aprobado.
7. En Oportunidades, busca una referencia y pulsa **Examinar**.
8. Completa y guarda la ficha. Después pulsa **Publicar**. La pantalla indica los datos pendientes.

La vista previa vence en 15 minutos y se pierde al reiniciar el servidor. Si otra edición cambia una referencia después de analizar, se rechaza toda la carga y se debe analizar otra vez.

## Modalidades

- **Solicitar cotización**: publica una ficha completa sin precio firme ni botón para agregar a la bolsa. La consulta lleva a la página de contacto, cuyos canales deben configurarse en `public/js/config.js`.
- **Importación bajo pedido**: muestra precio aprobado y plazo total. Requiere costos confirmados, margen mínimo y confirmación del proveedor de menos de 24 horas. En esta versión se consulta el pedido, sin pago anticipado automático.
- **Existencias propias**: permite agregar a la bolsa si hay unidades registradas, precio aprobado, costos confirmados y margen mínimo.

Toda modalidad exige nombre, variante, descripción, foto principal, estado, garantía, contenido de entrega, procedencia y condiciones de envío. Los datos técnicos adicionales se guardan en SQLite y se muestran cuando se completan. No se deducen especificaciones ni colores desde el nombre.

Una ficha importada publicada que deja de cumplir los requisitos se omite de la API pública. Si vence una confirmación de bajo pedido, hay que volver a confirmar el proveedor; no hace falta reimportar. Una edición incompleta pausa la ficha guardada. El inventario de demostración previo conserva su visibilidad hasta que se edite o pause; no representa stock comercial.

## Actualizaciones

Se importan únicamente Base comparada y Base lujo, usando los encabezados de fila 5 y los datos desde fila 6. La identidad es marca + referencia exacta, normalizada a mayúsculas y espacios simples. Se preservan puntos, barras y guiones. Los diez solapamientos del archivo se reúnen y prevalece Base comparada; no se fusionan referencias por similitud.

Una recarga actualiza el dato de proveedor y la observación financiera. Conserva nombre, variante, descripción, fotos, ficha técnica, condiciones, precio aprobado, costo confirmado manual y stock propio. Si cambia la observación del proveedor, retira la confirmación de costos y disponibilidad, y pausa una ficha publicada. Un corte anterior al guardado queda bloqueado. Las actualizaciones de una carga se guardan en una transacción y quedan en Actividad.

Los productos no presentes en un archivo no se borran ni se consideran agotados. La ausencia de una referencia no prueba que esté fuera de stock.

## Modelo de costos

Cada observación conserva los Supuestos originales. El servidor recalcula compra, flete por umbral, seguro, CIF, arancel presupuestado, IVA importado, recargo cambiario, gestión, inversión de caja, costo de mercancía, venta sugerida, ingreso sin IVA, cobro, reserva de garantía y envío nacional.

Margen de contribución = (ingreso sin IVA − costo mercancía − cobro − reserva garantía − envío nacional) / ingreso sin IVA.

También se muestra el escenario sin crédito de IVA. El precio sugerido aplica el descuento del archivo al comparable. El precio aprobado es independiente y no se sobrescribe al importar. Si no hay comparable local, el resultado es nulo/por cotizar. Los errores de fórmula del archivo no se convierten a cero ni se usan como márgenes.

**Costo mercancía confirmado COP** sustituye el costo de mercancía del modelo. Debe estar expresado bajo el mismo tratamiento de IVA; comisión, reserva de garantía y envío nacional se siguen calculando aparte. Los supuestos importados son una observación fechada: para revisarlos, actualiza Supuestos en el archivo y genera otra vista previa. La tasa y los impuestos de la pestaña Reglas solo afectan al modelo general previo; el margen mínimo se aplica a ambos modelos. La aplicación no certifica impuestos ni recuperabilidad de IVA.

## Imágenes y archivos

Sube PNG/JPEG/WebP, hasta 5 MB por archivo, o usa URL HTTPS autorizadas. Se guarda una principal y hasta ocho adicionales. La carga crea el archivo; **Guardar ficha** vincula las fotos a la referencia. Conserva `public/uploads` al actualizar y respáldalo junto con `data`.

No se descargan imágenes de Jomashop automáticamente. Ninguna foto, característica, unidad, garantía o plazo se inventa al importar.

## Código

- `src/inventory-import.js`: lectura XLSX, vista previa, selección y transacción.
- `src/catalog-model.js`: identidad, cálculo importado, validación y campos públicos.
- `src/product-editor.js`: validación y persistencia de fichas.
- `src/db.js`: migración aditiva y SQLite.
- `src/server.js`: API autenticada, carga de fotos, publicación y tienda.
- `public/js/views/inventory.js`: vista previa, filtros y paginación.
- `public/js/views/product-editor.js`: formulario de ficha.
- `public/js/views/admin.js`: oportunidades, revisión y actividad.
- `public/app.js`: eventos de carga, edición y selección.

Los costos, enlaces de compra, cupones, comparables y márgenes solo se envían al administrador. La API pública usa una lista explícita de campos comerciales.

## Verificación

`npm test` verifica importación, errores, solapamientos, stock cero, conservación de fichas, fechas antiguas, conflicto y reversión, edición, margen, privacidad, autenticación, origen y bloqueo de publicación incompleta.

`npm run test:inventory -- "ruta/al/inventario.xlsx"` prueba un archivo real con una base temporal que se elimina al terminar. No modifica la base de la tienda.

## Límites

No hay consulta en vivo a Jomashop, programación nueva de su carga XLSX ni pagos reales. Las solicitudes de bolsa siguen siendo pruebas sin cobro ni reserva. Las sesiones y vistas previas permanecen en memoria; reiniciar cierra sesiones y descarta vistas previas. Los archivos subidos y la base requieren disco persistente y respaldo. Configura los canales comerciales, revisa las fichas y reemplaza las condiciones de demostración antes de lanzar ventas reales.
