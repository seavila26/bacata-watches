# Frontend

| Archivo | Responsabilidad |
| --- | --- |
| public/index.html | Navegación, pie, contenedores y diálogos. |
| public/app.js | Rutas, eventos, cargas, descargas y conexión API. |
| public/js/state.js | Filtros, selección entre páginas, vistas previas y bolsa. |
| public/js/api.js | Peticiones JSON y datos públicos. |
| public/js/views/admin.js | Acceso, oportunidades, parámetros y detalle privado. |
| public/js/views/inventory.js | Análisis de base en crudo y exportación de fichas. |
| public/js/views/catalog-import.js | Importación técnica, vista previa y resumen. |
| public/js/views/publications.js | Tabla, filtros, orden y acciones de publicaciones. |
| public/js/views/product-editor.js | Corrección manual individual y fotos. |
| public/js/views/store.js | Catálogo, galería, condiciones globales y bolsa. |
| public/js/components.js | Componentes visuales y disponibilidad. |
| public/js/config.js | Marca, contacto, campañas y editorial. |
| public/css/admin.css | Administración, tablas y formularios. |
| public/css/store.css | Tienda y fichas públicas. |
| public/css/responsive.css | Adaptación de escritorio y móvil. |
| public/css/tokens.css | Colores, tipografía y espaciado. |

El navegador no calcula costos ni márgenes. Solo presenta resultados privados del servidor. La API pública incluye el precio efectivo y los textos globales; no expone datos de compra.

La selección se conserva entre páginas y filtros hasta limpiarla o guardar la carga. Los botones de exportación usan la selección completa; sin selección, todos los resultados filtrados. Cada tabla administra su paginación de 50 filas.

Todas las fotografías de las fichas proceden de SQLite. No existen fichas complementarias públicas que sustituyan los datos guardados. La galería incluye foto principal y fotos adicionales.

Para actualizar, usa `git pull --ff-only`, conserva la base y `public/uploads`, instala con `npm ci`, reinicia y pulsa Ctrl+F5. Las campañas se configuran en `config.js` con fechas que incluyen el desplazamiento horario de Colombia.
