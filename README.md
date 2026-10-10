# Relojería Bacatá v0.5

Añade preparación de fichas por lote, extracción verificable, propuestas en español, plantillas y publicación masiva. Conserva el diseño de v0.3 e incorpora importador XLSX con vista previa, selección, actualización de referencias y editor de fichas persistente en SQLite.

## Iniciar una instalación nueva

Requiere Node.js 22.13 o superior.

1. Copia `.env.example` a `.env` y configura correo, contraseña de al menos 16 caracteres y secreto de sesión de al menos 32.
2. Ejecuta `npm ci` para instalar ExcelJS y sus dependencias.
3. Ejecuta `npm start` y abre `http://localhost:3000`.
4. Entra a Administración y luego a Importar inventario.

Para desarrollo: `npm run dev`. Opcional: `SEED_DEMO=false` en `.env` evita crear los productos ficticios cuando la base está vacía. No elimina productos existentes.

## Actualizar desde v0.3 o v0.4

1. Detén el servidor.
2. Haz una copia de seguridad de `data`, `.env` y `public/uploads` si existe.
3. Copia `src`, `public` y `docs` de esta entrega sobre tu proyecto. Fusiona `public` conservando tus imágenes y la carpeta `uploads`.
4. Copia también `package.json`, `package-lock.json`, `tests`, `scripts`, `examples` y este README.
5. Conserva tu `.env` y tu carpeta `data`. Este paquete no contiene bases ni credenciales de uso real.
6. Ejecuta `npm ci` y después `npm start`. La migración se aplica al iniciar y conserva productos, pedidos, configuración y actividad.
7. Pulsa Ctrl+F5 para renovar los módulos del navegador.

## Preparar las fichas de los 149 candidatos

Después de importar, abre **Preparar catálogo**, selecciona los candidatos de inicio y pulsa **Probar con las primeras 10 seleccionadas**. Revisa las propuestas antes de aplicarlas. Crea plantillas de condiciones comunes y prepara la vista previa de publicación para varias referencias a la vez. Lee `docs/ENRIQUECIMIENTO.md` para el flujo, configuración, formato del catálogo autorizado y limitaciones.

La lectura directa de Jomashop no pudo verificarse desde este entorno: las diez consultas del piloto no pudieron resolver el dominio. No hay fichas ni fotos reales precompletadas en este paquete. El adaptador y el flujo se probaron con registros de prueba; ejecuta el piloto desde tu instalación antes de completar el catálogo. La redacción IA es opcional y requiere una clave de API en el servidor; sin clave se prepara texto básico.

## Uso del inventario

Lee `docs/INVENTARIO.md`: flujo completo, modalidades, precio aprobado, conservación de fichas, costos, fotos, estructura de código y limitaciones.

La carga reconoce Base comparada, Base lujo y Supuestos del Excel suministrado. La vista previa no modifica el catálogo. Las referencias elegidas se guardan como borradores por cotizar, con stock propio cero. Marca y referencia exacta identifican el producto. Las actualizaciones conservan contenido comercial y precios aprobados, y pausan publicaciones si cambia el dato del proveedor.

La publicación exige una ficha completa y condiciones de venta. Bajo pedido requiere confirmación del proveedor de menos de 24 horas. Las fotografías se pueden subir desde el editor o usar por enlace HTTPS. La información privada de compra y rentabilidad se excluye de la API pública.

El feed CSV configurado mediante `SUPPLIER_FEED_URL` queda disponible para fuentes independientes. No actualiza referencias administradas por XLSX. La carga manual CSV inmediata se retiró para evitar saltarse la vista previa. Las cargas nuevas no publican automáticamente.

## Verificación

- `npm test`: 16 pruebas automatizadas de modelo, importación, edición y API.
- `npm run test:inventory -- "ruta/al/inventario.xlsx"`: carga real en una base temporal y comprueba borradores/stock cero.

## Diseño

- `docs/FRONTEND.md`: mapa de estilos y componentes de v0.3.
- `docs/INVENTARIO.md`: mapa del importador y editor.
- `docs/ENRIQUECIMIENTO.md`: nuevo flujo de preparación y revisión masiva.
- `docs/MANUAL-REVISION.md`: revisión del libro de marca.
- `docs/QA-v0.4.md`: pruebas anteriores.
- `docs/ENRIQUECIMIENTO.md`: pruebas y límites de v0.5.

## Operación pendiente

La pasarela sigue pendiente. Las solicitudes de bolsa son pruebas sin cobro ni reserva. Completa canales de contacto en `public/js/config.js`, revisa las condiciones de demostración, fotografías, garantías y datos comerciales antes del lanzamiento. No hay extracción en vivo de Jomashop. Guarda `data` y `public/uploads` en disco persistente y respalda ambos. Sesiones y vistas previas se pierden al reiniciar el servidor.
