// Product identity preserves punctuation: different variants must not collapse.
export const identityKey = (brand, reference) => JSON.stringify([brand, reference].map(v => String(v).normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase()));
export function sourceFinance(source, approvedPrice, manualCost) {
  const a = source.assumptions;
  const usd = a.usePromo ? source.promo_usd : source.regular_usd;
  const shippingUsd = usd <= 2000 ? a.freightLow : a.freightHigh;
  const cif = (usd + shippingUsd + usd * a.insurance) * a.fx;
  const duty = cif * (usd <= 200 ? a.dutySmall : usd <= 2000 ? a.dutyLow : a.dutyHigh);
  const vat = (cif + duty) * a.importVat;
  const cash = cif + duty + vat + usd * a.fx * a.fxFee + (usd <= 2000 ? a.managementLow : a.managementHigh);
  const goods = manualCost ?? (cash - vat * a.recoverVat);
  const suggested = source.market_cop == null ? null : Math.round(source.market_cop * (1 - a.discount));
  const price = approvedPrice ?? suggested ?? 0;
  const income = price / (1 + a.saleVat);
  const commission = price * a.fee;
  const warranty = price * a.warranty;
  const profit = income - goods - commission - warranty - a.nationalShipping;
  return {supplier: usd * a.fx, shipping: shippingUsd * a.fx, importCost: duty, commission,
    buffer: a.nationalShipping + warranty, cash, goods, vat, income, cost: goods + commission + warranty + a.nationalShipping,
    suggested, price, profit, margin: income > 0 ? profit / income : null,
    margin_without_vat_credit: income > 0 ? (income - cash - commission - warranty - a.nationalShipping) / income : null,
    break_even: (goods + a.nationalShipping) / (1 / (1 + a.saleVat) - a.fee - a.warranty), model: 'imported', fx: a.fx};
}
export function publicationIssues(p, a, now = Date.now()) {
  const issues = [];
  for (const [k, label] of [['name','nombre'],['variant','variante'],['description','descripción'],['image_url','fotografía principal'],['condition','estado de la pieza'],['warranty','garantía'],['package_contents','contenido de entrega'],['provenance','procedencia'],['shipping_terms','condiciones de entrega']]) {
    if (!String(p[k] || '').trim()) issues.push(`Completar ${label}`);
  }
  if(p.source_snapshot_json)for(const [k,label] of [['collection','colección'],['movement','movimiento'],['diameter_mm','diámetro'],['material','material de caja'],['crystal','cristal'],['water_resistance','resistencia al agua'],['dial_color','color de esfera'],['strap','material de correa']])if(p[k]==null||String(p[k]).trim()==='')issues.push(`Completar ${label}`);
  if (p.sale_mode !== 'quote') {
    if (!(p.approved_price_cop > 0)) issues.push('Aprobar un precio de venta');
    if (!p.cost_verified) issues.push('Confirmar costos comerciales');
    if (!String(p.delivery_days || '').trim() || p.delivery_days === 'Por confirmar') issues.push('Confirmar plazo total de entrega');
    if (p.sale_mode === 'available' && p.stock < 1) issues.push('Registrar existencias propias');
    if (p.sale_mode === 'on_order' && (!p.supplier_confirmed_at || now - Date.parse(p.supplier_confirmed_at) > 86400000)) issues.push('Confirmar disponibilidad del proveedor (vigencia: 24 horas)');
    if (!a.eligible) issues.push('Revisar margen mínimo');
  }
  return issues;
}
export function publicProduct(p, analysis) {
  const keys = ['id','brand','name','reference','variant','description','image_url','stock','delivery_days','collection','movement','diameter_mm','style','condition','material','crystal','water_resistance','dial_color','case_color','strap_color','strap','warranty','package_contents','provenance','shipping_terms','sale_mode'];
  const result = Object.fromEntries(keys.map(k => [k,p[k]]));
  result.images = JSON.parse(p.images_json || '[]');
  result.availability = p.sale_mode;
  result.price_cop = p.sale_mode === 'quote' ? null : analysis.price;
  result.is_demo = !p.source_snapshot_json;
  return result;
}
