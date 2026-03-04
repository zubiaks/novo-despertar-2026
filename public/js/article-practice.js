// public/js/article-practice.js
(function () {
  'use strict';
  const startBtn = document.getElementById('practice-start');
  const doneBtn = document.getElementById('practice-done');
  const timerEl = document.getElementById('practice-timer');
  let timerId = null;
  let remaining = 0;

  function toastInfo(msg){ if (window.toastInfo) window.toastInfo(msg); else console.info(msg); }
  function toastSuccess(msg){ if (window.toastSuccess) window.toastSuccess(msg); else console.info(msg); }
  function toastWarn(msg){ if (window.toastWarn) window.toastWarn(msg); else console.warn(msg); }

  function formatTime(sec){
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
  }

  function startPractice(durationSec = 180) {
    if (timerId) return;
    remaining = durationSec;
    timerEl.textContent = formatTime(remaining);
    toastInfo('Iniciando prática de 3 minutos...');
    timerId = setInterval(() => {
      remaining -= 1;
      timerEl.textContent = formatTime(remaining);
      if (remaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        timerEl.textContent = '';
        toastSuccess('Prática concluída — bem feito!');
      }
    }, 1000);
  }

  function completePracticeNow() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      timerEl.textContent = '';
      toastSuccess('Prática marcada como concluída.');
    } else {
      toastWarn('Não há prática em curso.');
    }
  }

  if (startBtn) startBtn.addEventListener('click', () => startPractice(180));
  if (doneBtn) doneBtn.addEventListener('click', completePracticeNow);
})();
