/**
 * Client-side progressive enhancement for theme switching, discovery index,
 * recipe reading/sharing/Cook Mode, and multimodal AI recipe capture.
 * Rendered inline (no client bundle step, zero third-party scripts).
 */

export const THEME_CLIENT_SCRIPT = `(function () {
  var btns = Array.prototype.slice.call(document.querySelectorAll('[data-theme-toggle]'));
  if (!btns.length) return;
  var root = document.documentElement;
  var mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function effectiveDark() {
    var cur = root.getAttribute('data-theme');
    if (cur === 'dark') return true;
    if (cur === 'light') return false;
    return !!(mq && mq.matches);
  }
  function syncPressed() {
    var on = effectiveDark() ? 'true' : 'false';
    btns.forEach(function (btn) { btn.setAttribute('aria-pressed', on); });
  }
  syncPressed();
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', function () {
      var saved = null;
      try { saved = localStorage.getItem('2y-theme'); } catch (e) {}
      if (saved !== 'dark' && saved !== 'light') {
        root.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
        syncPressed();
      }
    });
  }
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = effectiveDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('2y-theme', next); } catch (e) {}
      syncPressed();
    });
  });
})();`;

export const GLOBAL_CHROME_SCRIPT = `(function () {
  var W = typeof window !== 'undefined' ? window : null;
  if (!document || typeof document.querySelectorAll !== 'function') return;
  function qsa(root, sel) {
    return root && typeof root.querySelectorAll === 'function' ? Array.prototype.slice.call(root.querySelectorAll(sel)) : [];
  }
  function getStore(kind) {
    try {
      var s = W && W[kind] ? W[kind] : (kind === 'localStorage' && typeof localStorage !== 'undefined' ? localStorage : kind === 'sessionStorage' && typeof sessionStorage !== 'undefined' ? sessionStorage : null);
      if (!s) return null;
      s.setItem('__2y_p', '1');
      s.removeItem('__2y_p');
      return s;
    } catch (e) { return null; }
  }
  var local = getStore('localStorage');
  var session = getStore('sessionStorage');
  function safeHref(h) {
    return typeof h === 'string' && h.length > 0 && h.charAt(0) === '/' && h.charAt(1) !== '/' ? h : null;
  }
  function uiLang() {
    var l = (document.documentElement && document.documentElement.lang) || 'en';
    return l === 'es' || l === 'fr' ? l : 'en';
  }
  var LABELS = {
    en: { recipes: 'Recipes', categories: 'Categories & collections', ingredients: 'Ingredients', recent: 'Recent searches', searchFor: 'Search:', remove: 'Remove' },
    es: { recipes: 'Recetas', categories: 'Categorías y colecciones', ingredients: 'Ingredientes', recent: 'Búsquedas recientes', searchFor: 'Buscar:', remove: 'Quitar' },
    fr: { recipes: 'Recettes', categories: 'Catégories et collections', ingredients: 'Ingrédients', recent: 'Recherches récentes', searchFor: 'Chercher :', remove: 'Retirer' }
  };

  // --- 1. View toggle (Cards / Index across Home, Search, Hubs, Saved) -------
  var lists = qsa(document, '[data-recipe-list]');
  var viewBtns = qsa(document, '[data-view-btn]');
  function prefersReducedMotion() {
    return !!(W && typeof W.matchMedia === 'function' && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function setView(mode, animate) {
    var v = mode === 'list' ? 'list' : 'grid';
    function apply() {
      lists.forEach(function (l) { l.setAttribute('data-view', v); });
      viewBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-view-btn') === v ? 'true' : 'false');
      });
    }
    if (animate && document && typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
      try { document.startViewTransition(apply); return; } catch (e) {}
    }
    apply();
  }
  if (viewBtns.length && lists.length) {
    try {
      var savedView = local ? local.getItem('2y-view') : null;
      if (savedView === 'grid' || savedView === 'list') setView(savedView, false);
    } catch (e) {}
    viewBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-view-btn') || 'grid';
        setView(mode, true);
        if (local) { try { local.setItem('2y-view', mode); } catch (e) {} }
      });
    });
  }

  // --- 2. Auto-submit filters on /search when selects/checkboxes change ------
  var spForm = document.querySelector ? document.querySelector('[data-search-page-form]') : null;
  if (spForm && typeof spForm.submit === 'function') {
    qsa(spForm, 'select, input[type="checkbox"]').forEach(function (ctrl) {
      ctrl.addEventListener('change', function () { spForm.submit(); });
    });
  }

  // --- 2b. Cook with what you have pantry picker on /search (Q6) ------------
  var pantryPicker = document.querySelector ? document.querySelector('[data-pantry-picker]') : null;
  if (pantryPicker) {
    var haveInput = pantryPicker.querySelector('[data-have-input]') || (spForm && spForm.querySelector('[data-have-input]'));
    var pantryChips = qsa(pantryPicker, '[data-pantry-chip]');
    var pantrySelected = pantryPicker.querySelector('[data-pantry-selected]');
    var pantryAddInput = pantryPicker.querySelector('[data-pantry-add-input]');
    var pantryAddBtn = pantryPicker.querySelector('[data-pantry-add-btn]');
    var pantryStatus = pantryPicker.querySelector('[data-pantry-status]');
    var maxItems = 5;
    function normHave(s) {
      return String(s || '').trim().replace(/\\s+/g, ' ').toLowerCase();
    }
    var pantryList = haveInput && haveInput.value
      ? haveInput.value.split(',').map(function (s) { return s.trim().replace(/\\s+/g, ' '); }).filter(Boolean).slice(0, maxItems)
      : [];
    function renderPantryState() {
      if (haveInput) haveInput.value = pantryList.join(',');
      pantryChips.forEach(function (chip) {
        var key = normHave(chip.getAttribute('data-pantry-chip') || chip.textContent);
        var active = pantryList.some(function (x) { return normHave(x) === key; });
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (pantrySelected) {
        while (pantrySelected.firstChild) pantrySelected.removeChild(pantrySelected.firstChild);
        pantrySelected.hidden = pantryList.length === 0;
        pantryList.forEach(function (item) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'pantry-selected-pill';
          b.setAttribute('data-pantry-remove', item);
          b.textContent = item + ' ×';
          b.addEventListener('click', function () {
            pantryList = pantryList.filter(function (x) { return normHave(x) !== normHave(item); });
            if (pantryStatus) pantryStatus.hidden = true;
            renderPantryState();
          });
          pantrySelected.appendChild(b);
        });
      }
    }
    function togglePantryItem(rawItem, addOnly) {
      var clean = String(rawItem || '').trim().replace(/\\s+/g, ' ');
      if (clean.length < 2 || clean.length > 32) return;
      var k = normHave(clean);
      var exists = pantryList.some(function (x) { return normHave(x) === k; });
      if (exists) {
        if (!addOnly) pantryList = pantryList.filter(function (x) { return normHave(x) !== k; });
        if (pantryStatus) pantryStatus.hidden = true;
        renderPantryState();
        return;
      }
      if (pantryList.length >= maxItems) {
        if (pantryStatus) {
          pantryStatus.textContent = pantryPicker.getAttribute('data-max-msg') || 'Pick up to 5 ingredients.';
          pantryStatus.hidden = false;
        }
        return;
      }
      pantryList.push(clean);
      if (pantryStatus) pantryStatus.hidden = true;
      renderPantryState();
    }
    pantryChips.forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.preventDefault();
        togglePantryItem(chip.getAttribute('data-pantry-chip') || chip.textContent, false);
      });
    });
    function addCustomPantry() {
      if (!pantryAddInput) return;
      togglePantryItem(pantryAddInput.value, true);
      pantryAddInput.value = '';
    }
    if (pantryAddBtn) pantryAddBtn.addEventListener('click', addCustomPantry);
    if (pantryAddInput) {
      pantryAddInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addCustomPantry();
        }
      });
    }
    renderPantryState();
  }

  // --- 3. Save ♥ (bookmarks) + Recently Viewed + optional server sync --------
  var SAVED_KEY = '2y-saved';
  var RECENT_KEY = '2y-recent';
  var RECENT_Q_KEY = '2y-recent-q';
  var LANG_FORM_KEY = '2y-lang-form';

  function readJsonArr(key) {
    if (!local) return [];
    try {
      var parsed = JSON.parse(local.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function writeJsonArr(key, arr) {
    if (!local) return;
    try { local.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }

  function clearChildren(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function renderLocalSaved() {
    var root = document.querySelector ? document.querySelector('[data-saved-local-root]') : null;
    if (!root) return;
    var items = readJsonArr(SAVED_KEY).filter(function (x) { return x && typeof x.id === 'string' && safeHref(x.href); });
    clearChildren(root);
    if (!items.length) {
      var box = document.createElement('div');
      box.className = 'empty-note empty-search-card';
      var p = document.createElement('p');
      p.textContent = root.getAttribute('data-empty-text') || 'No saved recipes yet.';
      box.appendChild(p);
      var bHref = safeHref(root.getAttribute('data-browse-href') || '/search');
      if (bHref) {
        var acts = document.createElement('div');
        acts.className = 'empty-actions';
        var a = document.createElement('a');
        a.className = 'empty-share-link';
        a.href = bHref;
        a.textContent = root.getAttribute('data-browse-label') || 'Browse recipes';
        acts.appendChild(a);
        box.appendChild(acts);
      }
      root.appendChild(box);
      return;
    }
    var ul = document.createElement('ul');
    ul.className = 'discovery-list';
    items.forEach(function (it, idx) {
      var li = document.createElement('li');
      var num = document.createElement('span');
      num.className = 'recipe-number';
      num.textContent = (idx + 1 < 10 ? '0' : '') + (idx + 1);
      li.appendChild(num);
      var main = document.createElement('div');
      if (it.cat) {
        var ey = document.createElement('span');
        ey.className = 'eyebrow';
        ey.textContent = String(it.cat);
        main.appendChild(ey);
      }
      var h3 = document.createElement('h3');
      var link = document.createElement('a');
      link.className = 'stretched-row';
      link.href = safeHref(it.href) || '/';
      link.textContent = String(it.title || it.id);
      h3.appendChild(link);
      main.appendChild(h3);
      li.appendChild(main);
      var end = document.createElement('div');
      end.className = 'row-end';
      if (typeof it.min === 'number' && it.min > 0) {
        var st = document.createElement('span');
        st.className = 'icon-stat';
        st.textContent = it.min + ' min';
        end.appendChild(st);
      }
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'save-btn save-btn--labeled';
      rm.setAttribute('aria-pressed', 'true');
      rm.style.position = 'relative';
      rm.style.zIndex = '2';
      rm.textContent = root.getAttribute('data-remove-label') || (LABELS[uiLang()] || LABELS.en).remove;
      rm.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleSavedById(it.id, it);
      });
      end.appendChild(rm);
      li.appendChild(end);
      ul.appendChild(li);
    });
    root.appendChild(ul);
  }

  function renderLocalRecent() {
    var root = document.querySelector ? document.querySelector('[data-recent-local-root]') : null;
    if (!root) return;
    var items = readJsonArr(RECENT_KEY).filter(function (x) { return x && typeof x.id === 'string' && safeHref(x.href); });
    if (!items.length) return;
    clearChildren(root);
    var ul = document.createElement('ul');
    ul.className = 'recent-links-list';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = safeHref(it.href) || '/';
      a.textContent = String(it.title || it.id);
      li.appendChild(a);
      if (it.cat) {
        var sp = document.createElement('span');
        sp.className = 'recent-cat';
        sp.textContent = String(it.cat);
        li.appendChild(sp);
      }
      ul.appendChild(li);
    });
    root.appendChild(ul);
  }

  var knownSignedIn = null;
  var savedPage = document.querySelector ? document.querySelector('[data-saved-page]') : null;
  if (savedPage) knownSignedIn = savedPage.getAttribute('data-signed-in') === '1';

  function refreshSaveUi(idsOverride) {
    var items = readJsonArr(SAVED_KEY);
    var savedSet = new Set();
    if (Array.isArray(idsOverride)) {
      idsOverride.forEach(function (id) { if (typeof id === 'string') savedSet.add(id); });
    } else {
      items.forEach(function (it) { if (it && typeof it.id === 'string') savedSet.add(it.id); });
    }
    qsa(document, '[data-save-recipe]').forEach(function (btn) {
      var id = btn.getAttribute('data-save-recipe');
      var on = !!id && savedSet.has(id);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var lbl = on ? btn.getAttribute('data-label-saved') : btn.getAttribute('data-label-save');
      if (lbl) {
        btn.setAttribute('aria-label', lbl);
        btn.setAttribute('title', lbl);
        var span = btn.querySelector ? btn.querySelector('[data-save-label]') : null;
        if (span) span.textContent = lbl;
      }
    });
    qsa(document, '[data-saved-count]').forEach(function (badge) {
      badge.textContent = savedSet.size > 0 ? String(savedSet.size) : '';
      badge.hidden = savedSet.size === 0;
    });
    renderLocalSaved();
  }

  function pushServerToggle(id) {
    if (typeof fetch !== 'function') return;
    fetch('/account/saved/toggle', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ recipe_id: id })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.ok || !Array.isArray(data.ids)) return;
        if (savedPage && !data.saved) {
          var btn = document.querySelector('[data-save-recipe="' + id + '"]');
          var li = btn && btn.closest ? btn.closest('li[data-recipe-item]') : null;
          if (li && li.parentNode) li.parentNode.removeChild(li);
        }
        refreshSaveUi(data.ids);
      })
      .catch(function () {});
  }

  function toggleSavedById(id, metaObj) {
    if (!id) return;
    var items = readJsonArr(SAVED_KEY);
    var exists = items.some(function (x) { return x && x.id === id; });
    if (exists) {
      items = items.filter(function (x) { return !x || x.id !== id; });
    } else {
      var rec = metaObj && typeof metaObj === 'object' ? metaObj : { id: id, title: id, href: '/' };
      if (!safeHref(rec.href)) rec.href = '/';
      items.unshift({
        id: id,
        title: String(rec.title || id),
        href: rec.href,
        cat: rec.cat || null,
        min: typeof rec.min === 'number' ? rec.min : null,
        at: Date.now()
      });
      if (items.length > 200) items = items.slice(0, 200);
    }
    writeJsonArr(SAVED_KEY, items);
    if (knownSignedIn === true) {
      pushServerToggle(id);
      return;
    }
    refreshSaveUi();
    if (knownSignedIn === null && typeof fetch === 'function') {
      fetch('/account/saved', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (res) {
          if (!res || !res.ok) return;
          knownSignedIn = !!res.signedIn;
          if (knownSignedIn) pushServerToggle(id);
        })
        .catch(function () {});
    }
  }

  qsa(document, '[data-save-recipe]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var wasSaved = btn.getAttribute('aria-pressed') === 'true';
      var id = btn.getAttribute('data-save-recipe');
      var meta = null;
      try { meta = JSON.parse(btn.getAttribute('data-recipe-meta') || 'null'); } catch (err) {}
      toggleSavedById(id, meta);
      if (!wasSaved && !prefersReducedMotion() && btn.classList && typeof btn.classList.add === 'function') {
        btn.classList.remove('is-popping');
        btn.classList.add('is-popping');
        setTimeout(function () {
          if (btn.classList) btn.classList.remove('is-popping');
        }, 380);
      }
    });
  });

  if (knownSignedIn === true && savedPage) {
    var serverBtns = qsa(savedPage, '[data-saved-server-list] [data-save-recipe]');
    var serverIds = serverBtns.map(function (b) { return b.getAttribute('data-save-recipe'); }).filter(Boolean);
    refreshSaveUi(serverIds);
    var localItems = readJsonArr(SAVED_KEY);
    if (localItems.length && typeof fetch === 'function') {
      var localIds = localItems.map(function (x) { return x && x.id; }).filter(Boolean);
      var toMerge = localIds.filter(function (id) { return serverIds.indexOf(id) === -1; });
      if (toMerge.length) {
        fetch('/account/saved/sync', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ ids: localIds })
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (data && data.ok && Array.isArray(data.ids) && data.ids.length > serverIds.length && W && W.location && typeof W.location.reload === 'function') {
              writeJsonArr(SAVED_KEY, []);
              W.location.reload();
            }
          })
          .catch(function () {});
      } else {
        writeJsonArr(SAVED_KEY, []);
      }
    }
  } else {
    refreshSaveUi();
  }

  // Record recipe page visit into localStorage['2y-recent']
  var recipeMetaEl = document.getElementById ? document.getElementById('recipe-meta-data') : null;
  if (recipeMetaEl && recipeMetaEl.textContent) {
    try {
      var rm = JSON.parse(recipeMetaEl.textContent);
      if (rm && typeof rm.id === 'string' && safeHref(rm.href)) {
        var recent = readJsonArr(RECENT_KEY).filter(function (x) { return x && x.id !== rm.id; });
        recent.unshift({ id: rm.id, title: String(rm.title || ''), href: rm.href, cat: rm.cat || null, at: Date.now() });
        if (recent.length > 12) recent = recent.slice(0, 12);
        writeJsonArr(RECENT_KEY, recent);
      }
    } catch (e) {}
  }
  renderLocalRecent();

  // --- 4. Recent search history + header/sheet typeahead suggestions --------
  function saveRecentQuery(raw) {
    var q = String(raw || '').trim();
    if (!q || q.length > 80) return;
    var cur = readJsonArr(RECENT_Q_KEY).filter(function (x) { return typeof x === 'string' && x.toLowerCase() !== q.toLowerCase(); });
    cur.unshift(q);
    if (cur.length > 6) cur = cur.slice(0, 6);
    writeJsonArr(RECENT_Q_KEY, cur);
  }

  qsa(document, 'form[action="/search"]').forEach(function (f) {
    f.addEventListener('submit', function () {
      var qIn = f.querySelector('input[name="q"]');
      if (qIn) saveRecentQuery(qIn.value);
    });
  });

  function renderRecentChips(container, wrap, lang) {
    if (!container) return;
    var list = readJsonArr(RECENT_Q_KEY).filter(function (x) { return typeof x === 'string' && x.trim(); });
    clearChildren(container);
    if (!list.length) {
      if (wrap) wrap.hidden = true;
      return;
    }
    var amp = lang === 'en' ? '' : 'lang=' + encodeURIComponent(lang) + '&';
    list.forEach(function (q) {
      var a = document.createElement('a');
      a.className = 'chip';
      a.href = '/search?' + amp + 'q=' + encodeURIComponent(q);
      a.textContent = q;
      container.appendChild(a);
    });
    if (wrap) wrap.hidden = false;
  }

  function renderSuggestResults(container, data, lang, qVal) {
    clearChildren(container);
    var dict = LABELS[lang] || LABELS.en;
    var amp = lang === 'en' ? '' : 'lang=' + encodeURIComponent(lang) + '&';
    var hasAny = false;
    function addGroup(heading, rows, renderLink) {
      if (!Array.isArray(rows) || !rows.length) return;
      hasAny = true;
      var h = document.createElement('p');
      h.className = 'suggest-heading';
      h.textContent = heading;
      container.appendChild(h);
      var ul = document.createElement('ul');
      ul.className = 'suggest-list';
      rows.forEach(function (item) {
        var built = renderLink(item);
        if (!built) return;
        var li = document.createElement('li');
        li.appendChild(built);
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }
    addGroup(dict.recipes, data.recipes, function (r) {
      var hr = safeHref(r && r.href);
      if (!hr) return null;
      var a = document.createElement('a');
      a.href = hr;
      a.textContent = String(r.title || '') + (r.totalMinutes ? ' · ' + r.totalMinutes + ' min' : '');
      return a;
    });
    addGroup(dict.categories, data.categories, function (c) {
      var hr = safeHref(c && c.href);
      if (!hr) return null;
      var a = document.createElement('a');
      a.href = hr;
      a.textContent = String(c.label || '');
      return a;
    });
    addGroup(dict.ingredients, data.ingredients, function (ing) {
      if (typeof ing !== 'string' || !ing) return null;
      var a = document.createElement('a');
      a.href = '/search?' + amp + 'q=' + encodeURIComponent(ing);
      a.textContent = dict.searchFor + ' ' + ing;
      return a;
    });
    if (!hasAny && qVal) {
      var allA = document.createElement('a');
      allA.className = 'suggest-fallback-link';
      allA.href = '/search?' + amp + 'q=' + encodeURIComponent(qVal);
      allA.textContent = dict.searchFor + ' ' + qVal;
      container.appendChild(allA);
      hasAny = true;
    }
    return hasAny;
  }

  function bindSuggestInput(inputEl, targetEl, wrapEl) {
    if (!inputEl || !targetEl) return;
    var timer = null;
    var reqSeq = 0;
    function showRecent() {
      var lang = inputEl.getAttribute('data-suggest-lang') || uiLang();
      var list = readJsonArr(RECENT_Q_KEY).filter(function (x) { return typeof x === 'string' && x.trim(); });
      if (!list.length) {
        if (wrapEl) wrapEl.hidden = true;
        return;
      }
      clearChildren(targetEl);
      var dict = LABELS[lang] || LABELS.en;
      var h = document.createElement('p');
      h.className = 'suggest-heading';
      h.textContent = dict.recent;
      targetEl.appendChild(h);
      var ul = document.createElement('ul');
      ul.className = 'suggest-list';
      var amp = lang === 'en' ? '' : 'lang=' + encodeURIComponent(lang) + '&';
      list.forEach(function (q) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '/search?' + amp + 'q=' + encodeURIComponent(q);
        a.textContent = q;
        li.appendChild(a);
        ul.appendChild(li);
      });
      targetEl.appendChild(ul);
      if (wrapEl) wrapEl.hidden = false;
    }
    function runSuggest() {
      var val = (inputEl.value || '').trim();
      var lang = inputEl.getAttribute('data-suggest-lang') || uiLang();
      if (!val) {
        if (wrapEl && wrapEl.getAttribute('data-search-popover') != null) showRecent();
        else if (wrapEl) wrapEl.hidden = true;
        return;
      }
      if (typeof fetch !== 'function') return;
      var mySeq = ++reqSeq;
      fetch('/api/v1/search/suggest?q=' + encodeURIComponent(val) + '&lang=' + encodeURIComponent(lang), {
        headers: { 'Accept': 'application/json' }
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (mySeq !== reqSeq || !data) return;
          var any = renderSuggestResults(targetEl, data, lang, val);
          if (wrapEl) wrapEl.hidden = !any;
        })
        .catch(function () {});
    }
    inputEl.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(runSuggest, 120);
    });
    inputEl.addEventListener('focus', function () {
      if ((inputEl.value || '').trim()) runSuggest();
      else if (wrapEl && wrapEl.getAttribute('data-search-popover') != null) showRecent();
    });
  }

  var headerInput = document.querySelector ? document.querySelector('[data-header-search-input]') : null;
  var headerPopover = document.querySelector ? document.querySelector('[data-search-popover]') : null;
  if (headerInput && headerPopover) {
    bindSuggestInput(headerInput, headerPopover, headerPopover);
    var headerForm = document.querySelector('[data-header-search]');
    document.addEventListener('click', function (ev) {
      if (headerForm && typeof headerForm.contains === 'function' && !headerForm.contains(ev.target)) {
        headerPopover.hidden = true;
      }
    });
  }

  var sheet = document.querySelector ? document.querySelector('[data-search-sheet]') : null;
  if (sheet) {
    var sheetInput = sheet.querySelector('[data-sheet-search-input]');
    var sheetClose = sheet.querySelector('[data-close-search-sheet]');
    var recentWrap = sheet.querySelector('[data-recent-searches-wrap]');
    var recentChips = sheet.querySelector('[data-recent-searches]');
    var clearRecentBtn = sheet.querySelector('[data-clear-recent-q]');
    var sheetSugWrap = sheet.querySelector('[data-sheet-suggestions-wrap]');
    var sheetSug = sheet.querySelector('[data-sheet-suggestions]');
    var lastTrigger = null;

    if (sheetInput && sheetSug && sheetSugWrap) {
      bindSuggestInput(sheetInput, sheetSug, sheetSugWrap);
    }
    if (clearRecentBtn) {
      clearRecentBtn.addEventListener('click', function () {
        writeJsonArr(RECENT_Q_KEY, []);
        renderRecentChips(recentChips, recentWrap, uiLang());
      });
    }
    function openSheet(triggerEl) {
      lastTrigger = triggerEl || document.activeElement;
      var mobMenu = document.querySelector ? document.querySelector('details.mobile-menu[open]') : null;
      if (mobMenu) mobMenu.removeAttribute('open');
      renderRecentChips(recentChips, recentWrap, uiLang());
      sheet.hidden = false;
      if (document.body && document.body.style) document.body.style.overflow = 'hidden';
      if (sheetInput && typeof sheetInput.focus === 'function') sheetInput.focus();
    }
    function closeSheet() {
      if (sheet.hidden) return;
      sheet.hidden = true;
      if (document.body && document.body.style) document.body.style.overflow = '';
      if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    }
    qsa(document, '[data-open-search-sheet]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openSheet(el);
      });
    });
    if (sheetClose) sheetClose.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!sheet.hidden) closeSheet();
        if (headerPopover) headerPopover.hidden = true;
      }
    });
  }

  // --- 5. Preserve form state across language switches (N5) -----------------
  function captureFormSnapshot() {
    var forms = qsa(document, 'form[data-capture-form], form[data-search-page-form], form[data-report-form]');
    if (!forms.length) return null;
    var fields = {};
    var any = false;
    forms.forEach(function (f) {
      qsa(f, 'input, textarea, select').forEach(function (el) {
        var name = el.getAttribute('name');
        var type = (el.getAttribute('type') || '').toLowerCase();
        if (!name || type === 'hidden' || type === 'file' || name === 'id') return;
        if (type === 'checkbox') { fields[name] = !!el.checked; any = true; }
        else if (typeof el.value === 'string' && el.value !== '') { fields[name] = el.value; any = true; }
      });
    });
    if (!any) return null;
    var path = W && W.location && W.location.pathname ? W.location.pathname : '/';
    return { path: path, at: Date.now(), fields: fields };
  }

  qsa(document, '.language-nav a, .mobile-menu-langs a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (!session) return;
      var snap = captureFormSnapshot();
      if (snap) {
        try { session.setItem(LANG_FORM_KEY, JSON.stringify(snap)); } catch (e) {}
      }
    });
  });

  if (session && W && W.location) {
    try {
      var rawSnap = session.getItem(LANG_FORM_KEY);
      if (rawSnap) {
        session.removeItem(LANG_FORM_KEY);
        var parsedSnap = JSON.parse(rawSnap);
        if (parsedSnap && parsedSnap.path === W.location.pathname && typeof parsedSnap.at === 'number' && (Date.now() - parsedSnap.at) < 60000 && parsedSnap.fields) {
          var targetForms = qsa(document, 'form[data-capture-form], form[data-search-page-form], form[data-report-form]');
          targetForms.forEach(function (f) {
            Object.keys(parsedSnap.fields).forEach(function (name) {
              var el = f.querySelector('[name="' + name + '"]');
              if (!el) return;
              var val = parsedSnap.fields[name];
              if (el.type === 'checkbox') el.checked = !!val;
              else if (typeof val === 'string') el.value = val;
            });
            try {
              if (typeof Event === 'function' && typeof f.dispatchEvent === 'function') f.dispatchEvent(new Event('input'));
            } catch (err) {}
          });
        }
      }
    } catch (e) {}
  }
})();`;

