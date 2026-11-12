/**
 * Client-side progressive enhancement for theme switching, discovery index,
 * recipe reading/sharing/Cook Mode, and multimodal AI recipe capture.
 * Rendered inline (no client bundle step, zero third-party scripts).
 */

export const THEME_CLIENT_SCRIPT = `(function () {
  var btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var root = document.documentElement;
    var cur = root.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('2y-theme', next); } catch (e) {}
  });
})();`;

export const DISCOVERY_CLIENT_SCRIPT = `(function () {
  var list = document.querySelector('[data-recipe-list]');
  var viewBtns = Array.prototype.slice.call(document.querySelectorAll('[data-view-btn]'));
  function setView(mode) {
    var v = mode === 'grid' ? 'grid' : 'list';
    if (list) list.setAttribute('data-view', v);
    viewBtns.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-view-btn') === v ? 'true' : 'false');
    });
  }
  if (viewBtns.length && list) {
    try {
      var savedView = localStorage.getItem('2y-view');
      if (savedView === 'grid' || savedView === 'list') setView(savedView);
    } catch (e) {}
    viewBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-view-btn') || 'list';
        setView(mode);
        try { localStorage.setItem('2y-view', mode); } catch (e) {}
      });
    });
  }

  var input = document.querySelector('[data-recipe-search]');
  if (!input) return;
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-recipe-item]'));
  if (!list) list = input.closest('section') ? input.closest('section').querySelector('ul.discovery-list') : null;
  var emptyEl = document.querySelector('[data-search-empty]');
  var closestNote = document.querySelector('[data-closest-note]');
  var clearBtn = document.querySelector('[data-clear-search]');
  var emptyMsg = document.querySelector('[data-empty-msg]');
  var emptySuggestions = document.querySelector('[data-empty-suggestions]');
  var suggestionsList = document.querySelector('[data-suggestions-list]');

  function norm(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .trim()
      .replace(/\\s+/g, ' ');
  }

  function editDist(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var v0 = new Array(b.length + 1);
    var v1 = new Array(b.length + 1);
    for (var i = 0; i <= b.length; i++) v0[i] = i;
    for (var i = 0; i < a.length; i++) {
      v1[0] = i + 1;
      for (var j = 0; j < b.length; j++) {
        var cost = a.charCodeAt(i) === b.charCodeAt(j) ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (var j = 0; j <= b.length; j++) v0[j] = v1[j];
    }
    return v0[b.length];
  }

  function getVariants(tok) {
    var v = [tok];
    if (tok.length > 3) {
      if (tok.endsWith('ies')) v.push(tok.slice(0, -3) + 'y');
      else if (tok.endsWith('es')) v.push(tok.slice(0, -2), tok.slice(0, -1));
      else if (tok.endsWith('s')) v.push(tok.slice(0, -1));
      else v.push(tok + 's', tok + 'es');
    }
    return v;
  }

  function matchTokenInText(tok, text) {
    if (!tok || !text) return false;
    if (text.indexOf(tok) !== -1) return true;
    var vars = getVariants(tok);
    for (var i = 0; i < vars.length; i++) {
      if (text.indexOf(vars[i]) !== -1) return true;
    }
    if (tok.length >= 5) {
      var words = text.split(/[^a-z0-9]+/);
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (w.length >= 4 && Math.abs(w.length - tok.length) <= 2) {
          if (editDist(tok, w) <= 2) return true;
        }
      }
    }
    return false;
  }

  function strictMatchToken(tok, text) {
    if (!tok || !text) return false;
    if (text.indexOf(tok) !== -1) return true;
    var vars = getVariants(tok);
    for (var i = 0; i < vars.length; i++) {
      if (text.indexOf(vars[i]) !== -1) return true;
    }
    return false;
  }

  var records = items.map(function (li, idx) {
    var title = norm(li.getAttribute('data-title') || (li.querySelector('h3') ? li.querySelector('h3').textContent : ''));
    var cat = norm(li.getAttribute('data-category') || '');
    var body = norm(li.getAttribute('data-body') || '');
    var rawSearch = norm(li.getAttribute('data-search') || (title + ' ' + cat + ' ' + body));
    return {
      el: li,
      idx: idx,
      title: title,
      cat: cat,
      body: body,
      all: rawSearch
    };
  });

  var logTimeout = null;
  function reportZeroMatch(query) {
    if (!query || query.length < 2) return;
    clearTimeout(logTimeout);
    logTimeout = setTimeout(function () {
      try {
        var lang = document.documentElement.lang || 'en';
        fetch('/api/search-gap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query, locale: lang })
        }).catch(function () {});
      } catch (e) {}
    }, 1200);
  }

  function updateUrl(q, push) {
    try {
      var u = new URL(window.location.href);
      if (q) u.searchParams.set('q', q);
      else u.searchParams.delete('q');
      u.hash = 'recipes';
      if (push) history.pushState(null, '', u.toString());
      else history.replaceState(null, '', u.toString());
    } catch (e) {}
  }

  function filterRecipes() {
    var rawQ = (input.value || '').trim();
    var q = norm(rawQ);
    if (!q) {
      if (closestNote) closestNote.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      records.forEach(function (r) {
        r.el.hidden = false;
        var num = r.el.querySelector('.recipe-number');
        if (num) num.textContent = (r.idx + 1 < 10 ? '0' : '') + (r.idx + 1);
        if (list) list.appendChild(r.el);
      });
      return;
    }

    var tokens = q.split(/\\s+/);
    var matched = [];
    var strictCount = 0;

    records.forEach(function (rec) {
      var allTokensMatch = true;
      var titleMatchesAll = true;
      var categoryMatchesAny = false;
      var isStrictMatch = true;

      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        var inTitle = matchTokenInText(tok, rec.title);
        var inCat = matchTokenInText(tok, rec.cat);
        var inBody = matchTokenInText(tok, rec.body);
        if (!inTitle && !inCat && !inBody) {
          allTokensMatch = false;
          break;
        }
        if (!inTitle) titleMatchesAll = false;
        if (inCat) categoryMatchesAny = true;

        if (!strictMatchToken(tok, rec.all)) {
          isStrictMatch = false;
        }
      }

      if (allTokensMatch) {
        var tier = titleMatchesAll ? 1 : (categoryMatchesAny ? 2 : 3);
        if (isStrictMatch) strictCount++;
        matched.push({ rec: rec, tier: tier });
      }
    });

    if (matched.length > 0) {
      if (emptyEl) emptyEl.hidden = true;
      if (closestNote) {
        closestNote.hidden = (strictCount > 0);
      }
      matched.sort(function (a, b) {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.rec.idx - b.rec.idx;
      });

      records.forEach(function (r) { r.el.hidden = true; });

      matched.forEach(function (m, rank) {
        m.rec.el.hidden = false;
        var num = m.rec.el.querySelector('.recipe-number');
        if (num) num.textContent = (rank + 1 < 10 ? '0' : '') + (rank + 1);
        if (list) list.appendChild(m.rec.el);
      });
    } else {
      records.forEach(function (r) { r.el.hidden = true; });
      if (closestNote) closestNote.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        if (emptyMsg) {
          var tmpl = emptyEl.getAttribute('data-nothing-matches') || "Nothing matches '{q}' yet";
          emptyMsg.textContent = tmpl.replace('{q}', rawQ);
        }
        if (emptySuggestions && suggestionsList) {
          suggestionsList.innerHTML = '';
          var suggestions = [];
          records.forEach(function (r) {
            var minD = 999;
            var titleWords = r.title.split(/[^a-z0-9]+/);
            for (var w = 0; w < titleWords.length; w++) {
              var d = editDist(q, titleWords[w]);
              if (d < minD) minD = d;
            }
            if (minD <= 3) {
              suggestions.push({ rec: r, dist: minD });
            }
          });
          suggestions.sort(function (a, b) { return a.dist - b.dist; });
          var top = suggestions.slice(0, 3);
          if (top.length > 0) {
            top.forEach(function (s) {
              var link = s.rec.el.querySelector('h3 a');
              var li = document.createElement('li');
              var a = document.createElement('a');
              a.textContent = s.rec.title;
              if (link) a.href = link.href;
              li.appendChild(a);
              suggestionsList.appendChild(li);
            });
            emptySuggestions.hidden = false;
          } else {
            emptySuggestions.hidden = true;
          }
        }
      }
      reportZeroMatch(rawQ);
    }
  }

  try {
    var p = new URLSearchParams(window.location.search);
    var initQ = p.get('q');
    if (initQ) {
      input.value = initQ;
      filterRecipes();
    }
  } catch (e) {}

  input.addEventListener('input', function () {
    updateUrl(input.value.trim(), false);
    filterRecipes();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      updateUrl(input.value.trim(), true);
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      updateUrl('', true);
      filterRecipes();
      input.focus();
    });
  }
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
  // Ingredient checkbox progress + copy/send grocery list
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
    var orig = btn.innerHTML;
    var msg = btn.getAttribute('data-copied');
    if (!msg) return;
    btn.textContent = msg;
    setTimeout(function () { btn.innerHTML = orig; }, 1600);
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
  var shareNav = document.querySelector('[data-share-url]');
  var pageTitle = (shareNav && shareNav.getAttribute('data-share-title')) || document.title;
  var pageUrl = (shareNav && shareNav.getAttribute('data-share-url')) || window.location.href;
  var groceryBtn = document.querySelector('[data-share-grocery]');
  if (groceryBtn) {
    groceryBtn.addEventListener('click', function () {
      var rows = Array.prototype.slice.call(document.querySelectorAll('ul.ingredients li'));
      var unchecked = rows.filter(function (li) {
        var cb = li.querySelector('input[type="checkbox"]');
        return !cb || !cb.checked;
      });
      var target = unchecked.length > 0 ? unchecked : rows;
      var lines = target.map(function (li) {
        var line = li.querySelector('.line');
        return '\\u2610 ' + ((line ? line.textContent : li.textContent) || '').trim();
      });
      if (!lines.length) return;
      var payload = pageTitle + ' — 2yolks\\n\\n' + lines.join('\\n') + '\\n\\n' + pageUrl;
      if (navigator.share) {
        navigator.share({ title: pageTitle, text: payload }).catch(function () {
          copyText(payload, groceryBtn);
        });
      } else {
        copyText(payload, groceryBtn);
      }
    });
  }
  // Share bar + Copy recipe card + 9:16 Story PNG export
  var dataEl = document.getElementById('cook-data');
  var overlay = document.querySelector('[data-cook-mode]');
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
    var storyBtn = shareNav.querySelector('[data-story-card]');
    if (storyBtn) {
      storyBtn.addEventListener('click', function () {
        var svgUrl = storyBtn.getAttribute('data-card-svg');
        var slug = storyBtn.getAttribute('data-recipe-slug') || 'recipe';
        if (!svgUrl) return;
        storyBtn.disabled = true;
        fetch(svgUrl)
          .then(function (r) { if (!r.ok) throw new Error('card'); return r.text(); })
          .then(function (svgText) {
            return new Promise(function (resolve, reject) {
              var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
              var objUrl = URL.createObjectURL(blob);
              var img = new Image();
              img.onload = function () {
                try {
                  var canvas = document.createElement('canvas');
                  canvas.width = 1080;
                  canvas.height = 1920;
                  var ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, 1080, 1920);
                  URL.revokeObjectURL(objUrl);
                  canvas.toBlob(function (pngBlob) {
                    if (!pngBlob) return reject(new Error('png'));
                    resolve(pngBlob);
                  }, 'image/png');
                } catch (err) {
                  URL.revokeObjectURL(objUrl);
                  reject(err);
                }
              };
              img.onerror = function () { URL.revokeObjectURL(objUrl); reject(new Error('img')); };
              img.src = objUrl;
            });
          })
          .then(function (pngBlob) {
            var fname = slug + '-2yolks-story.png';
            var file = typeof File === 'function' ? new File([pngBlob], fname, { type: 'image/png' }) : null;
            if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
              return navigator.share({ files: [file], title: sTitle, url: sUrl }).catch(function () {});
            }
            var dlUrl = URL.createObjectURL(pngBlob);
            var a = document.createElement('a');
            a.href = dlUrl;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(dlUrl); }, 2000);
            flashBtn(storyBtn);
          })
          .catch(function () {
            window.open(svgUrl, '_blank', 'noopener');
          })
          .then(function () {
            storyBtn.disabled = false;
          });
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
 * Live quality checks + optional AI Kitchen Co-Editor on the capture form.
 * Nothing here gates saving - the server still validates.
 * Strings are localized en/es/fr and follow the form's UI language.
 */
export const CAPTURE_CHECK_STRINGS = `{"en":{"title":"Give the recipe a name","ingredients":"List the ingredients, one per line","qty_ok":"Every ingredient line starts with an amount","cups_ok":"No ambiguous cup measures","qty_todo":"## ingredient line(s) do not start with an amount - cooks need quantities","cups_todo":"You use \\"cup\\" - cups vary by country, so consider grams or ml too","steps":"Write the steps, one per line","servings_ok":"Servings (optional) should be a number","servings_bad":"Servings should be a number","source_ok":"Source noted","source_todo":"Add the https:// link to the original","optional":"optional"},"es":{"title":"Ponle un nombre a la receta","ingredients":"Anota los ingredientes, uno por línea","qty_ok":"Cada línea de ingrediente empieza con una cantidad","cups_ok":"Sin medidas ambiguas en tazas","qty_todo":"## línea(s) de ingredientes no empiezan con cantidad - hacen falta cantidades","cups_todo":"Usas \\"taza\\" - las tazas varían por país, considera también gramos o ml","steps":"Escribe los pasos, uno por línea","servings_ok":"Las porciones (opcional) deben ser un número","servings_bad":"Las porciones deben ser un número","source_ok":"Fuente anotada","source_todo":"Agrega el enlace https:// al original","optional":"opcional"},"fr":{"title":"Donnez un nom à la recette","ingredients":"Listez les ingrédients, un par ligne","qty_ok":"Chaque ligne d'ingrédient commence par une quantité","cups_ok":"Pas de mesures ambiguës en tasses","qty_todo":"## ligne(s) d'ingrédients ne commencent pas par une quantité - il faut des quantités","cups_todo":"Vous utilisez \\"tasse\\" - les tasses varient selon les pays, pensez aussi aux grammes ou ml","steps":"Écrivez les étapes, une par ligne","servings_ok":"Les portions (facultatif) doivent être un nombre","servings_bad":"Les portions doivent être un nombre","source_ok":"Source notée","source_todo":"Ajoutez le lien https:// vers l'original","optional":"facultatif"}}`;

export const CAPTURE_CLIENT_SCRIPT = `(function () {
  var form = document.querySelector('form[data-capture-form]');
  if (!form) return;
  var box = document.querySelector('[data-live-checks]');
  if (!box) return;
  var ALL = JSON.parse(document.getElementById('capture-check-strings').textContent);
  var CATLABELS = JSON.parse(document.getElementById('capture-cat-labels').textContent);
  // Chrome and live checks follow the account UI language (document lang);
  // the recipe locale select is recipe data and never re-localizes chrome.
  function lang() {
    var v = (document.documentElement && document.documentElement.lang) || 'en';
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

  // Multimodal AI Kitchen Co-Editor (photo + voice note + rough notes -> structured draft & polish)
  var aiPanel = document.querySelector('[data-ai-panel]');
  if (aiPanel) {
    var photoInput = aiPanel.querySelector('[data-ai-photo]');
    var photoPreview = aiPanel.querySelector('[data-ai-photo-preview]');
    var voiceBtn = aiPanel.querySelector('[data-ai-voice-btn]');
    var voiceStatus = aiPanel.querySelector('[data-ai-voice-status]');
    var notesInput = aiPanel.querySelector('[data-ai-notes]');
    var extractBtn = aiPanel.querySelector('[data-ai-extract]');
    var polishBtn = aiPanel.querySelector('[data-ai-polish]');
    var undoBtn = aiPanel.querySelector('[data-ai-undo]');
    var statusEl = aiPanel.querySelector('[data-ai-status]');
    var improvementsWrap = aiPanel.querySelector('[data-ai-improvements-wrap]');
    var improvementsList = aiPanel.querySelector('[data-ai-improvements]');
    var questionsWrap = aiPanel.querySelector('[data-ai-questions-wrap]');
    var questionsList = aiPanel.querySelector('[data-ai-questions]');

    var attachedImage = null;
    var attachedAudio = null;
    var undoSnapshot = null;
    var recorder = null;
    var audioChunks = [];

    function snapshotForm() {
      var names = ['category', 'title', 'intro', 'ingredients', 'steps', 'prep', 'cook', 'servings'];
      var snap = {};
      names.forEach(function (n) {
        var el = field(n);
        if (el) snap[n] = el.value;
      });
      return snap;
    }

    function restoreSnapshot(snap) {
      if (!snap) return;
      Object.keys(snap).forEach(function (n) {
        var el = field(n);
        if (el) el.value = snap[n];
      });
      run();
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', function () {
        if (!undoSnapshot) return;
        restoreSnapshot(undoSnapshot);
        undoSnapshot = null;
        undoBtn.hidden = true;
        if (statusEl) statusEl.hidden = true;
      });
    }

    if (photoInput) {
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) {
          attachedImage = null;
          if (photoPreview) photoPreview.hidden = true;
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          var img = new Image();
          img.onload = function () {
            var maxDim = 1024;
            var w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w >= h) { h = Math.round((h * maxDim) / w); w = maxDim; }
              else { w = Math.round((w * maxDim) / h); h = maxDim; }
            }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            var comma = dataUrl.indexOf(',');
            attachedImage = { mimeType: 'image/jpeg', data: dataUrl.slice(comma + 1) };
            if (photoPreview) {
              photoPreview.src = dataUrl;
              photoPreview.hidden = false;
            }
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (voiceBtn && typeof MediaRecorder !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      voiceBtn.hidden = false;
      var startText = voiceBtn.getAttribute('data-label-start') || voiceBtn.textContent;
      var stopText = voiceBtn.getAttribute('data-label-stop') || 'Stop';
      var readyText = voiceBtn.getAttribute('data-label-ready') || 'Voice attached';
      voiceBtn.addEventListener('click', function () {
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
          return;
        }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          audioChunks = [];
          recorder = new MediaRecorder(stream);
          recorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
          recorder.onstop = function () {
            stream.getTracks().forEach(function (t) { t.stop(); });
            voiceBtn.textContent = startText;
            var blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' });
            var fr = new FileReader();
            fr.onload = function () {
              var res = String(fr.result || '');
              var c = res.indexOf(',');
              if (c !== -1) {
                attachedAudio = { mimeType: (blob.type || 'audio/webm').split(';')[0], data: res.slice(c + 1) };
                if (voiceStatus) { voiceStatus.textContent = '\\u2713 ' + readyText; voiceStatus.hidden = false; }
              }
            };
            fr.readAsDataURL(blob);
          };
          recorder.start();
          voiceBtn.textContent = stopText;
          setTimeout(function () { if (recorder && recorder.state === 'recording') recorder.stop(); }, 45000);
        }).catch(function () {});
      });
    }

    function applyChoice(q, answer) {
      if (!answer) return;
      if (q.field === 'servings') {
        var m = /\\d+/.exec(answer);
        if (m && field('servings')) field('servings').value = m[0];
      } else if (q.field === 'prepMinutes') {
        var mp = /\\d+/.exec(answer);
        if (mp && field('prep')) field('prep').value = mp[0];
      } else if (q.field === 'cookMinutes') {
        var mc = /\\d+/.exec(answer);
        if (mc && field('cook')) field('cook').value = mc[0];
      } else if (q.field === 'ingredients' && field('ingredients')) {
        var curIng = field('ingredients').value.trim();
        field('ingredients').value = curIng ? curIng + '\\n' + answer : answer;
      } else if (field('steps')) {
        var curSt = field('steps').value.trim();
        field('steps').value = curSt ? curSt + '\\n' + answer : answer;
      }
      run();
    }

    function renderFeedback(data) {
      if (improvementsWrap && improvementsList) {
        improvementsList.innerHTML = '';
        var imps = Array.isArray(data.improvements) ? data.improvements : [];
        if (imps.length > 0) {
          imps.forEach(function (imp) {
            var li = document.createElement('li');
            li.textContent = imp;
            improvementsList.appendChild(li);
          });
          improvementsWrap.hidden = false;
        } else {
          improvementsWrap.hidden = true;
        }
      }
      if (questionsWrap && questionsList) {
        questionsList.innerHTML = '';
        var qs = Array.isArray(data.followUpQuestions) ? data.followUpQuestions : [];
        if (qs.length > 0) {
          qs.forEach(function (q) {
            var item = document.createElement('div');
            item.className = 'ai-question';
            var p = document.createElement('p');
            p.textContent = q.question;
            item.appendChild(p);
            var chips = document.createElement('div');
            chips.className = 'ai-choices';
            (Array.isArray(q.quickChoices) ? q.quickChoices : []).forEach(function (choice) {
              var b = document.createElement('button');
              b.type = 'button';
              b.className = 'quiet ai-chip';
              b.textContent = '+ ' + choice;
              b.addEventListener('click', function () {
                applyChoice(q, choice);
                b.disabled = true;
                b.textContent = '\\u2713 ' + choice;
              });
              chips.appendChild(b);
            });
            item.appendChild(chips);
            questionsList.appendChild(item);
          });
          questionsWrap.hidden = false;
        } else {
          questionsWrap.hidden = true;
        }
      }
    }

    function callAi(mode) {
      var endpoint = aiPanel.getAttribute('data-ai-endpoint') || '/account/recipes/ai-assist';
      var workingMsg = aiPanel.getAttribute('data-msg-working') || 'Working…';
      var doneMsg = mode === 'polish'
        ? (aiPanel.getAttribute('data-msg-done-polish') || 'Draft polished.')
        : (aiPanel.getAttribute('data-msg-done-extract') || 'Draft structured.');
      var notes = notesInput ? notesInput.value.trim() : '';
      var draft = {
        title: field('title') ? field('title').value.trim() : '',
        category: field('category') ? field('category').value : '',
        intro: field('intro') ? field('intro').value.trim() : '',
        ingredients: field('ingredients') ? lines(field('ingredients').value) : [],
        steps: field('steps') ? lines(field('steps').value) : [],
        prep: field('prep') ? field('prep').value.trim() : '',
        cook: field('cook') ? field('cook').value.trim() : '',
        servings: field('servings') ? field('servings').value.trim() : ''
      };
      if (!attachedImage && !attachedAudio && !notes && !draft.ingredients.length && !draft.steps.length) {
        if (statusEl) {
          statusEl.className = 'err';
          statusEl.textContent = aiPanel.getAttribute('data-msg-err-input') || 'Add notes, photo, or draft lines first.';
          statusEl.hidden = false;
        }
        return;
      }
      if (extractBtn) extractBtn.disabled = true;
      if (polishBtn) polishBtn.disabled = true;
      if (statusEl) {
        statusEl.className = 'ok';
        statusEl.textContent = workingMsg;
        statusEl.hidden = false;
      }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: mode,
          uiLang: lang(),
          recipeLocale: field('locale') ? field('locale').value : 'us:en',
          notes: notes,
          image: attachedImage,
          audio: attachedAudio,
          draft: draft
        })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) {
            throw new Error((res.body && res.body.error) || 'AI error');
          }
          undoSnapshot = snapshotForm();
          if (undoBtn) undoBtn.hidden = false;
          var d = res.body.recipe || {};
          if (d.title && field('title')) field('title').value = d.title;
          if (d.category && field('category')) field('category').value = d.category;
          if (d.intro && field('intro')) field('intro').value = d.intro;
          if (Array.isArray(d.ingredients) && d.ingredients.length && field('ingredients')) {
            field('ingredients').value = d.ingredients.join('\\n');
          }
          if (Array.isArray(d.steps) && d.steps.length && field('steps')) {
            field('steps').value = d.steps.join('\\n');
          }
          if (d.prepMinutes != null && d.prepMinutes > 0 && field('prep')) field('prep').value = String(d.prepMinutes);
          if (d.cookMinutes != null && d.cookMinutes > 0 && field('cook')) field('cook').value = String(d.cookMinutes);
          if (d.servings != null && d.servings > 0 && field('servings')) field('servings').value = String(d.servings);
          run();
          renderFeedback(res.body);
          if (statusEl) {
            statusEl.className = 'ok';
            statusEl.textContent = doneMsg;
            statusEl.hidden = false;
          }
        })
        .catch(function (err) {
          if (statusEl) {
            statusEl.className = 'err';
            statusEl.textContent = err && err.message ? err.message : 'Error';
            statusEl.hidden = false;
          }
        })
        .then(function () {
          if (extractBtn) extractBtn.disabled = false;
          if (polishBtn) polishBtn.disabled = false;
        });
    }

    if (extractBtn) extractBtn.addEventListener('click', function () { callAi('extract'); });
    if (polishBtn) polishBtn.addEventListener('click', function () { callAi('polish'); });
  }
})();`;
