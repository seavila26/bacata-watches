## Lectura de fuentes con JavaScript

- Diagnósticos específicos para HTML inicial, referencia incorrecta y bloqueo.
- Chromium opcional, HTTPS limitado y procedencia de datos renderizados.
- Pruebas de regresión y guía de instalación; sin cambios de base de datos.

# v0.5 · Preparación masiva del catálogo

- Selección de candidatos, prueba inicial de diez y procesamiento del lote en segundo plano.
- Extracción por referencia y marca desde JSON-LD/tablas; resultados ambiguos pendientes.
- Borrador español sin clave e integración opcional de IA solo para nombre y descripción.
- Fotos descargadas desde fuentes autorizadas y revisión de propuestas antes de aplicar.
- Conservación de fichas corregidas, fuente y fecha por campo e historial consultable.
- Plantillas de condiciones comunes, precio sugerido en bloque y publicación de fichas listas.
- Colores de caja/correa persistidos; requisitos técnicos mínimos para fichas importadas.
- Alternativa de catálogo autorizado JSON cuando la lectura directa no esté disponible.
- 16 pruebas aprobadas. El piloto de diez referencias reales quedó pendiente por falta de acceso al dominio del proveedor; no hay fichas reales precompletadas.

# v0.4 · Inventario y fichas

- Importación XLSX con vista previa, selección, filtros y paginación.
- Identidad por marca y referencia exacta; reúne solapamientos entre bases.
- Nuevos productos pendientes, por cotizar y sin unidades propias.
- Modelo de contribución del Excel recalculado en servidor; fórmulas erróneas no se importan como números.
- Editor completo en SQLite, fotos subidas, galería y precio aprobado independiente.
- Modalidades de cotización, bajo pedido y existencias propias.
- Validación de publicación, vigencia de confirmación y conservación de fichas en recargas.
- Migración que conserva la base existente; requiere npm ci por la nueva dependencia ExcelJS.
- Pruebas de modelo, importación, API y archivo real. Ver docs/QA-v0.4.md.

# v0.3 · frontend Bacatá

- Aplicación del libro de marca completo, con matriz de 28 páginas y pendientes explícitos.
- Sistema CSS separado en tokens, base, componentes, tienda, administración y responsive.
- JS organizado en estado, API, utilidades, componentes y vistas.
- Corrección de bolsa: icono + palabra + contador en fila con espacios independientes.
- Corrección de acceso: 24 px entre campos y 32 px entre contraseña y botón.
- Fuentes Caladea/Noto Sans locales; licencias incluidas; elimina dependencia de Google Fonts.
- Inicio editorial, selección, criterio, artículos y franja de acompañamiento.
- Menú móvil y búsqueda en diálogos accesibles.
- Catálogo con seis filtros, precio COP, estados y resultados vacíos.
- Ficha con ampliación, galería preparada, condiciones y datos no verificados explícitos.
- Bolsa con cantidades, referencias retiradas, aceptación y solicitud de prueba.
- Estados de carga, error de API y fallo de imagen.
- Campañas con fechas Colombia y retorno automático, desactivadas por defecto.
- Comandos npm cargan `.env`; no hay dependencias externas nuevas.