export const DISCOVERY_CLIENT_SCRIPT = `(function () {
  var lists = Array.prototype.slice.call(document.querySelectorAll('[data-recipe-list]'));
  var list = lists[0] || document.querySelector('[data-recipe-list]');
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-recipe-group]'));

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
  var emptyShareLink = emptyEl && emptyEl.querySelector ? emptyEl.querySelector('[data-empty-share-link]') : null;
  var baseShareHref = emptyShareLink ? (emptyShareLink.getAttribute('data-base-href') || emptyShareLink.getAttribute('href') || '/account/recipes/new') : '/account/recipes/new';

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

  // Typo tolerance is deliberately narrow: one edit for 5-7 letter words, two
  // for 8+, and only against whole words of similar length. Fuzzy matching is
  // a fallback pass (see filterRecipes), never mixed into exact results, so
  // "pasta" cannot surface Mulled Wine via "taste".
  function matchTokenInText(tok, text, fuzzy) {
    if (!tok || !text) return false;
    if (text.indexOf(tok) !== -1) return true;
    var vars = getVariants(tok);
    for (var i = 0; i < vars.length; i++) {
      if (text.indexOf(vars[i]) !== -1) return true;
    }
    if (fuzzy && tok.length >= 5) {
      var maxD = tok.length >= 8 ? 2 : 1;
      var words = text.split(/[^a-z0-9]+/);
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (w.length >= 4 && Math.abs(w.length - tok.length) <= maxD) {
          if (editDist(tok, w) <= maxD) return true;
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
      parent: li.parentNode,
      idx: idx,
      display: (li.getAttribute('data-title') || (li.querySelector('h3') ? li.querySelector('h3').textContent : '') || '').trim(),
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

  var statusEl = document.querySelector('[data-search-status]');
  var filterEmptyEl = document.querySelector('[data-filter-empty]');
  var searchAllLink = document.querySelector('[data-search-all]');
  function announce(n, q) {
    if (!statusEl) return;
    if (!q) { statusEl.textContent = ''; return; }
    var tmpl = n === 1 ? (statusEl.getAttribute('data-one') || '1 recipe') : (statusEl.getAttribute('data-many') || '{n} recipes');
    statusEl.textContent = tmpl.replace('{n}', String(n));
  }

  function runPass(tokens, fuzzy) {
    var matched = [];
    records.forEach(function (rec) {
      var titleMatchesAll = true;
      var categoryMatchesAny = false;
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        var inTitle = matchTokenInText(tok, rec.title, fuzzy);
        var inCat = matchTokenInText(tok, rec.cat, fuzzy);
        // Intros/ingredients are long free text: exact (plural-aware) only.
        var inBody = matchTokenInText(tok, rec.body, false);
        if (!inTitle && !inCat && !inBody) return;
        if (!inTitle) titleMatchesAll = false;
        if (inCat) categoryMatchesAny = true;
      }
      matched.push({ rec: rec, tier: titleMatchesAll ? 1 : (categoryMatchesAny ? 2 : 3) });
    });
    return matched;
  }

  function filterRecipes() {
    var rawQ = (input.value || '').trim();
    var q = norm(rawQ);
    if (filterEmptyEl) filterEmptyEl.hidden = Boolean(q);
    if (searchAllLink) {
      try {
        var su = new URL(searchAllLink.getAttribute('data-base') || '/', window.location.href);
        if (rawQ) su.searchParams.set('q', rawQ); else su.searchParams.delete('q');
        su.hash = 'recipes';
        searchAllLink.setAttribute('href', su.pathname + su.search + su.hash);
      } catch (e) {}
    }
    if (!q) {
      if (closestNote) closestNote.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      if (emptyShareLink) emptyShareLink.setAttribute('href', baseShareHref);
      records.forEach(function (r) {
        r.el.hidden = false;
        var num = r.el.querySelector('.recipe-number');
        if (num) num.textContent = (r.idx + 1 < 10 ? '0' : '') + (r.idx + 1);
        var dest = r.parent || list;
        if (dest) dest.appendChild(r.el);
      });
      groups.forEach(function (g) { g.hidden = false; });
      announce(0, '');
      return;
    }

    var tokens = q.split(/\\s+/);
    var matched = runPass(tokens, false);
    var usedFuzzy = false;
    if (matched.length === 0) {
      matched = runPass(tokens, true);
      usedFuzzy = matched.length > 0;
    }
    announce(matched.length, q);

    if (matched.length > 0) {
      if (emptyEl) emptyEl.hidden = true;
      if (emptyShareLink) emptyShareLink.setAttribute('href', baseShareHref);
      if (closestNote) {
        closestNote.hidden = !usedFuzzy;
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
      // Ranked results render inside the first list; hide the other group
      // shells so no empty headings linger (grouped homepage, 4A).
      groups.forEach(function (g) { g.hidden = !(list && g.contains(list)); });
    } else {
      records.forEach(function (r) { r.el.hidden = true; });
      groups.forEach(function (g) { g.hidden = true; });
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
              a.textContent = s.rec.display || s.rec.title;
              if (link) a.href = link.href;
              li.appendChild(a);
              suggestionsList.appendChild(li);
            });
            emptySuggestions.hidden = false;
          } else {
            emptySuggestions.hidden = true;
          }
        }
        if (emptyShareLink && rawQ) {
          var sep = baseShareHref.indexOf('?') === -1 ? '?' : '&';
          emptyShareLink.setAttribute('href', baseShareHref + sep + 'prompt=' + encodeURIComponent(rawQ));
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
    // The header search link lands on /#search: focus the box for typing.
    if (window.location.hash === '#search') input.focus({ preventScroll: true });
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
  var pageUrl = (shareNav && shareNav.getAttribute('data-share-url')) || (window && window.location ? window.location.href : '');
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
    function bindSvgCardExport(btn, width, height, suffix) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        var svgUrl = btn.getAttribute('data-card-svg');
        var slug = btn.getAttribute('data-recipe-slug') || 'recipe';
        if (!svgUrl) return;
        btn.disabled = true;
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
                  canvas.width = width;
                  canvas.height = height;
                  var ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, width, height);
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
            var fname = slug + suffix;
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
            flashBtn(btn);
          })
          .catch(function () {
            window.open(svgUrl, '_blank', 'noopener');
          })
          .then(function () {
            btn.disabled = false;
          });
      });
    }
    bindSvgCardExport(shareNav.querySelector('[data-story-card]'), 1080, 1920, '-2yolks-story.png');
    bindSvgCardExport(shareNav.querySelector('[data-og-card]'), 1200, 630, '-2yolks-card.png');
  }
  var printBtn = document.querySelector('[data-print-open]');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  var openBtn = document.querySelector('[data-cook-open]');
  if (dataEl && overlay && openBtn) {
    var cookData = JSON.parse(dataEl.textContent);
    var steps = Array.prototype.map.call(document.querySelectorAll('ol.steps li'), function (li) {
      var st = li.querySelector('[data-step-text]');
      return st ? st.textContent : li.textContent;
    });
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
      var liveSteps = Array.prototype.map.call(document.querySelectorAll('ol.steps li'), function (li) {
        var st = li.querySelector('[data-step-text]');
        return st ? st.textContent : li.textContent;
      });
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
  // Inline step timer chips (D7)
  Array.prototype.slice.call(document.querySelectorAll('[data-inline-timer]')).forEach(function (chip) {
    var mins = parseInt(chip.getAttribute('data-inline-timer') || '0', 10);
    if (!mins || mins <= 0) return;
    var disp = chip.querySelector('[data-chip-display]') || chip;
    var baseLabel = chip.getAttribute('data-timer-label-base') || (mins + ' min');
    var doneLabel = chip.getAttribute('data-done-label') || 'Done!';
    var tid = null;
    function reset() {
      if (tid) { clearInterval(tid); tid = null; }
      if (chip.classList) {
        chip.classList.remove('is-running');
        chip.classList.remove('is-done');
      }
      chip.setAttribute('aria-pressed', 'false');
      disp.textContent = baseLabel;
    }
    chip.addEventListener('click', function () {
      if (tid) { reset(); return; }
      if (chip.classList) {
        chip.classList.remove('is-done');
        chip.classList.add('is-running');
      }
      chip.setAttribute('aria-pressed', 'true');
      var end = Date.now() + mins * 60000;
      function update() {
        var left = Math.max(0, Math.round((end - Date.now()) / 1000));
        if (left <= 0) {
          clearInterval(tid);
          tid = null;
          if (chip.classList) {
            chip.classList.remove('is-running');
            chip.classList.add('is-done');
          }
          chip.setAttribute('aria-pressed', 'false');
          disp.textContent = doneLabel;
          try {
            var Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
            if (Ctx) {
              var ctx = new Ctx(), osc = ctx.createOscillator(), g = ctx.createGain();
              osc.type = 'sine'; osc.frequency.value = 880;
              g.gain.setValueAtTime(0.16, ctx.currentTime);
              g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.connect(g); g.connect(ctx.destination);
              osc.start(); osc.stop(ctx.currentTime + 0.5);
            }
          } catch (e4) {}
          return;
        }
        var mm = Math.floor(left / 60), ss = left % 60;
        disp.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss;
      }
      update();
      tid = setInterval(update, 500);
    });
  });
})();`;

