// public/js/toasts.js
(function(){
  if (window.__nd_toasts_loaded) return;
  window.__nd_toasts_loaded = true;

  const root = document.createElement('div');
  root.className = 'toast-root';
  root.setAttribute('aria-live','polite');
  root.setAttribute('aria-atomic','false');
  document.body.appendChild(root);

  function makeIcon(type){
    const svg = {
      info: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      success: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>',
      warn: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      error: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
    };
    return svg[type] || svg.info;
  }

  window.showToast = function(message, type='info', timeout=4200){
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.innerHTML = `${makeIcon(type)}<div class="msg">${String(message)}</div><button class="close" aria-label="Fechar">&times;</button>`;
    root.appendChild(t);

    requestAnimationFrame(()=> t.classList.add('show'));

    const close = () => {
      t.classList.remove('show');
      setTimeout(()=> t.remove(), 260);
    };
    t.querySelector('.close').addEventListener('click', close);

    if (timeout > 0) {
      setTimeout(close, timeout);
    }
    return { close };
  };

  window.toastInfo = (m,t)=> window.showToast(m,'info',t);
  window.toastSuccess = (m,t)=> window.showToast(m,'success',t);
  window.toastWarn = (m,t)=> window.showToast(m,'warn',t);
  window.toastError = (m,t)=> window.showToast(m,'error',t);
})();
