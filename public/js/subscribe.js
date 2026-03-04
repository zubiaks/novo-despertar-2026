// public/js/subscribe.js
(function () {
  'use strict';
  const form = document.getElementById('subscribe-form');
  if (!form) return;
  const btn = document.getElementById('subscribe-btn');
  let pending = false;

  function toastSuccess(msg){ if (window.toastSuccess) window.toastSuccess(msg); else console.info(msg); }
  function toastError(msg){ if (window.toastError) window.toastError(msg); else console.error(msg); }
  function toastWarn(msg){ if (window.toastWarn) window.toastWarn(msg); else console.warn(msg); }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (pending) return;
    const email = (form.email.value || '').trim();
    if (!email) { toastWarn('Introduz um email válido.'); form.email.focus(); return; }
    pending = true;
    btn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        toastSuccess('Obrigado — subscrito!');
        form.reset();
      } else {
        const json = await res.json().catch(()=>null);
        toastError((json && json.message) ? json.message : 'Erro ao subscrever.');
      }
    } catch (err) {
      toastError('Erro de rede.');
    } finally {
      pending = false;
      btn.disabled = false;
    }
  });
})();