/**
 * Live quality checks + optional AI Kitchen Co-Editor on the capture form,
 * plus on-device autosave/restore of the draft. Nothing here gates saving -
 * the server still validates (and enforces the rights attestation).
 * Strings are localized en/es/fr and follow the form's UI language.
 */
const CAPTURE_CHECK_STRINGS_DATA: Record<'en' | 'es' | 'fr', Record<string, string>> = {
  en: {
    title: 'Give the recipe a name',
    ingredients: 'List the ingredients, one per line',
    qty_ok: 'Every ingredient line starts with an amount',
    cups_ok: 'No ambiguous cup measures',
    qty_todo: '## ingredient line(s) do not start with an amount - cooks need quantities',
    cups_todo: 'You use "cup" - cups vary by country, so consider grams or ml too',
    steps: 'Write the steps, one per line',
    servings_ok: 'Servings (optional) should be a number',
    servings_bad: 'Servings should be a number',
    source_ok: 'Source noted',
    source_todo: 'Add the https:// link to the original',
    optional: 'optional',
    restored: 'Restored your unsaved draft from this device.',
    unsaved: 'This device has unsaved changes for this recipe.',
    restore: 'Restore them',
    discard: 'Discard',
  },
  es: {
    title: 'Ponle un nombre a la receta',
    ingredients: 'Anota los ingredientes, uno por línea',
    qty_ok: 'Cada línea de ingrediente empieza con una cantidad',
    cups_ok: 'Sin medidas ambiguas en tazas',
    qty_todo: '## línea(s) de ingredientes no empiezan con cantidad - hacen falta cantidades',
    cups_todo: 'Usas "taza" - las tazas varían por país, considera también gramos o ml',
    steps: 'Escribe los pasos, uno por línea',
    servings_ok: 'Las porciones (opcional) deben ser un número',
    servings_bad: 'Las porciones deben ser un número',
    source_ok: 'Fuente anotada',
    source_todo: 'Agrega el enlace https:// al original',
    optional: 'opcional',
    restored: 'Recuperamos tu borrador sin guardar de este dispositivo.',
    unsaved: 'Este dispositivo tiene cambios sin guardar de esta receta.',
    restore: 'Recuperarlos',
    discard: 'Descartar',
  },
  fr: {
    title: 'Donnez un nom à la recette',
    ingredients: 'Listez les ingrédients, un par ligne',
    qty_ok: "Chaque ligne d'ingrédient commence par une quantité",
    cups_ok: 'Pas de mesures ambiguës en tasses',
    qty_todo: "## ligne(s) d'ingrédients ne commencent pas par une quantité - il faut des quantités",
    cups_todo: 'Vous utilisez "tasse" - les tasses varient selon les pays, pensez aussi aux grammes ou ml',
    steps: 'Écrivez les étapes, une par ligne',
    servings_ok: 'Les portions (facultatif) doivent être un nombre',
    servings_bad: 'Les portions doivent être un nombre',
    source_ok: 'Source notée',
    source_todo: "Ajoutez le lien https:// vers l'original",
    optional: 'facultatif',
    restored: 'Votre brouillon non enregistré sur cet appareil a été restauré.',
    unsaved: 'Cet appareil a des modifications non enregistrées pour cette recette.',
    restore: 'Les restaurer',
    discard: 'Supprimer',
  },
};
export const CAPTURE_CHECK_STRINGS = JSON.stringify(CAPTURE_CHECK_STRINGS_DATA);

/**
 * Pure helpers used by the capture script. Kept as plain ES5 source (String.raw,
 * so regex backslashes stay literal) and exported so tests can evaluate them.
 *  - captureDecide: what to do with an autosaved copy on load:
 *    'none' | 'restore' (server form is blank: put the copy back) | 'offer' (ask first).
 *  - mergeIngredientLine: a quick-choice answer replaces the existing line for
 *    the same ingredient ("salt" -> "1 tsp salt") instead of adding a duplicate.
 */
