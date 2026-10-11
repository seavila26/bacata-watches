// Runs before the stylesheet: light is the brand's default, dark is opt-in.
(() => {
  try {
    document.documentElement.dataset.theme = localStorage.getItem('bacata-theme') === 'dark' ? 'dark' : 'light';
  } catch { document.documentElement.dataset.theme = 'light'; }
})();
