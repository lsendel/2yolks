import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CAPTURE_CLIENT_SCRIPT, CAPTURE_CHECK_STRINGS } from './clientScript';

type El = { [k: string]: any };

function makeEl(tag: string, extra: El = {}): El {
  const classSet = new Set<string>();
  const syncCls = () => { el.className = [...classSet].join(' '); };
  const el: El = {
    tagName: tag,
    value: '',
    textContent: '',
    className: '',
    hidden: false,
    disabled: false,
    checked: false,
    style: {} as Record<string, string>,
    children: [] as El[],
    attrs: {} as Record<string, string>,
    listeners: {} as Record<string, Array<(e: unknown) => void>>,
    parentNode: null as El | null,
    classList: {
      add(c: string) { classSet.add(c); syncCls(); },
      remove(c: string) { classSet.delete(c); syncCls(); },
      contains(c: string) { return classSet.has(c); },
      toggle(c: string, force?: boolean) {
        const on = force === undefined ? !classSet.has(c) : Boolean(force);
        if (on) classSet.add(c); else classSet.delete(c);
        syncCls();
        return on;
      },
    },
    setAttribute(k: string, v: string) { el.attrs[k] = String(v); },
    getAttribute(k: string) { return k in el.attrs ? el.attrs[k] : null; },
    removeAttribute(k: string) { delete el.attrs[k]; },
    appendChild(c: El) { el.children.push(c); c.parentNode = el; return c; },
    insertBefore(c: El, ref: El | null) { const i = ref ? el.children.indexOf(ref) : -1; if (i < 0) el.children.push(c); else el.children.splice(i, 0, c); c.parentNode = el; return c; },
    removeChild(c: El) { el.children = el.children.filter((x: El) => x !== c); c.parentNode = null; return c; },
    addEventListener(ev: string, fn: (e: unknown) => void) { (el.listeners[ev] ??= []).push(fn); },
    focus() {},
    scrollIntoView() {},
    closest() { return null; },
    querySelector(sel: string): El | null { return walk(el, sel)[0] ?? null; },
    querySelectorAll(sel: string): El[] { return walk(el, sel); },
    ...extra,
  };
  if (extra['attrs']) {
    for (const [k, v] of Object.entries(extra['attrs'] as Record<string, string>)) el.attrs[k] = v;
  }
  return el;
}

function matches(el: El, sel: string): boolean {
  const m = /^([a-z0-9]*)(\.[a-z0-9_-]+)?((?:\[[^\]]+\])+)?$/i.exec(sel);
  if (m) {
    const [, tag, cls, attrsPart] = m;
    if (tag && el.tagName !== tag) return false;
    if (cls && !String(el.className).split(' ').includes(cls.slice(1))) return false;
    if (attrsPart) {
      const re = /\[([^=\]]+)(?:="([^"]*)")?\]/g;
      let am: RegExpExecArray | null;
      while ((am = re.exec(attrsPart))) {
        const k = am[1]!;
        if (am[2] !== undefined) {
          if ((el.attrs[k] ?? el[k]) !== am[2]) return false;
        } else if (!(k in el.attrs)) {
          return false;
        }
      }
    }
    if (tag || cls || attrsPart) return true;
  }
  if (sel === 'textarea, input, a') return ['textarea', 'input', 'a'].includes(el.tagName);
  return false;
}

function walk(root: El, sel: string): El[] {
  const out: El[] = [];
  for (const c of root.children as El[]) {
    if (matches(c, sel)) out.push(c);
    out.push(...walk(c, sel));
  }
  return out;
}

class MemStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