export const CAPTURE_HELPERS_JS = String.raw`
function captureNorm(v) { return String(v == null ? '' : v).replace(/\r/g, '').trim(); }
function captureIsBlank(f) {
  return ['title', 'intro', 'ingredients', 'steps'].every(function (n) { return !captureNorm(f && f[n]); });
}
function captureSame(a, b, names) {
  return names.every(function (n) { return captureNorm(a && a[n]) === captureNorm(b && b[n]); });
}
function captureDecide(saved, current, names, now, maxAgeMs) {
  if (!saved || typeof saved !== 'object' || !saved.f || typeof saved.f !== 'object' || typeof saved.at !== 'number') return 'none';
  if (now - saved.at > maxAgeMs) return 'none';
  if (captureIsBlank(saved.f) || captureSame(saved.f, current, names)) return 'none';
  return captureIsBlank(current) ? 'restore' : 'offer';
}
function ingredientCore(line) {
  var s = String(line == null ? '' : line).toLowerCase().replace(/\s+/g, ' ').trim();
  s = s.replace(/^[0-9\u00BC-\u00BE\u2150-\u215E][0-9\u00BC-\u00BE\u2150-\u215E.,\/\s-]*/, '');
  s = s.replace(/^(?:kg|g|mg|ml|cl|dl|l|oz|lbs?|cups?|tbsps?|tsps?|tablespoons?|teaspoons?|tazas?|cdas?|cdtas?|cucharadas?|cucharaditas?|tasses?|c\.\s?à\s?[sc]\.?|cuill[eè]res?(?: à (?:soupe|café))?|pinch(?:es)?|pizcas?|pinc[ée]es?|cloves?|dientes?|gousses?|cans?|latas?|bo[iî]tes?|pieces?|piezas?|morceaux?)\.?(?=\s|$)\s*/, '');
  s = s.replace(/^(?:of|de|d['’])\s*/, '');
  return s.replace(/\s*[,(;].*$/, '').trim();
}
function mergeIngredientLine(text, answer, target) {
  var ans = String(answer == null ? '' : answer).trim();
  var src = String(text == null ? '' : text);
  if (!ans) return src;
  var lines = src.split(/\r?\n/);
  var tgt = String(target == null ? '' : target).replace(/\s+/g, ' ').trim().toLowerCase();
  var ansCore = ingredientCore(ans);
  var hit = -1;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].replace(/\s+/g, ' ').trim().toLowerCase();
    if (!l) continue;
    if (tgt && l === tgt) { hit = i; break; }
    if (hit === -1 && ansCore && ingredientCore(l) === ansCore) hit = i;
  }
  if (hit !== -1) { lines[hit] = ans; return lines.join('\n'); }
  var cur = src.replace(/\s+$/, '');
  return cur ? cur + '\n' + ans : ans;
}
var CAPTURE_UNITS_MAP = {
  g:1,kg:1,mg:1,ml:1,cl:1,dl:1,l:1,oz:1,lb:1,lbs:1,
  cup:1,cups:1,tbsp:1,tbsps:1,tablespoon:1,tablespoons:1,
  tsp:1,tsps:1,teaspoon:1,teaspoons:1,
  taza:1,tazas:1,cda:1,cdas:1,cucharada:1,cucharadas:1,
  cdta:1,cdtas:1,cucharadita:1,cucharaditas:1,
  tasse:1,tasses:1,
  pinch:1,pinches:1,pizca:1,pizcas:1,pincee:1,
  clove:1,cloves:1,diente:1,dientes:1,gousse:1,gousses:1,
  can:1,cans:1,lata:1,latas:1,
  slice:1,slices:1,piece:1,pieces:1,pieza:1,piezas:1,
  bunch:1,manojo:1,sprig:1,sprigs:1,rama:1,ramas:1
};
var CAPTURE_QTY_RE = /^\s*((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[\u00BC-\u00BE\u2150-\u215E])(?:\s*[-\u2013]\s*(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[\u00BC-\u00BE\u2150-\u215E]))?)\s*(.*)$/;
function normUnitKey(s) {
  return String(s || '').toLowerCase().replace(/\u00e9|\u00e8|\u00ea/g, 'e').replace(/[^a-z]/g, '');
}
function parseIngRow(line) {
  var cleaned = String(line == null ? '' : line).replace(/^\s*(?:[-*\u2022\u00B7]\s+)/, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { isSection: false, qty: '', unit: '', item: '' };
  if (!CAPTURE_QTY_RE.test(cleaned)) {
    var sec = /^(?:#+\s*(.+?)\s*|\[(.+?)\]|([A-Za-z\u00C0-\u024F][^0-9,;]{1,48}):)$/.exec(cleaned);
    if (sec) {
      var heading = (sec[1] || sec[2] || sec[3] || '').replace(/:+$/, '').trim();
      if (heading) return { isSection: true, qty: '', unit: '', item: heading };
    }
  }
  var qm = CAPTURE_QTY_RE.exec(cleaned);
  if (!qm) return { isSection: false, qty: '', unit: '', item: cleaned };
  var qty = qm[1].replace(/\s+/g, ' ').trim();
  var rest = (qm[2] || '').trim();
  var unit = '';
  var um = /^([A-Za-z\u00C0-\u024F]+)\.?(?=\s|$)\s*(.*)$/.exec(rest);
  if (um && CAPTURE_UNITS_MAP[normUnitKey(um[1])]) {
    unit = um[1];
    rest = (um[2] || '').trim().replace(/^of\s+/i, '');
  }
  return { isSection: false, qty: qty, unit: unit, item: rest };
}
function formatIngRow(row) {
  if (!row) return '';
  var item = String(row.item == null ? '' : row.item).replace(/\s+/g, ' ').trim();
  if (row.isSection) {
    var h = item.replace(/:+$/, '').trim();
    return h ? h + ':' : '';
  }
  var parts = [];
  if (row.qty && String(row.qty).trim()) parts.push(String(row.qty).trim());
  if (row.unit && String(row.unit).trim()) parts.push(String(row.unit).trim());
  if (item) parts.push(item);
  return parts.join(' ');
}
`;

