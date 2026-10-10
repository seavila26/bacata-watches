import { escapeHtml, safeImage } from './utils.js';
export function art(p) {
  if (p.image_url && safeImage(p.image_url)) return `<img src="${escapeHtml(safeImage(p.image_url))}" alt="Reloj ${escapeHtml(p.brand)} ${escapeHtml(p.name)}" loading="lazy">`;
  const palette = ['#243f4b', '#463b2e', '#334d3b', '#51484b', '#283644'];
  let value = 0;
  for (const c of p.reference) value += c.charCodeAt(0);
  const dial = palette[value % palette.length];
  return `<svg viewBox="0 0 400 400" role="img" aria-label="Ilustración conceptual de ${escapeHtml(p.brand)} ${escapeHtml(p.name)}">
    <defs>
    <radialGradient id="glow">
    <stop stop-color="#fff" stop-opacity=".19"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    </defs>
    <rect x="163" y="-30" width="74" height="460" rx="17" fill="#242621"/>
    <rect x="163" y="-30" width="74" height="460" rx="17" fill="url(#glow)"/>
    <circle cx="200" cy="200" r="113" fill="#b7bcb2"/>
    <circle cx="200" cy="200" r="103" fill="#121713"/>
    <circle cx="200" cy="200" r="96" fill="${dial}"/>${Array.from({
    length: 12
  }, (_, i) => `<line x1="200" y1="113" x2="200" y2="130" stroke="#e8d7ad" stroke-width="${i % 3 === 0 ? 4 : 2}" transform="rotate(${i * 30} 200 200)"/>`).join('')}<text x="200" y="168" text-anchor="middle" font-family="Georgia" font-size="13" letter-spacing="2" fill="#eadcbe">${escapeHtml(p.brand.toUpperCase())}</text>
    <line x1="200" y1="200" x2="236" y2="153" stroke="#eadcbe" stroke-width="6" stroke-linecap="round"/>
    <line x1="200" y1="200" x2="153" y2="180" stroke="#eadcbe" stroke-width="4" stroke-linecap="round"/>
    <circle cx="200" cy="200" r="5" fill="#d3b67e"/>
    <circle cx="200" cy="200" r="96" fill="url(#glow)"/>
    </svg>`;
}
export function icon(name) {
  const paths = {
    bag: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 1 9 8 15 7-6 12-11 8-15Z"/>'
  };
  return `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}
export function emptyState(title, message, action = '') {
  return `<div class="empty">
    <span class="empty-mark">${icon('clock')}</span>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(message)}</p>${action}</div>`;
}
export function productAvailability(p) {
  if (p.availability === 'quote') return {
    key: 'quote',
    label: 'Por cotizar',
    action: 'Consultar esta pieza',
    buy: false
  };
  if (p.availability === 'on_order') return {
    key: 'on_order',
    label: 'Bajo pedido',
    action: 'Consultar pedido',
    buy: false
  };
  if (p.stock <= 0 || p.availability === 'sold_out') return {
    key: 'sold_out',
    label: 'Agotado',
    action: 'Consultar disponibilidad',
    buy: false
  };
  return {
    key: 'available',
    label: 'Disponible',
    action: 'Añadir a la bolsa',
    buy: true
  };
}
