// public/js/footer.js
(function () {
  const el = document.getElementById('site-footer');
  if (!el) return;
  (async function loadFooter(){
    try {
      const r = await fetch('/partials/footer.html', { cache: 'no-cache' });
      if (!r.ok) throw new Error('not-found');
      const text = await r.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const footer = doc.querySelector('footer') || doc.body.firstElementChild;
      if (footer) el.appendChild(document.importNode(footer, true));
      else el.innerHTML = '<footer class="site-footer"><div class="container"><p>© Novo Despertar — ' + new Date().getFullYear() + '</p></div></footer>';
    } catch (e) {
      el.innerHTML = '<footer class="site-footer"><div class="container"><p>© Novo Despertar — ' + new Date().getFullYear() + '</p></div></footer>';
    }
  })();
})();
