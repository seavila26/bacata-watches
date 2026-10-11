# Inventario, fichas y publicaciones

## 1. Importar base en crudo

Usa el botón **1 · Importar base en crudo**. El archivo sigue usando Base comparada, Base lujo y Supuestos; conserva los encabezados originales en la fila 5 y los datos desde la fila 6. Máximo 15 MB desde el panel y 10.000 filas por hoja.

**Analizar** no modifica productos. La vista previa muestra nuevas referencias, actualizaciones, errores, comparables y márgenes calculados por el servidor. Filtra y selecciona resultados de todas las páginas, luego pulsa **Guardar selección en el administrador**. La vista previa vence a los 15 minutos. Cambios concurrentes en productos o reglas obligan a analizar otra vez; las escrituras se realizan en una transacción.

El filtro inicial es margen ≥10%, anuncio `In Stock.` y compra ≤USD 2.000; requiere precio comparable verificado. Se conservan los filtros por grupo y búsqueda. Oportunidades permite seleccionar referencias guardadas y examinar el desglose completo.

Una fila con error de fórmula queda **por cotizar**, sin costo total, venta sugerida ni margen calculables; un resultado faltante nunca se usa como cero. Las filas con identidad, enlace, fecha o números inválidos se bloquean. Los errores se muestran en el análisis.

Los productos ausentes de una nueva base se conservan. No se eliminan ni se consideran agotados. Una fila guardada actualiza su última confirmación aunque no cambie el corte del proveedor. No se escriben las filas excluidas de la selección ni las bloqueadas.

## Costos globales en Administración

Los controles muestran porcentajes; la API almacena fracciones (`0.10` = 10%). Todos los cálculos ocurren en el servidor.

| Parámetro | Clave API | Valor inicial |
| --- | --- | --- |
| Tasa COP/USD | fx | 4000 |
| Importación e impuestos | duty | 20% |
| Comisión sobre venta | fee | 3,5% |
| Colchón logístico sobre compra y envío | logistics_rate | 0% |
| Descuento sobre mercado | discount | 3% |
| Margen mínimo | min_margin | 10% |
| Plazo global | delivery_days | 5 a 10 días hábiles |
| Garantía global | warranty | Texto editable |
| Envío global | shipping_terms | Texto editable |

El XLSX sigue aportando el precio promocional / regular según `usePromo`, los envíos USD `freightLow` / `freightHigh` y la evidencia del comparable. La tasa, tributos, comisiones y descuentos de Supuestos no sustituyen los parámetros globales. Un comparable USD se convierte con la tasa global; sigue sujeto a la evidencia de referencia exacta del archivo.

- Compra COP = redondeo(compra USD × tasa).
- Envío COP = redondeo(envío USD × tasa).
- Importación e impuestos = redondeo((compra COP + envío COP) × porcentaje global).
- Venta sugerida = redondeo(precio comparable COP × (1 − descuento)).
- Precio de publicación = precio aprobado, si existe; de lo contrario, venta sugerida. En ambos casos se exige comparable válido.
- Comisión = redondeo(precio de publicación × comisión).
- Colchón = redondeo((compra COP + envío COP) × colchón).
- Costo total = compra COP + envío COP + importación e impuestos + comisión + colchón.
- Contribución = precio de publicación − costo total.
- Margen = contribución / precio de publicación.

Este modelo utiliza una línea combinada de importación e impuestos y margen sobre el precio de venta completo. No añade seguros, IVA descontable, reservas ni costos ocultos del modelo anterior. La suma del desglose coincide exactamente con el total. Una modificación de parámetros recalcula las oportunidades y pausa publicaciones que dejen de cumplir; registra cambios de precio en Actividad.

## 2. Exportar plantilla de fichas

En la vista previa de base o en Oportunidades, pulsa **Exportar plantilla de fichas**. Con casillas seleccionadas se exporta toda la selección, incluso fuera de la página o filtro visible. Sin casillas seleccionadas se exportan todos los resultados filtrados.

La hoja `catalogo` tiene exactamente estas columnas, en este orden:

```text
brand | reference | source_url | collection | movement | diameter_mm | material | crystal | water_resistance | dial_color | case_color | strap_color | strap | image_1 | image_2 | image_3
```

Se rellena únicamente lo ya guardado. Para referencias nuevas de la vista previa se incluyen marca, referencia y enlace del proveedor. Los demás campos quedan vacíos. No se deducen especificaciones a partir del nombre ni se incluyen precios o costos.

## 3. Importar fichas y publicar

Usa **2 · Importar fichas y publicar**, sube el XLSX con hoja `catalogo`, revisa y guarda. No requiere hoja Supuestos.

- Identidad: marca + referencia, mayúsculas y espacios simples; se conservan puntos, barras y guiones.
- Solo se aceptan referencias que ya estén en oportunidades guardadas desde la base en crudo. Las desconocidas o repetidas se rechazan con motivo.
- Vacíos y espacios en blanco no borran ningún campo. Valores presentes actualizan solo datos técnicos, enlace de fuente o fotos.
- No se actualizan nombre, descripción, costos ni precios.
- `image_1` es la foto principal; `image_2` y `image_3` son las dos primeras fotos adicionales. Las imágenes existentes adicionales se conservan. Se admiten HTTPS y rutas de fotos subidas al administrador. No se descargan imágenes ni se consultan páginas externas.
- Se actualiza la última confirmación de cada referencia aceptada al guardar.

