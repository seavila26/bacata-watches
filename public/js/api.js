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
  if (!response.ok) throw Object.assign(Error(data.error || `Error ${response.status}`), { status: response.status });
  return data;
}
export const request = (path, method, body) => api(path, {
  method,
  body: JSON.stringify(body)
});
export function normalizeProducts(products) {
  return products;
}