export const CAPTURE_CLIENT_SCRIPT = `(function () {
${CAPTURE_HELPERS_JS}
  // --- On-device autosave (localStorage; never sent anywhere) -----------------
  var DRAFT_PREFIX = '2yolks:capture:';
  var PENDING_KEY = '2yolks:capture:pending';
  var MAX_AGE = 30 * 24 * 3600 * 1000;
  var W = typeof window !== 'undefined' ? window : null;
  function store(kind) {
    try { var s = W[kind]; var k = DRAFT_PREFIX + 'probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; }
  }
  var local = store('localStorage');
  var session = store('sessionStorage');
  function readSaved(key) {
    if (!local) return null;
    try { return JSON.parse(local.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function drop(key) { if (local && key) { try { local.removeItem(key); } catch (e) {} } }
  function takePending() {
    var p = null;
    if (session) { try { p = session.getItem(PENDING_KEY); session.removeItem(PENDING_KEY); } catch (e) {} }
    return p;
  }
  (function purgeOld() {
    if (!local) return;
    try {
      var now = Date.now(), dead = [];
      for (var i = 0; i < local.length; i++) {
        var k = local.key(i);
        if (!k || k.indexOf(DRAFT_PREFIX) !== 0) continue;
        var v = readSaved(k);
        if (!v || typeof v.at !== 'number' || now - v.at > MAX_AGE) dead.push(k);
      }
      dead.forEach(drop);
    } catch (e) {}
  })();
  // "Sent in" page: the draft is with the reviewers now, forget the device copy.
  var clearEl = document.querySelector('[data-capture-clear]');
  if (clearEl) {
    drop(takePending());
    drop(DRAFT_PREFIX + clearEl.getAttribute('data-capture-clear'));
  }

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
  // "Link to the original" only matters for adapted recipes. Visible without
  // JS; hidden here unless "adapted" is picked (or it carries a server error).
  function syncSourceLink() {
    var wrap = form.querySelector('[data-source-link]');
    if (!wrap) return;
    var urlEl = field('source_url');
    var hasErr = !!urlEl && urlEl.getAttribute('aria-invalid') === 'true';
    wrap.hidden = field('source_kind').value !== 'adapted' && !hasErr;
  }
  function qsa(root, sel) {
    return root && typeof root.querySelectorAll === 'function' ? Array.prototype.slice.call(root.querySelectorAll(sel)) : [];
  }
  function checkState(key) {
    var li = box.querySelector('[data-check="' + key + '"]');
    return li ? li.className : '';
  }

  // --- S6 Live preview (textContent + createElement only; never innerHTML) ---
  var previewWrap = document.querySelector('[data-live-preview]');
  function updatePreview() {
    if (!previewWrap) return;
    var pTitle = previewWrap.querySelector('[data-preview-title]');
    var pCat = previewWrap.querySelector('[data-preview-category]');
    var pFacts = previewWrap.querySelector('[data-preview-facts]');
    var pIntro = previewWrap.querySelector('[data-preview-intro]');
    var pEmpty = previewWrap.querySelector('[data-preview-empty]');
    var pIngWrap = previewWrap.querySelector('[data-preview-ing-wrap]');
    var pIngs = previewWrap.querySelector('[data-preview-ings]');
    var pStepWrap = previewWrap.querySelector('[data-preview-step-wrap]');
    var pSteps = previewWrap.querySelector('[data-preview-steps]');
    var rawTitle = field('title') ? (field('title').value || '').trim() : '';
    if (pTitle) pTitle.textContent = rawTitle || pTitle.getAttribute('data-empty-title') || '';
    var catVal = field('category') ? field('category').value : '';
    var labels = CATLABELS[lang()] || CATLABELS.en;
    var catText = catVal && labels && labels[catVal] ? labels[catVal] : '';
    if (pCat) { pCat.textContent = catText; pCat.hidden = !catText; }
    if (pFacts) {
      while (pFacts.firstChild) pFacts.removeChild(pFacts.firstChild);
      [['prep', 'data-tpl-prep'], ['cook', 'data-tpl-cook'], ['servings', 'data-tpl-serves']].forEach(function (pair) {
        var el = field(pair[0]);
        var val = el ? (el.value || '').trim() : '';
        if (!val || !(Number(val) > 0)) return;
        var span = document.createElement('span');
        span.textContent = (pFacts.getAttribute(pair[1]) || '{n}').replace('{n}', val);
        pFacts.appendChild(span);
      });
    }
    var intro = field('intro') ? (field('intro').value || '').trim() : '';
    if (pIntro) { pIntro.textContent = intro; pIntro.hidden = !intro; }
    var ings = field('ingredients') ? lines(field('ingredients').value || '') : [];
    if (pIngs && pIngWrap) {
      while (pIngs.firstChild) pIngs.removeChild(pIngs.firstChild);
      ings.forEach(function (line) {
        var li = document.createElement('li');
        li.textContent = line;
        pIngs.appendChild(li);
      });
      pIngWrap.hidden = ings.length === 0;
    }
    var stepsList = field('steps') ? lines(field('steps').value || '') : [];
    if (pSteps && pStepWrap) {
      while (pSteps.firstChild) pSteps.removeChild(pSteps.firstChild);
      stepsList.forEach(function (line) {
        var li = document.createElement('li');
        li.textContent = line;
        pSteps.appendChild(li);
      });
      pStepWrap.hidden = stepsList.length === 0;
    }
    if (pEmpty) pEmpty.hidden = Boolean(rawTitle || intro || ings.length || stepsList.length);
  }
  if (previewWrap && W && W.addEventListener) {
    W.addEventListener('2y-photo-change', function (ev) {
      var pPhoto = previewWrap.querySelector('[data-preview-photo]');
      if (!pPhoto) return;
      var url = ev && ev.detail && ev.detail.url ? String(ev.detail.url) : '';
      if (url) { pPhoto.src = url; pPhoto.hidden = false; }
      else { pPhoto.removeAttribute('src'); pPhoto.hidden = true; }
    });
  }

  var syncBuildersFromForm = null;
  function updateLineCounter(sel, count) {
    var el = form.querySelector ? form.querySelector(sel) : null;
    if (!el) return;
    var tpl = el.getAttribute('data-tpl') || '{n} / {max} lines';
    el.textContent = tpl.replace('{n}', String(count)).replace('{max}', '80');
    if (el.classList && typeof el.classList.toggle === 'function') el.classList.toggle('is-over', count > 80);
  }

  function run() {
    var T = ALL[lang()];
    localizeChrome();
    syncSourceLink();
    var title = (field('title').value || '').trim();
    set('title', title.length >= 3 ? 'ok' : title.length ? 'todo' : 'idle', T.title);
    var ings = lines(field('ingredients').value || '');
    updateLineCounter('[data-ing-counter]', ings.length);
    set('ingredients', ings.length > 0 ? 'ok' : 'idle', T.ingredients);
    if (ings.length === 0) {
      set('qty', 'idle', T.qty_ok);
      set('cups', 'idle', T.cups_ok);
    } else {
      // Leading amount only: a digit or unicode fraction at the START of the
      // line. 'stock for 2 people' does not count; '½ onion' does.
      var noQty = ings.filter(function (l) { return !parseIngRow(l).isSection && !/^[0-9\\u00BC-\\u00BE\\u2150-\\u215E]/.test(l); }).length;
      set('qty', noQty === 0 ? 'ok' : 'todo', noQty === 0 ? T.qty_ok : T.qty_todo.replace('##', String(noQty)));
      var cups = ings.filter(function (l) { return /\\b(cups?|tazas?|tasses?)\\b/i.test(l); }).length;
      set('cups', cups === 0 ? 'ok' : 'todo', cups === 0 ? T.cups_ok : T.cups_todo);
    }
    var steps = lines(field('steps').value || '');
    updateLineCounter('[data-step-counter]', steps.length);
    set('steps', steps.length > 0 ? 'ok' : 'idle', T.steps);
    var sv = (field('servings').value || '').trim();
    set('servings', sv === '' ? 'idle' : Number(sv) > 0 ? 'ok' : 'todo', sv === '' ? T.servings_ok : Number(sv) > 0 ? T.servings_ok : T.servings_bad);
    var adapted = field('source_kind').value === 'adapted';
    var url = (field('source_url').value || '').trim();
    var urlOk = false;
    if (url) { try { var u = new URL(url); urlOk = u.protocol === 'https:' && u.hostname.indexOf('.') > 0; } catch (e) { urlOk = false; } }
    set('source', !adapted ? 'ok' : urlOk ? 'ok' : url ? 'todo' : 'idle', !adapted ? T.source_ok : T.source_todo);
    updatePreview();
  }

  var FIELDS = ['category', 'title', 'locale', 'intro', 'ingredients', 'steps', 'prep', 'cook', 'servings', 'display_name', 'source_kind', 'source_url'];
  var idEl = form.querySelector('input[name="id"]');
  var keySuffix = idEl && idEl.value ? idEl.value : 'new';
  if (!(idEl && idEl.value) && W && W.location && W.location.search) {
    var rmM = /[?&]remix=([A-Za-z0-9_-]+)/.exec(W.location.search);
    var prM = !rmM ? /[?&]prompt=([^&#]+)/.exec(W.location.search) : null;
    if (rmM) keySuffix = 'remix:' + rmM[1];
    else if (prM) { try { keySuffix = 'prompt:' + decodeURIComponent(prM[1]).slice(0, 32); } catch (eP) {} }
  }
  var KEY = DRAFT_PREFIX + keySuffix;
  function readForm() {
    var o = {};
    FIELDS.forEach(function (n) { var el = field(n); if (el) o[n] = el.value; });
    return o;
  }
  function writeForm(o) {
    FIELDS.forEach(function (n) { var el = field(n); if (el && typeof o[n] === 'string') el.value = o[n]; });
    if (syncBuildersFromForm) syncBuildersFromForm();
    run();
  }
  var saveTimer = null;
  function persistNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!local) return;
    var f = readForm();
    try {
      if (captureIsBlank(f)) local.removeItem(KEY);
      else local.setItem(KEY, JSON.stringify({ v: 1, at: Date.now(), f: f }));
    } catch (e) {}
  }
  function persistSoon() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, 400);
  }
  function changed() { run(); persistSoon(); }

  // A successful save lands on ?saved=1: drop the copy that was just stored on
  // the server. Any other load means the last submit did not go through.
  var pending = takePending();
  var justSaved = /[?&]saved=1(?:&|$)/.test(W && W.location ? W.location.search : '');
  if (justSaved) { drop(pending); drop(KEY); }

  function showDraftNotice(text, actions) {
    var n = document.createElement('div');
    n.className = 'ok draft-notice';
    n.setAttribute('role', 'status');
    var span = document.createElement('span');
    span.textContent = text;
    n.appendChild(span);
    actions.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'quiet';
      b.textContent = a[0];
      b.addEventListener('click', function () {
        a[1]();
        if (n.parentNode) n.parentNode.removeChild(n);
      });
      n.appendChild(b);
    });
    var anchor = document.querySelector('[data-start-section]') || document.querySelector('[data-capture-shell]') || document.querySelector('[data-ai-panel]') || form;
    anchor.parentNode.insertBefore(n, anchor);
  }
  var hadAutosaveNotice = false;
  if (!justSaved) {
    var TS = ALL[lang()];
    var savedCopy = readSaved(KEY);
    var serverCopy = readForm();
    var decision = captureDecide(savedCopy, serverCopy, FIELDS, Date.now(), MAX_AGE);
    if (decision === 'restore') {
      hadAutosaveNotice = true;
      writeForm(savedCopy.f);
      showDraftNotice(TS.restored, [[TS.discard, function () { writeForm(serverCopy); drop(KEY); }]]);
    } else if (decision === 'offer') {
      hadAutosaveNotice = true;
      showDraftNotice(TS.unsaved, [
        [TS.restore, function () { writeForm(savedCopy.f); persistNow(); }],
        [TS.discard, function () { drop(KEY); }]
      ]);
    }
  }

  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  if (W && W.addEventListener) W.addEventListener('pagehide', function () { if (saveTimer) persistNow(); });
  if (document.addEventListener) document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && saveTimer) persistNow(); });
  run();

  // --- S2 Start tiles & in-page paste ---------------------------------------
  var startTiles = qsa(document, '[data-start-tile]');
  var modePanels = qsa(document, '[data-mode-panel]');
  function selectStartTile(mode, focusTarget) {
    startTiles.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-start-tile') === mode ? 'true' : 'false');
    });
    modePanels.forEach(function (p) {
      p.hidden = p.getAttribute('data-mode-panel') !== mode;
    });
    if (!focusTarget) return;
    if (mode === 'type') {
      var tEl = field('title');
      if (tEl && typeof tEl.focus === 'function') tEl.focus();
      return;
    }
    var opened = modePanels.filter(function (p) { return p.getAttribute('data-mode-panel') === mode; })[0];
    var inp = opened && typeof opened.querySelector === 'function' ? opened.querySelector('textarea, input, a') : null;
    if (inp && typeof inp.focus === 'function') inp.focus();
  }
  if (startTiles.length) {
    selectStartTile('type', false);
    startTiles.forEach(function (b) {
      b.addEventListener('click', function () {
        selectStartTile(b.getAttribute('data-start-tile') || 'type', true);
      });
    });
  }

  var pasteForm = document.querySelector('[data-paste-form]');
  if (pasteForm && typeof fetch === 'function') {
    var pasteTa = pasteForm.querySelector('textarea[name="text"]');
    var pasteSubmit = pasteForm.querySelector('[data-paste-submit]');
    var pasteUndo = pasteForm.querySelector('[data-paste-undo]');
    var pasteStatus = pasteForm.querySelector('[data-paste-status]');
    var pasteUndoSnap = null;
    function setPasteStatus(kind, text) {
      if (!pasteStatus) return;
      pasteStatus.hidden = !text;
      pasteStatus.className = kind;
      pasteStatus.textContent = text;
    }
    if (pasteUndo) {
      pasteUndo.addEventListener('click', function () {
        if (!pasteUndoSnap) return;
        writeForm(pasteUndoSnap);
        persistSoon();
        pasteUndoSnap = null;
        pasteUndo.hidden = true;
        setPasteStatus('', '');
      });
    }
    pasteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var action = pasteForm.getAttribute('action') || '/account/recipes/paste';
      var workingText = pasteForm.getAttribute('data-msg-working') || 'Reading…';
      var errText = pasteForm.getAttribute('data-msg-err-generic') || 'Something went wrong.';
      if (pasteSubmit) pasteSubmit.disabled = true;
      setPasteStatus('ok', workingText);
      fetch(action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: 'text=' + encodeURIComponent(pasteTa ? pasteTa.value : '')
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) {
            setPasteStatus('err', (res.body && res.body.error) || errText);
            return;
          }
          pasteUndoSnap = readForm();
          var d = res.body.parsed || {};
          ['title', 'intro', 'ingredients', 'steps', 'prep', 'cook', 'servings'].forEach(function (k) {
            if (typeof d[k] === 'string' && d[k] && field(k)) field(k).value = d[k];
          });
          if (syncBuildersFromForm) syncBuildersFromForm();
          changed();
          if (pasteUndo) pasteUndo.hidden = false;
          var warns = Array.isArray(res.body.warnings) ? res.body.warnings : [];
          setPasteStatus(warns.length ? 'err' : 'ok', warns.length ? warns.join(' ') : (res.body.message || ''));
        })
        .catch(function () { setPasteStatus('err', errText); })
        .then(function () { if (pasteSubmit) pasteSubmit.disabled = false; });
    });
  }

  // --- S3 Mobile stepper & preview toggle ----------------------------------
  var shell = document.querySelector('[data-capture-shell]');
  var stepperBar = document.querySelector('[data-stepper-bar]');
  var stepList = qsa(form, '[data-step]');
  var stepJumps = qsa(document, '[data-step-jump]');
  var previewToggle = document.querySelector('[data-preview-toggle]');
  var previewBack = document.querySelector('[data-preview-back]');
  var activeStep = 0;
  var softWarnedStep = -1;
  var mq = W && typeof W.matchMedia === 'function' ? W.matchMedia('(max-width: 720px)') : null;
  function stepOfEl(el) {
    var cur = el;
    while (cur && cur !== form) {
      if (typeof cur.getAttribute === 'function' && cur.getAttribute('data-step') != null) {
        var n = Number(cur.getAttribute('data-step'));
        return isNaN(n) ? -1 : n;
      }
      cur = cur.parentNode;
    }
    return -1;
  }
  function setPreviewMobile(on) {
    if (!shell) return;
    if (shell.classList) shell.classList.toggle('capture-preview-mobile', !!on);
    if (previewToggle) previewToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (previewBack) previewBack.hidden = !on;
    if (on && W && typeof W.scrollTo === 'function') W.scrollTo(0, 0);
  }
  function showStep(idx, moveFocus) {
    if (!stepList.length) return;
    if (idx < 0) idx = 0;
    if (idx >= stepList.length) idx = stepList.length - 1;
    activeStep = idx;
    softWarnedStep = -1;
    stepList.forEach(function (fs, i) {
      if (fs.classList) fs.classList.toggle('is-active', i === idx);
      else fs.className = i === idx ? 'form-step is-active' : 'form-step';
      var m = fs.querySelector ? fs.querySelector('[data-step-msg]') : null;
      if (m) { m.textContent = ''; m.hidden = true; }
    });
    stepJumps.forEach(function (a, i) {
      if (i === idx) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
    if (stepperBar) {
      var pTxt = stepperBar.querySelector('[data-step-progress]');
      var pFill = stepperBar.querySelector('[data-step-fill]');
      var tpl = form.getAttribute('data-step-progress-tpl') || 'Step {n} of {total}';
      if (pTxt) pTxt.textContent = tpl.replace('{n}', String(idx + 1)).replace('{total}', String(stepList.length));
      if (pFill && pFill.style) pFill.style.width = Math.round(((idx + 1) * 100) / stepList.length) + '%';
    }
    if (moveFocus) {
      var leg = stepList[idx].querySelector ? stepList[idx].querySelector('.step-heading') : null;
      if (leg && typeof leg.focus === 'function') leg.focus();
    }
  }
  function stepHasMissing(idx) {
    if (idx === 0) return !(field('title') && (field('title').value || '').trim()) ? field('title') : null;
    if (idx === 1) return !(field('ingredients') && lines(field('ingredients').value || '').length) ? field('ingredients') : null;
    if (idx === 2) return !(field('steps') && lines(field('steps').value || '').length) ? field('steps') : null;
    return null;
  }
  function stepHasSoftWarn(idx) {
    if (idx === 0) return checkState('title') === 'todo';
    if (idx === 1) return checkState('qty') === 'todo' || checkState('cups') === 'todo';
    if (idx === 3) return checkState('servings') === 'todo';
    return false;
  }
  function applyStepperMode() {
    var on = !!(mq && mq.matches && stepList.length);
    if (shell && shell.classList) shell.classList.toggle('capture-stepper-on', on);
    if (stepperBar) stepperBar.hidden = !on;
    if (!on) setPreviewMobile(false);
  }
  if (stepList.length) {
    showStep(0, false);
    applyStepperMode();
    if (mq) {
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', applyStepperMode);
      else if (typeof mq.addListener === 'function') mq.addListener(applyStepperMode);
    }
    stepList.forEach(function (fs, idx) {
      var prev = fs.querySelector ? fs.querySelector('[data-step-prev]') : null;
      var next = fs.querySelector ? fs.querySelector('[data-step-next]') : null;
      var msgEl = fs.querySelector ? fs.querySelector('[data-step-msg]') : null;
      if (prev) prev.addEventListener('click', function () { showStep(idx - 1, true); });
      if (next) next.addEventListener('click', function () {
        var missing = stepHasMissing(idx);
        if (missing) {
          if (msgEl) { msgEl.textContent = form.getAttribute('data-step-need-required') || ''; msgEl.hidden = false; }
          if (typeof missing.focus === 'function') missing.focus();
          return;
        }
        if (stepHasSoftWarn(idx) && softWarnedStep !== idx) {
          softWarnedStep = idx;
          if (msgEl) { msgEl.textContent = form.getAttribute('data-step-soft-warn') || ''; msgEl.hidden = false; }
          return;
        }
        showStep(idx + 1, true);
      });
    });
    stepJumps.forEach(function (a) {
      a.addEventListener('click', function () {
        var idx = Number(a.getAttribute('data-step-jump'));
        if (!isNaN(idx)) showStep(idx, false);
      });
    });
    if (previewToggle) previewToggle.addEventListener('click', function () {
      var on = !(shell && shell.classList && shell.classList.contains('capture-preview-mobile'));
      setPreviewMobile(on);
    });
    if (previewBack) previewBack.addEventListener('click', function () { setPreviewMobile(false); });
  }

  // One clear finish: "Send in for review" needs the permission box. Say so
  // right next to it before a round trip (the server enforces it regardless).
  var attestEl = field('attest');
  function attestError(show) {
    if (!attestEl) return;
    var p = document.getElementById('err-attest');
    if (!show) {
      attestEl.removeAttribute('aria-invalid');
      attestEl.removeAttribute('aria-describedby');
      if (p && p.parentNode) p.parentNode.removeChild(p);
      return;
    }
    if (!p) {
      p = document.createElement('p');
      p.className = 'field-err';
      p.id = 'err-attest';
      var lab = attestEl.closest('label') || attestEl;
      lab.parentNode.insertBefore(p, lab.nextSibling);
    }
    p.textContent = attestEl.getAttribute('data-err-attest') || '';
    attestEl.setAttribute('aria-invalid', 'true');
    attestEl.setAttribute('aria-describedby', 'err-attest');
  }
  if (attestEl) attestEl.addEventListener('change', function () { if (attestEl.checked) attestError(false); });

  // --- S1 Inline sign-in when saving or sending while signed out ------------
  var inlineAuth = form.querySelector('[data-inline-auth]');
  var pendingIntent = null;
  if (inlineAuth) {
    var emailStep = inlineAuth.querySelector('[data-inline-auth-email-step]');
    var codeStep = inlineAuth.querySelector('[data-inline-auth-code-step]');
    var authEmail = inlineAuth.querySelector('[data-auth-email]');
    var authCode = inlineAuth.querySelector('[data-auth-code]');
    var authCodeLead = inlineAuth.querySelector('[data-auth-code-lead]');
    var authSendBtn = inlineAuth.querySelector('[data-auth-send]');
    var authVerifyBtn = inlineAuth.querySelector('[data-auth-verify]');
    var authChangeBtn = inlineAuth.querySelector('[data-auth-change]');
    var authStatus = inlineAuth.querySelector('[data-inline-auth-status]');
    var authSending = false;
    function authMsg(k, fb) { return inlineAuth.getAttribute('data-msg-' + k) || fb; }
    function setAuthStatus(kind, text) {
      if (!authStatus) return;
      authStatus.hidden = !text;
      authStatus.className = kind;
      authStatus.textContent = text;
    }
    function submitWithIntent(intentVal) {
      var hi = form.querySelector('input[type="hidden"][name="intent"]');
      if (!hi) {
        hi = document.createElement('input');
        hi.type = 'hidden';
        hi.name = 'intent';
        form.appendChild(hi);
      }
      hi.value = intentVal || 'save';
      persistNow();
      if (session) { try { session.setItem(PENDING_KEY, KEY); } catch (err) {} }
      form.submit();
    }
    function requestInlineCode() {
      if (authSending) return;
      var em = authEmail ? (authEmail.value || '').trim() : '';
      if (!em || em.indexOf('@') < 1) {
        setAuthStatus('err', authMsg('err-email', 'Enter a valid email address.'));
        if (authEmail && typeof authEmail.focus === 'function') authEmail.focus();
        return;
      }
      authSending = true;
      if (authSendBtn) authSendBtn.disabled = true;
      setAuthStatus('ok', authMsg('working', 'Working…'));
      fetch(inlineAuth.getAttribute('data-code-endpoint') || '/account/code', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: em, next: '/account/recipes/new' })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) {
            setAuthStatus('err', (res.body && res.body.error) || authMsg('err-generic', 'Something went wrong.'));
            return;
          }
          setAuthStatus('', '');
          if (emailStep) emailStep.hidden = true;
          if (codeStep) codeStep.hidden = false;
          if (authCodeLead) authCodeLead.textContent = authMsg('sent', 'We sent a code to {email}.').replace('{email}', res.body.email || em);
          if (authCode) { authCode.value = ''; if (typeof authCode.focus === 'function') authCode.focus(); }
        })
        .catch(function () { setAuthStatus('err', authMsg('err-generic', 'Something went wrong.')); })
        .then(function () { authSending = false; if (authSendBtn) authSendBtn.disabled = false; });
    }
    function verifyInlineCode() {
      if (authSending) return;
      var em = authEmail ? (authEmail.value || '').trim() : '';
      var cd = authCode ? (authCode.value || '').trim() : '';
      if (!/^\\d{6}$/.test(cd)) {
        setAuthStatus('err', authMsg('err-code', 'Enter the 6-digit code.'));
        if (authCode && typeof authCode.focus === 'function') authCode.focus();
        return;
      }
      authSending = true;
      if (authVerifyBtn) authVerifyBtn.disabled = true;
      setAuthStatus('ok', authMsg('working', 'Working…'));
      fetch(inlineAuth.getAttribute('data-verify-endpoint') || '/account/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: em, code: cd, next: '/account/recipes/new' })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) {
            if (res.body && res.body.restart) {
              if (codeStep) codeStep.hidden = true;
              if (emailStep) emailStep.hidden = false;
            }
            setAuthStatus('err', (res.body && res.body.error) || authMsg('err-generic', 'Something went wrong.'));
            return;
          }
          form.setAttribute('data-signed-in', '1');
          setAuthStatus('ok', authMsg('done', 'Email confirmed. Saving your recipe…'));
          submitWithIntent(pendingIntent);
        })
        .catch(function () { setAuthStatus('err', authMsg('err-generic', 'Something went wrong.')); })
        .then(function () { authSending = false; if (authVerifyBtn) authVerifyBtn.disabled = false; });
    }
    if (authSendBtn) authSendBtn.addEventListener('click', requestInlineCode);
    if (authVerifyBtn) authVerifyBtn.addEventListener('click', verifyInlineCode);
    var inlinePasskeyBtn = inlineAuth.querySelector('[data-inline-passkey-login]');
    var inlineGoogleBtn = inlineAuth.querySelector('[data-inline-google-login]');
    if (inlineGoogleBtn) {
      inlineGoogleBtn.addEventListener('click', function () {
        persistNow();
        if (session) { try { session.setItem(PENDING_KEY, KEY); } catch (err) {} }
      });
    }
    if (inlinePasskeyBtn && typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function' && navigator.credentials && typeof navigator.credentials.get === 'function') {
      inlinePasskeyBtn.hidden = false;
      function b64uBuf(s) {
        var b64 = String(s || '').split('-').join('+').split('_').join('/');
        while (b64.length % 4) b64 += '=';
        var bin = atob(b64);
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out.buffer;
      }
      function bufB64u(buf) {
        var bytes = new Uint8Array(buf);
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).split('+').join('-').split('/').join('_').split('=').join('');
      }
      inlinePasskeyBtn.addEventListener('click', function () {
        if (authSending) return;
        authSending = true;
        inlinePasskeyBtn.disabled = true;
        setAuthStatus('ok', authMsg('working', 'Working…'));
        var cid = '';
        fetch(inlinePasskeyBtn.getAttribute('data-options-url') || '/account/passkey/login/options', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ next: '/account/recipes/new' })
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
          .then(function (res) {
            if (!res.ok || !res.body || !res.body.ok) throw new Error((res.body && res.body.error) || authMsg('err-generic', 'Something went wrong.'));
            cid = res.body.challengeId;
            var opt = res.body.options;
            return navigator.credentials.get({
              publicKey: {
                challenge: b64uBuf(opt.challenge),
                rpId: opt.rpId,
                timeout: opt.timeout || 60000,
                userVerification: opt.userVerification || 'preferred'
              }
            });
          })
          .then(function (cred) {
            if (!cred || !cred.response) throw new Error(authMsg('err-passkey-cancel', 'Passkey request was cancelled or did not complete.'));
            var resp = cred.response;
            return fetch(inlinePasskeyBtn.getAttribute('data-verify-url') || '/account/passkey/login/verify', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                challengeId: cid,
                credentialId: bufB64u(cred.rawId),
                clientDataJSON: bufB64u(resp.clientDataJSON),
                authenticatorData: bufB64u(resp.authenticatorData),
                signature: bufB64u(resp.signature)
              })
            }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); });
          })
          .then(function (res) {
            if (!res.ok || !res.body || !res.body.ok) {
              setAuthStatus('err', (res.body && res.body.error) || authMsg('err-generic', 'Something went wrong.'));
              return;
            }
            form.setAttribute('data-signed-in', '1');
            setAuthStatus('ok', authMsg('done', 'Signed in. Saving your recipe…'));
            submitWithIntent(pendingIntent);
          })
          .catch(function (err) {
            var isCancel = err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
            setAuthStatus('err', isCancel ? authMsg('err-passkey-cancel', 'Passkey request was cancelled or did not complete.') : (err && err.message) || authMsg('err-generic', 'Something went wrong.'));
          })
          .then(function () { authSending = false; inlinePasskeyBtn.disabled = false; });
      });
    }
    if (authChangeBtn) authChangeBtn.addEventListener('click', function () {
      if (codeStep) codeStep.hidden = true;
      if (emailStep) emailStep.hidden = false;
      setAuthStatus('', '');
      if (authEmail && typeof authEmail.focus === 'function') authEmail.focus();
    });
    if (authEmail) authEmail.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); requestInlineCode(); } });
    if (authCode) authCode.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); verifyInlineCode(); } });
  }

  form.addEventListener('submit', function (e) {
    var btn = e.submitter;
    if (btn && btn.value === 'submit' && attestEl && !attestEl.checked) {
      e.preventDefault();
      attestError(true);
      attestEl.focus();
      return;
    }
    if (form.getAttribute('data-signed-in') === '0' && inlineAuth && typeof fetch === 'function') {
      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        e.preventDefault();
        var bad = form.querySelector(':invalid');
        if (bad) {
          var sIdx = stepOfEl(bad);
          if (sIdx >= 0) showStep(sIdx, false);
        }
        if (typeof form.reportValidity === 'function') form.reportValidity();
        return;
      }
      e.preventDefault();
      pendingIntent = (btn && btn.value) ? btn.value : 'save';
      persistNow();
      inlineAuth.hidden = false;
      if (stepList.length) showStep(stepList.length - 1, false);
      var emIn = inlineAuth.querySelector('[data-auth-email]');
      if (emIn && typeof emIn.focus === 'function') emIn.focus();
      if (typeof inlineAuth.scrollIntoView === 'function') {
        try { inlineAuth.scrollIntoView({ block: 'center' }); } catch (err) {}
      }
      return;
    }
    persistNow();
    if (session) { try { session.setItem(PENDING_KEY, KEY); } catch (err) {} }
  });

  // Server-side validation errors: bring the first offending field (and its step) into view.
  var firstInvalid = form.querySelector('[aria-invalid="true"]');
  if (firstInvalid) {
    var errStep = stepOfEl(firstInvalid);
    if (errStep >= 0) showStep(errStep, false);
    try { firstInvalid.focus({ preventScroll: true }); firstInvalid.scrollIntoView({ block: 'center' }); } catch (e) { firstInvalid.focus(); }
  }
  if (hadAutosaveNotice && startTiles.length) selectStartTile('type', false);

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
    var targetLangSel = aiPanel.querySelector('[data-ai-target-lang]');
    var translateBtn = aiPanel.querySelector('[data-ai-translate]');
    var undoBtn = aiPanel.querySelector('[data-ai-undo]');
    var statusEl = aiPanel.querySelector('[data-ai-status]');
    var improvementsWrap = aiPanel.querySelector('[data-ai-improvements-wrap]');
    var improvementsList = aiPanel.querySelector('[data-ai-improvements]');
    var questionsWrap = aiPanel.querySelector('[data-ai-questions-wrap]');
    var questionsList = aiPanel.querySelector('[data-ai-questions]');
    function msg(name, fallback) { return aiPanel.getAttribute('data-msg-' + name) || fallback; }

    var attachedImage = null;
    var attachedAudio = null;
    var undoSnapshot = null;
    var recorder = null;
    var audioChunks = [];

    function setStatus(kind, text, withSignIn) {
      if (!statusEl) return;
      statusEl.hidden = false;
      statusEl.className = kind;
      statusEl.textContent = text;
      if (withSignIn) {
        statusEl.appendChild(document.createTextNode(' '));
        var a = document.createElement('a');
        a.href = aiPanel.getAttribute('data-signin-url') || '/account';
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = msg('signin', 'Sign in again');
        statusEl.appendChild(a);
      }
    }

    function snapshotForm() {
      var names = ['category', 'title', 'locale', 'intro', 'ingredients', 'steps', 'prep', 'cook', 'servings'];
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
      changed();
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
        // Replace the existing line for the same ingredient instead of adding a duplicate.
        field('ingredients').value = mergeIngredientLine(field('ingredients').value, answer, q.target);
      } else if (field('steps')) {
        var curSt = field('steps').value.trim();
        field('steps').value = curSt ? curSt + '\\n' + answer : answer;
      }
      if (syncBuildersFromForm) syncBuildersFromForm();
      changed();
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

    function aiError(text, sessionEnded) {
      var e = new Error(text);
      e.userFacing = true;
      e.sessionEnded = !!sessionEnded;
      return e;
    }

    function callAi(mode) {
      var endpoint = aiPanel.getAttribute('data-ai-endpoint') || '/account/recipes/ai-assist';
      var workingMsg = msg('working', 'Working…');
      var genericMsg = msg('err-generic', 'Something went wrong. Please try again.');
      var sessionMsg = msg('err-session', 'Your session ended. Your draft is saved on this device.');
      var doneMsg = mode === 'polish'
        ? msg('done-polish', 'Draft polished.')
        : mode === 'translate'
          ? msg('done-translate', 'Draft translated.')
          : msg('done-extract', 'Draft structured.');
      var targetLocale = targetLangSel ? targetLangSel.value : '';
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
        setStatus('err', msg('err-input', 'Add notes, photo, or draft lines first.'));
        return;
      }
      // Keep the device copy current: if the session has ended, nothing is lost.
      persistNow();
      if (extractBtn) extractBtn.disabled = true;
      if (polishBtn) polishBtn.disabled = true;
      if (translateBtn) translateBtn.disabled = true;
      setStatus('ok', workingMsg);
      fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          mode: mode,
          uiLang: lang(),
          recipeLocale: field('locale') ? field('locale').value : 'us:en',
          targetLocale: mode === 'translate' ? targetLocale : undefined,
          notes: notes,
          image: attachedImage,
          audio: attachedAudio,
          draft: draft
        })
      })
        .then(function (r) {
          var ct = (r.headers.get('content-type') || '').toLowerCase();
          var isJson = ct.indexOf('application/json') !== -1;
          // 401, or a redirect that ended on an HTML sign-in page: the session is gone.
          if (r.status === 401 || (r.redirected && !isJson)) throw aiError(sessionMsg, true);
          if (!isJson) throw aiError(genericMsg);
          return r.json().then(function (j) { return { ok: r.ok, body: j }; }, function () { throw aiError(genericMsg); });
        })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) {
            if (res.body && res.body.session) throw aiError(res.body.error || sessionMsg, true);
            throw aiError((res.body && res.body.error) || genericMsg);
          }
          // Only a real (model) translation may switch the recipe language.
          if (mode === 'translate' && res.body.provider !== 'gemini') {
            throw aiError(msg('translate-unavailable', genericMsg));
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
          if (mode === 'translate' && targetLocale && field('locale')) field('locale').value = targetLocale;
          if (syncBuildersFromForm) syncBuildersFromForm();
          changed();
          renderFeedback(res.body);
          setStatus('ok', res.body.provider === 'deterministic' ? doneMsg + ' ' + msg('fallback', '') : doneMsg);
        })
        .catch(function (err) {
          setStatus('err', err && err.userFacing ? err.message : genericMsg, !!(err && err.sessionEnded));
        })
        .then(function () {
          if (extractBtn) extractBtn.disabled = false;
          if (polishBtn) polishBtn.disabled = false;
          if (translateBtn) translateBtn.disabled = false;
        });
    }

    if (extractBtn) extractBtn.addEventListener('click', function () { callAi('extract'); });
    if (polishBtn) polishBtn.addEventListener('click', function () { callAi('polish'); });
    if (translateBtn) translateBtn.addEventListener('click', function () { callAi('translate'); });
  }

  // --- S4 Structured ingredient builder & numbered step cards ----------------
  function makeMoveBtn(cls, attrName, symbol, labelText, disabled, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'quiet builder-icon-btn ' + cls;
    b.setAttribute(attrName, '1');
    b.setAttribute('aria-label', labelText);
    b.setAttribute('title', labelText);
    b.textContent = symbol;
    b.disabled = !!disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  var ingBuilder = form.querySelector ? form.querySelector('[data-ing-builder]') : null;
  var loadIngFromTextarea = null;
  if (ingBuilder) {
    var ingField = field('ingredients');
    var ingRowsWrap = ingBuilder.querySelector('[data-ing-rows]');
    var ingAddBtn = ingBuilder.querySelector('[data-ing-add]');
    var ingAddSectionBtn = ingBuilder.querySelector('[data-ing-add-section]');
    var ingModeRowsBtn = ingBuilder.querySelector('[data-ing-mode-rows]');
    var ingModeRawBtn = ingBuilder.querySelector('[data-ing-mode-raw]');
    var qtyPh = ingBuilder.getAttribute('data-ph-qty') || 'Qty';
    var unitPh = ingBuilder.getAttribute('data-ph-unit') || 'Unit';
    var itemPh = ingBuilder.getAttribute('data-ph-item') || 'Ingredient…';
    var secPh = ingBuilder.getAttribute('data-ph-section') || 'Section…';
    var lblUp = ingBuilder.getAttribute('data-lbl-up') || 'Move up';
    var lblDown = ingBuilder.getAttribute('data-lbl-down') || 'Move down';
    var lblDel = ingBuilder.getAttribute('data-lbl-del') || 'Remove';
    var ingState = [];

    function syncIngToTextarea(runChanged) {
      if (!ingField) return;
      ingField.value = ingState.map(formatIngRow).filter(Boolean).join('\\n');
      if (runChanged) changed();
      else run();
    }

    function renderIngRows() {
      if (!ingRowsWrap) return;
      while (ingRowsWrap.firstChild) ingRowsWrap.removeChild(ingRowsWrap.firstChild);
      ingState.forEach(function (row, idx) {
        var rowEl = document.createElement('div');
        rowEl.className = row.isSection ? 'ing-row-item ing-section-row' : 'ing-row-item';
        rowEl.setAttribute('data-ing-row', String(idx));
        function onMultiPaste(ev) {
          var clip = ev.clipboardData || (W && W.clipboardData);
          var text = clip && typeof clip.getData === 'function' ? clip.getData('text') : '';
          if (text && (text.indexOf('\\n') !== -1 || text.indexOf('\\r') !== -1)) {
            ev.preventDefault();
            var pasted = text.split(/\\r?\\n/).map(function (l) { return l.trim(); }).filter(Boolean);
            if (pasted.length) {
              var parsedNew = pasted.map(parseIngRow);
              ingState.splice.apply(ingState, [idx, 1].concat(parsedNew));
              renderIngRows();
              syncIngToTextarea(true);
            }
          }
        }
        if (row.isSection) {
          var secIn = document.createElement('input');
          secIn.type = 'text';
          secIn.className = 'ing-chip-section';
          secIn.placeholder = secPh;
          secIn.setAttribute('aria-label', secPh);
          secIn.value = row.item || '';
          secIn.addEventListener('input', function () {
            ingState[idx].item = secIn.value;
            syncIngToTextarea(true);
          });
          secIn.addEventListener('paste', onMultiPaste);
          rowEl.appendChild(secIn);
        } else {
          var qIn = document.createElement('input');
          qIn.type = 'text';
          qIn.className = 'ing-chip-qty';
          qIn.placeholder = qtyPh;
          qIn.setAttribute('aria-label', qtyPh);
          qIn.value = row.qty || '';
          qIn.addEventListener('input', function () {
            ingState[idx].qty = qIn.value;
            syncIngToTextarea(true);
          });
          qIn.addEventListener('paste', onMultiPaste);
          var uIn = document.createElement('input');
          uIn.type = 'text';
          uIn.className = 'ing-chip-unit';
          uIn.setAttribute('list', 'capture-units');
          uIn.placeholder = unitPh;
          uIn.setAttribute('aria-label', unitPh);
          uIn.value = row.unit || '';
          uIn.addEventListener('input', function () {
            ingState[idx].unit = uIn.value;
            syncIngToTextarea(true);
          });
          var itIn = document.createElement('input');
          itIn.type = 'text';
          itIn.className = 'ing-chip-item';
          itIn.placeholder = itemPh;
          itIn.setAttribute('aria-label', itemPh);
          itIn.value = row.item || '';
          itIn.addEventListener('input', function () {
            ingState[idx].item = itIn.value;
            syncIngToTextarea(true);
          });
          itIn.addEventListener('paste', onMultiPaste);
          rowEl.appendChild(qIn);
          rowEl.appendChild(uIn);
          rowEl.appendChild(itIn);
        }
        var actions = document.createElement('div');
        actions.className = 'builder-row-actions';
        actions.appendChild(makeMoveBtn('is-up', 'data-ing-up', '\\u2191', lblUp, idx === 0, function () {
          var tmp = ingState[idx - 1]; ingState[idx - 1] = ingState[idx]; ingState[idx] = tmp;
          renderIngRows(); syncIngToTextarea(true);
        }));
        actions.appendChild(makeMoveBtn('is-down', 'data-ing-down', '\\u2193', lblDown, idx === ingState.length - 1, function () {
          var tmp = ingState[idx + 1]; ingState[idx + 1] = ingState[idx]; ingState[idx] = tmp;
          renderIngRows(); syncIngToTextarea(true);
        }));
        actions.appendChild(makeMoveBtn('is-del', 'data-ing-del', '\\u00D7', lblDel, false, function () {
          ingState.splice(idx, 1);
          if (!ingState.length) ingState.push({ isSection: false, qty: '', unit: '', item: '' });
          renderIngRows(); syncIngToTextarea(true);
        }));
        rowEl.appendChild(actions);
        ingRowsWrap.appendChild(rowEl);
      });
    }

    loadIngFromTextarea = function () {
      var listLines = ingField ? lines(ingField.value || '') : [];
      ingState = listLines.length
        ? listLines.map(parseIngRow)
        : [{ isSection: false, qty: '', unit: '', item: '' }, { isSection: false, qty: '', unit: '', item: '' }];
      renderIngRows();
    };
    function setIngRawMode(raw) {
      if (ingBuilder.classList) ingBuilder.classList.toggle('is-raw', !!raw);
      if (ingModeRowsBtn) ingModeRowsBtn.setAttribute('aria-pressed', raw ? 'false' : 'true');
      if (ingModeRawBtn) ingModeRawBtn.setAttribute('aria-pressed', raw ? 'true' : 'false');
      if (!raw) loadIngFromTextarea();
    }
    if (ingBuilder.classList) ingBuilder.classList.add('is-enhanced');
    loadIngFromTextarea();
    if (ingModeRowsBtn) ingModeRowsBtn.addEventListener('click', function () { setIngRawMode(false); });
    if (ingModeRawBtn) ingModeRawBtn.addEventListener('click', function () { setIngRawMode(true); if (ingField && ingField.focus) ingField.focus(); });
    if (ingAddBtn) {
      ingAddBtn.addEventListener('click', function () {
        ingState.push({ isSection: false, qty: '', unit: '', item: '' });
        renderIngRows();
        var added = ingRowsWrap && ingRowsWrap.querySelectorAll ? ingRowsWrap.querySelectorAll('[data-ing-row]') : [];
        var last = added[added.length - 1];
        var focusIn = last && last.querySelector ? last.querySelector('input') : null;
        if (focusIn && typeof focusIn.focus === 'function') focusIn.focus();
      });
    }
    if (ingAddSectionBtn) {
      ingAddSectionBtn.addEventListener('click', function () {
        ingState.push({ isSection: true, qty: '', unit: '', item: '' });
        renderIngRows();
        var added = ingRowsWrap && ingRowsWrap.querySelectorAll ? ingRowsWrap.querySelectorAll('[data-ing-row]') : [];
        var last = added[added.length - 1];
        var focusIn = last && last.querySelector ? last.querySelector('input') : null;
        if (focusIn && typeof focusIn.focus === 'function') focusIn.focus();
      });
    }
  }

  var stepBuilder = form.querySelector ? form.querySelector('[data-step-builder]') : null;
  var loadStepsFromTextarea = null;
  if (stepBuilder) {
    var stepField = field('steps');
    var stepCardsWrap = stepBuilder.querySelector('[data-step-cards]');
    var stepAddBtn = stepBuilder.querySelector('[data-step-add]');
    var stepPhotoJumpBtn = stepBuilder.querySelector('[data-step-photo-jump]');
    var stepModeCardsBtn = stepBuilder.querySelector('[data-step-mode-cards]');
    var stepModeRawBtn = stepBuilder.querySelector('[data-step-mode-raw]');
    var stepPh = stepBuilder.getAttribute('data-ph-step') || 'Describe this step…';
    var timerLbl = stepBuilder.getAttribute('data-lbl-timer') || 'Timer (min)';
    var sLblUp = stepBuilder.getAttribute('data-lbl-up') || 'Move up';
    var sLblDown = stepBuilder.getAttribute('data-lbl-down') || 'Move down';
    var sLblDel = stepBuilder.getAttribute('data-lbl-del') || 'Remove';
    var stepState = [];

    function parseStepCard(rawLine) {
      var s = String(rawLine || '').trim();
      if (!s) return { text: '', mins: '' };
      var trailing = /\\s*\\((\\d{1,4})\\s*min\\)\\s*$/i.exec(s);
      if (trailing) {
        return { text: s.slice(0, trailing.index).trim(), mins: trailing[1] };
      }
      var inlineMin = /\\b(\\d{1,3})\\s*min(?:ute)?s?\\b/i.exec(s);
      return { text: s, mins: inlineMin ? inlineMin[1] : '' };
    }
    function formatStepCard(card) {
      var txt = String(card && card.text ? card.text : '').replace(/\\s+/g, ' ').trim();
      if (!txt) return '';
      var m = parseInt((card && card.mins) || '', 10);
      if (m > 0 && m <= 1440 && !/\\b\\d{1,3}\\s*(?:min|minute|minutes|minuto|minutos|h|hr|hrs|hour|hours|hora|horas|heure|heures)/i.test(txt)) {
        return txt + ' (' + m + ' min)';
      }
      return txt;
    }
    function syncStepsToTextarea(runChanged) {
      if (!stepField) return;
      stepField.value = stepState.map(formatStepCard).filter(Boolean).join('\\n');
      if (runChanged) changed();
      else run();
    }
    function renderStepCards() {
      if (!stepCardsWrap) return;
      while (stepCardsWrap.firstChild) stepCardsWrap.removeChild(stepCardsWrap.firstChild);
      stepState.forEach(function (card, idx) {
        var el = document.createElement('div');
        el.className = 'step-card-item';
        el.setAttribute('data-step-card', String(idx));
        var head = document.createElement('div');
        head.className = 'step-card-head';
        var num = document.createElement('span');
        num.className = 'step-card-num';
        num.textContent = (idx + 1 < 10 ? '0' : '') + (idx + 1);
        head.appendChild(num);
        var actions = document.createElement('div');
        actions.className = 'builder-row-actions';
        actions.appendChild(makeMoveBtn('is-up', 'data-step-up', '\\u2191', sLblUp, idx === 0, function () {
          var tmp = stepState[idx - 1]; stepState[idx - 1] = stepState[idx]; stepState[idx] = tmp;
          renderStepCards(); syncStepsToTextarea(true);
        }));
        actions.appendChild(makeMoveBtn('is-down', 'data-step-down', '\\u2193', sLblDown, idx === stepState.length - 1, function () {
          var tmp = stepState[idx + 1]; stepState[idx + 1] = stepState[idx]; stepState[idx] = tmp;
          renderStepCards(); syncStepsToTextarea(true);
        }));
        actions.appendChild(makeMoveBtn('is-del', 'data-step-del', '\\u00D7', sLblDel, false, function () {
          stepState.splice(idx, 1);
          if (!stepState.length) stepState.push({ text: '', mins: '' });
          renderStepCards(); syncStepsToTextarea(true);
        }));
        head.appendChild(actions);
        el.appendChild(head);

        var ta = document.createElement('textarea');
        ta.rows = 2;
        ta.className = 'step-card-text';
        ta.placeholder = stepPh;
        ta.setAttribute('aria-label', stepPh + ' ' + (idx + 1));
        ta.value = card.text || '';
        ta.addEventListener('input', function () {
          stepState[idx].text = ta.value;
          syncStepsToTextarea(true);
        });
        el.appendChild(ta);

        var timerRow = document.createElement('label');
        timerRow.className = 'step-card-timer';
        var timerSpan = document.createElement('span');
        timerSpan.textContent = timerLbl;
        var timerIn = document.createElement('input');
        timerIn.type = 'number';
        timerIn.min = '1';
        timerIn.max = '1440';
        timerIn.placeholder = '0';
        timerIn.value = card.mins || '';
        timerIn.addEventListener('input', function () {
          stepState[idx].mins = timerIn.value;
          syncStepsToTextarea(true);
        });
        timerRow.appendChild(timerSpan);
        timerRow.appendChild(timerIn);
        el.appendChild(timerRow);

        stepCardsWrap.appendChild(el);
      });
    }
    loadStepsFromTextarea = function () {
      var listLines = stepField ? lines(stepField.value || '') : [];
      stepState = listLines.length
        ? listLines.map(parseStepCard)
        : [{ text: '', mins: '' }, { text: '', mins: '' }];
      renderStepCards();
    };
    function setStepRawMode(raw) {
      if (stepBuilder.classList) stepBuilder.classList.toggle('is-raw', !!raw);
      if (stepModeCardsBtn) stepModeCardsBtn.setAttribute('aria-pressed', raw ? 'false' : 'true');
      if (stepModeRawBtn) stepModeRawBtn.setAttribute('aria-pressed', raw ? 'true' : 'false');
      if (!raw) loadStepsFromTextarea();
    }
    if (stepBuilder.classList) stepBuilder.classList.add('is-enhanced');
    loadStepsFromTextarea();
    if (stepModeCardsBtn) stepModeCardsBtn.addEventListener('click', function () { setStepRawMode(false); });
    if (stepModeRawBtn) stepModeRawBtn.addEventListener('click', function () { setStepRawMode(true); if (stepField && stepField.focus) stepField.focus(); });
    if (stepAddBtn) {
      stepAddBtn.addEventListener('click', function () {
        stepState.push({ text: '', mins: '' });
        renderStepCards();
        var added = stepCardsWrap && stepCardsWrap.querySelectorAll ? stepCardsWrap.querySelectorAll('[data-step-card]') : [];
        var last = added[added.length - 1];
        var ta = last && last.querySelector ? last.querySelector('textarea') : null;
        if (ta && typeof ta.focus === 'function') ta.focus();
      });
    }
    if (stepPhotoJumpBtn) {
      stepPhotoJumpBtn.addEventListener('click', function () {
        if (stepList.length > 3) showStep(3, false);
        var ph = document.getElementById('f-dish_photo');
        if (ph && typeof ph.scrollIntoView === 'function') {
          try { ph.scrollIntoView({ block: 'center' }); } catch (err) {}
        }
        if (ph && typeof ph.focus === 'function') ph.focus();
      });
    }
  }

  syncBuildersFromForm = function () {
    if (loadIngFromTextarea) loadIngFromTextarea();
    if (loadStepsFromTextarea) loadStepsFromTextarea();
  };

  // --- S12 Search-gap prompt quick-fill chips --------------------------------
  qsa(document, '[data-gap-chip]').forEach(function (chip) {
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      var qVal = chip.getAttribute('data-gap-chip') || '';
      var tField = field('title');
      if (tField && qVal) {
        tField.value = qVal;
        if (startTiles.length) selectStartTile('type', false);
        changed();
        if (typeof tField.focus === 'function') tField.focus();
      }
    });
  });
})();`;

