function readCart() {
  try {
    const data = JSON.parse(localStorage.getItem('aurel-cart') || '{}');
    return Object.fromEntries(Object.entries(data).filter(([id, qty]) => typeof id === 'string' && Number.isInteger(qty) && qty > 0 && qty <= 10));
  } catch {
    return {};
  }
}
export const state = {
  bulkSelection:new Set(),bulkFilter:'launch',bulkQuery:'',bulkPage:0,bulkPlan:null,proposalSelection:new Set(),proposalEdits:{},proposalFilter:'proposed',proposalPage:0,
  importPreview: null, importSelection: new Set(), importFilter: 'all', importQuery: '', importPage: 0,
  adminQuery: '', adminStatus: '', adminPage: 0,
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
