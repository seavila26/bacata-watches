# Verificación · Bacatá v0.4

## Resultados ejecutados

- `npm test`: siete pruebas, todas aprobadas. Cubren vista previa sin escritura, coincidencias, errores de fórmula, cálculo conocido de Bulova 96B349, ingreso sin IVA y escenario sin crédito, borradores con stock cero, edición técnica y galería, precio manual, requisitos de publicación, vigencia del proveedor, privacidad, conservación en recargas, bloqueo de corte antiguo, conflicto concurrente y reversión completa, referencias con barras/espacios, autenticación, origen, carga inválida y cierre de sesión.
- Inventario real al corte 07/10/2026: 1.968 referencias únicas, diez solapamientos reunidos, cero filas bloqueadas. Se ignoran 9.520 resultados de fórmula erróneos en las bases (ocho celdas por cada una de las 1.190 filas de lujo sin comparable). La prueba guardó todas en una base temporal: 1.968 pendientes y cero unidades propias.
- El filtro de inicio reúne 149 candidatos con margen de al menos 10%, evidencia local elegible, anuncio In Stock y compra de hasta USD 2.000, usando los supuestos del archivo.
- Validación sintáctica de los módulos de servidor y frontend.
- Verificación del DOM con el inventario real: 50 filas por página, selección por filtro, formulario técnico/comercial y requisitos visibles.

## Alcance y límites

Las pruebas usan bases temporales y credenciales de prueba. No se modificó una instalación del usuario, no se consultó disponibilidad en vivo y no se publicaron referencias comerciales.

No se pudo ejecutar la revisión visual en un navegador: el entorno no disponía de Chromium y su descarga no entregó un archivo utilizable. Se verificaron estructura HTML, campos, estados y reglas CSS, pero no hay nuevas capturas ni comprobación visual de escritorio/móvil en esta entrega. Las capturas previas incluidas en `docs/previews` corresponden a v0.3.

La prueba HTTP verifica el servidor real en un proceso aislado. Pagos, reservas, contactos comerciales y sincronización activa de Jomashop siguen pendientes.
