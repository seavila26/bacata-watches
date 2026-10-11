# Validación del flujo simplificado

`npm test` ejecuta pruebas con bases SQLite temporales y credenciales de prueba; no modifica una instalación comercial.

Cobertura:

- Clave exacta con normalización de mayúsculas/espacios y conservación de puntuación.
- Análisis de base y de fichas sin escritura; duplicados y errores de fórmula.
- Parámetros globales, desglose que suma al costo, comparable y prioridad del precio aprobado.
- Exportación con 16 columnas y 55 referencias, incluyendo todas las páginas.
- Vacíos que conservan datos; actualizaciones parciales de imágenes; rechazo de referencias inexistentes.
- Publicación automática, motivos de borrador y pausa por margen.
- Recargas que conservan contenido y pausas manuales; ausencia de referencias sin borrado.
- Regla de más de 72 horas, confirmación y bloqueo de compra vencida.
- API pública con lista explícita de campos comprobada contra productos publicados reales de prueba.
- Acciones individuales y masivas, exportación de publicaciones y condiciones globales.
- Concurrencia, reversión completa y bloqueo de vistas previas con reglas cambiadas.
- Migración desde esquema anterior preservando productos, fotos, precios aprobados, pedidos e historial.
- Autenticación, origen, imágenes inválidas y eliminación de endpoints anteriores.
- Renderizado de las cuatro vistas y selección persistente entre páginas.

El flujo HTTP inicia un servidor real, importa 55 oportunidades y publica cuatro fichas de prueba. Las pruebas de frontend verifican filtros y HTML generado; no equivalen a una revisión visual en navegador. Chromium no está instalado en este entorno, por lo que no se han generado nuevas capturas ni validado visualmente todos los tamaños de pantalla.

La pasarela de pagos no forma parte de este cambio. No se consultan proveedores externos ni se descargan fotografías. Los datos de ejemplo son ficticios.
