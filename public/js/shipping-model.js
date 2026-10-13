/** Solo estimación visual; el importe definitivo se calcula en el servidor. */
export function shippingEstimate(zone, commercial) {
  return zone === 'bogota' ? commercial.shipping_bogota_cop : zone === 'national' ? commercial.shipping_national_cop : null;
}
export function normalizeCity(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
}
export const bogotaNames = new Set(['bogota','bogotadc','santafedebogota','santafedebogotadc']);
