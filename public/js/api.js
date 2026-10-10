import { productDetails } from './config.js';
export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? {
        'content-type': 'application/json'
      } : {}),
      ...options.headers
    }
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error('Respuesta inválida del servidor');
  }
  if (!response.ok) throw Error(data.error || `Error ${response.status}`);
  return data;
}
export const request = (path, method, body) => api(path, {
  method,
  body: JSON.stringify(body)
});
export function normalizeProducts(products) {
  return products.map(product => {
    const diameter = String(product.variant || '').match(/(\d+(?:\.\d+)?)\s*mm/i);
    return {
      ...product,
      ...(product.is_demo ? productDetails[product.reference] : {}),
      diameter_mm: product.diameter_mm ?? (product.is_demo ? productDetails[product.reference]?.diameter_mm : null) ?? (diameter ? Number(diameter[1]) : null)
    };
  });
}