function setupPhase2Dom(opts: { mobile?: boolean; signedIn?: boolean; fetchImpl?: (url: string, init?: RequestInit) => Promise<Response> } = {}) {
  const root = makeEl('main');
  const shell = makeEl('div', { attrs: { 'data-capture-shell': '' } });
  root.appendChild(shell);

  // Start tiles + panels
  const startSec = makeEl('div', { attrs: { 'data-start-section': '' } });
  const tilePhoto = makeEl('button', { attrs: { 'data-start-tile': 'photo', 'aria-pressed': 'false' } });
  const tilePaste = makeEl('button', { attrs: { 'data-start-tile': 'paste', 'aria-pressed': 'false' } });
  const tileType = makeEl('button', { attrs: { 'data-start-tile': 'type', 'aria-pressed': 'true' } });
  startSec.appendChild(tilePhoto); startSec.appendChild(tilePaste); startSec.appendChild(tileType);
  shell.appendChild(startSec);

  const photoPanel = makeEl('div', { attrs: { 'data-mode-panel': 'photo' } });
  const pastePanel = makeEl('div', { attrs: { 'data-mode-panel': 'paste' } });
  const pasteForm = makeEl('form', {
    attrs: { 'data-paste-form': '', action: '/account/recipes/paste', 'data-msg-working': 'Reading…', 'data-msg-err-generic': 'Error' },
  });
  const pasteTa = makeEl('textarea', { attrs: { name: 'text' } });
  const pasteBtn = makeEl('button', { attrs: { 'data-paste-submit': '' } });
  const pasteUndo = makeEl('button', { hidden: true, attrs: { 'data-paste-undo': '' } });
  const pasteStatus = makeEl('div', { hidden: true, attrs: { 'data-paste-status': '' } });
  pasteForm.appendChild(pasteTa); pasteForm.appendChild(pasteBtn); pasteForm.appendChild(pasteUndo); pasteForm.appendChild(pasteStatus);
  pastePanel.appendChild(pasteForm);
  shell.appendChild(photoPanel);
  shell.appendChild(pastePanel);

  // Stepper bar
  const stepperBar = makeEl('div', { hidden: true, attrs: { 'data-stepper-bar': '' } });
  const stepProgress = makeEl('span', { attrs: { 'data-step-progress': '' } });
  const stepFill = makeEl('div', { attrs: { 'data-step-fill': '' } });
  const previewToggle = makeEl('button', { attrs: { 'data-preview-toggle': '', 'aria-pressed': 'false' } });
  stepperBar.appendChild(stepProgress); stepperBar.appendChild(stepFill); stepperBar.appendChild(previewToggle);
  shell.appendChild(stepperBar);

  // Form + 5 steps
  let nativeSubmitted = false;
  const form = makeEl('form', {
    attrs: {
      'data-capture-form': '',
      'data-signed-in': opts.signedIn === false ? '0' : '1',
      'data-step-progress-tpl': 'Step {n} of {total}',
      'data-step-need-required': 'Fill this in to continue.',
      'data-step-soft-warn': 'Press Next again.',
    },
    checkValidity: () => true,
    submit() { nativeSubmitted = true; },
  });
  shell.appendChild(form);

  const fields: Record<string, El> = {};
  const mkField = (tag: string, name: string, val = '') => {
    const f = makeEl(tag, { value: val, attrs: { name } });
    fields[name] = f;
    return f;
  };
  const catSel = mkField('select', 'category', '');
  catSel.options = [{ value: '', textContent: 'Not sure yet' }, { value: 'mains', textContent: 'Mains' }];
  const titleF = mkField('input', 'title');
  const locF = mkField('select', 'locale', 'us:en');
  const introF = mkField('textarea', 'intro');
  const ingF = mkField('textarea', 'ingredients');
  const stepF = mkField('textarea', 'steps');
  const prepF = mkField('input', 'prep');
  const cookF = mkField('input', 'cook');
  const servF = mkField('input', 'servings');
  const authF = mkField('input', 'display_name', 'Sam');
  const srcKindF = mkField('select', 'source_kind', 'original');
  const srcUrlF = mkField('input', 'source_url');
  const attestF = makeEl('input', { attrs: { name: 'attest', 'data-err-attest': 'Tick box' } });
  fields['attest'] = attestF;

  const stepWidgets: { fs: El; prev?: El; next?: El; msg: El; leg: El }[] = [];
  const stepContents: El[][] = [
    [catSel, titleF, locF, introF],
    [ingF],
    [stepF],
    [prepF, cookF, servF],
    [authF, srcKindF, srcUrlF, attestF],
  ];
  for (let i = 0; i < 5; i++) {
    const fs = makeEl('fieldset', { attrs: { 'data-step': String(i) } });
    const leg = makeEl('legend', { className: 'step-heading' });
    fs.appendChild(leg);
    for (const c of stepContents[i]!) fs.appendChild(c);
    const msg = makeEl('div', { hidden: true, attrs: { 'data-step-msg': '' } });
    fs.appendChild(msg);
    const prev = i > 0 ? makeEl('button', { attrs: { 'data-step-prev': '' } }) : undefined;
    const next = i < 4 ? makeEl('button', { attrs: { 'data-step-next': '' } }) : undefined;
    if (prev) fs.appendChild(prev);
    if (next) fs.appendChild(next);
    stepWidgets.push({ fs, prev, next, msg, leg });
    form.appendChild(fs);
  }

  // Live checks
  const liveBox = makeEl('ul', { attrs: { 'data-live-checks': '' } });
  for (const k of ['title', 'ingredients', 'qty', 'cups', 'steps', 'servings', 'source']) {
    liveBox.appendChild(makeEl('li', { attrs: { 'data-check': k } }));
  }
  form.appendChild(liveBox);

  // Inline auth
  const inlineAuth = makeEl('div', {
    hidden: true,
    attrs: {
      'data-inline-auth': '',
      'data-code-endpoint': '/account/code',
      'data-verify-endpoint': '/account/verify',
      'data-msg-sent': 'Code sent to {email}',
      'data-msg-working': 'Working…',
      'data-msg-done': 'Confirmed',
      'data-msg-err-email': 'Bad email',
      'data-msg-err-code': 'Bad code',
      'data-msg-err-generic': 'Generic err',
    },
  });
  const emailStep = makeEl('div', { attrs: { 'data-inline-auth-email-step': '' } });
  const authEmail = makeEl('input', { attrs: { 'data-auth-email': '' } });
  const authSend = makeEl('button', { attrs: { 'data-auth-send': '' } });
  emailStep.appendChild(authEmail); emailStep.appendChild(authSend);
  const codeStep = makeEl('div', { hidden: true, attrs: { 'data-inline-auth-code-step': '' } });
  const authCodeLead = makeEl('p', { attrs: { 'data-auth-code-lead': '' } });
  const authCode = makeEl('input', { attrs: { 'data-auth-code': '' } });
  const authVerify = makeEl('button', { attrs: { 'data-auth-verify': '' } });
  const authChange = makeEl('button', { attrs: { 'data-auth-change': '' } });
  codeStep.appendChild(authCodeLead); codeStep.appendChild(authCode); codeStep.appendChild(authVerify); codeStep.appendChild(authChange);
  const authStatus = makeEl('div', { hidden: true, attrs: { 'data-inline-auth-status': '' } });
  inlineAuth.appendChild(emailStep); inlineAuth.appendChild(codeStep); inlineAuth.appendChild(authStatus);
  form.appendChild(inlineAuth);

  // Live preview
  const previewWrap = makeEl('aside', { attrs: { 'data-live-preview': '' } });
  const previewBack = makeEl('button', { hidden: true, attrs: { 'data-preview-back': '' } });
  const pPhoto = makeEl('img', { hidden: true, attrs: { 'data-preview-photo': '' } });
  const pCat = makeEl('p', { hidden: true, attrs: { 'data-preview-category': '' } });
  const pTitle = makeEl('h3', { attrs: { 'data-preview-title': '', 'data-empty-title': 'Your recipe name' } });
  const pFacts = makeEl('div', { attrs: { 'data-preview-facts': '', 'data-tpl-prep': 'Prep {n} min', 'data-tpl-cook': 'Cook {n} min', 'data-tpl-serves': 'Serves {n}' } });
  const pIntro = makeEl('p', { hidden: true, attrs: { 'data-preview-intro': '' } });
  const pEmpty = makeEl('p', { attrs: { 'data-preview-empty': '' } });
  const pIngWrap = makeEl('div', { hidden: true, attrs: { 'data-preview-ing-wrap': '' } });
  const pIngs = makeEl('ul', { attrs: { 'data-preview-ings': '' } });
  pIngWrap.appendChild(pIngs);
  const pStepWrap = makeEl('div', { hidden: true, attrs: { 'data-preview-step-wrap': '' } });
  const pSteps = makeEl('ol', { attrs: { 'data-preview-steps': '' } });
  pStepWrap.appendChild(pSteps);
  for (const c of [previewBack, pPhoto, pCat, pTitle, pFacts, pIntro, pEmpty, pIngWrap, pStepWrap]) previewWrap.appendChild(c);
  shell.appendChild(previewWrap);

  const catLabels = JSON.stringify({ en: { __prompt: 'P', __unsure: 'Not sure yet', __preamble: 'A', __preambleHint: 'H', mains: 'Mains' } });
  const doc: any = {
    documentElement: { lang: 'en' },
    querySelector: (sel: string) => root.querySelector(sel),
    querySelectorAll: (sel: string) => root.querySelectorAll(sel),
    getElementById: (id: string) => (id === 'capture-check-strings' ? { textContent: CAPTURE_CHECK_STRINGS } : id === 'capture-cat-labels' ? { textContent: catLabels } : null),
    createElement: (tag: string) => makeEl(tag),
    createTextNode: (t: string) => makeEl('#text', { textContent: t }),
  };
  const win: any = {
    localStorage: new MemStorage(),
    sessionStorage: new MemStorage(),
    location: { search: '' },
    addEventListener() {},
    scrollTo() {},
    matchMedia: () => ({ matches: Boolean(opts.mobile), addEventListener() {} }),
  };
  const fetchFn = opts.fetchImpl ?? (() => Promise.reject(new Error('unexpected fetch')));
  new Function('document', 'window', 'fetch', CAPTURE_CLIENT_SCRIPT)(doc, win, fetchFn);

  const click = (el: El) => (el.listeners['click'] ?? []).forEach((fn: (e: unknown) => void) => fn({ preventDefault() {} }));
  const fireForm = (ev: string, e: unknown = {}) => (form.listeners[ev] ?? []).forEach((fn: (e: unknown) => void) => fn(e));
  return {
    shell, tilePhoto, tilePaste, tileType, photoPanel, pastePanel, pasteForm, pasteTa, pasteUndo, pasteStatus,
    stepperBar, stepProgress, stepWidgets, previewToggle, previewBack, previewWrap, pTitle, pCat, pFacts, pIngs, pSteps, pEmpty,
    fields, form, fireForm, click, inlineAuth, emailStep, codeStep, authEmail, authCode, authSend, authVerify, authStatus,
    wasSubmitted: () => nativeSubmitted,
  };
}

