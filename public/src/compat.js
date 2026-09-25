(function() {
  try { var t = localStorage.getItem('theme') || 'dark'; document.documentElement.dataset.theme = t; } catch(e) {}
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  }
})();
