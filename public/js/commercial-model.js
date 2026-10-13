/** Texto plano compartido entre servidor y formulario. Nunca incluir secretos. */
export const commercialFields = [
  ['trade_name', 'Nombre comercial', 'Identidad', 120],
  ['legal_name', 'Nombre o razón social del vendedor', 'Identidad', 200],
  ['tax_id', 'NIT', 'Identidad', 40],
  ['address', 'Dirección de notificación', 'Identidad', 300],
  ['email', 'Correo de atención', 'Contacto', 254],
  ['whatsapp', 'WhatsApp con indicativo de país', 'Contacto', 15],
  ['coverage', 'Cobertura de envíos', 'Envíos', 300],
  ['delivery', 'Plazos de entrega', 'Envíos', 2000],
  ['shipping', 'Instrucciones adicionales de envío', 'Envíos', 4000],
  ['warranty', 'Garantía comercial y procedimiento', 'Posventa', 8000],
  ['returns', 'Cambios, devoluciones y retracto', 'Posventa', 8000],
  ['privacy', 'Tratamiento de datos personales', 'Privacidad', 8000]
];
export const commercialDefaults = {
  trade_name: 'Relojería Bacatá', legal_name: '', tax_id: '', address: '', email: '',
  whatsapp: '573246871623', coverage: 'Colombia',
  delivery: 'Entrega de 1 a 5 días hábiles desde la confirmación del pedido.',
  shipping: 'El envío se calcula según el destino y se muestra antes de confirmar el pago.',
  shipping_bogota_cop: 0, shipping_national_cop: 25000,
  warranty: 'La garantía aplicable, su duración, responsable y documentación se confirman para cada referencia antes de comprar. Para solicitar orientación, contacta a Bacatá por WhatsApp con la referencia y una descripción de la falla. No envíes el reloj sin coordinar su recepción.',
  returns: 'Texto provisional. Las condiciones comerciales de cambios, devoluciones y retracto están pendientes de aprobación. Esta versión solo recibe solicitudes de prueba; no realiza cobros ni reservas.',
  privacy: 'Texto provisional. La política de tratamiento de datos personales está pendiente de aprobación antes de habilitar compras reales. Evita introducir información personal en las solicitudes de prueba.',
  provisional: true
};
export function validateCommercial(input) {
  const allowed = new Set([...commercialFields.map(([key]) => key), 'provisional', 'shipping_bogota_cop', 'shipping_national_cop']);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.has(key))) throw Error('Campo comercial no permitido');
  const result = {};
  for (const [key, label, , max] of commercialFields) {
    if (typeof input[key] !== 'string' || input[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input[key])) throw Error(`Revisa el campo: ${label}`);
    result[key] = input[key].trim();
  }
  for (const key of ['shipping_bogota_cop','shipping_national_cop']) {
    const value = input[key];
    if (!['number','string'].includes(typeof value) || value === '' || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)<0 || Number(value)>1000000) throw Error('Las tarifas de envío deben ser pesos enteros entre 0 y 1.000.000');
    result[key] = Number(value);
  }
  if (!result.trade_name || !result.whatsapp || !result.coverage || !result.warranty || !result.returns || !result.privacy || !result.delivery || !result.shipping) throw Error('Completa los textos comerciales obligatorios');
  if (result.whatsapp && !/^[1-9]\d{7,14}$/.test(result.whatsapp)) throw Error('WhatsApp debe incluir indicativo de país, sin espacios ni signos');
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw Error('Correo de atención inválido');
  if (typeof input.provisional !== 'boolean') throw Error('Indica si la información es provisional');
  result.provisional = input.provisional;
  if (!result.provisional && ['legal_name', 'tax_id', 'address', 'email', 'whatsapp'].some(key => !result[key])) throw Error('Para retirar el aviso provisional, completa la identidad legal, NIT, dirección, correo y WhatsApp');
  return result;
}
