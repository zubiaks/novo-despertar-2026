// public/js/menu-loader.js — loader robusto de partials + assets
(function(){
  if (window.__nd_menu_loader) return;
  window.__nd_menu_loader = true;

  const insertHTML = (selector, html) => {
    const el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  };

  const fetchText = async (url) => {
    const res = await fetch(url, {cache: 'no-cache'});
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return res.text();
  };

  // carrega CSS do tema se não existir
  const ensureThemeCss = () => {
    if (!document.querySelector('link[href^="/css/theme.css"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = '/css/theme.css?v=1';
      document.head.appendChild(l);
    }
  };

  // injeta script (evita duplicados)
  const injectScript = (src) => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.head.appendChild(s);
  };

  const loadPartials = async () => {
    try {
      ensureThemeCss();

      const menuHtml = await fetchText('/partials/menu.html');
      insertHTML('#site-menu', menuHtml);

      const footerHtml = await fetchText('/partials/footer.html');
      insertHTML('#site-footer', footerHtml);

      // carregar toasts.js automaticamente
      try {
        injectScript('/js/toasts.js');
      } catch(e){ /* não bloqueia */ }

      // inicializar comportamentos do menu (hamburger, token UI)
      try {
        const nav = document.querySelector('.site-nav');
        const burger = document.querySelector('.site-nav .burger');
        if (burger && nav) {
          burger.addEventListener('click', ()=> nav.classList.toggle('open'));
        }

        // token UI: mostra Admin/Logout se sessionStorage.nd_token
        const token = sessionStorage.getItem('nd_token');
        const authContainer = document.querySelector('.nav-auth');
        if (authContainer) {
          authContainer.innerHTML = token
            ? '<a href="/admin.html" class="btn btn-outline">Admin</a> <button id="nd-logout" class="btn">Logout</button>'
            : '<a href="/login.html" class="btn btn-outline">Login</a>';
          const logoutBtn = document.getElementById('nd-logout');
          if (logoutBtn) logoutBtn.addEventListener('click', ()=> { sessionStorage.removeItem('nd_token'); location.reload(); });
        }
      } catch(e){ console.warn('menu init failed', e); }

    } catch(err){
      console.error('menu-loader error', err);
    }
  };

  // run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPartials);
  } else {
    loadPartials();
  }
})();
