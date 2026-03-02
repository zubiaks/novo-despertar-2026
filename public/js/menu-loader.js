// public/js/menu-loader.js
(function injectThemeCss(){
  try {
    const href = '/css/theme.css?v=1';
    if (!document.querySelector('link[href="'+href+'"]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.crossOrigin = 'anonymous';
      document.head.appendChild(l);
    }
  } catch(e) { /* não bloqueia o loader */ }
})();

(async function(){
  try {
    const container = document.getElementById('site-menu');
    if (!container) return;

    const resp = await fetch('/partials/menu.html', { cache: 'no-cache' });
    if (!resp.ok) {
      container.innerHTML = '<nav><a href="/index.html">Novo Despertar</a></nav>';
      return;
    }
    container.innerHTML = await resp.text();

    function getToken(){ try { return sessionStorage.getItem('nd_token'); } catch { return null; } }
    function clearAuth(){ try { sessionStorage.removeItem('nd_token'); sessionStorage.removeItem('nd_open_new'); } catch {} }

    const authEl = document.getElementById('nav-auth');
    const token = getToken();
    if (authEl) {
      if (token) {
        authEl.innerHTML = '<span class="nav-user">Admin</span><a href="/admin.html" id="nav-admin">Admin</a><button id="nav-logout" class="btn-link" aria-label="Logout">Logout</button>';
        document.getElementById('nav-logout').addEventListener('click', (e) => { e.preventDefault(); clearAuth(); location.reload(); });
      } else {
        authEl.innerHTML = '<a href="/login.html" id="nav-login">Login</a>';
      }
    }

    const toggle = document.getElementById('nav-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const nav = document.querySelector('.site-nav');
        const expanded = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      });
    }

    // highlight active link based on data-nav attributes
    const map = { '/': 'index', '/index.html': 'index', '/artigos.html': 'artigos', '/temas.html': 'temas', '/sobre.html': 'sobre', '/admin.html': 'admin' };
    const key = map[location.pathname] || null;
    document.querySelectorAll('.site-nav a[data-nav]').forEach(a => a.classList.toggle('active', a.getAttribute('data-nav') === key));

    // preserve old behavior: open new-article modal if flag set and on admin page
    if (location.pathname.endsWith('/admin.html')) {
      const shouldOpen = (() => { try { return sessionStorage.getItem('nd_open_new'); } catch { return null; } })();
      if (shouldOpen) {
        try { sessionStorage.removeItem('nd_open_new'); } catch {}
        setTimeout(() => { if (typeof openModalForNew === 'function') openModalForNew(); }, 200);
      }
    }
  } catch (err) { console.error('menu-loader error', err); }
})();
