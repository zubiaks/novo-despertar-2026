// public/js/toasts.js
(function () {
  if (window.__nd_toasts_loaded) return;
  window.__nd_toasts_loaded = true;

  // Root container (created once)
  const root = document.createElement('div');
  root.className = 'toast-root';
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'false');
  root.style.pointerEvents = 'none';
  document.body.appendChild(root);

  // SVG icons as DOM nodes (safe)
  function makeIconNode(type) {
    const ns = 'http://www.w3.org/2000/svg';
    const svgMap = {
      info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
      success: '<path d="M20 6L9 17l-5-5"></path>',
      warn: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      error: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'
    };
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = svgMap[type] || svgMap.info;
    return svg;
  }

  // Respect user preference for reduced motion
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Create a toast element and return control methods
  window.showToast = function (message, type = 'info', timeout = 4200) {
    if (!message && message !== 0) return { close: () => {} };

    // Normalize timeout: <=0 means persistent until manual close
    const persistent = Number(timeout) <= 0;

    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    t.style.pointerEvents = 'auto';
    t.tabIndex = -1; // allow focus programmatically

    // Build structure safely (no innerHTML with user content)
    const iconWrap = document.createElement('span');
    iconWrap.className = 'icon-wrap';
    iconWrap.appendChild(makeIconNode(type));

    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = String(message);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Fechar');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.pointerEvents = 'auto';

    t.appendChild(iconWrap);
    t.appendChild(msg);
    t.appendChild(closeBtn);

    // Append and animate in
    root.appendChild(t);
    // Force reflow then show (skip animation if reduced motion)
    if (!reduceMotion) {
      requestAnimationFrame(() => t.classList.add('show'));
    } else {
      t.classList.add('show');
    }

    // Close logic with pause on hover/focus
    let removed = false;
    let timer = null;
    let start = Date.now();
    let remaining = Number(timeout) || 0;

    function removeToast() {
      if (removed) return;
      removed = true;
      t.classList.remove('show');
      // allow CSS transition to finish (260ms matches CSS)
      setTimeout(() => {
        try { t.remove(); } catch (e) { /* ignore */ }
      }, reduceMotion ? 0 : 260);
    }

    function startTimer() {
      if (persistent) return;
      clearTimeout(timer);
      start = Date.now();
      // if remaining is 0 (e.g., timeout undefined), set default
      if (!remaining) remaining = 4200;
      timer = setTimeout(removeToast, remaining);
    }

    function pauseTimer() {
      if (persistent) return;
      clearTimeout(timer);
      remaining -= Date.now() - start;
    }

    // Events
    closeBtn.addEventListener('click', () => {
      removeToast();
      // return focus to document body to avoid focus loss
      try { document.activeElement && document.activeElement.blur(); } catch (e) {}
    });

    t.addEventListener('mouseenter', pauseTimer);
    t.addEventListener('mouseleave', startTimer);
    t.addEventListener('focusin', pauseTimer);
    t.addEventListener('focusout', startTimer);
    t.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') removeToast(); });

    // Make close button focusable and keyboard accessible
    closeBtn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        removeToast();
      }
    });

    // Start timer unless persistent
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
