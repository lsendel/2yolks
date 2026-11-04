/**
 * Client-side progressive enhancement for the recipe page and discovery index.
 * Rendered inline (no build step, no framework):
 * serving scaler, unit toggle, ingredient copy, share-card copy,
 * cook mode overlay with Wake Lock, keyboard navigation, and per-step timers.
 * Steps data comes from the #cook-data JSON script tag (escaped server-side).
 */
export const DISCOVERY_CLIENT_SCRIPT = `(function () {
  var input = document.querySelector('[data-recipe-search]');
  if (!input) return;
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-recipe-item]'));
  var emptyEl = document.querySelector('[data-search-empty]');
  input.addEventListener('input', function () {
    var q = (input.value || '').trim().toLowerCase();
    var shown = 0;
    items.forEach(function (li) {
      var hay = (li.getAttribute('data-search') || '').toLowerCase();
      var match = !q || hay.indexOf(q) !== -1;
      li.hidden = !match;
      if (match) {
        shown++;
        var num = li.querySelector('.recipe-number');
        if (num) num.textContent = (shown < 10 ? '0' : '') + shown;
      }
    });
    if (emptyEl) emptyEl.hidden = shown > 0 || items.length === 0;
  });
})();`;

export const RECIPE_CLIENT_SCRIPT = `(function () {
  // Graceful fallback: hide the hero figure if its image failed to load (alt text alone is not a layout).
  Array.prototype.slice.call(document.querySelectorAll('figure.hero-image img')).forEach(function (img) {
    function hide() { var f = img.closest('figure'); if (f) f.style.display = 'none'; }
    if (img.complete && img.naturalWidth === 0) hide(); else img.addEventListener('error', hide);
  });
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
  // Ingredient checkbox progress + copy ingredients list
  var ingChecks = Array.prototype.slice.call(document.querySelectorAll('ul.ingredients input[type="checkbox"]'));
  var ingProg = document.querySelector('[data-ing-progress]');
  function updateIngProgress() {
    if (!ingProg || !ingChecks.length) return;
    var checked = ingChecks.filter(function (c) { return c.checked; }).length;
    ingProg.hidden = checked === 0;
    ingProg.textContent = checked + ' / ' + ingChecks.length;
  }
  ingChecks.forEach(function (c) { c.addEventListener('change', updateIngProgress); });
  function flashBtn(btn) {
    var orig = btn.textContent;
    var msg = btn.getAttribute('data-copied');
    if (!msg) return;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = orig; }, 1600);
  }
  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flashBtn(btn); }, function () {});
    }
  }
  var copyIngBtn = document.querySelector('[data-copy-ingredients]');
  if (copyIngBtn) {
    copyIngBtn.addEventListener('click', function () {
      var lines = Array.prototype.map.call(document.querySelectorAll('ul.ingredients .line'), function (el) {
        return '- ' + (el.textContent || '').trim();
      });
      if (lines.length) copyText(lines.join('\\n'), copyIngBtn);
    });
  }
  // Share bar + Copy recipe card
  var dataEl = document.getElementById('cook-data');
  var overlay = document.querySelector('[data-cook-mode]');
  var shareNav = document.querySelector('[data-share-url]');
  if (shareNav) {
    var sUrl = shareNav.getAttribute('data-share-url'), sTitle = shareNav.getAttribute('data-share-title');
    var nat = shareNav.querySelector('[data-share-native]');
    if (nat && navigator.share) { nat.hidden = false; nat.addEventListener('click', function () { navigator.share({ title: sTitle, url: sUrl }).catch(function () {}); }); }
    var cp = shareNav.querySelector('[data-share-copy]');
    if (cp) cp.addEventListener('click', function () { copyText(sUrl, cp); });
    var cardBtn = shareNav.querySelector('[data-share-card]');
    if (cardBtn) {
      cardBtn.addEventListener('click', function () {
        var lines = Array.prototype.map.call(document.querySelectorAll('ul.ingredients .line'), function (el) {
          return '• ' + (el.textContent || '').trim();
        });
        var card = sTitle + ' — 2yolks\\n\\n' + lines.join('\\n') + '\\n\\n' + sUrl;
        copyText(card, cardBtn);
      });
    }
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
    var barEl = overlay.querySelector('[data-cook-bar]');
    var timerWrap = overlay.querySelector('[data-cook-timer]');
    var timerLabel = overlay.querySelector('[data-timer-label]');
    var timerBtn = overlay.querySelector('[data-timer-btn]');
    var timerDisplay = overlay.querySelector('[data-timer-display]');
    var idx = 0, timerId = null, wakeLock = null;
    function minutesOf(text) {
      var m = /(\\d+)\\s*(min(?:ute)?s?|minutos?|hours?|horas?|heures?)/i.exec(text);
      if (!m) return null;
      var n = parseInt(m[1], 10);
      return /h/i.test(m[2]) ? n * 60 : n;
    }
    function show(i) {
      idx = Math.max(0, Math.min(steps.length - 1, i));
      stepEl.textContent = steps[idx];
      progEl.textContent = (idx + 1) + ' / ' + steps.length;
      if (barEl && steps.length) barEl.style.width = Math.round(((idx + 1) / steps.length) * 100) + '%';
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
      var liveSteps = Array.prototype.map.call(document.querySelectorAll('ol.steps li'), function (li) { return li.textContent; });
      if (liveSteps.length) steps = liveSteps;
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
    document.addEventListener('keydown', function (e) {
      if (overlay.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'ArrowLeft') show(idx - 1);
    });
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
          try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) {
              var ctx = new Ctx(), osc = ctx.createOscillator(), g = ctx.createGain();
              osc.type = 'sine'; osc.frequency.value = 880;
              g.gain.setValueAtTime(0.18, ctx.currentTime);
              g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
              osc.connect(g); g.connect(ctx.destination);
              osc.start(); osc.stop(ctx.currentTime + 0.6);
            }
          } catch (e3) {}
          return;
        }
        timerDisplay.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
      }
      tick();
      timerId = setInterval(tick, 500);
    });
  }
})();`;

