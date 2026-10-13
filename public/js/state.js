import { commercialDefaults } from './commercial-model.js';
function readDestination() {
  try { const value=JSON.parse(sessionStorage.getItem('bacata-destination') || 'null');
    if(['bogota','national'].includes(value?.zone) && typeof value.city === 'string' && value.city.length<=100) return value;
  } catch {}
  return {zone:'',city:''};
}
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
  commercial: { ...commercialDefaults },
  admin: null,
  paymentConfig: { enabled:false, mode:'disabled' },
  paymentResult:null,
  shippingDestination: readDestination(),
  paymentError:'',
  orderList: null,
  selectedOrder: null,
  orderFilter: { q: '', status: '', page: 1 },
  tab: 'resumen',
  catalogSort: 'selection',
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
