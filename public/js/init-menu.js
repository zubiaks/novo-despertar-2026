// public/js/init-menu.js
(function () {
  if (!document.getElementById) return;

  function initMenu() {
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    const toggle = nav.querySelector('#nav-toggle');
    const links = nav.querySelector('#nav-links');
    if (!toggle || !links) return;

    function openMenu() {
      links.style.display = 'flex';
      links.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      nav.classList.add('open');
      toggle.dataset.opened = 'true';
      // move focus to first link for keyboard users
      const first = links.querySelector('a,button');
      if (first) first.focus();
    }

    function closeMenu(returnFocus = true) {
      links.style.display = '';
      links.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
      toggle.dataset.opened = 'false';
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      if (expanded) closeMenu();
      else openMenu();
    });

    // Close when clicking a link
    links.addEventListener('click', (ev) => {
      if (ev.target && ev.target.matches('a')) closeMenu(false);
    });

    // Close on Escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        closeMenu();
      }
    });

    // Responsive behaviour: ensure correct state on resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) {
        links.style.display = '';
        links.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
      } else {
        links.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Initialize when menu is injected
  if (document.getElementById('site-nav')) initMenu();
  else document.addEventListener('menu:loaded', initMenu);
})();
