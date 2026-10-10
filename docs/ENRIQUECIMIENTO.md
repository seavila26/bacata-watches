# Preparar catálogo · Bacatá v0.5

## Uso recomendado con los 149 candidatos

1. Importa los candidatos desde el Excel como en v0.4.
2. Abre **Preparar catálogo**, con el filtro **Candidatos de inicio**. Para el archivo del 07/10/2026 aparecen 149 referencias.
3. Pulsa **Seleccionar todo el filtro**. La selección abarca todas sus páginas, no solo las 50 filas visibles.
4. Ejecuta **Probar con las primeras 10 seleccionadas**. Se leen las URLs guardadas en las fichas. Si la fuente entrega datos compatibles y acredita la referencia, se guardan propuestas; todavía no se modifica la ficha ni se publica.
5. Revisa **Procesamiento y resultados** y **Revisar propuestas**. Los errores se muestran en **Pendientes de fuente**. Puedes editar los valores propuestos directamente, antes de aplicar. Las ediciones se conservan al cambiar de página durante esta sesión.
6. Si las diez corresponden correctamente, ejecuta **Preparar todas las seleccionadas**. El proceso continúa mientras el servidor esté activo, aunque cierres la pestaña. Hasta 250 piezas por lote; una petición de cancelación termina la referencia en curso y detiene las siguientes.
7. Selecciona las propuestas revisadas y pulsa **Aplicar propuestas revisadas**. Se conservan los campos previamente completados. Los costos, el precio aprobado y las unidades propias no se modifican.
8. Crea una plantilla con las condiciones reales comunes: garantía, contenido de entrega, procedencia, envío, plazo y modalidad. En **Condiciones comunes y precio**, selecciona la plantilla y prepara la vista previa. Puedes proponer los precios sugeridos que todavía no se hayan aprobado. Si has verificado los costos y la disponibilidad de todas las referencias elegidas, puedes marcar sus confirmaciones explícitas para aplicarlas en el mismo lote.
9. **Aplicar cambios y continuar revisión** guarda los datos comunes. **Aplicar y publicar las listas** publica únicamente las que cumplen todos los requisitos y comunica cuáles siguen pendientes.

La modalidad de cotización no tiene compra directa. Bajo pedido necesita costos confirmados, precio aprobado, margen mínimo y confirmación reciente del proveedor. Las confirmaciones comerciales masivas requieren que marques expresamente los campos correspondientes después de verificar el lote. Las unidades propias se registran cuando existan; ningún proceso masivo inventa cantidades. Las fichas importadas necesitan colección, movimiento, diámetro, material de caja, cristal, resistencia al agua, color de esfera y material de correa para publicarse, además de los requisitos comerciales anteriores. Los colores de caja y correa se guardan cuando la fuente los informa.

## Qué hace la extracción

Consulta normal por HTTPS, sin evadir bloqueos. Reconoce Product en JSON-LD, propiedades adicionales, tablas de dos columnas y pares dt/dd. Busca una referencia exacta y revisa la marca. No usa las especificaciones de un producto relacionado para completar otro. Cuando la fuente declara una pieza usada/reacondicionada y la ficha dice nuevo, rechaza esa correspondencia.

Se obtienen características explícitas, se traducen términos conocidos y se mantienen las unidades. Un diámetro ambiguo o valores contradictorios quedan pendientes. No se deducen especificaciones desde la marca, el precio, las fotos o el nombre del modelo. La compatibilidad con el HTML real del proveedor debe validarse en el piloto: el adaptador no garantiza que cualquier cambio de la página siga siendo interpretable.

Las fotos del lote se descargan cuando activas esa opción, hasta tres por pieza, desde dominios configurados. Se admite PNG/JPEG/WebP y hasta 5 MB por archivo. Una respuesta bloqueada o de otro formato no se sustituye por una ilustración. Revisa que tengas autorización de uso y que corresponda a la variante ofrecida. La carga puede generar archivos de propuestas descartadas; conserva y respalda public/uploads. No se eliminan fotos automáticamente.

La propuesta contiene fuente, fecha, dato original, campos faltantes y método de redacción. Después de aplicar, **Examinar → Fuentes e historial de campos → Consultar procedencia** muestra el registro. Si una ficha cambia después de preparar una propuesta, se rechaza el lote de aprobación para evitar sobrescribir esa edición; vuelve a preparar la referencia.

## Redacción española e IA opcional

Sin configurar nada, se prepara un nombre y una descripción básicos a partir de los datos obtenidos. Los términos no reconocidos conservan el texto original para revisión.

Para redacción editorial con IA, añade a tu `.env` existente:

```dotenv
OPENAI_API_KEY=tu-clave-de-API
OPENAI_MODEL=gpt-4.1-mini
```

La clave permanece en el servidor. La opción envía marca, referencia y características obtenidas para preparar únicamente nombre y descripción; no usa IA para crear especificaciones técnicas. El servicio de API requiere acceso y puede generar cargos. Los textos siempre se presentan para revisión antes de aplicar. Si la redacción falla, se conserva el borrador básico y se muestra la incidencia.

Integración basada en [Responses API y JSON Schema](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). No se realizaron peticiones reales con clave durante las pruebas.

## Cuando la consulta directa no funciona

Un bloqueo, una página inaccesible o una referencia no acreditada deja un resultado pendiente. No supone que el reloj esté agotado.

Puedes solicitar al proveedor un catálogo estructurado autorizado y cargarlo como JSON en la misma pestaña. Ejemplo de estructura; los valores de este ejemplo describen solo el formato y no acreditan una referencia comercial:

