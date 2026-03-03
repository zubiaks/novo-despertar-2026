// public/js/menu-loader.js
// Carrega um partial de menu de forma segura e só injeta o <nav>.
// Evita innerHTML directo no target e executa scripts de forma controlada.
(function () {
  const TARGET_ID = 'site-menu';
  const PARTIAL_PATHS = ['/partials/menu.html', '/public/partials/menu.html'];
  const LOG_PREFIX = '[menu-loader]';

  function log(...args) { if (window.console) console.debug(LOG_PREFIX, ...args); }

  async function fetchPartial() {
    for (const p of PARTIAL_PATHS) {
      try {
        const res = await fetch(p, { cache: 'no-cache' });
        if (!res.ok) { log('not found', p, res.status); continue; }
        const text = await res.text();
        return { html: text, path: p };
      } catch (err) {
        log('fetch error', p, err && err.message ? err.message : err);
      }
    }
    return null;
  }

  // Substitui scripts inline e externos de forma segura para que sejam executados
  function runInlineScripts(container) {
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach(old => {
      const ns = document.createElement('script');
      // Preserve src for external scripts, otherwise copy textContent
      if (old.src) {
        ns.src = old.src;
        ns.async = false;
      } else {
        ns.textContent = old.textContent;
      }
      // Copy non-src attributes (type, nomodule, etc.)
      Array.from(old.attributes).forEach(a => {
        if (a.name !== 'src') ns.setAttribute(a.name, a.value);
      });
      old.parentNode.replaceChild(ns, old);
    });
  }

  // Remove nós de texto soltos e curtos que podem ter sido injetados por engano
  function removeLooseTextNodes(target) {
    const toRemove = [];
    target.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        const txt = n.textContent.trim();
        if (!txt) toRemove.push(n);
        else if (txt.length < 60 && !/\n/.test(n.textContent)) toRemove.push(n);
      }
    });
    toRemove.forEach(n => n.parentNode.removeChild(n));
  }

  async function injectMenu() {
    const target = document.getElementById(TARGET_ID);
    if (!target) { log('target not found', TARGET_ID); return; }

    // Limpeza preventiva de nós de texto soltos
    removeLooseTextNodes(target);

    const partial = await fetchPartial();
    if (!partial) { log('partial not found'); return; }

    // Parse seguro do HTML do partial
    const container = document.createElement('div');
    container.innerHTML = partial.html;

    // Preferir um <nav> dentro do partial; caso contrário usar o primeiro elemento
    const incomingNav = container.querySelector('nav') || container.firstElementChild;
    if (incomingNav) {
      const existingNav = target.querySelector('nav');
      if (existingNav) existingNav.replaceWith(incomingNav);
      else target.appendChild(incomingNav);
    } else {
      // Se não houver nav, anexar filhos filtrando scripts para execução controlada
      while (container.firstChild) {
        const node = container.firstChild;
        target.appendChild(node);
      }
    }

    // Executar scripts que vieram no partial de forma controlada
    try { runInlineScripts(target); } catch (e) { log('script exec error', e && e.message ? e.message : e); }

    // Dispatch event para que outras partes da app saibam que o menu está pronto
    document.dispatchEvent(new CustomEvent('menu:loaded', { detail: { path: partial.path } }));
    log('menu injected from', partial.path);
  }

  // Inicialização: aguarda DOMContentLoaded se necessário
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectMenu);
  } else {
    // Pequeno timeout para garantir que outros scripts inline já registaram listeners
    setTimeout(injectMenu, 0);
  }
})();
