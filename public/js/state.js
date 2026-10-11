function readCart() {
  try {
    const data = JSON.parse(localStorage.getItem('aurel-cart') || '{}');
    return Object.fromEntries(Object.entries(data).filter(([id, qty]) => typeof id === 'string' && Number.isInteger(qty) && qty > 0 && qty <= 10));
  } catch {
    return {};
  }
}
export const state = {
  opportunitySelection: new Set(),
  opportunityFilter: 'launch',
  publicationSelection: new Set(),
  publicationPage: 0,
  publicationFilter: {
    brand: '',
    status: '',
    query: '',
    sort: 'published_at',
    direction: 'desc'
  },
  catalogPreview: null,
  catalogResult: null,
  importPreview: null,
  importSelection: new Set(),
  importFilter: 'launch',
  importQuery: '',
  importPage: 0,
  adminQuery: '',
  adminStatus: '',
  adminPage: 0,
  products: [],
  admin: null,
  tab: 'oportunidades',
  selected: null,
  filters: {
    q: '',
    brand: '',
    price: '',
    movement: '',
    diameter: '',
    style: '',
    availability: ''
  },
  cart: readCart()
};