describe('Phase 2 capture client script (tiles, paste, stepper, preview, inline auth)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('start tiles default to Type (helper panels hidden) and switch cleanly', () => {
    const p = setupPhase2Dom();
    expect(p.photoPanel.hidden).toBe(true);
    expect(p.pastePanel.hidden).toBe(true);
    expect(p.tileType.getAttribute('aria-pressed')).toBe('true');

    p.click(p.tilePaste);
    expect(p.pastePanel.hidden).toBe(false);
    expect(p.photoPanel.hidden).toBe(true);
    expect(p.tilePaste.getAttribute('aria-pressed')).toBe('true');
    expect(p.tileType.getAttribute('aria-pressed')).toBe('false');

    p.click(p.tilePhoto);
    expect(p.photoPanel.hidden).toBe(false);
    expect(p.pastePanel.hidden).toBe(true);
  });

  it('in-page paste fills the same form without losing author/locale, and Undo restores it', async () => {
    const p = setupPhase2Dom({
      fetchImpl: async () => new Response(JSON.stringify({
        ok: true,
        parsed: { title: 'Pasted Soup', intro: '', ingredients: '2 onions', steps: 'Simmer.', prep: '10', cook: '', servings: '4' },
        warnings: [],
        message: 'Filled from your text.',
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    });
    p.fields['display_name']!.value = 'Abuela';
    p.fields['locale']!.value = 'mx:es';
    p.pasteTa.value = 'Pasted Soup\nIngredients\n2 onions\nInstructions\nSimmer.';
    (p.pasteForm.listeners['submit'] ?? []).forEach((fn: (e: unknown) => void) => fn({ preventDefault() {} }));
    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(p.fields['title']!.value).toBe('Pasted Soup');
    expect(p.fields['ingredients']!.value).toBe('2 onions');
    expect(p.fields['display_name']!.value).toBe('Abuela'); // preserved
    expect(p.fields['locale']!.value).toBe('mx:es'); // preserved
    expect(p.pasteUndo.hidden).toBe(false);
    expect(p.pasteStatus.textContent).toBe('Filled from your text.');

    p.click(p.pasteUndo);
    expect(p.fields['title']!.value).toBe('');
    expect(p.pasteUndo.hidden).toBe(true);
  });

  it('live preview updates via textContent only (XSS-safe) and hides empty state', () => {
    const p = setupPhase2Dom();
    expect(p.pEmpty.hidden).toBe(false);
    p.fields['category']!.value = 'mains';
    p.fields['title']!.value = '<img src=x onerror=alert(1)> Pozole';
    p.fields['ingredients']!.value = '500 g pork\n<b>hominy</b>';
    p.fields['steps']!.value = 'Boil gently.';
    p.fields['prep']!.value = '20';
    p.fields['servings']!.value = '4';
    p.fireForm('input');

    expect(p.pTitle.textContent).toBe('<img src=x onerror=alert(1)> Pozole');
    expect(p.pCat.textContent).toBe('Mains');
    expect(p.pFacts.children.map((c: El) => c.textContent)).toEqual(['Prep 20 min', 'Serves 4']);
    expect(p.pIngs.children.map((c: El) => c.textContent)).toEqual(['500 g pork', '<b>hominy</b>']);
    expect(p.pSteps.children.map((c: El) => c.textContent)).toEqual(['Boil gently.']);
    expect(p.pEmpty.hidden).toBe(true);
  });

  it('mobile stepper gates required fields, warns once on soft checks, and toggles preview', () => {
    const p = setupPhase2Dom({ mobile: true });
    expect(p.stepperBar.hidden).toBe(false);
    expect(p.stepProgress.textContent).toBe('Step 1 of 5');
    expect(p.stepWidgets[0]!.fs.classList.contains('is-active')).toBe(true);

    // Step 0 missing title -> blocked
    p.click(p.stepWidgets[0]!.next!);
    expect(p.stepWidgets[0]!.fs.classList.contains('is-active')).toBe(true);
    expect(p.stepWidgets[0]!.msg.textContent).toBe('Fill this in to continue.');

    // Short 2-letter title -> soft warn once, second click advances
    p.fields['title']!.value = 'Ok';
    p.fireForm('input');
    p.click(p.stepWidgets[0]!.next!);
    expect(p.stepWidgets[0]!.fs.classList.contains('is-active')).toBe(true);
    expect(p.stepWidgets[0]!.msg.textContent).toBe('Press Next again.');
    p.click(p.stepWidgets[0]!.next!);
    expect(p.stepWidgets[1]!.fs.classList.contains('is-active')).toBe(true);
    expect(p.stepProgress.textContent).toBe('Step 2 of 5');

    // Back never blocks
    p.click(p.stepWidgets[1]!.prev!);
    expect(p.stepWidgets[0]!.fs.classList.contains('is-active')).toBe(true);

    // Mobile preview toggle
    p.click(p.previewToggle);
    expect(p.shell.classList.contains('capture-preview-mobile')).toBe(true);
    expect(p.previewBack.hidden).toBe(false);
    p.click(p.previewBack);
    expect(p.shell.classList.contains('capture-preview-mobile')).toBe(false);
    expect(p.previewBack.hidden).toBe(true);
  });

  it('inline sign-in intercepts anonymous save/submit, verifies code, and submits with preserved intent', async () => {
    const calls: string[] = [];
    const p = setupPhase2Dom({
      signedIn: false,
      fetchImpl: (async (url: string) => {
        calls.push(url);
        if (url === '/account/code') {
          return { ok: true, status: 200, json: async () => ({ ok: true, email: 'cook@example.com' }) } as unknown as Response;
        }
        return { ok: true, status: 200, json: async () => ({ ok: true, email: 'cook@example.com', next: '/account/recipes/new' }) } as unknown as Response;
      }),
    });
    p.fields['title']!.value = 'Soup';
    p.fields['ingredients']!.value = '1 onion';
    p.fields['steps']!.value = 'Simmer.';
    p.fields['attest']!.checked = true;

    let prevented = false;
    p.fireForm('submit', { submitter: { value: 'submit' }, preventDefault() { prevented = true; } });
    expect(prevented).toBe(true);
    expect(p.inlineAuth.hidden).toBe(false);

    p.authEmail.value = 'cook@example.com';
    p.click(p.authSend);
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(p.codeStep.hidden).toBe(false);

    p.authCode.value = '123456';
    p.click(p.authVerify);
    for (let i = 0; i < 6; i++) await Promise.resolve();

    expect(calls).toEqual(['/account/code', '/account/verify']);
    expect(p.wasSubmitted()).toBe(true);
    const hiddenIntent = p.form.querySelector('input[type="hidden"][name="intent"]');
    expect(hiddenIntent?.value).toBe('submit');
  });
});
