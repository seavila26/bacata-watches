# Verificación frontend v0.3

## Navegador

Pruebas con Chromium sin interfaz, API real de la aplicación y base SQLite temporal de prueba. Revisión visual de capturas de portada escritorio/móvil, login, panel, decisión y ficha.

- Inicio y catálogo: 320, 375, 768, 1024, 1440 px; sin desborde horizontal del documento.
- Administración, Marcas, Cómo elegimos, Editorial, Contacto y Condiciones: mismos cinco tamaños; sin desborde del documento.
- La tabla administrativa mantiene scroll interno para conservar la lectura de cifras.
- Sin errores JavaScript ni violaciones de CSP en el recorrido final.
- Fuentes locales Caladea y Noto Sans cargadas y comprobadas mediante FontFaceSet.
- Icono → palabra Bolsa: 8 px. Palabra → contador: 10 px; verificación de rectángulos DOM.
- Campo contraseña → botón Ingresar: 32 px.
- Acceso administrativo, tabla, revisión y formulario de edición cargados.
- Búsqueda sin resultados y restablecimiento funcionales.
- Ficha, ampliación con diálogo, cierre con Escape y añadir a bolsa funcionales.
- Bolsa, aceptación de condiciones y creación de solicitud de prueba verificadas.
- Menú móvil, navegación a editorial y cierre de diálogo al cambiar de ruta verificados.
- Sintaxis JS de módulos comprobada.

## Límites

No constituye auditoría WCAG completa ni pruebas en todos los dispositivos físicos. No se probaron pagos, proveedores externos ni ventas reales. Los filtros de movimiento y estilo requieren datos técnicos aprobados; se deshabilitan explícitamente si no existen. Los estados bajo pedido/por cotizar/agotado están preparados en frontend pero la API actual solo entrega publicados con stock positivo.