/**
 * Live quality checks on the capture form: gentle, non-blocking hints while
 * the cook types. Nothing here gates saving - the server still validates.
 * Strings are localized en/es/fr and follow the form's language select;
 * checks start in a neutral "not yet checked" state until the cook has typed
 * something - an untouched field is never a green pass.
 *
 * The emitted function takes a template-literal-safe approach: every regex
 * backslash is double-escaped so the TS template does not eat it.
 */
export const CAPTURE_CHECK_STRINGS = `{"en":{"title":"Give the recipe a name","ingredients":"List the ingredients, one per line","qty_ok":"Every ingredient line starts with an amount","cups_ok":"No ambiguous cup measures","qty_todo":"## ingredient line(s) do not start with an amount - cooks need quantities","cups_todo":"You use \\"cup\\" - cups vary by country, so consider grams or ml too","steps":"Write the steps, one per line","servings_ok":"Servings (optional) should be a number","servings_bad":"Servings should be a number","source_ok":"Source noted","source_todo":"Add the https:// link to the original","optional":"optional"},"es":{"title":"Ponle un nombre a la receta","ingredients":"Anota los ingredientes, uno por línea","qty_ok":"Cada línea de ingrediente empieza con una cantidad","cups_ok":"Sin medidas ambiguas en tazas","qty_todo":"## línea(s) de ingredientes no empiezan con cantidad - hacen falta cantidades","cups_todo":"Usas \\"taza\\" - las tazas varían por país, considera también gramos o ml","steps":"Escribe los pasos, uno por línea","servings_ok":"Las porciones (opcional) deben ser un número","servings_bad":"Las porciones deben ser un número","source_ok":"Fuente anotada","source_todo":"Agrega el enlace https:// al original","optional":"opcional"},"fr":{"title":"Donnez un nom à la recette","ingredients":"Listez les ingrédients, un par ligne","qty_ok":"Chaque ligne d'ingrédient commence par une quantité","cups_ok":"Pas de mesures ambiguës en tasses","qty_todo":"## ligne(s) d'ingrédients ne commencent pas par une quantité - il faut des quantités","cups_todo":"Vous utilisez \\"tasse\\" - les tasses varient selon les pays, pensez aussi aux grammes ou ml","steps":"Écrivez les étapes, une par ligne","servings_ok":"Les portions (facultatif) doivent être un nombre","servings_bad":"Les portions doivent être un nombre","source_ok":"Source notée","source_todo":"Ajoutez le lien https:// vers l'original","optional":"facultatif"}}`;

