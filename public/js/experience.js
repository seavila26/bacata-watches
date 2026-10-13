/** Presentation only: preferences, motion and accessible table controls. */
let observer;
export function syncThemeControls() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.querySelectorAll('[data-action="theme"]').forEach(button => {
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
    button.title = dark ? 'Activar modo claro' : 'Activar modo oscuro';
  });
}
export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('bacata-theme', next); } catch { /* Session preference still works. */ }
  syncThemeControls();
}
export function enhanceView(root) {
  syncThemeControls();
  root.querySelectorAll('.table-wrap').forEach((table, index) => {
    table.tabIndex = 0;
    table.setAttribute('role', 'region');
    table.setAttribute('aria-label', `Tabla de datos ${index + 1}. Desplaza para consultar todas las columnas.`);
    table.querySelectorAll('thead th').forEach(th => th.scope = 'col');
    table.querySelectorAll('input[type="checkbox"]').forEach(input => {
      if (input.parentElement.tagName === 'LABEL') return;
      const label = document.createElement('label');
      label.className = 'selection-check';
      input.replaceWith(label);
      label.append(input);
    });
  });
  observer?.disconnect();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-revealed');
    observer.unobserve(entry.target);
  }), { threshold: .08 });
  root.querySelectorAll('[data-reveal]').forEach(element => {
    if (element.getBoundingClientRect().top < innerHeight) return;
    element.classList.add('reveal-ready');
    observer.observe(element);
  });
}
export function enterView(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.remove('view-enter');
  void root.offsetWidth;
  root.classList.add('view-enter');
}
