/**
 * Client-side progressive enhancement for the recipe page.
 * Rendered inline by renderRecipe (no build step, no framework):
 * serving scaler, cook mode overlay with Wake Lock, per-step timers.
 * Steps data comes from the #cook-data JSON script tag (escaped server-side).
 */
export const RECIPE_CLIENT_SCRIPT = `(function () {
  var FRACS = [[0.125,'\\u215b'],[0.2,'\\u2155'],[0.25,'\\u00bc'],[0.333333,'\\u2153'],[0.375,'\\u215c'],[0.4,'\\u2156'],[0.5,'\\u00bd'],[0.6,'\\u2157'],[0.625,'\\u215d'],[0.666667,'\\u2154'],[0.75,'\\u00be'],[0.8,'\\u2158'],[0.875,'\\u215e']];
  function fmt(n) {
    var w = Math.floor(n + 1e-9), r = n - w;
    if (r < 0.06) return String(w);
    for (var i = 0; i < FRACS.length; i++) {
      if (Math.abs(r - FRACS[i][0]) < 0.04) return w > 0 ? w + ' ' + FRACS[i][1] : FRACS[i][1];
    }
    return (Math.round(n * 10) / 10).toString();
  }
  // Serving scaler + unit toggle. Every variant is pre-rendered on the server
  // (data-v = {system: {multiplier: text}}); the browser only swaps text.
  var vEls = Array.prototype.slice.call(document.querySelectorAll('[data-v]'));
  var scaler = document.querySelector('.scaler');
  var unitBox = document.querySelector('.unit-toggle');
  var state = { sys: unitBox ? unitBox.getAttribute('data-default-units') : null, mult: '1' };
  try { var saved = localStorage.getItem('2y-units'); if (unitBox && (saved === 'metric' || saved === 'us')) state.sys = saved; } catch (e) {}
  function apply() {
    vEls.forEach(function (el) {
      var v;
      try { v = JSON.parse(el.getAttribute('data-v')); } catch (e) { return; }
      var sys = state.sys || (v.metric ? 'metric' : 'us');
      var t = v[sys] && (v[sys][state.mult] || v[sys]['1']);
      if (t != null) el.textContent = t;
    });
    if (unitBox) Array.prototype.forEach.call(unitBox.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-units') === state.sys ? 'true' : 'false');
    });
  }
  if (unitBox) {
    unitBox.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-units]');
      if (!b) return;
      state.sys = b.getAttribute('data-units');
      try { localStorage.setItem('2y-units', state.sys); } catch (e2) {}
      apply();
    });
    apply();
  }
  if (scaler) {
    scaler.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-mult]');
      if (!btn) return;
      state.mult = btn.getAttribute('data-mult');
      Array.prototype.forEach.call(scaler.querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      apply();
    });
    var first = scaler.querySelector('button[data-mult="1"]');
    if (first) first.setAttribute('aria-pressed', 'true');
  }
  // Cook mode
  var dataEl = document.getElementById('cook-data');
  var overlay = document.querySelector('[data-cook-mode]');
  var shareNav = document.querySelector('[data-share-url]');
  if (shareNav) {
    var sUrl = shareNav.getAttribute('data-share-url'), sTitle = shareNav.getAttribute('data-share-title');
    var nat = shareNav.querySelector('[data-share-native]');
    if (nat && navigator.share) { nat.hidden = false; nat.addEventListener('click', function () { navigator.share({ title: sTitle, url: sUrl }).catch(function () {}); }); }
    var cp = shareNav.querySelector('[data-share-copy]');
    if (cp) cp.addEventListener('click', function () {
      var done = function () { var o = cp.textContent; cp.textContent = cp.getAttribute('data-copied'); setTimeout(function () { cp.textContent = o; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(sUrl).then(done, function () {});
    });
  }
  var printBtn = document.querySelector('[data-print-open]');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  var openBtn = document.querySelector('[data-cook-open]');
  if (dataEl && overlay && openBtn) {
    var cookData = JSON.parse(dataEl.textContent);
    var steps = Array.prototype.map.call(document.querySelectorAll('ol.steps li'), function (li) { return li.textContent; });
    if (!steps.length) steps = cookData.steps;
    var strings = cookData.strings || {};
    var stepEl = overlay.querySelector('[data-cook-step]');
    var progEl = overlay.querySelector('[data-cook-progress]');
    var timerWrap = overlay.querySelector('[data-cook-timer]');
    var timerLabel = overlay.querySelector('[data-timer-label]');
    var timerBtn = overlay.querySelector('[data-timer-btn]');
    var timerDisplay = overlay.querySelector('[data-timer-display]');
    var idx = 0, timerId = null, wakeLock = null;
    function minutesOf(text) {
      var m = /(\\d+)\\s*(min(?:ute)?s?|minutos?|hours?|horas?)/i.exec(text);
      if (!m) return null;
      var n = parseInt(m[1], 10);
      return /h/i.test(m[2]) ? n * 60 : n;
    }
    function show(i) {
      idx = Math.max(0, Math.min(steps.length - 1, i));
      stepEl.textContent = steps[idx];
      progEl.textContent = (idx + 1) + ' / ' + steps.length;
      var mins = minutesOf(steps[idx]);
      timerWrap.hidden = mins === null;
      if (mins !== null) timerLabel.textContent = mins + ' min';
      stopTimer();
    }
    function stopTimer() {
      if (timerId) { clearInterval(timerId); timerId = null; }
      timerDisplay.hidden = true;
      timerBtn.hidden = false;
    }
    function open() {
      overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      show(0);
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () {});
      }
    }
    function close() {
      overlay.hidden = true;
      document.body.style.overflow = '';
      stopTimer();
      if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; }
    }
    openBtn.addEventListener('click', open);
    overlay.querySelector('[data-cook-close]').addEventListener('click', close);
    overlay.querySelector('[data-cook-prev]').addEventListener('click', function () { show(idx - 1); });
    overlay.querySelector('[data-cook-next]').addEventListener('click', function () { show(idx + 1); });
    timerBtn.addEventListener('click', function () {
      var mins = minutesOf(steps[idx]);
      if (mins === null) return;
      var end = Date.now() + mins * 60000;
      timerBtn.hidden = true;
      timerDisplay.hidden = false;
      function tick() {
        var left = Math.max(0, Math.round((end - Date.now()) / 1000));
        var mm = Math.floor(left / 60), ss = left % 60;
        if (left <= 0) {
          timerDisplay.hidden = false;
          timerDisplay.textContent = strings.timerDone || 'Done!';
          clearInterval(timerId); timerId = null;
          timerBtn.hidden = false;
          return;
        }
        timerDisplay.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
      }
      tick();
      timerId = setInterval(tick, 500);
    });
  }
})();`;