Se publica automáticamente con colección, movimiento, diámetro, material, cristal, resistencia al agua, color de esfera, material de correa, image_1, comparable válido y margen ≥ mínimo. La ausencia de comparable exige **Verificar precio comparable**, incluso cuando hay precio aprobado. Los demás faltantes se enumeran. Las referencias con margen insuficiente se clasifican como margen bajo. Una pausa manual no se revoca por importar; una pausa automática puede resolverse al importar una ficha que vuelva a cumplir.

El resumen separa **Publicadas**, **Pendientes**, **Margen bajo** y **Rechazadas**. **Descargar pendientes en Excel** incluye las columnas de la ficha y `category`, `reason` en una hoja `pendientes`. Ese informe es para revisión; para volver a importar conserva las 16 columnas originales en la hoja `catalogo`. El informe temporal vence a las 24 horas o al reiniciar.

## 4. Publicaciones

La tabla reúne todas las referencias con fecha de publicación, incluidas pausadas y vencidas. Muestra marca, referencia, estado, fecha de publicación, última confirmación, precio, margen y desglose. Hay filtros por marca/estado, búsqueda, orden ascendente/descendente, selección entre páginas y exportación privada a Excel.

**Pausar** y **Reactivar** funcionan por fila y por selección. Reactivar comprueba ficha, comparable y margen; devuelve el motivo de cada referencia que no cumple. El editor individual permite corregir un dato, escribir nombre o descripción, aprobar precio y subir fotos.

Después de **más de 72 horas** desde la última confirmación, el estado efectivo es **Requiere confirmación**. La tienda y los pedidos lo comprueban en cada solicitud; no depende de abrir el panel o de un temporizador del navegador. **Confirmar y mantener activa** comprueba requisitos y actualiza la fecha. La primera fecha de publicación se conserva en posteriores reactivaciones. Al iniciar se reparan fechas ausentes de publicaciones heredadas y se pausan las fichas que no cumplen los requisitos, mostrando el motivo. El estado administrativo usa las mismas reglas que la tienda.

La API pública devuelve una lista explícita de campos de presentación, precio de venta y condiciones globales. Excluye enlaces del proveedor, costos, márgenes, precio aprobado, snapshots, análisis y datos operativos. La disponibilidad pública es **Disponible**, sin conteo de unidades. La bolsa admite cantidades de 1 a 10 por solicitud de prueba; ese límite no representa existencias.

## Prueba completa con cuatro referencias

En una instalación de prueba:

```bash
npm ci
npm run demo:inventory
npm start
```

El generador crea `data/piloto/base-cruda.xlsx` y `data/piloto/fichas-completadas.xlsx`. Son cuatro referencias ficticias de marca PRUEBA, no productos comerciales. Configura .env antes de iniciar.

1. En Administración fija tasa 4000, importación 20%, comisión 3,5%, colchón 0%, descuento 3%, margen mínimo 10%.
2. Analiza `base-cruda.xlsx`. Cambia el filtro a **Todas**, selecciona las cuatro referencias y guarda. Deben quedar cuatro borradores.
3. En Oportunidades cambia a **Todas**, selecciona las cuatro y exporta la plantilla. Confirma los encabezados y que los datos técnicos faltantes estén vacíos.
4. El archivo `fichas-completadas.xlsx` simula la devolución del agente externo. Usa una foto propia: en una ficha sube una imagen manualmente, copia su ruta `/uploads/...` en `image_1` de las cuatro filas y guarda el Excel. No uses las referencias ficticias en la tienda de producción.
5. Analiza la plantilla completada y guarda.

| Referencia | Resultado esperado |
| --- | --- |
| PRUEBA-01 | Publicada automáticamente. |
| PRUEBA-02 | Pendiente: falta cristal. |
| PRUEBA-03 | Pendiente: verificar precio comparable. |
| PRUEBA-04 | Margen bajo; no publicada. |

6. Descarga pendientes y revisa los tres motivos. Completa el cristal de PRUEBA-02, deja vacíos los demás datos e importa de nuevo: debe conservarlos y publicar la ficha.
7. En Publicaciones pausa PRUEBA-01: debe desaparecer del catálogo. Reactívala: debe volver. Prueba filtros, exportación y acciones con casillas.
8. En una copia de la base cambia la compra de PRUEBA-01 a USD 900, mantén o aumenta la fecha de consulta, analiza y guarda: debe pausarse por margen sin perder fotografías ni ficha.
9. Las pruebas automatizadas simulan el vencimiento, comprueban el umbral exacto de tres días y la confirmación. No necesitas esperar tres días para ejecutar `npm test`.

## Mapa de código

| Archivo | Responsabilidad |
| --- | --- |
| src/inventory-import.js | Lectura original XLSX, análisis y guardado seleccionado. |
| src/catalog-model.js | Identidad, costos globales, requisitos y campos públicos. |
| src/catalog-export.js | Plantilla técnica y generación de Excel. |
| src/catalog-import.js | Vista previa técnica, actualización, publicación e informe de pendientes. |
| src/publications.js | Pausas, reactivaciones, confirmación y visibilidad. |
| src/product-editor.js | Edición individual y validación de imágenes. |
| src/db.js | SQLite, migración, parámetros y actividad. |
| src/server.js | API, autenticación, archivos y solicitudes de prueba. |

Rutas privadas nuevas: `/api/admin/catalog/export`, `/preview`, `/commit`, `/pending`; `/api/admin/publications/action`, `/export`. Se conservan `/api/admin/inventory/preview`, `/commit` y el editor individual. Los endpoints del flujo retirado devuelven 404.
