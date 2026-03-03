// public/js/toasts.js
(function () {
  if (window.__nd_toasts_loaded) return;
  window.__nd_toasts_loaded = true;

  // Root container
  const root = document.createElement('div');
  root.className = 'toast-root';
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'false');
  root.style.pointerEvents = 'none';
  document.body.appendChild(root);

  // Helpers
  function makeIcon(type) {
    const svg = {
      info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      success: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>',
      warn: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      error: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
    };
    return svg[type] || svg.info;
  }

  // Create a toast element and return control methods
  window.showToast = function (message, type = 'info', timeout = 4200) {
    if (!message) return { close: () => {} };

    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    t.style.pointerEvents = 'auto';

    // Inner structure
    t.innerHTML = `
      ${makeIcon(type)}
      <div class="msg">${String(message)}</div>
      <button class="close" aria-label="Fechar" type="button">&times;</button>
    `;

    // Append and animate in
    root.appendChild(t);
    // Force reflow then show
    requestAnimationFrame(() => t.classList.add('show'));

    // Close logic with pause on hover
    let removed = false;
    let timer = null;
    let start = Date.now();
    let remaining = timeout;

    function removeToast() {
      if (removed) return;
      removed = true;
      t.classList.remove('show');
      setTimeout(() => {
        try { t.remove(); } catch (e) { /* ignore */ }
      }, 260);
    }

    function startTimer() {
      if (timeout <= 0) return;
      clearTimeout(timer);
      start = Date.now();
      timer = setTimeout(removeToast, remaining);
    }

    function pauseTimer() {
      if (timeout <= 0) return;
      clearTimeout(timer);
      remaining -= Date.now() - start;
    }

    // Events
    const closeBtn = t.querySelector('.close');
    closeBtn.addEventListener('click', removeToast);
    t.addEventListener('mouseenter', pauseTimer);
    t.addEventListener('mouseleave', startTimer);
    t.addEventListener('focusin', pauseTimer);
    t.addEventListener('focusout', startTimer);
    t.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') removeToast(); });

    // Start timer
    startTimer();

    // Return control handle
    return {
      close: removeToast,
      element: t
    };
  };

  // Convenience wrappers
  window.toastInfo = (m, t) => window.showToast(m, 'info', typeof t === 'number' ? t : 4200);
  window.toastSuccess = (m, t) => window.showToast(m, 'success', typeof t === 'number' ? t : 4200);
  window.toastWarn = (m, t) => window.showToast(m, 'warn', typeof t === 'number' ? t : 4200);
  window.toastError = (m, t) => window.showToast(m, 'error', typeof t === 'number' ? t : 0); // errors persist until closed

})();