```json
[
  {
    "brand": "Marca",
    "reference": "REFERENCIA-EXACTA",
    "source_url": "https://www.jomashop.com/pagina-de-la-referencia.html",
    "fields": {
      "collection": "Colección informada",
      "movement": "Movimiento informado",
      "diameter_mm": 40,
      "material": "Material informado",
      "crystal": "Cristal informado",
      "water_resistance": "Valor y unidad originales",
      "dial_color": "Color informado",
      "case_color": "Color informado",
      "strap_color": "Color informado",
      "strap": "Material informado"
    },
    "images": ["https://cdn.jomashop.com/fotografia-autorizada.webp"]
  }
]
```

Omitir los datos desconocidos. `diameter_mm` es un número, el resto son textos. No incluir stock, costos ni condiciones comerciales dentro de fields. El catálogo admite 250 registros y requiere que las referencias ya estén importadas. La correspondencia aportada por este catálogo también debe revisarse; el programa no certifica el documento del proveedor.

`examples/catalogo-piloto.json` contiene las diez referencias reales elegidas para el piloto con sus URLs, pero **sin características ni fotos completadas**. Es un esqueleto para solicitar datos al proveedor, no un catálogo listo para cargar. Rellena únicamente información respaldada.

Jomashop y sus CDN configurados están permitidos por defecto. Para usar otra fuente o CDN autorizada, añade los dominios exactos, separados por comas, a `ENRICHMENT_ALLOWED_HOSTS` en `.env`. No se aceptan IP locales, credenciales en la URL, HTTP ni redirecciones hacia hosts fuera de la lista. No se hace búsqueda automática en páginas alternativas cuando falla una fuente.

## Datos persistentes y actualización

Los lotes, propuestas, plantillas e historial se guardan en SQLite. Una propuesta aplicada no vuelve a modificar la ficha automáticamente. Si se reinicia el servidor, un lote incompleto queda marcado como interrumpido y se deben reintentar sus pendientes. Las propuestas ya preparadas sobreviven al reinicio. La vista previa de condiciones/publicación vence en 15 minutos y se pierde con el reinicio. Las ediciones que aún no hayas aplicado desde la pantalla no sobreviven a una recarga del navegador.

## Archivos principales

- `src/source-reader.js`: acceso HTTPS limitado y extracción de características.
- `src/spanish-copy.js`: borrador básico e integración opcional de IA.
- `src/catalog-enrichment.js`: lotes, propuestas, fotos y aprobación.
- `src/catalog-bulk.js`: plantillas, vista previa y publicación masiva.
- `public/js/views/catalog-bulk.js`: selección y revisión del catálogo.
- `tests/enrichment.test.js`: correspondencia, conservación, piloto de diez y operaciones masivas.

## Pruebas y resultado real

`npm test`: 16 pruebas aprobadas, incluyendo un piloto de diez registros de prueba, edición y conservación de correcciones, fotos inválidas y publicación parcial con pendientes explícitos.

Con el Excel real se verificaron 1.968 referencias únicas y el filtro de 149 candidatos. Se intentó consultar diez referencias de diez marcas desde este entorno: las diez quedaron pendientes porque no se pudo resolver el dominio de Jomashop. No se obtuvieron ni completaron fotografías o características reales. Debe ejecutarse el piloto desde la instalación del usuario antes de procesar el catálogo completo.

Para repetir la prueba sin modificar la base de la tienda:

```powershell
npm run test:pilot -- "ruta\al\inventario.xlsx" --live
```

El chequeo visual en navegador sigue pendiente. Se comprobó la estructura de los formularios y tablas mediante DOM, pero no se presentan nuevas capturas de escritorio/móvil. La pasarela de pagos y las reservas siguen pendientes como en v0.4.

## Actualización: lectura renderizada opcional

El HTML inicial de Bulova 98B428 se obtuvo con HTTP 200, título y referencia, pero sin h1, Product JSON-LD ni especificaciones. Ahora se distingue una ficha que requiere JavaScript de una referencia incorrecta o un bloqueo. El título por sí solo nunca acredita características.

Para una fuente cuya consulta automatizada esté autorizada, instala y activa:

```powershell
npm ci
npm run browser:install
```

Añade a tu `.env` existente `ENRICHMENT_RENDER_ENABLED=true` y reinicia con `npm start`. No reemplaces tu `.env`. Por defecto está desactivado.

El navegador se utiliza solo cuando se detecta la estructura inicial sin ficha. Se cierra después de cada pieza. Usa HTTPS con dominios permitidos y DNS público validado, limita solicitudes, tamaño y tiempo, bloquea conexiones WebSocket, service workers, imágenes y peticiones distintas de GET. No inicia sesión ni resuelve verificaciones humanas. Fuentes que dependan de POST, cookies, dominios adicionales o estructuras incompatibles pueden seguir pendientes: utiliza entonces el catálogo autorizado. No se garantiza la extracción de Jomashop.

No basta con encontrar el título: la lectura renderizada exige referencia/marca válidas y al menos una especificación explícita. Cada característica registra el método `rendered/html` o `rendered/structured/html`. La revisión, aprobación y publicación siguen separadas.

Los lotes terminados conservan sus resultados anteriores. Selecciona las diez piezas y crea un nuevo piloto para obtener los nuevos diagnósticos. No ejecutes los 149 hasta revisar las propuestas de ese piloto.

Validación: 19 pruebas aprobadas, incluida una prueba con Chromium real y una ficha controlada que incorpora especificaciones mediante JavaScript. Se comprobó el bloqueo de otro dominio y de POST. La extracción real de las diez páginas de Jomashop permanece pendiente de validación desde la instalación con acceso autorizado.
