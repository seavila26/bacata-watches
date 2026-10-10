# Cómo modificar el frontend

## Mapa de archivos

| Archivo | Qué editar |
| --- | --- |
| public/index.html | Encabezado, navegación, pie y contenedores de diálogos. |
| public/app.js | Rutas, eventos, carga y conexión con API. |
| public/js/config.js | Nombre, canales comerciales, artículos, campaña y fichas complementarias validadas. |
| public/js/state.js | Estado de filtros, selección y panel. |
| public/js/api.js | Peticiones API y normalización de datos públicos. |
| public/js/utils.js | Formato COP, porcentajes y escape seguro de texto. |
| public/js/components.js | Ilustración, iconos, estado vacío y disponibilidad. |
| public/js/views/store.js | Inicio, catálogo, ficha, bolsa, marcas, criterio, editorial, contacto y condiciones. |
| public/js/views/admin.js | Acceso, oportunidades, decisión, edición, reglas, fuentes, pedidos y actividad. |
| public/css/tokens.css | Colores exactos, tipografía, espaciado y fuentes locales. |
| public/css/base.css | Reset, textos, campos y foco. |
| public/css/components.css | Botones, avisos, diálogos, etiquetas, carga y errores. |
| public/css/store.css | Diseño de todas las vistas públicas. |
| public/css/admin.css | Diseño del acceso y panel. |
| public/css/responsive.css | Ajustes en 1100/900/700/400 px y movimiento reducido. |
| public/assets | Logo, fotografía conceptual y fuentes locales con licencias. |

## Cambios habituales

- Color o medida global: cambiar el token, no añadir otra capa de reglas al final del CSS.
- Espacio entre contraseña y botón: `#login>.btn` en admin.css.
- Icono, palabra y contador de bolsa: `.header-action` y `.bag-count` en store.css; se mantienen en una fila flex con gap.
- Textos de portada: home() en views/store.js. Titular estacional: config.js.
- Filtros: catalog() en store.js; eventos en app.js. El diámetro puede inferirse del dato explícito en variante, por ejemplo «41 mm»; no se supone movimiento ni material.
- Artículos: articles en config.js.
- Fotos múltiples: productDetails[referencia].images en config.js, hasta que estos datos lleguen desde el backend. Todas deben corresponder a la misma referencia real.
- Contacto: completar contactEmail/whatsapp/address en config.js con datos aprobados.

## Campañas

Configurar enabled, theme, startsAt y endsAt. Las fechas deben incluir -05:00. Una campaña a la vez. Conservar el logo base y los botones de compra azules; no usar artes no aprobados. El retorno automático se evalúa cada minuto y al renderizar inicio.

## Actualizar la instalación local

1. Detener el servidor con Ctrl+C.
2. Copiar `public` entero, `src/server.js` y `package.json` desde este paquete sobre la instalación actual.
3. Conservar `.env` y `data`. No borrar la base de datos.
4. Ejecutar `npm start` o `node --env-file=.env src/server.js`.
5. En el navegador: Ctrl+F5 para evitar CSS/JS antiguos.

No se necesitan dependencias nuevas. Los comandos npm cargan `.env`. Node 22.13 o superior.

## Separación de frontend y backend

Este cambio reorganiza el frontend y habilita archivos JS/CSS/fuentes locales en el servidor. No cambia el esquema SQLite, la fórmula, ni los endpoints de pedidos y oportunidades. Los datos técnicos complementarios en config.js son temporales y no se guardan desde el panel hasta ampliar el modelo de datos. La pasarela sigue pendiente.
