// Identity keeps punctuation; only case and whitespace are normalized.
export const normalizeIdentity = v => String(v ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase();
export const identityKey = (brand, reference) => JSON.stringify([brand, reference].map(normalizeIdentity));
export const REQUIRED = {
  collection: 'colección',
  movement: 'movimiento',
  diameter_mm: 'diámetro',
  material: 'material',
  crystal: 'cristal',
  water_resistance: 'resistencia al agua',
  dial_color: 'color de esfera',
  strap: 'material de correa',
  image_url: 'image_1'
};
export const GLOBAL_DEFAULTS = {
  fx: '4000',
  duty: '0.20',
  fee: '0.035',
  logistics_rate: '0',
  discount: '0.03',
  min_margin: '0.10',
  delivery_days: '5 a 10 días hábiles',
  warranty: 'Garantía del comercio según las condiciones de compra',
  shipping_terms: 'Condiciones de envío informadas al finalizar la compra'
};
export function sourceFinance(source, approvedPrice = null, settings = GLOBAL_DEFAULTS) {
  const s = {
      ...GLOBAL_DEFAULTS,
      ...settings
    },
    a = source.assumptions || {};
  const usd = source.price_usd ?? (a.usePromo === 0 ? source.regular_usd : source.promo_usd);
  const shippingUsd = source.shipping_usd ?? (usd <= 2000 ? a.freightLow ?? 0 : a.freightHigh ?? 0);
  const fx = +s.fx,
    valid = !source.finance_error && Number.isFinite(usd) && usd > 0 && Number.isFinite(shippingUsd) && shippingUsd >= 0;
  const supplier = valid ? Math.round(usd * fx) : null,
    shipping = valid ? Math.round(shippingUsd * fx) : null;
  const market = source.market_cop > 0 ? source.market_cop : null;
  const comparable = !!market && source.evidence === true && !source.finance_error;
  const suggested = comparable ? Math.round(market * (1 - +s.discount)) : null;
  const price = comparable ? approvedPrice ?? suggested : null;
  const importCost = valid ? Math.round((supplier + shipping) * +s.duty) : null;
  const commission = valid && price > 0 ? Math.round(price * +s.fee) : null;
  const buffer = valid ? Math.round((supplier + shipping) * +s.logistics_rate) : null;
  const cost = valid && commission != null ? supplier + shipping + importCost + commission + buffer : null;
  const profit = cost != null && price > 0 ? price - cost : null,
    margin = profit != null ? profit / price : null;
  return {
    supplier,
    shipping,
    shipping_usd: shippingUsd,
    price_usd: usd,
    importCost,
    commission,
    buffer,
    cost,
    market,
    suggested,
    price,
    profit,
    margin,
    fx,
    comparable,
    eligible: valid && comparable && margin != null && margin >= +s.min_margin,
    model: 'global',
    quote_reason: source.finance_error || (!market ? 'Verificar precio: sin comparable' : !source.evidence ? 'Verificar precio comparable' : !valid ? 'Por cotizar: precio proveedor inválido' : null)
  };
}
export function publicationIssues(p, a) {
  const issues = Object.entries(REQUIRED).filter(([k]) => p[k] == null || String(p[k]).trim() === '').map(([, label]) => `Completar ${label}`);
  if (!a.comparable) {
    issues.push('Verificar precio comparable');
    if (a.quote_reason) issues.push(a.quote_reason);
  }
  if (a.margin == null) issues.push('Por cotizar: margen no calculable');else if (!a.eligible) issues.push('Margen inferior al mínimo');
  return issues;
}
export function publicationState(p, now = Date.now()) {
  if (p.status === 'published' && (!p.last_confirmed_at || !Number.isFinite(Date.parse(p.last_confirmed_at)) || now - Date.parse(p.last_confirmed_at) > 3 * 86400000)) return 'requires_confirmation';
  return p.status;
}
export function publicProduct(p, analysis, s = GLOBAL_DEFAULTS) {
  const keys = ['id', 'brand', 'name', 'reference', 'variant', 'description', 'image_url', 'collection', 'movement', 'diameter_mm', 'style', 'condition', 'material', 'crystal', 'water_resistance', 'dial_color', 'case_color', 'strap_color', 'strap', 'package_contents', 'provenance'];
  return {
    ...Object.fromEntries(keys.map(k => [k, p[k]])),
    images: JSON.parse(p.images_json || '[]'),
    availability: 'available',
    price_cop: analysis.price,
    delivery_days: s.delivery_days,
    warranty: s.warranty,
    shipping_terms: s.shipping_terms,
    is_demo: false
  };
}
