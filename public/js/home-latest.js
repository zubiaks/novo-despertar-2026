// public/js/home-latest.js
(async function () {
  const container = document.getElementById('latest-cards');
  if (!container) return;

  function createCard(a) {
    const article = document.createElement('article');
    article.className = 'card';
    const link = document.createElement('a');
    link.href = a.url || ('/artigo.html?id=' + encodeURIComponent(a.id || ''));
    link.style.textDecoration = 'none';
    link.style.color = 'inherit';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = a.image || '/images/placeholder-article.jpg';
    img.alt = a.title || '';
    img.addEventListener('error', () => { img.src = '/images/placeholder-article.jpg'; });

    const h3 = document.createElement('h3');
    h3.textContent = a.title || '—';
    h3.style.margin = '0.5rem 0 0';

    const p = document.createElement('p');
    p.style.margin = '0.25rem 0';
    p.style.color = '#64748b';
    p.style.fontSize = '0.95rem';
    p.textContent = a.excerpt || (a.body || '').slice(0, 120) + '...';

    link.appendChild(img);
    link.appendChild(h3);
    link.appendChild(p);
    article.appendChild(link);
    return article;
  }

  async function load() {
    container.innerHTML = '';
    const loading = document.createElement('div');
    loading.style.gridColumn = '1/-1';
    loading.style.padding = '1rem';
    loading.textContent = 'A carregar…';
    container.appendChild(loading);

    try {
      const res = await fetch('/api/articles?limit=6&sort=published_at:desc', { cache: 'no-cache' });
      if (!res.ok) throw new Error('fetch-failed');
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
      container.innerHTML = '';
      if (!items.length) {
        const none = document.createElement('div');
        none.style.gridColumn = '1/-1';
        none.style.padding = '1rem';
        none.textContent = 'Nenhum artigo encontrado.';
        container.appendChild(none);
        return;
      }
      items.forEach(i => container.appendChild(createCard(i)));
    } catch (e) {
      container.innerHTML = '';
      const err = document.createElement('div');
      err.style.gridColumn = '1/-1';
      err.style.padding = '1rem';
      err.textContent = 'Erro ao carregar artigos.';
      container.appendChild(err);
      console.error(e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else setTimeout(load, 0);
})();
