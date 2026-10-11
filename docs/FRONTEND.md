# Frontend

| Archivo | Responsabilidad |
| --- | --- |
| public/index.html | Navegación, pie, contenedores y diálogos. |
| public/app.js | Rutas, eventos, cargas, descargas y conexión API. |
| public/js/theme-init.js | Preferencia de tema antes de cargar estilos; claro por defecto. |
| public/js/experience.js | Tema, movimiento y mejora accesible de controles de tabla. |
| public/js/views/admin-overview.js | Resumen de estados efectivos, prioridades y accesos al flujo. |
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
| public/css/themes.css | Colores semánticos de los modos claro y oscuro. |
| public/css/motion.css | Transiciones y aparición de secciones con movimiento reducido. |
| public/css/tokens.css | Colores, tipografía y espaciado. |

El navegador no calcula costos ni márgenes. Solo presenta resultados privados del servidor. La API pública incluye el precio efectivo y los textos globales; no expone datos de compra.

La selección se conserva entre páginas y filtros hasta limpiarla o guardar la carga. Los botones de exportación usan la selección completa; sin selección, todos los resultados filtrados. Cada tabla administra su paginación de 50 filas.

Todas las fotografías de las fichas proceden de SQLite. No existen fichas complementarias públicas que sustituyan los datos guardados. La galería incluye foto principal y fotos adicionales.

Para actualizar, usa `git pull --ff-only`, conserva la base y `public/uploads`, instala con `npm ci`, reinicia y pulsa Ctrl+F5. Las campañas se configuran en `config.js` con fechas que incluyen el desplazamiento horario de Colombia.

## Personalizar la experiencia

La identidad se conserva en `tokens.css`: azul #0B1D3A, marfil #F7F3EB, Caladea y Noto Sans. El latón queda para detalles decorativos. El modo claro sigue siendo el inicial. `themes.css` cambia superficies y colores de lectura; no cambia los colores maestros ni invierte el logo. El logo conserva una base blanca en modo oscuro. El botón del encabezado guarda la preferencia en `localStorage` con la clave `bacata-theme`; no afecta datos de negocio.

El administrador abre en Resumen. Sus cifras cuentan `effective_status`, de modo que una referencia vencida no se presenta como activa por conservar un estado histórico de publicación. Las tarjetas abren filtros de consulta; no ejecutan publicaciones ni pausas. Las ocho secciones tienen URLs `#/admin/resumen`, `#/admin/inventario`, etc.; funcionan al recargar y con el historial del navegador. En móvil, la navegación horizontal conserva los controles de teclado.

El catálogo tiene orden por precio o marca y filtros removibles. La URL conserva filtros y orden para recargar o compartir la selección. La búsqueda incluye movimiento y colección, por lo que el acceso Automáticos encuentra referencias por su movimiento.

Las transiciones viven en `motion.css`. Respetan `prefers-reduced-motion`; las secciones permanecen visibles sin animación o sin IntersectionObserver. No se usan animaciones continuas en las piezas ni datos comerciales inventados.

El flujo de XLSX, la fórmula de rentabilidad, la confirmación a 72 horas y los contratos API continúan en el servidor. Este cambio no agrega proveedores, tareas automáticas ni pasarela.