export const ACCOUNT_LIVE_SHARE_SCRIPT = `(function () {
  var qsa = function (sel) {
    return document && typeof document.querySelectorAll === 'function' ? Array.prototype.slice.call(document.querySelectorAll(sel)) : [];
  };
  qsa('[data-acct-copy-url]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-acct-copy-url') || '';
      if (!url) return;
      var orig = btn.textContent;
      var done = btn.getAttribute('data-copied') || 'Copied';
      function flash() {
        btn.textContent = done;
        setTimeout(function () { btn.textContent = orig; }, 1800);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(flash).catch(function () {});
      }
    });
  });
  qsa('[data-acct-story-card]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var svgUrl = btn.getAttribute('data-card-svg');
      var slug = btn.getAttribute('data-recipe-slug') || 'recipe';
      var liveUrl = btn.getAttribute('data-live-url') || '';
      var orig = btn.textContent;
      var ready = btn.getAttribute('data-copied') || orig;
      if (!svgUrl || typeof fetch !== 'function') return;
      btn.disabled = true;
      fetch(svgUrl)
        .then(function (r) { if (!r.ok) throw new Error('fetch'); return r.text(); })
        .then(function (svg) {
          return new Promise(function (resolve, reject) {
            var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            var u = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
              var canvas = document.createElement('canvas');
              canvas.width = 1080;
              canvas.height = 1920;
              var ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, 1080, 1920);
              URL.revokeObjectURL(u);
              canvas.toBlob(function (png) { if (png) resolve(png); else reject(new Error('png')); }, 'image/png');
            };
            img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('img')); };
            img.src = u;
          });
        })
        .then(function (pngBlob) {
          var fname = slug + '-2yolks-story.png';
          var file = typeof File === 'function' ? new File([pngBlob], fname, { type: 'image/png' }) : null;
          if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
            return navigator.share({ files: [file], url: liveUrl }).catch(function () {});
          }
          var dl = URL.createObjectURL(pngBlob);
          var a = document.createElement('a');
          a.href = dl;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(dl); }, 2000);
          btn.textContent = ready;
          setTimeout(function () { btn.textContent = orig; }, 1800);
        })
        .catch(function () { window.open(svgUrl, '_blank', 'noopener'); })
        .then(function () { btn.disabled = false; });
    });
  });
})();`;

