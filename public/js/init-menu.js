// public/js/init-menu.js
(function () {
  if (!document.getElementById) return;

  let initialized = false;

  function debounce(fn, wait = 150) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function initMenu() {
    if (initialized) return;
    initialized = true;

    const nav = document.getElementById('site-nav');
    if (!nav) return;

    const toggle = nav.querySelector('#nav-toggle');
    const links = nav.querySelector('#nav-links');
    if (!toggle || !links) return;

    // Ensure ARIA initial state
    if (!toggle.hasAttribute('aria-expanded')) toggle.setAttribute('aria-expanded', 'false');
    if (!links.hasAttribute('aria-hidden')) links.setAttribute('aria-hidden', window.innerWidth > 720 ? 'false' : 'true');

    function showLinks() {
      nav.classList.add('open');
      links.classList.add('open');
      links.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.dataset.opened = 'true';
      const first = links.querySelector('[role="menuitem"], a, button');
      if (first) first.focus();
    }

    function hideLinks(returnFocus = true) {
      nav.classList.remove('open');
      links.classList.remove('open');
      links.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.dataset.opened = 'false';
      if (returnFocus) toggle.focus();
    }

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    // Toggle handler
    toggle.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (isOpen()) hideLinks();
      else showLinks();
    });

    // Keyboard: Enter/Space on toggle
    toggle.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggle.click();
      }
    });

    // Close when clicking a link (small delay for same-page anchors)
    links.addEventListener('click', (ev) => {
      const target = ev.target;
      if (target && target.matches('a')) {
        setTimeout(() => hideLinks(false), 50);
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && isOpen()) {
        hideLinks();
      }
    });

    // Close when clicking/touching outside
    document.addEventListener('click', (ev) => {
      if (!isOpen()) return;
      const target = ev.target;
      if (!nav.contains(target)) hideLinks();
    }, true);

    document.addEventListener('touchstart', (ev) => {
      if (!isOpen()) return;
      const target = ev.target;
      if (!nav.contains(target)) hideLinks();
    }, { passive: true });

    // Responsive behaviour: ensure correct state on resize (debounced)
    const onResize = debounce(() => {
      if (window.innerWidth > 720) {
        links.setAttribute('aria-hidden', 'false');
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
        links.classList.remove('open');
        toggle.dataset.opened = 'false';
      } else {
        if (!isOpen()) links.setAttribute('aria-hidden', 'true');
      }
    }, 120);

    window.addEventListener('resize', onResize);

    // Arrow-key navigation (Home/End, ArrowLeft/Right, ArrowUp/Down)
    function enableArrowNav() {
      const items = Array.from(links.querySelectorAll('[role="menuitem"], a, button')).filter(Boolean);
      if (!items.length) return;

      links.addEventListener('keydown', (ev) => {
        const idx = items.indexOf(document.activeElement);
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          const next = items[(idx + 1) % items.length];
          next.focus();
        } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          const prev = items[(idx - 1 + items.length) % items.length];
          prev.focus();
        } else if (ev.key === 'Home') {
          ev.preventDefault();
          items[0].focus();
        } else if (ev.key === 'End') {
          ev.preventDefault();
          items[items.length - 1].focus();
        }
      });
    }

    // Initialize arrow nav now and after dynamic injection
    enableArrowNav();
    document.addEventListener('menu:loaded', enableArrowNav);

    // Expose a small API for other scripts if needed
    nav.initMenu = {
      open: showLinks,
      close: hideLinks,
      isOpen
    };
  }

  // Initialize when DOM ready or when custom event fired
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMenu);
  } else {
    initMenu();
  }
  document.addEventListener('menu:loaded', initMenu);
})();