export const CAPTURE_CLIENT_SCRIPT = `(function () {
  var form = document.querySelector('form[action="/account/recipes/save"]');
  if (!form) return;
  var box = document.querySelector('[data-live-checks]');
  if (!box) return;
  var ALL = JSON.parse(document.getElementById('capture-check-strings').textContent);
  var CATLABELS = JSON.parse(document.getElementById('capture-cat-labels').textContent);
  function lang() {
    var v = (form.querySelector('[name="locale"]').value || 'us:en').split(':')[1];
    return ALL[v] ? v : 'en';
  }
  function field(name) { return form.querySelector('[name="' + name + '"]'); }
  function lines(v) { return v.split(/\\r?\\n/).map(function (l) { return l.trim(); }).filter(Boolean); }
  function set(key, state, text) {
    var li = box.querySelector('[data-check="' + key + '"]');
    if (!li) return;
    var mark = state === 'ok' ? '\\u2713 ' : state === 'todo' ? '\\u2022 ' : '\\u2013 ';
    li.textContent = mark + text;
    li.className = state;
  }
  function localizeChrome() {
    var catSel = form.querySelector('[name="category"]');
    var labels = CATLABELS[lang()] || CATLABELS.en;
    Array.prototype.slice.call(catSel.options).forEach(function (o) {
      if (!o.value) o.textContent = labels.__unsure;
      else if (labels[o.value]) o.textContent = labels[o.value];
    });
    var prompt = document.querySelector('[data-category-prompt]');
    if (prompt) prompt.textContent = labels.__prompt;
    var pre = document.querySelector('[data-preamble-label]');
    if (pre) pre.textContent = labels.__preamble;
    var preHint = document.querySelector('[data-preamble-hint]');
    if (preHint) preHint.textContent = labels.__preambleHint;
  }
  function run() {
    var T = ALL[lang()];
    localizeChrome();
    var title = (field('title').value || '').trim();
    set('title', title.length >= 3 ? 'ok' : title.length ? 'todo' : 'idle', T.title);
    var ings = lines(field('ingredients').value || '');
    set('ingredients', ings.length > 0 ? 'ok' : 'idle', T.ingredients);
    if (ings.length === 0) {
      set('qty', 'idle', T.qty_ok);
      set('cups', 'idle', T.cups_ok);
    } else {
      // Leading amount only: a digit or unicode fraction at the START of the
      // line. 'stock for 2 people' does not count; '½ onion' does.
      var noQty = ings.filter(function (l) { return !/^[0-9\\u00BC-\\u00BE\\u2150-\\u215E]/.test(l); }).length;
      set('qty', noQty === 0 ? 'ok' : 'todo', noQty === 0 ? T.qty_ok : T.qty_todo.replace('##', String(noQty)));
      var cups = ings.filter(function (l) { return /\\b(cups?|tazas?|tasses?)\\b/i.test(l); }).length;
      set('cups', cups === 0 ? 'ok' : 'todo', cups === 0 ? T.cups_ok : T.cups_todo);
    }
    var steps = lines(field('steps').value || '');
    set('steps', steps.length > 0 ? 'ok' : 'idle', T.steps);
    var sv = (field('servings').value || '').trim();
    set('servings', sv === '' ? 'idle' : Number(sv) > 0 ? 'ok' : 'todo', sv === '' ? T.servings_ok : Number(sv) > 0 ? T.servings_ok : T.servings_bad);
    var adapted = field('source_kind').value === 'adapted';
    var url = (field('source_url').value || '').trim();
    var urlOk = false;
    if (url) { try { var u = new URL(url); urlOk = u.protocol === 'https:' && u.hostname.indexOf('.') > 0; } catch (e) { urlOk = false; } }
    set('source', !adapted ? 'ok' : urlOk ? 'ok' : url ? 'todo' : 'idle', !adapted ? T.source_ok : T.source_todo);
  }
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  run();
})();`;