export const PASSKEY_CLIENT_SCRIPT = `(function () {
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential !== 'function') return;
  if (!navigator.credentials || typeof fetch !== 'function') return;
  function b64uToBuf(s) {
    var b64 = String(s || '').split('-').join('+').split('_').join('/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function bufToB64u(buf) {
    var bytes = new Uint8Array(buf);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).split('+').join('-').split('/').join('_').split('=').join('');
  }
  function showStatus(el, kind, msg) {
    if (!el) return;
    el.hidden = !msg;
    el.className = kind;
    el.textContent = msg;
  }

  var loginBtn = document.querySelector('[data-passkey-login]');
  if (loginBtn && typeof navigator.credentials.get === 'function') {
    loginBtn.hidden = false;
    var wrap = loginBtn.closest('.alt-auth') || loginBtn.parentElement;
    if (wrap) wrap.hidden = false;
    var statusEl = document.querySelector('[data-passkey-status]');
    var busy = false;
    loginBtn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      loginBtn.disabled = true;
      showStatus(statusEl, 'ok', loginBtn.getAttribute('data-msg-working') || 'Working…');
      var challengeId = '';
      var cancelMsg = loginBtn.getAttribute('data-msg-cancel') || 'Passkey request was cancelled or did not complete.';
      var failMsg = loginBtn.getAttribute('data-msg-fail') || 'Could not verify that passkey.';
      fetch(loginBtn.getAttribute('data-options-url') || '/account/passkey/login/options', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ next: loginBtn.getAttribute('data-next') || '' })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) throw new Error((res.body && res.body.error) || failMsg);
          challengeId = res.body.challengeId;
          var opt = res.body.options;
          return navigator.credentials.get({
            publicKey: {
              challenge: b64uToBuf(opt.challenge),
              rpId: opt.rpId,
              timeout: opt.timeout || 60000,
              userVerification: opt.userVerification || 'preferred'
            }
          });
        })
        .then(function (cred) {
          if (!cred || !cred.response) throw new Error(cancelMsg);
          var resp = cred.response;
          return fetch(loginBtn.getAttribute('data-verify-url') || '/account/passkey/login/verify', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              challengeId: challengeId,
              credentialId: bufToB64u(cred.rawId),
              clientDataJSON: bufToB64u(resp.clientDataJSON),
              authenticatorData: bufToB64u(resp.authenticatorData),
              signature: bufToB64u(resp.signature)
            })
          }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); });
        })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) {
            showStatus(statusEl, 'err', (res.body && res.body.error) || failMsg);
            return;
          }
          window.location.assign(res.body.next || '/account');
        })
        .catch(function (err) {
          var isCancel = err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
          showStatus(statusEl, 'err', isCancel ? cancelMsg : (err && err.message) || failMsg);
        })
        .then(function () { busy = false; loginBtn.disabled = false; });
    });
  }

  var regBtn = document.querySelector('[data-passkey-register]');
  if (regBtn && typeof navigator.credentials.create === 'function') {
    regBtn.hidden = false;
    var regStatus = document.querySelector('[data-passkey-reg-status]');
    var regBusy = false;
    regBtn.addEventListener('click', function () {
      if (regBusy) return;
      regBusy = true;
      regBtn.disabled = true;
      showStatus(regStatus, 'ok', regBtn.getAttribute('data-msg-working') || 'Working…');
      var challengeId = '';
      var unsupportedMsg = regBtn.getAttribute('data-msg-unsupported') || 'Passkeys are not supported in this browser.';
      var cancelMsg = regBtn.getAttribute('data-msg-cancel') || 'Passkey request was cancelled or did not complete.';
      var failMsg = regBtn.getAttribute('data-msg-fail') || 'Could not verify that passkey.';
      fetch(regBtn.getAttribute('data-options-url') || '/account/passkey/register/options', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: '{}'
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) throw new Error((res.body && res.body.error) || failMsg);
          challengeId = res.body.challengeId;
          var opt = res.body.options;
          var pk = {
            challenge: b64uToBuf(opt.challenge),
            rp: opt.rp,
            user: {
              id: b64uToBuf(opt.user.id),
              name: opt.user.name,
              displayName: opt.user.displayName
            },
            pubKeyCredParams: opt.pubKeyCredParams,
            timeout: opt.timeout || 60000,
            attestation: 'none',
            authenticatorSelection: opt.authenticatorSelection,
            excludeCredentials: (opt.excludeCredentials || []).map(function (c) {
              return { type: 'public-key', id: b64uToBuf(c.id) };
            })
          };
          return navigator.credentials.create({ publicKey: pk });
        })
        .then(function (cred) {
          if (!cred || !cred.response) throw new Error(cancelMsg);
          var resp = cred.response;
          if (typeof resp.getPublicKey !== 'function' || typeof resp.getAuthenticatorData !== 'function') {
            throw new Error(unsupportedMsg);
          }
          var spki = resp.getPublicKey();
          var authData = resp.getAuthenticatorData();
          var alg = typeof resp.getPublicKeyAlgorithm === 'function' ? resp.getPublicKeyAlgorithm() : -7;
          if (!spki || !authData) throw new Error(unsupportedMsg);
          var transports = typeof resp.getTransports === 'function' ? resp.getTransports() : [];
          return fetch(regBtn.getAttribute('data-verify-url') || '/account/passkey/register/verify', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              challengeId: challengeId,
              credentialId: bufToB64u(cred.rawId),
              clientDataJSON: bufToB64u(resp.clientDataJSON),
              authenticatorData: bufToB64u(authData),
              publicKeySpki: bufToB64u(spki),
              coseAlg: alg,
              transports: transports
            })
          }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); });
        })
        .then(function (res) {
          if (!res.ok || !res.body || !res.body.ok) {
            showStatus(regStatus, 'err', (res.body && res.body.error) || failMsg);
            return;
          }
          var u = new URL(window.location.href);
          u.searchParams.set('passkey_added', '1');
          window.location.assign(u.toString());
        })
        .catch(function (err) {
          var isCancel = err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
          showStatus(regStatus, 'err', isCancel ? cancelMsg : (err && err.message) || failMsg);
        })
        .then(function () { regBusy = false; regBtn.disabled = false; });
    });
  }
})();`;
