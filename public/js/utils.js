export const money = n => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
}).format(n || 0);
export const percent = n => new Intl.NumberFormat('es-CO', {
  style: 'percent',
  maximumFractionDigits: 1
}).format(n || 0);
export const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
export const safeImage = url => {
  try {
    const u = new URL(url, location.href);
    return ['https:', 'http:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
};
