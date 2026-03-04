// public/js/menu-loader.js
// Carrega um partial de menu de forma segura e só injeta o <nav>.
// Evita innerHTML directo no target e executa scripts de forma controlada.
(function () {
  const TARGET_ID = 'site-menu';
  const PARTIAL_PATHS = ['/partials/menu.html', '/public/partials/menu.html'];
  const LOG_PREFIX = '[menu-loader]';
  const FETCH_TIMEOUT = 7000; // ms
  const TRUSTED_SCRIPT_ORIGINS = [location.origin]; // permitir apenas scripts da mesma origem por defeito

  function log(...args) { if (window.console) console.debug(LOG_PREFIX, ...args); }

  function timeoutFetch(url, opts = {}, ms = FETCH_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('fetch-timeout')), ms);
      fetch(url, opts).then(r => { clearTimeout(timer); resolve(r); }).catch(e => { clearTimeout(timer); reject(e); });
    });
  }

  async function fetchPartial() {
    for (const p of PARTIAL_PATHS) {
      try {
        const res = await timeoutFetch(p, { cache: 'no-cache' });
        if (!res.ok) { log('not found', p, res.status); continue; }
        const text = await res.text();
        return { html: text, path: p };
      } catch (err) {
        log('fetch error', p, err && err.message ? err.message : err);
      }
    }
    return null;
  }

  // Executa scripts de forma controlada: inline sempre; externos apenas se origin permitida.
  function runInlineScripts(container, basePath) {
    const scripts = Array.from(container.querySelectorAll('script'));
    scripts.forEach(old => {
      const ns = document.createElement('script');
      // Copy non-src attributes (type, nomodule, async, defer)
      Array.from(old.attributes).forEach(a => ns.setAttribute(a.name, a.value));
      if (old.src) {
        try {
          const url = new URL(old.src, basePath || location.href);
          if (!TRUSTED_SCRIPT_ORIGINS.includes(url.origin)) {
            log('blocked external script from untrusted origin', url.origin);
            return; // skip untrusted external script
          }
          ns.src = url.href;
          ns.async = false;
        } catch (e) {
          log('invalid script src', old.src);
          return;
        }
      } else {
        // preserve textContent for inline scripts
        ns.textContent = old.textContent;
      }
      // Replace old script with new one (this executes it)
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

  // Valida que o node é um elemento de navegação aceitável (nav, header, div com role=navigation)
  function isNavLike(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = node.tagName.toLowerCase();
    if (tag === 'nav') return true;
    if (node.getAttribute && node.getAttribute('role') === 'navigation') return true;
    return false;
  }

  async function injectMenu() {
    const target = document.getElementById(TARGET_ID);
    if (!target) { log('target not found', TARGET_ID); return; }

    removeLooseTextNodes(target);

    const partial = await fetchPartial();
    if (!partial) { log('partial not found'); return; }

    // Parse seguro com DOMParser (scripts não executam ao parsear)
    const parser = new DOMParser();
    const doc = parser.parseFromString(partial.html, 'text/html');

    // Preferir um <nav> dentro do partial; caso contrário usar o primeiro elemento "nav-like"
    let incomingNav = doc.querySelector('nav') || Array.from(doc.body.children).find(isNavLike) || doc.body.firstElementChild;

    if (!incomingNav) {
      log('no suitable nav element found in partial', partial.path);
      return;
    }

    // Clonar o node para o documento actual (adoptNode/importNode)
    const imported = document.importNode(incomingNav, true);

    // Sanity checks: garantir que não introduz IDs duplicados que possam quebrar a página
    const existingIds = new Set(Array.from(document.querySelectorAll('[id]')).map(n => n.id));
    Array.from(imported.querySelectorAll('[id]')).forEach(el => {
      if (existingIds.has(el.id)) {
        // prefixar id duplicado para evitar colisões
        el.id = `menu-${Date.now()}-${Math.random().toString(36).slice(2,6)}-${el.id}`;
      }
    });

    // Substituir nav existente apenas depois de validações
    const existingNav = target.querySelector('nav');
    if (existingNav) {
      existingNav.replaceWith(imported);
    } else {
      target.appendChild(imported);
    }

    // Executar scripts que vieram no partial de forma controlada
    try { runInlineScripts(target, partial.path); } catch (e) { log('script exec error', e && e.message ? e.message : e); }

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
