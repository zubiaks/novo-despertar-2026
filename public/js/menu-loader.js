// public/js/menu-loader.js (versão segura)
(function () {
  const TARGET_ID = 'site-menu';
  const PARTIAL_PATHS = ['/partials/menu.html', '/public/partials/menu.html'];

  function log(...args){ if (window.console) console.log('[menu-loader]', ...args); }

  async function fetchPartial() {
    for (const p of PARTIAL_PATHS) {
      try {
        const res = await fetch(p, { cache: 'no-cache' });
        if (!res.ok) { log('not found', p, res.status); continue; }
        return { html: await res.text(), path: p };
      } catch (err) {
        log('fetch error', p, err);
      }
    }
    return null;
  }

  function runInlineScripts(container) {
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach(old => {
      const ns = document.createElement('script');
      if (old.src) { ns.src = old.src; ns.async = false; }
      else ns.textContent = old.textContent;
      Array.from(old.attributes).forEach(a => { if (a.name !== 'src') ns.setAttribute(a.name, a.value); });
      old.parentNode.replaceChild(ns, old);
    });
  }

  function removeLooseTextNodes(target) {
    const toRemove = [];
    target.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        const txt = n.textContent.trim();
        if (!txt) toRemove.push(n);
        else if (txt.length < 40 && !/\n/.test(n.textContent)) toRemove.push(n);
      }
    });
    toRemove.forEach(n => n.parentNode.removeChild(n));
  }

  async function injectMenu() {
    const target = document.getElementById(TARGET_ID);
    if (!target) { log('target not found:', TARGET_ID); return; }

    removeLooseTextNodes(target);

    const partial = await fetchPartial();
    if (!partial) { log('partial not found'); return; }

    const container = document.createElement('div');
    container.innerHTML = partial.html;

    const incomingNav = container.querySelector('nav') || container.firstElementChild;
    if (incomingNav) {
      const existingNav = target.querySelector('nav');
      if (existingNav) existingNav.replaceWith(incomingNav);
      else target.appendChild(incomingNav);
    } else {
      while (container.firstChild) target.appendChild(container.firstChild);
    }

    try { runInlineScripts(target); } catch (e) { log('script exec error', e); }

    document.dispatchEvent(new CustomEvent('menu:loaded', { detail: { path: partial.path } }));
    log('menu injected from', partial.path);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectMenu);
  else setTimeout(injectMenu, 0);
})();
