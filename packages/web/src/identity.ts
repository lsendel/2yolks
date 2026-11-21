/**
 * Unified 2yolks design system — "Obsidian & Yolk" (Kingswood Coffee editorial
 * visual adaptation): stark pitch-black discovery canvas, crisp white sticky
 * header & flat 11px card cutouts, Barlow Condensed uppercase display posters,
 * full-bleed 50/50 editorial split bands, and warm cream recipe reading pages
 * with full light/dark/OS-preference support, print rules, and reduced motion.
 * Decorative art is local inline SVG, separate from cleared recipe photography.
 */
export const DESIGN_SYSTEM_CSS = `
@font-face {font-family:'Barlow Condensed';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/barlow-condensed-600-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF;}
@font-face {font-family:'Barlow Condensed';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/barlow-condensed-600-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
@font-face {font-family:'Barlow Condensed';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/barlow-condensed-700-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF;}
@font-face {font-family:'Barlow Condensed';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/barlow-condensed-700-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
:root {
  color-scheme: light;
  --obsidian:#000000;
  --obsidian-elev:#111113;
  --plum:#000000;
  --plum-elev:#111113;
  --lime:#ffd166;
  --lime-hover:#ffe08a;
  --yolk-gold:#ffd166;
  --yolk:#ffd166;
  --brand:#111111;
  --brand-strong:#000000;
  --ink:#111111;
  --muted:#52525b;
  --bg:#faf8f3;
  --card:#ffffff;
  --surface-soft:#f1f1f1;
  --line:#e4e2dc;
  --line-strong:#9c988f;
  --amber-bg:#fffbeb;
  --amber-line:#fcd34d;
  --amber-ink:#78350f;
  --blue-bg:#eff6ff;
  --blue-line:#93c5fd;
  --radius:11px;
  --btn-radius:4px;
  --shadow:0 1px 2px rgb(0 0 0 / 0.05), 0 12px 32px -16px rgb(0 0 0 / 0.24);
  --font-body:ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-display:'Barlow Condensed',ui-sans-serif, system-ui, sans-serif;
}
*{box-sizing:border-box;}
html{scroll-behavior:smooth;scroll-padding-top:4.75rem;}
body{margin:0;font-family:var(--font-body);background:var(--obsidian);color:var(--ink);line-height:1.55;}
a{color:var(--brand);}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid var(--yolk-gold);outline-offset:2px;}
.site-header *:focus-visible,main:not(.discovery) *:focus-visible,.discovery-list[data-view="grid"] li *:focus-visible,html[data-theme="light"] *:focus-visible{outline-color:#000000;}
h1,h2,h3{font-family:var(--font-display);letter-spacing:.01em;font-weight:700;text-transform:uppercase;line-height:1.02;overflow-wrap:break-word;}
h1{font-size:clamp(2.35rem,5.4vw,3.8rem);line-height:1;margin:.25rem 0 1rem;}
h2{font-size:clamp(1.7rem,3.2vw,2.2rem);margin:2.25rem 0 .75rem;}
.time-meta,.scaler,.ing-progress,.cook-progress,ul.ingredients,.recipe-meter,.step-timer-chip{font-variant-numeric:tabular-nums;}

main{max-width:46rem;margin:0 auto;padding:1.75rem 1.5rem 3.5rem;background:var(--bg);color:var(--ink);transition:background-color .18s ease,color .18s ease;}
main:not(.discovery){border-top:4px solid var(--yolk-gold);box-shadow:0 20px 48px rgb(0 0 0 / .24);}
main.wide{max-width:72rem;}
main.wide.discovery{max-width:1280px;padding:0;margin:auto;background:var(--obsidian);color:#ffffff;border-top:0;box-shadow:none;}
main img{max-width:100%;height:auto;}

/* Keyframes & UI utilities */
@keyframes yolk-pop{
  0%{transform:scale(1);}
  45%{transform:scale(1.24);box-shadow:0 0 0 4px rgb(255 209 102 / .45);}
  78%{transform:scale(.94);}
  100%{transform:scale(1);box-shadow:none;}
}
.save-btn.is-popping{animation:yolk-pop .36s cubic-bezier(.22,1,.36,1);}
.skip{position:absolute;left:-9999px;top:0;background:#ffffff;color:#000000;padding:.5rem 1rem;border:2px solid #000000;z-index:100;}
.skip:focus{left:0;}
.visually-hidden{position:absolute !important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
.eyebrow{font-family:var(--font-display);font-size:.82rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;}
.icon-arrow{width:1.05em;height:1.05em;vertical-align:-.14em;flex-shrink:0;transition:transform .16s ease;}
.cat-icon{width:16px;height:16px;flex-shrink:0;opacity:.92;}
.social-icon{width:16px;height:16px;flex-shrink:0;}
.info-icon{width:13px;height:13px;flex-shrink:0;opacity:.9;}
.ing-icon{width:16px;height:16px;flex-shrink:0;color:var(--brand);margin-top:.12em;opacity:.88;}
.ing-icon--egg{color:#b45309;}
.ing-icon--protein{color:#7c2d12;}
.ing-icon--produce{color:#166534;}
.ing-icon--grain{color:#854d0e;}
.ing-icon--liquid{color:#1d4ed8;}

/* Crisp White Header & Navigation (Kingswood editorial bar) */
.site-header{background:#ffffff;border-bottom:1px solid #e6e6e6;color:#000000;position:sticky;top:0;z-index:30;}
.header-inner{max-width:1280px;margin:0 auto;padding:.7rem 1.5rem;display:flex;align-items:center;gap:.45rem .7rem;flex-wrap:wrap;}
.brand{display:inline-flex;align-items:center;gap:.45rem;text-decoration:none;color:#000000;}
.brand-mark{width:1.75rem;height:1.75rem;flex-shrink:0;}
.brand-word{font-family:var(--font-display);font-weight:700;font-size:1.9rem;letter-spacing:.02em;text-transform:uppercase;line-height:1;display:inline-block;transform:rotate(-2deg);}
.brand-yolks-svg{width:2.1rem;height:1.2rem;flex-shrink:0;color:inherit;overflow:visible;}
.brand-yolks-svg .yolk-one,.brand-yolks-svg .yolk-two{transition:transform .22s ease;}
.brand:hover .brand-yolks-svg .yolk-one{transform:translateX(-1.2px);}
.brand:hover .brand-yolks-svg .yolk-two{transform:translate(1.8px,-1px);}
.site-nav{margin-left:auto;display:flex;align-items:center;flex-wrap:wrap;gap:.15rem;}
.site-nav a,.language-nav a{color:#000000;font-family:var(--font-display);font-weight:600;font-size:.92rem;text-transform:uppercase;letter-spacing:.03em;border-radius:var(--btn-radius);min-height:40px;display:inline-flex;align-items:center;gap:.32rem;padding:.3rem .46rem;text-decoration:none;transition:background .15s,color .15s;}
.site-nav a:hover,.language-nav a:hover{background:var(--surface-soft);color:#000000;}
.site-nav a.nav-share-cta{background:#000000;color:#ffffff;font-weight:700;padding:.35rem .72rem;margin-left:.2rem;border:1px solid #000000;}
.site-nav a.nav-share-cta:hover{background:var(--yolk-gold);color:#000000;border-color:var(--yolk-gold);}
.site-nav a.nav-share-cta .social-icon{width:15px;height:15px;}
.header-tools{display:inline-flex;align-items:center;gap:.25rem;}
.language-nav{display:flex;flex-wrap:wrap;gap:0 .08rem;align-items:center;}
.language-nav a[aria-current=page]{text-decoration:underline;text-underline-offset:5px;font-weight:700;}
.theme-toggle{background:#ffffff;color:#000000;border:1px solid #d4d4d8;border-radius:var(--btn-radius);min-height:38px;min-width:38px;padding:.35rem .5rem;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;cursor:pointer;font-family:var(--font-display);font-size:.82rem;font-weight:700;text-transform:uppercase;transition:border-color .15s,background .15s;}
.theme-toggle:hover{border-color:#000000;background:var(--surface-soft);}
.theme-toggle .social-icon{width:16px;height:16px;}
.theme-toggle .icon-sun{display:none;}
html[data-theme="dark"] .theme-toggle .icon-sun{display:inline-block;}
html[data-theme="dark"] .theme-toggle .icon-moon{display:none;}

/* Header search + compact mobile menu */
.header-search-form{position:relative;display:flex;align-items:stretch;flex:1 1 160px;max-width:215px;min-width:140px;background:#f4f4f5;border:1px solid #d4d4d8;border-radius:var(--btn-radius);}
.header-search-form:focus-within{border-color:#000000;box-shadow:0 0 0 1px #000000;}
.header-search-icon{position:absolute;left:.65rem;top:50%;transform:translateY(-50%);width:15px;height:15px;color:#52525b;pointer-events:none;}
.header-search-form input{flex:1;min-width:0;min-height:38px;padding:.35rem .5rem .35rem 2.05rem;background:transparent;border:0;color:#000000;font:inherit;font-size:.84rem;}
.header-search-form input::placeholder{color:#52525b;}
.header-search-form input:focus-visible{outline:none;}
.header-search-form button{border:0;background:#000000;color:#ffffff;font-family:var(--font-display);font-size:.86rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:0 .75rem;cursor:pointer;border-radius:0 3px 3px 0;}
.header-search-form button:hover{background:var(--yolk-gold);color:#000000;}
.search-popover{position:absolute;left:0;right:0;top:calc(100% + 6px);background:#ffffff;border:1px solid #d4d4d8;border-radius:var(--radius);padding:.65rem .75rem;z-index:45;box-shadow:0 16px 32px rgb(0 0 0 / .22);display:grid;gap:.55rem;min-width:260px;}
.search-popover[hidden]{display:none !important;}
.suggest-heading{margin:0;font-family:var(--font-display);font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:#52525b;font-weight:700;}
.suggest-list{list-style:none;margin:0;padding:0;display:grid;gap:.15rem;}
.suggest-list a,.suggest-fallback-link{display:block;padding:.38rem .45rem;color:#000000;text-decoration:none;font-size:.86rem;font-weight:600;border-bottom:1px solid #f1f1f1;border-radius:var(--btn-radius);}
.suggest-list a:hover,.suggest-fallback-link:hover{background:#f1f1f1;color:#000000;}
.nav-search-mobile{display:none !important;}
.site-nav a.nav-search .social-icon{width:17px;height:17px;}
.nav-saved-link{position:relative;}
.saved-count{display:inline-flex;align-items:center;justify-content:center;min-width:1.25rem;height:1.25rem;padding:0 .3rem;background:var(--yolk-gold);color:#000000;font-family:var(--font-body);font-size:.72rem;font-weight:800;line-height:1;border-radius:999px;}
.saved-count[hidden],.tab-badge[hidden]{display:none !important;}
.mobile-menu{display:none;}
.mobile-menu summary{list-style:none;cursor:pointer;color:#000000;background:#ffffff;border:1px solid #d4d4d8;border-radius:var(--btn-radius);min-height:42px;min-width:42px;display:inline-flex;align-items:center;justify-content:center;}
.mobile-menu summary::-webkit-details-marker{display:none;}
.mobile-menu summary .social-icon{width:20px;height:20px;}
.mobile-menu[open] summary{background:#000000;color:#ffffff;border-color:#000000;}
.mobile-menu-panel{position:absolute;left:0;right:0;top:100%;background:#ffffff;color:#000000;border-bottom:1px solid #e6e6e6;padding:.5rem 1rem 1rem;display:flex;flex-direction:column;gap:.35rem;box-shadow:0 18px 30px rgb(0 0 0 / .2);}
.mobile-menu-panel nav{display:flex;flex-direction:column;}
.mobile-menu-panel nav a{color:#000000;text-decoration:none;font-family:var(--font-display);font-weight:700;font-size:1.15rem;text-transform:uppercase;letter-spacing:.03em;min-height:46px;display:flex;align-items:center;border-bottom:1px solid #e6e6e6;}
.mobile-menu-panel nav a.mobile-sub-link{padding-left:1rem;font-size:1rem;color:#52525b;}
.mobile-menu-panel nav a:hover{color:#000000;background:#f4f4f5;}
.mobile-menu-panel .mobile-menu-langs{flex-direction:row;gap:1rem;}
.mobile-menu-panel .mobile-menu-langs a{font-size:.96rem;color:#000000;border-bottom:0;}
.mobile-menu-panel .mobile-menu-langs a[aria-current=page]{text-decoration:underline;text-underline-offset:5px;}
.theme-toggle-menu{align-self:flex-start;margin-top:.35rem;padding:.45rem .75rem;}

/* Full-screen search sheet */
.search-sheet{position:fixed;inset:0;z-index:65;background:#000000;color:#ffffff;padding:1rem 1rem 5.5rem;overflow-y:auto;display:flex;flex-direction:column;gap:1rem;}
.search-sheet[hidden]{display:none !important;}
.search-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid #26262a;padding-bottom:.65rem;}
.search-sheet-title{font-family:var(--font-display);font-size:1.65rem;font-weight:700;text-transform:uppercase;color:#ffffff;}
.search-sheet-close{background:#141416;color:#ffffff;border:1px solid #3f3f46;border-radius:var(--btn-radius);min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;}
.search-sheet-form{display:flex;align-items:stretch;background:#141416;border:1px solid var(--yolk-gold);border-radius:var(--btn-radius);overflow:hidden;}
.search-sheet-form input{flex:1;min-width:0;min-height:50px;padding:.6rem .9rem;background:transparent;border:0;color:#ffffff;font:inherit;font-size:1rem;}
.search-sheet-form input::placeholder{color:#a1a1aa;}
.search-sheet-form button{border:0;background:var(--yolk-gold);color:#000000;font-family:var(--font-display);font-size:1rem;text-transform:uppercase;font-weight:700;letter-spacing:.04em;padding:0 1.15rem;cursor:pointer;}
.search-sheet-section h3{margin:0 0 .45rem;font-size:.95rem;text-transform:uppercase;letter-spacing:.06em;color:#d4d4d8;}
.search-sheet-row{display:flex;align-items:center;justify-content:space-between;gap:.5rem;}
.quiet-link{background:transparent;border:0;color:var(--yolk-gold);font:inherit;font-size:.82rem;cursor:pointer;text-decoration:underline;padding:.25rem 0;}
.search-sheet-chips{display:flex;flex-wrap:wrap;gap:.45rem;}
.search-sheet .chip{color:#ffffff;border:1px solid #3f3f46;border-radius:var(--btn-radius);background:#141416;padding:.4rem .75rem;text-decoration:none;font-size:.86rem;font-weight:600;min-height:38px;display:inline-flex;align-items:center;}

/* Hero search + Hero Mosaic (D6 on Obsidian canvas) */
.hero-search{display:flex;flex-direction:column;gap:.45rem;width:100%;max-width:32rem;min-width:0;margin:0 0 .85rem;}
.hero-prompt{font-family:var(--font-display);font-size:1.05rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--yolk-gold);}
.hero-search-row{display:flex;align-items:stretch;width:100%;min-width:0;background:#141416;border:1px solid #333338;border-radius:var(--btn-radius);overflow:hidden;position:relative;}
.hero-search-row:focus-within{border-color:var(--yolk-gold);box-shadow:0 0 0 1px var(--yolk-gold);}
.hero-search-icon{position:absolute;left:.9rem;top:50%;transform:translateY(-50%);width:18px;height:18px;color:#a1a1aa;pointer-events:none;}
.hero-search input{flex:1;min-width:0;min-height:50px;padding:.6rem .9rem .6rem 2.6rem;background:transparent;border:0;color:#ffffff;font:inherit;font-size:1rem;}
.hero-search input::placeholder{color:#a1a1aa;}
.hero-search input:focus-visible{outline:none;}
.hero-search button{border:0;background:#ffffff;color:#000000;font-family:var(--font-display);font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:0 1.25rem;cursor:pointer;transition:background .15s;}
.hero-search button:hover{background:var(--yolk-gold);}
.after-copy p.hero-quick,.hero-quick{display:flex;flex-wrap:wrap;gap:.4rem;width:100%;max-width:100%;min-width:0;margin:0 0 1.65rem;}
.hero-quick a{color:#f4f4f5;background:#111113;border:1px solid #333338;border-radius:var(--btn-radius);padding:.3rem .72rem;font-size:.82rem;font-weight:600;text-decoration:none;min-height:36px;display:inline-flex;align-items:center;white-space:nowrap;transition:border-color .15s,color .15s;}
.hero-quick a:hover{border-color:var(--yolk-gold);color:var(--yolk-gold);}

.after-hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);background:#000000;border-bottom:1px solid #222226;}
.after-copy{padding:3.25rem 3rem 2.85rem;display:flex;flex-direction:column;align-items:flex-start;min-width:0;}
.after-copy .eyebrow{color:var(--yolk-gold);letter-spacing:.12em;}
.after-copy h1{color:#ffffff;font-size:clamp(2.8rem,6.2vw,4.75rem);line-height:.96;letter-spacing:.005em;text-transform:uppercase;margin:.85rem 0 1rem;max-width:12.5ch;}
.after-copy p{max-width:34ch;font-size:1rem;line-height:1.55;color:#d4d4d8;margin:0 0 1.6rem;}
.hero-cta-row{display:flex;flex-wrap:wrap;gap:.75rem;width:100%;margin-top:auto;}
.discovery-cta{display:inline-flex;justify-content:space-between;align-items:center;gap:1.25rem;padding:.9rem 1.3rem;background:#ffffff;color:#000000;border-radius:var(--btn-radius);font-family:var(--font-display);font-size:1.05rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;min-width:200px;transition:background .15s,transform .15s;}
.discovery-cta:hover{background:var(--yolk-gold);color:#000000;transform:translateY(-2px);}
.discovery-cta:hover .icon-arrow{transform:translate(2px,-2px);}
.discovery-cta-secondary{display:inline-flex;align-items:center;gap:.5rem;padding:.9rem 1.2rem;border:1px solid #3f3f46;border-radius:var(--btn-radius);color:#ffffff;font-family:var(--font-display);font-size:1.05rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;transition:border-color .15s,color .15s;}
.discovery-cta-secondary:hover{border-color:var(--yolk-gold);color:var(--yolk-gold);}
.identity-art{position:relative;margin:0;min-width:0;overflow:hidden;border-radius:var(--radius);}
.identity-art img{width:100%;height:100%;object-fit:cover;display:block;}
.identity-art figcaption{position:absolute;bottom:.65rem;right:.65rem;left:.65rem;margin-left:auto;max-width:210px;background:#ffffffeb;color:#000000;border-radius:2px;font-size:.68rem;line-height:1.35;padding:.45rem .55rem;}
.hero-mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:10px;background:#000000;padding:1.15rem 1.5rem 1.15rem 0;min-height:400px;}
.mosaic-tile{position:relative;overflow:hidden;display:block;text-decoration:none;min-height:0;border-radius:var(--radius);background:#141416;}
.mosaic-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .28s ease;}
.mosaic-tile:hover img{transform:scale(1.04);}
.mosaic-overlay{position:absolute;inset:auto 0 0;padding:1.75rem .75rem .6rem;background:linear-gradient(to top,rgb(0 0 0 / .9),rgb(0 0 0 / .48) 60%,transparent);display:flex;align-items:flex-end;justify-content:space-between;gap:.4rem;color:#ffffff;}
.mosaic-title{font-family:var(--font-display);font-size:1.05rem;font-weight:700;text-transform:uppercase;line-height:1.08;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.mosaic-badge{flex-shrink:0;display:inline-flex;align-items:center;gap:.2rem;background:#ffffff;color:#000000;border:0;border-radius:2px;font-family:var(--font-display);font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:.14rem .42rem;}

/* Featured band (high-contrast neutral showcase cutout) */
.featured-recipe{position:relative;display:grid;grid-template-columns:1.15fr 1fr;gap:2rem;padding:2rem 2.25rem;margin:1.75rem 3rem 0;background:var(--surface-soft);color:#000000;border-radius:var(--radius);transition:background .15s;}
.featured-recipe:hover{background:#ffffff;}
.featured-recipe .eyebrow{color:#52525b;}
.featured-recipe h2{font-size:clamp(1.95rem,4.2vw,3.1rem);line-height:.98;max-width:18ch;margin:.45rem 0 0;color:#000000;}
.featured-recipe h2 a{color:inherit;text-decoration:none;display:inline-flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;}
.featured-recipe h2 a::after{content:'';position:absolute;inset:0;}
.featured-recipe:hover h2 .icon-arrow{transform:translate(3px,-3px);}
.featured-facts{display:flex;align-items:center;justify-content:flex-end;gap:.6rem;flex-wrap:wrap;}
.icon-stat{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;}
.fact-icon{width:17px;height:17px;flex-shrink:0;vertical-align:middle;}
.featured-facts>span{border:1px solid #d4d4d8;background:#ffffff;color:#000000;border-radius:var(--btn-radius);padding:.4rem .7rem;font-size:.82rem;font-weight:650;}
.featured-recipe .status-label{color:#3f3f46;border-color:#d4d4d8;}
.featured-recipe .tested-badge{background:var(--yolk-gold);color:#000000;border:0;}

/* Discovery toolbar + Visual Category Rail */
.discovery-index{padding:2.5rem 3rem 3.5rem;scroll-margin-top:4.5rem;}
.index-heading{display:flex;gap:1rem;align-items:baseline;justify-content:space-between;flex-wrap:wrap;}
.index-heading h2,.index-heading h1{font-size:clamp(2rem,3.6vw,2.65rem);color:#ffffff;margin:0;}
.index-heading p{font-size:.9rem;margin:0;color:#a1a1aa;}
.discovery-toolbar{display:flex;flex-direction:column;align-items:stretch;gap:1rem;margin:1.35rem 0 1.85rem;}
.chips{display:flex;flex-wrap:wrap;gap:.375rem;margin:.25rem 0 0;position:relative;z-index:1;}
.chip{display:inline-flex;align-items:center;font-size:.8rem;font-weight:600;color:var(--muted);background:var(--bg);border:1px solid var(--line);border-radius:var(--btn-radius);padding:.18rem .65rem;text-decoration:none;}
.chip:hover{color:#000000;border-color:#000000;}
.cat-nav{display:flex;flex-wrap:wrap;gap:.45rem;margin:0 0 1.25rem;}
.discovery .cat-nav{margin:0;gap:.5rem;}
.discovery .chip{background:#111113;color:#f4f4f5;border:1px solid #333338;border-radius:var(--btn-radius);min-height:40px;font-weight:600;font-size:.84rem;padding:.4rem .82rem;gap:.4rem;transition:border-color .15s,background .15s,color .15s;}
.discovery .chip:hover{border-color:var(--yolk-gold);color:var(--yolk-gold);}
.discovery .chip[aria-current=page]{background:var(--yolk-gold);border-color:var(--yolk-gold);color:#000000;font-weight:750;}

/* Story-style Category Rail (D5 on Obsidian canvas) */
.cat-nav.cat-rail{flex-wrap:nowrap;overflow-x:auto;scroll-snap-type:x proximity;gap:.55rem;padding:.2rem 0 .45rem;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.cat-nav.cat-rail::-webkit-scrollbar{display:none;}
.discovery .cat-rail .chip.cat-rail-item{flex:0 0 auto;flex-direction:column;align-items:center;justify-content:flex-start;gap:.38rem;min-width:86px;max-width:108px;padding:.3rem .35rem;border:0;background:transparent;text-align:center;scroll-snap-align:start;min-height:0;}
.cat-rail-ring{width:54px;height:54px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:#141416;border:1.5px solid #333338;color:#ffffff;transition:transform .16s ease,border-color .16s ease,background .16s ease,color .16s ease;}
.cat-rail-ring .cat-icon,.cat-rail-ring .social-icon{width:24px;height:24px;}
.cat-rail-item:hover .cat-rail-ring{border-color:var(--yolk-gold);color:var(--yolk-gold);background:#1c1c20;transform:translateY(-2px);}
.discovery .cat-rail .chip.cat-rail-item[aria-current=page]{background:transparent;color:var(--yolk-gold);}
.discovery .cat-rail .chip.cat-rail-item[aria-current=page] .cat-rail-ring{background:var(--yolk-gold);border-color:var(--yolk-gold);color:#000000;box-shadow:0 0 0 3px rgb(255 209 102 / .28);}
.cat-rail-label{font-family:var(--font-display);font-size:.88rem;line-height:1.15;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:#e4e4e7;}
.cat-rail-item[aria-current=page] .cat-rail-label{color:var(--yolk-gold);font-weight:700;}

.toolbar-controls{display:flex;align-items:center;gap:.6rem;justify-content:space-between;flex-wrap:wrap;}
.discovery-search-wrap{flex:1 1 240px;max-width:360px;min-width:190px;}
.discovery-search{width:100%;min-height:42px;padding:.48rem .85rem;background:#141416;border:1px solid #333338;border-radius:var(--btn-radius);color:#ffffff;font:inherit;font-size:.88rem;}
.discovery-search::placeholder{color:#a1a1aa;}
.discovery-search:focus{border-color:var(--yolk-gold);outline:2px solid var(--yolk-gold);outline-offset:1px;}
.view-toggle{display:inline-flex;border:1px solid #333338;border-radius:var(--btn-radius);overflow:hidden;margin-left:auto;}
.view-toggle button{background:#111113;color:#e4e4e7;border:0;min-height:40px;padding:.4rem .8rem;display:inline-flex;align-items:center;gap:.35rem;cursor:pointer;font-family:var(--font-display);font-size:.92rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em;}
.view-toggle button+button{border-left:1px solid #333338;}
.view-toggle button[aria-pressed="true"]{background:#ffffff;color:#000000;font-weight:700;}

/* Discovery List View + Kingswood Flat 11px Cutout Cards Grid View */
.lang-notice{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem .75rem;margin:0 0 1.25rem;padding:.65rem .9rem;border:1px solid #2e2e34;background:#111113;border-radius:var(--radius);color:#ffffff;font-size:.92rem;}
.lang-notice .chip{min-height:0;}
.discovery-list{list-style:none;padding:0;margin:0;border-bottom:1px solid #26262a;transition:opacity .15s ease;}
.index-group{margin-top:2.25rem;}
.index-group[hidden]{display:none !important;}
.index-group-head{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin:0 0 .85rem;}
.index-group-title{display:inline-flex;align-items:center;gap:.5rem;font-size:1.55rem;margin:0;color:#ffffff;}
.see-all{display:inline-flex;align-items:center;gap:.3rem;color:var(--yolk-gold);font-family:var(--font-display);font-size:1.05rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;min-height:44px;}
.see-all:hover{text-decoration:underline;}

.discovery-list li{position:relative;display:grid;grid-template-columns:2.2rem minmax(0,1fr) auto;gap:1rem;border-top:1px solid #26262a;padding:1.25rem .75rem;margin:0 -.75rem;transition:background .15s,border-color .15s,transform .16s cubic-bezier(.33,1,.68,1);}
.discovery-list li.has-thumb{grid-template-columns:2.2rem 4.75rem minmax(0,1fr) auto;}
.discovery-list li[hidden]{display:none !important;}
.discovery-list li:hover{background:rgb(255 209 102 / .07);}
.recipe-thumb{display:flex;flex-direction:column;align-items:center;gap:.25rem;width:4.75rem;}
.recipe-thumb img,.recipe-thumb .category-art-svg{width:4.75rem;height:4.75rem;object-fit:cover;display:block;border-radius:6px;border:1px solid #333338;}
.card-art-fallback{display:none;}
.thumb-label{display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;line-height:1.2;text-align:center;color:#a1a1aa;}
.recipe-number{font-family:var(--font-display);font-size:.88rem;font-weight:700;color:#a1a1aa;padding-top:.2rem;font-variant-numeric:tabular-nums;}
.discovery-list h3{font-size:1.55rem;line-height:1.05;margin:.12rem 0 .35rem;}
.discovery-list h3 a{color:#ffffff;text-decoration:none;}
.discovery-list h3 a.stretched-row::after{content:'';position:absolute;inset:0;z-index:1;}
.discovery-list a:hover{text-decoration:underline;}
.discovery-list .eyebrow{display:inline-flex;align-items:center;gap:.35rem;color:var(--yolk-gold);font-weight:700;margin-bottom:.15rem;}
.card-intro{display:none;font-size:.86rem;line-height:1.42;color:#3f3f46;margin:.25rem 0 .5rem;}
.row-badges{display:flex;flex-wrap:wrap;gap:.35rem .5rem;align-items:center;}
.status-label{color:#d4d4d8;border:1px solid #3f3f46;border-radius:2px;padding:.08rem .48rem;font-size:.73rem;font-weight:600;}
.tested-badge{display:inline-flex;align-items:center;gap:.28rem;background:var(--yolk-gold);color:#000000;border-radius:2px;padding:.12rem .52rem;font-family:var(--font-display);font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
.tested-badge .fact-icon{width:13px;height:13px;}
.cooked-count-chip{display:inline-flex;align-items:center;gap:.25rem;font-size:.72rem;font-weight:650;color:var(--yolk-gold);border:1px solid rgb(255 209 102 / .45);border-radius:2px;padding:.08rem .45rem;}
.fallback-language,.provenance-badge{display:inline-block;font-size:.73rem;color:#d4d4d8;border:1px solid #3f3f46;border-radius:2px;padding:.08rem .45rem;}
.contributor-row{display:flex;align-items:center;gap:.45rem;margin-top:.55rem;position:relative;z-index:2;}
.contributor-avatar{width:24px;height:24px;border-radius:999px;background:var(--yolk-gold);color:#000000;font-size:.66rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:.02em;}
.contributor-link{display:inline-flex;align-items:center;gap:.42rem;color:#e4e4e7;font-size:.78rem;font-weight:600;text-decoration:none;}
.contributor-link:hover{color:var(--yolk-gold);text-decoration:underline;}

.row-end{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:.5rem;min-width:72px;}
.row-end-actions{display:inline-flex;align-items:center;gap:.35rem;position:relative;z-index:2;}
.save-btn{position:relative;z-index:2;background:transparent;color:#e4e4e7;border:1px solid #3f3f46;border-radius:var(--btn-radius);min-width:38px;min-height:38px;padding:.3rem .5rem;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;cursor:pointer;font:inherit;font-size:.84rem;font-weight:650;transition:background .15s,color .15s,border-color .15s,transform .15s;}
.save-btn:hover{border-color:var(--yolk-gold);color:var(--yolk-gold);}
.save-btn .icon-heart-filled{display:none;}
.save-btn[aria-pressed="true"]{background:var(--yolk-gold);color:#000000;border-color:var(--yolk-gold);}
.save-btn[aria-pressed="true"] .icon-heart-outline{display:none;}
.save-btn[aria-pressed="true"] .icon-heart-filled{display:inline-block;}
.save-btn--labeled{padding:.42rem .85rem;min-height:44px;}
.recipe-page .save-btn{color:var(--ink);border-color:var(--line-strong);background:var(--card);}
.recipe-page .save-btn:hover{border-color:#000000;color:#000000;}
.recipe-page .save-btn[aria-pressed="true"]{background:#000000;color:var(--yolk-gold);border-color:#000000;}
.related-card .save-btn{color:var(--ink);border-color:var(--line-strong);background:var(--card);min-width:34px;min-height:34px;padding:.25rem .42rem;}
.related-card .save-btn[aria-pressed="true"]{background:#000000;color:var(--yolk-gold);border-color:#000000;}
.row-end .icon-stat{font-size:.78rem;color:#d4d4d8;}
.row-end .fact-icon{width:14px;height:14px;}
.row-end a{color:var(--yolk-gold);font-size:1.35rem;line-height:1;text-decoration:none;min-height:34px;min-width:34px;display:inline-flex;align-items:center;justify-content:flex-end;transition:transform .15s;}
.discovery-list li:hover .row-end a{transform:translate(3px,-3px);}
.cat-heading-link{color:inherit;text-decoration:none;}
.cat-heading-link:hover{color:var(--yolk-gold);text-decoration:underline;}
.home-browse-all{margin:2rem 0 0;display:flex;justify-content:center;}

/* Kingswood Flat 11px White Card Cutouts in Grid View (D2, D3, D9) */
.discovery-list[data-view="grid"]{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:1rem;border-bottom:0;}
.discovery-list[data-view="grid"] li,.discovery-list[data-view="grid"] li.has-thumb{display:flex;flex-direction:column;align-items:stretch;gap:0;margin:0;padding:0;background:#ffffff;color:#000000;border:0;border-radius:var(--radius);overflow:hidden;}
.discovery-list[data-view="grid"] li:hover{transform:translateY(-3px);background:#ffffff;}
.discovery-list[data-view="grid"] .recipe-number{position:absolute;top:.65rem;right:.65rem;left:auto;z-index:2;padding:.14rem .42rem;background:#000000;border:0;border-radius:2px;color:#ffffff;font-size:.72rem;}
.discovery-list[data-view="grid"] .recipe-number:empty{display:none;}
.discovery-list[data-view="grid"] .recipe-thumb,.discovery-list[data-view="grid"] .card-art-fallback{position:relative;display:block;width:100%;aspect-ratio:4/5;overflow:hidden;background:var(--surface-soft);margin:0;border-bottom:0;}
.discovery-list[data-view="grid"] .recipe-thumb img,.discovery-list[data-view="grid"] .recipe-thumb .category-art-svg,.discovery-list[data-view="grid"] .card-art-fallback .category-art-svg{width:100%;height:100%;object-fit:cover;display:block;border:0;border-radius:0;transition:transform .26s ease;}
.discovery-list[data-view="grid"] li:hover .recipe-thumb img,.discovery-list[data-view="grid"] li:hover .recipe-thumb .category-art-svg,.discovery-list[data-view="grid"] li:hover .card-art-fallback .category-art-svg{transform:scale(1.03);}
.discovery-list[data-view="grid"] .thumb-label{position:absolute;top:.65rem;left:.65rem;bottom:auto;z-index:2;background:#ffffff;color:#000000;border:0;border-radius:2px;padding:.18rem .48rem;font-family:var(--font-display);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;}
.discovery-list[data-view="grid"] .card-body{padding:1rem 1.05rem .75rem;display:flex;flex-direction:column;gap:.2rem;flex:1;background:#ffffff;}
.discovery-list[data-view="grid"] .eyebrow{color:#52525b;}
.discovery-list[data-view="grid"] h3{font-size:1.42rem;line-height:1.04;margin:.1rem 0 .25rem;}
.discovery-list[data-view="grid"] h3 a{color:#000000;}
.discovery-list[data-view="grid"] .card-intro{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#3f3f46;}
.discovery-list[data-view="grid"] .status-label,.discovery-list[data-view="grid"] .fallback-language,.discovery-list[data-view="grid"] .provenance-badge{color:#3f3f46;border-color:#d4d4d8;}
.discovery-list[data-view="grid"] .cooked-count-chip{background:#f4f4f5;color:#18181b;border-color:#d4d4d8;}
.discovery-list[data-view="grid"] .pantry-match-pill{background:#fef3c7;color:#78350f;border-color:#f59e0b;}
.discovery-list[data-view="grid"] .contributor-link{color:#18181b;}
.discovery-list[data-view="grid"] .contributor-link:hover{color:#000000;}
.discovery-list[data-view="grid"] .contributor-avatar{background:#000000;color:var(--yolk-gold);}
.discovery-list[data-view="grid"] .row-end{margin-top:auto;padding:.65rem 1.05rem .85rem;background:#ffffff;border-top:1px solid #ececec;flex-direction:row;align-items:center;justify-content:space-between;width:100%;}
.discovery-list[data-view="grid"] .row-end .icon-stat{color:#3f3f46;font-weight:600;}
.discovery-list[data-view="grid"] .save-btn{color:#000000;border-color:#d4d4d8;background:#ffffff;}
.discovery-list[data-view="grid"] .save-btn:hover{border-color:#000000;background:#f4f4f5;color:#000000;}
.discovery-list[data-view="grid"] .save-btn[aria-pressed="true"]{background:#000000;color:var(--yolk-gold);border-color:#000000;}
.discovery-list[data-view="grid"] .row-end a{color:#000000;}

/* Full-Bleed 50/50 Editorial Poster Split Bands (Kingswood signature) */
.editorial-splits{max-width:1280px;margin:0 auto;padding:0 3rem 3.5rem;display:grid;gap:1.5rem;}
.editorial-split{display:grid;grid-template-columns:1fr 1fr;min-height:440px;background:#0c0c0e;border:1px solid #222226;border-radius:var(--radius);overflow:hidden;}
.editorial-split-copy{padding:3rem 2.75rem;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:1rem;min-width:0;}
.editorial-split--flip .editorial-split-copy{order:2;}
.editorial-split-copy .eyebrow{color:var(--yolk-gold);}
.editorial-jumbo{font-family:var(--font-display);font-weight:700;font-size:clamp(3.15rem,7.2vw,6.2rem);line-height:.86;letter-spacing:-.02em;text-transform:uppercase;color:#ffffff;margin:0;max-width:9ch;}
.editorial-split-copy p{margin:0;color:#d4d4d8;font-size:1rem;line-height:1.52;max-width:34ch;}
.editorial-split-cta{display:inline-flex;align-items:center;gap:.6rem;padding:.85rem 1.35rem;background:#ffffff;color:#000000;border-radius:var(--btn-radius);font-family:var(--font-display);font-size:1.05rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;margin-top:.35rem;transition:background .15s,transform .15s;}
.editorial-split-cta:hover{background:var(--yolk-gold);color:#000000;transform:translateY(-2px);}
.editorial-split--flip .editorial-split-cta{background:var(--yolk-gold);color:#000000;}
.editorial-split--flip .editorial-split-cta:hover{background:#ffffff;color:#000000;}
.editorial-split-media{position:relative;margin:0;min-height:320px;overflow:hidden;background:#141416;}
.editorial-split-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease;}
.editorial-split:hover .editorial-split-media img{transform:scale(1.03);}

/* Search page & filters (Q3, Q4) */
.search-page .crumbs-nav,.discovery-index .crumbs-nav{margin-bottom:.75rem;}
.discovery-index .crumbs a,.discovery-index .crumbs [aria-current="page"]{color:#d4d4d8;}
.discovery-index .crumbs a:hover{color:var(--yolk-gold);}
.search-page-form{display:grid;gap:.9rem;margin:1.25rem 0 1rem;background:var(--obsidian-elev);border:1px solid #26262a;border-radius:var(--radius);padding:1.1rem 1.2rem;}
.search-main-row{display:flex;align-items:stretch;background:#000000;border:1px solid #333338;border-radius:var(--btn-radius);overflow:hidden;position:relative;}
.search-main-row:focus-within{border-color:var(--yolk-gold);box-shadow:0 0 0 1px var(--yolk-gold);}
.search-bar-icon{position:absolute;left:.85rem;top:50%;transform:translateY(-50%);width:18px;height:18px;color:#a1a1aa;pointer-events:none;}
.search-main-row input{flex:1;min-width:0;min-height:48px;padding:.55rem .85rem .55rem 2.5rem;background:transparent;border:0;color:#ffffff;font:inherit;font-size:1rem;}
.search-main-row input::placeholder{color:#a1a1aa;}
.search-main-row input:focus-visible{outline:none;}
.search-main-row button{border:0;background:#ffffff;color:#000000;font-family:var(--font-display);font-size:1.05rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:0 1.25rem;cursor:pointer;}
.search-main-row button:hover{background:var(--yolk-gold);}
.search-filters{display:flex;flex-wrap:wrap;gap:.75rem 1rem;align-items:flex-end;}
.search-filters label{display:grid;gap:.3rem;font-size:.78rem;font-weight:650;color:#e4e4e7;flex:1 1 145px;}
.search-filters select{min-height:40px;padding:.35rem .55rem;background:#000000;color:#ffffff;border:1px solid #333338;border-radius:var(--btn-radius);font:inherit;font-size:.86rem;}
.search-filters label.filter-check{display:inline-flex;align-items:center;gap:.45rem;flex:0 1 auto;min-height:40px;font-size:.86rem;cursor:pointer;}
.search-filters label.filter-check input{width:1rem;height:1rem;accent-color:var(--yolk-gold);}
.apply-filters-btn{min-height:40px;padding:.4rem 1.05rem;background:transparent;color:var(--yolk-gold);border:1px solid var(--yolk-gold);border-radius:var(--btn-radius);font-family:var(--font-display);font-weight:700;font-size:.95rem;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;}
.apply-filters-btn:hover{background:var(--yolk-gold);color:#000000;}
.filter-pills{display:flex;flex-wrap:wrap;gap:.45rem;margin:.75rem 0;}
.active-filter-chip{background:#1c1c20 !important;border-color:var(--yolk-gold) !important;color:var(--yolk-gold) !important;font-weight:650 !important;}
.inferred-note{margin:.5rem 0 1rem;padding:.6rem .9rem;border-left:4px solid var(--yolk-gold);background:var(--obsidian-elev);color:#e4e4e7;border-radius:var(--btn-radius);font-size:.86rem;}
.search-results-bar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin:.75rem 0 1rem;}
.search-count{margin:0;font-size:.9rem;font-weight:650;color:#d4d4d8;}
.pagination{display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-top:1.75rem;padding-top:1rem;border-top:1px solid #26262a;}
.pagination-info{font-size:.88rem;color:#d4d4d8;}

/* Category / Collection / Cuisine / Contributor Hubs (N4, N5, D8) */
.hub-hero{display:grid;grid-template-columns:1.3fr minmax(0,260px);gap:1.5rem;align-items:center;padding:1.5rem 1.65rem;background:var(--obsidian-elev);border:1px solid #26262a;border-radius:var(--radius);margin-bottom:1.25rem;}
.hub-hero .eyebrow{color:var(--yolk-gold);display:inline-flex;align-items:center;gap:.35rem;}
.hub-hero-head{display:flex;align-items:center;gap:.85rem;}
.hub-avatar-lg{width:52px;height:52px;border-radius:999px;background:var(--yolk-gold);color:#000000;font-family:var(--font-display);font-size:1.35rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.hub-hero h1{color:#ffffff;margin:.35rem 0 .6rem;}
.hub-intro{margin:0 0 1rem;color:#d4d4d8;max-width:58ch;font-size:1rem;}
.hub-actions{display:flex;flex-wrap:wrap;gap:.5rem;}
.hub-hero-media{margin:0;}
.hub-hero-media img{width:100%;height:180px;object-fit:cover;display:block;border-radius:8px;border:1px solid #333338;}
.hub-hero-media figcaption{font-size:.74rem;color:#a1a1aa;margin-top:.3rem;}
.hub-related-nav{margin:.5rem 0 1rem;}
.hub-directory-grid{list-style:none;padding:0;margin:1.25rem 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem;}
.hub-directory-card{position:relative;background:var(--obsidian-elev);border:1px solid #26262a;border-radius:var(--radius);padding:1.25rem;display:grid;gap:.45rem;transition:border-color .15s,transform .15s;}
.hub-directory-card:hover{border-color:var(--yolk-gold);transform:translateY(-3px);}
.hub-directory-card .eyebrow{color:var(--yolk-gold);display:inline-flex;align-items:center;gap:.35rem;}
.hub-directory-card h2{margin:0;font-size:1.55rem;}
.hub-directory-card h2 a{color:#ffffff;text-decoration:none;}
.hub-directory-card h2 a.stretched::after{content:'';position:absolute;inset:0;}
.hub-directory-card p{margin:0;color:#d4d4d8;font-size:.9rem;line-height:1.48;}

/* Empty search state */
.empty-note{color:#a1a1aa;}
.empty-search-card{text-align:center;padding:2.5rem 1.5rem;border:1px dashed #333338;border-radius:var(--radius);background:var(--obsidian-elev);margin-top:1rem;color:#e4e4e7;}
.empty-skillet-svg{width:132px;height:82px;color:#d4d4d8;margin:0 auto .65rem;display:block;}
.suggestions-list{list-style:none;padding:0;margin:.5rem 0 1rem;display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem;}
.suggestions-list a{color:var(--yolk-gold);border:1px solid #3f3f46;border-radius:var(--btn-radius);padding:.25rem .65rem;text-decoration:none;}
.empty-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:.65rem;margin-top:1rem;}
.btn-clear,.empty-share-link{background:transparent;color:#ffffff;border:1px solid #3f3f46;border-radius:var(--btn-radius);padding:.5rem 1rem;font-family:var(--font-display);font-size:.96rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem;}
.btn-clear:hover{border-color:var(--yolk-gold);color:var(--yolk-gold);}
.empty-share-link{background:var(--yolk-gold);border-color:var(--yolk-gold);color:#000000;}

/* Saved & Recently viewed (N6) */
.saved-sync-banner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;padding:.95rem 1.15rem;border:1px solid #26262a;border-left:4px solid var(--yolk-gold);border-radius:var(--radius);background:var(--obsidian-elev);margin:1rem 0 1.25rem;}
.saved-sync-banner p{margin:0;font-size:.92rem;color:#e4e4e7;}
.saved-section{margin-top:1.5rem;}
.saved-section h2{color:#ffffff;margin:0 0 .85rem;font-size:1.6rem;}
.recent-links-list{list-style:none;padding:0;margin:0;display:grid;gap:.55rem;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));}
.recent-links-list li{border:1px solid #26262a;border-radius:var(--radius);background:var(--obsidian-elev);padding:.75rem .9rem;display:flex;flex-direction:column;gap:.2rem;}
.recent-links-list a{color:#ffffff;font-weight:650;text-decoration:none;}
.recent-links-list a:hover{color:var(--yolk-gold);text-decoration:underline;}
.recent-cat{font-size:.76rem;color:#a1a1aa;}

/* Breadcrumbs */
.crumbs-nav{margin-bottom:.75rem;}
.crumbs{list-style:none;display:flex;flex-wrap:wrap;gap:.5rem;margin:0;padding:0;font-size:.9rem;color:var(--muted);}
.crumbs li+li::before{content:'\\203A';margin-right:.5rem;color:var(--line-strong);}
.crumbs a{color:var(--muted);text-decoration:none;}
.crumbs a:hover{color:#000000;text-decoration:underline;}
.crumbs [aria-current="page"]{color:var(--ink);}

/* Legacy Country Grid cards (fallback only) */
.recipe-grid{list-style:none;margin:0;padding:0;display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));}
.recipe-card{position:relative;display:flex;flex-direction:column;gap:.4rem;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:1.1rem 1.25rem;transition:border-color .15s,box-shadow .15s,transform .15s;}
.recipe-card:hover{border-color:var(--line-strong);box-shadow:var(--shadow);transform:translateY(-2px);}
.recipe-card h3{font-family:var(--font-display);font-size:1.35rem;font-weight:700;line-height:1.12;margin:0;}
.recipe-card h3 a{color:var(--ink);text-decoration:none;}
.recipe-card h3 a:hover{color:#000000;}
.recipe-card h3 a.stretched::after{content:'';position:absolute;inset:0;border-radius:var(--radius);}
.recipe-card .meta{display:flex;align-items:center;flex-wrap:wrap;gap:.4rem .6rem;margin:0;color:var(--muted);font-size:.9rem;}
.meta-country{display:inline-flex;align-items:center;gap:.35rem;}
.yolk-dot{width:.5rem;height:.5rem;border-radius:50%;background:var(--yolk);display:inline-block;}

/* Recipe Page & Recipe Graphics (Warm cream reading surface with Obsidian & Yolk accents) */
.recipe-page{max-width:1040px;padding:2.25rem 3rem 4rem;border-top:4px solid var(--yolk-gold);}
.recipe-page .crumbs-nav{margin-bottom:1rem;}
.recipe-page .crumbs a{color:var(--muted);font-weight:500;}
.recipe-header{margin-bottom:1.25rem;}
.recipe-eyebrow{display:inline-flex;align-items:center;gap:.35rem;font-family:var(--font-display);font-size:.82rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:#000000;background:var(--yolk-gold);border-radius:2px;padding:.2rem .6rem;text-decoration:none;margin-bottom:.65rem;}
.recipe-eyebrow:hover{background:#ffe08a;}
.recipe-page h1{margin:.15rem 0 .75rem;font-size:clamp(2.45rem,4.8vw,3.5rem);color:var(--ink);}
.recipe-intro{font-size:1.1rem;line-height:1.65;color:var(--ink);opacity:.9;max-width:66ch;margin:0;}
.contributor-byline{display:flex;align-items:center;flex-wrap:wrap;gap:.55rem .85rem;margin:.9rem 0 0;}
.contributor-byline-link{display:inline-flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--ink);font-weight:650;font-size:.92rem;}
.contributor-byline-link:hover{color:#000000;text-decoration:underline;}
.recipe-page .contributor-avatar{width:28px;height:28px;background:#000000;color:var(--yolk-gold);font-size:.72rem;}
.cooked-by-pill{display:inline-flex;align-items:center;gap:.3rem;font-size:.82rem;font-weight:650;color:#18181b;background:#fef3c7;border:1px solid #f59e0b;border-radius:var(--btn-radius);padding:.16rem .55rem;}
.hero-image{margin:.5rem 0 1rem;}
.hero-image img{width:100%;height:auto;max-height:540px;object-fit:cover;border-radius:var(--radius);border:1px solid var(--line);display:block;}
.hero-image figcaption{color:var(--muted);font-size:.85rem;margin-top:.35rem;}
.time-meta{display:flex;flex-wrap:wrap;gap:.75rem 1.5rem;margin:1.25rem 0 .85rem;padding:.85rem 1.15rem;background:var(--card);border:1px solid var(--line);border-left:4px solid #000000;border-radius:var(--btn-radius);font-size:.95rem;}
.time-item{display:inline-flex;align-items:center;gap:.4rem;font-weight:600;white-space:nowrap;}
.time-label{color:var(--muted);font-weight:500;margin-right:.15rem;}

/* Effort & Time Visual Meter (D7) */
.recipe-meter{display:flex;flex-wrap:wrap;align-items:center;gap:.9rem 1.65rem;padding:.75rem 1.1rem;margin:0 0 1rem;background:var(--card);border:1px solid var(--line);border-radius:var(--btn-radius);font-size:.86rem;}
.meter-effort{display:inline-flex;align-items:center;gap:.55rem;}
.meter-label{color:var(--muted);font-weight:600;}
.meter-dots{display:inline-flex;gap:4px;}
.meter-dots span{width:16px;height:7px;background:var(--line);display:inline-block;}
.meter-dots span.is-on{background:#000000;}
.meter-time-split{flex:1 1 220px;display:grid;gap:.3rem;}
.time-bar{display:flex;height:8px;width:100%;overflow:hidden;background:var(--line);gap:2px;}
.time-seg-prep{background:var(--yolk-gold);}
.time-seg-cook{background:#000000;}
.time-seg-rest{background:#71717a;}
.time-legend{display:flex;flex-wrap:wrap;gap:.65rem;font-size:.75rem;color:var(--muted);}
.time-legend i{display:inline-block;width:8px;height:8px;margin-right:.28rem;vertical-align:0;}

.badge{display:inline-block;padding:.05rem .55rem;background:var(--amber-bg);color:var(--amber-ink);border:1px solid var(--amber-line);border-radius:2px;font-size:.75rem;font-weight:700;}
.recipe-actions{position:sticky;top:4.1rem;z-index:20;background:var(--bg);padding:.65rem 0;border-bottom:1px solid var(--line);margin:0 0 1rem;display:flex;flex-wrap:wrap;gap:.6rem;align-items:center;}
.recipe-page .recipe-actions button,.recipe-page .recipe-actions .jump,.recipe-page .recipe-actions .share-jump{border-radius:var(--btn-radius);min-height:44px;}
.recipe-actions .jump,.recipe-actions .share-jump{display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .9rem;border:1px solid var(--line-strong);background:var(--card);color:var(--ink);font-weight:650;font-size:.92rem;text-decoration:none;}
.recipe-actions .jump:hover,.recipe-actions .share-jump:hover{border-color:#000000;background:var(--surface-soft);text-decoration:none;}
.recipe-actions .print-open{background:var(--card);color:var(--ink);border:1px solid var(--line-strong);padding:.45rem 1rem;font-weight:600;cursor:pointer;font-size:.92rem;}
.recipe-actions .print-open:hover{border-color:#000000;}
.recipe-actions .cook-open{margin-left:auto;border:0;background:#000000;color:var(--yolk-gold);padding:.55rem 1.4rem;font-family:var(--font-display);font-weight:700;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;font-size:1.05rem;transition:background .15s,color .15s,transform .12s;}
.recipe-actions .cook-open:hover{background:var(--yolk-gold);color:#000000;transform:translateY(-1px);}
.langs{font-size:.9rem;color:var(--muted);display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;margin:.5rem 0 1rem;}
.langs a{display:inline-flex;align-items:center;min-height:44px;}
.recipe-page .langs .chip{min-height:0;border-radius:var(--btn-radius);border-color:var(--line-strong);background:var(--card);color:var(--ink);padding:.28rem .7rem;}
.untested,.machine-note,.tested-banner{border-radius:var(--btn-radius);border:1px solid var(--line);border-left:4px solid #000000;background:var(--card);color:var(--ink);padding:.75rem 1rem;margin:.75rem 0;font-size:.92rem;}
.untested .badge,.machine-note .badge,.tested-banner .badge{border-radius:2px;background:#000000;color:var(--yolk-gold);border:none;padding:.15rem .5rem;margin-right:.35rem;text-transform:uppercase;letter-spacing:.04em;font-size:.7rem;}
.recipe-body-grid{margin-top:1.75rem;}
.section-head{display:flex;align-items:center;justify-content:space-between;gap:.65rem;flex-wrap:wrap;margin-bottom:.75rem;}
.section-head h2,.steps-col>h2{margin:0;font-size:1.8rem;}
.steps-col>h2{margin-bottom:.75rem;}
.ing-tools{display:inline-flex;align-items:center;gap:.4rem;flex-wrap:wrap;}
.ing-progress{font-size:.78rem;font-weight:700;color:var(--muted);}
.copy-ing-btn{border:1px solid var(--line-strong);background:var(--card);color:var(--ink);border-radius:var(--btn-radius);padding:.3rem .62rem;font-size:.78rem;font-weight:650;cursor:pointer;min-height:34px;display:inline-flex;align-items:center;gap:.32rem;}
.copy-ing-btn:hover{border-color:#000000;background:#000000;color:var(--yolk-gold);}
.scaler,.unit-toggle{display:flex;flex-wrap:wrap;gap:.3rem;align-items:center;margin:0 0 .75rem;}
.scaler-label{color:var(--muted);font-size:.9rem;margin-right:.25rem;}
.scaler button,.unit-toggle button{border:1px solid var(--line-strong);background:var(--card);padding:.3rem .8rem;cursor:pointer;font-weight:600;font-size:.9rem;color:var(--ink);border-radius:var(--btn-radius);min-height:36px;}
.scaler button:hover,.unit-toggle button:hover{border-color:#000000;color:#000000;}
.scaler button[aria-pressed=true],.unit-toggle button[aria-pressed=true]{background:#000000;color:var(--yolk-gold);border-color:#000000;}
ul.ingredients{list-style:none;padding:0;margin:.5rem 0 0;}
ul.ingredients li{padding:.5rem 0;border-bottom:1px dashed var(--line);}
ul.ingredients li:last-child{border-bottom:0;}
ul.ingredients label{display:flex;gap:.55rem;align-items:flex-start;line-height:1.45;cursor:pointer;}
ul.ingredients input{transform:translateY(.22em);accent-color:#000000;width:1.1rem;height:1.1rem;flex-shrink:0;}
ul.ingredients input:checked ~ .line{text-decoration:line-through;color:var(--muted);}
ol.steps{list-style:none;padding:0;margin:.5rem 0 0;counter-reset:step;}
ol.steps li{counter-increment:step;position:relative;padding:.85rem 0 .85rem 3rem;margin:0;border-bottom:1px solid var(--line);line-height:1.68;}
ol.steps li:last-child{border-bottom:0;}
ol.steps li::before{content:counter(step,decimal-leading-zero);position:absolute;left:0;top:.85rem;width:2rem;height:2rem;border-radius:var(--btn-radius);background:#000000;color:var(--yolk-gold);display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:.95rem;font-weight:700;}
.step-text{display:block;}
.step-timer-chip{margin-top:.55rem;display:inline-flex;align-items:center;gap:.38rem;padding:.28rem .68rem;border:1px solid #000000;border-radius:var(--btn-radius);background:var(--card);color:#000000;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;min-height:34px;transition:background .15s,color .15s;}
.step-timer-chip:hover{background:var(--surface-soft);}
.step-timer-chip.is-running{background:#000000;color:var(--yolk-gold);}
.step-timer-chip.is-done{background:var(--yolk-gold);color:#000000;border-color:#000000;}
.step-timer-chip .fact-icon{width:14px;height:14px;}
.step-photo{margin:.75rem 0 0;max-width:420px;}
.step-photo img{width:100%;height:auto;border-radius:8px;border:1px solid var(--line);display:block;}
@media(min-width:820px){
  .recipe-body-grid{display:grid;grid-template-columns:minmax(290px,345px) minmax(0,1fr);gap:2.75rem;align-items:start;}
  .ingredients-col{position:sticky;top:4.75rem;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:1.35rem 1.4rem;}
}

/* Share bar + Source + Related Recipes */
.recipe-page .share{background:#000000;color:#ffffff;border-left:5px solid var(--yolk-gold);border-radius:var(--radius);padding:1.35rem 1.5rem;margin:2.5rem 0 0;display:flex;flex-direction:column;align-items:stretch;gap:.9rem;}
.share-head{display:flex;flex-direction:column;gap:.2rem;}
.share-head .share-label{color:var(--yolk-gold);font-family:var(--font-display);font-size:.95rem;text-transform:uppercase;letter-spacing:.06em;}
.share-head .share-label strong{color:#fff;font-family:var(--font-body);font-size:1.05rem;text-transform:none;letter-spacing:-.01em;}
.share-sub{color:#d4d4d8;font-size:.88rem;}
.share-buttons{display:flex;flex-wrap:wrap;gap:.5rem;}
.recipe-page .share button,.recipe-page .share a.share-link{border-radius:var(--btn-radius);min-height:40px;padding:.45rem .88rem;border:1px solid #3f3f46;background:#141416;color:#ffffff;font-weight:650;font-size:.85rem;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;cursor:pointer;transition:background .15s,color .15s,border-color .15s;}
.recipe-page .share button[hidden]{display:none;}
.recipe-page .share .share-copy,.recipe-page .share .share-native,.recipe-page .share .share-story-btn{background:var(--yolk-gold);color:#000000;border-color:var(--yolk-gold);font-weight:750;}
.recipe-page .share button:hover,.recipe-page .share a.share-link:hover{background:#ffffff;color:#000000;border-color:#ffffff;text-decoration:none;}
.share-more summary{cursor:pointer;color:var(--yolk-gold);font-weight:650;font-size:.88rem;min-height:40px;display:inline-flex;align-items:center;gap:.4rem;list-style:none;}
.share-more summary::-webkit-details-marker{display:none;}
.share-more summary::after{content:'';width:.45rem;height:.45rem;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .15s;}
.share-more[open] summary::after{transform:rotate(225deg) translateY(-1px);}
.share-more[open] summary{margin-bottom:.6rem;}
.recipe-source{color:var(--muted);font-size:.9rem;border-top:1px solid var(--line);margin-top:2rem;padding-top:1rem;}

.related-recipes{margin-top:2.25rem;padding-top:1.75rem;border-top:2px solid #000000;}
.related-recipes h2{margin:0 0 1rem;font-size:1.75rem;}
.related-grid{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;}
.related-card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.45rem;overflow:hidden;transition:border-color .15s,transform .18s;}
.related-card:hover{border-color:#000000;transform:translateY(-3px);}
.related-media{position:relative;aspect-ratio:4/3;margin:-1.1rem -1.2rem .45rem;overflow:hidden;background:var(--surface-soft);border-bottom:1px solid var(--line);}
.related-media img,.related-media .category-art-svg{width:100%;height:100%;object-fit:cover;display:block;transition:transform .24s ease;}
.related-card:hover .related-media img,.related-card:hover .related-media .category-art-svg{transform:scale(1.03);}
.related-media .thumb-label{position:absolute;top:.45rem;left:.45rem;bottom:auto;background:#ffffff;color:#000000;border:0;border-radius:2px;padding:.12rem .4rem;font-family:var(--font-display);font-size:.7rem;font-weight:700;text-transform:uppercase;}
.related-card .eyebrow{color:var(--muted);}
.related-card h3{font-size:1.25rem;line-height:1.1;margin:0;}
.related-card h3 a{color:var(--ink);text-decoration:none;}
.related-card h3 a.stretched::after{content:'';position:absolute;inset:0;}
.related-meta{margin-top:auto;padding-top:.4rem;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:.82rem;}
.related-arrow{color:#000000;font-weight:750;font-size:1.05rem;}

/* Cook Mode */
.cook-mode{position:fixed;inset:0;background:var(--bg);color:var(--ink);z-index:60;display:flex;}
.cook-mode[hidden]{display:none;}
.cook-inner{max-width:44rem;margin:auto;padding:1.5rem;width:100%;display:flex;flex-direction:column;gap:1.5rem;min-height:60vh;justify-content:center;}
.cook-top{display:flex;justify-content:space-between;align-items:center;color:var(--muted);}
.cook-close{background:var(--card);color:var(--ink);border:1px solid var(--line-strong);padding:.4rem 1rem;cursor:pointer;font-weight:600;}
.cook-step{font-family:var(--font-body);font-size:clamp(1.35rem,3.8vw,1.8rem);line-height:1.45;font-weight:500;margin:0;}
.cook-nav{display:flex;justify-content:space-between;gap:1rem;}
.cook-nav button{flex:1;background:#000000;color:var(--yolk-gold);border:0;padding:.8rem;font-family:var(--font-display);font-size:1.15rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;}
.cook-nav button:first-child{background:var(--card);color:var(--ink);border:1px solid var(--line-strong);}
.cook-timer{display:flex;gap:.75rem;align-items:center;}
.cook-timer[hidden]{display:none;}
.timer-btn{border:1px solid #000000;color:#000000;background:none;padding:.45rem 1rem;font-weight:600;cursor:pointer;}
.timer-display{font-size:1.4rem;font-weight:700;font-variant-numeric:tabular-nums;}
.cook-mode button{border-radius:var(--btn-radius);min-height:44px;}
.cook-bar{height:4px;background:var(--line);width:100%;overflow:hidden;}
.cook-bar-fill{height:100%;background:#000000;width:0%;transition:width .2s ease;}

/* Mobile bottom tab bar (N3) */
.mobile-tab-bar{display:none;}

/* Footer (Kingswood pitch-black bar + white underline input) */
.site-footer{background:#000000;color:#ffffff;border-top:1px solid #222224;margin-top:0;}
.site-footer .brand{color:#ffffff;}
.footer-inner{max-width:1280px;margin:0 auto;padding:2.75rem 3rem 1.75rem;display:grid;gap:2rem;grid-template-columns:1.6fr .85fr 1fr 1fr;}
.footer-note{color:#d4d4d8;font-size:.95rem;max-width:22rem;margin:.55rem 0 0;}
.footer-search-form{display:flex;align-items:stretch;max-width:22rem;margin:1rem 0 .25rem;border-bottom:1px solid #ffffff;}
.footer-search-form input{flex:1;min-width:0;min-height:40px;padding:.4rem .25rem .4rem 0;background:transparent;border:0;color:#ffffff;font:inherit;font-size:.9rem;}
.footer-search-form input::placeholder{color:#a1a1aa;}
.footer-search-form input:focus-visible{outline:none;}
.footer-search-form button{border:0;background:transparent;color:#ffffff;font-size:1.1rem;font-weight:700;padding:0 .5rem;cursor:pointer;min-width:36px;}
.footer-search-form button:hover{color:var(--yolk-gold);}
.footer-col{display:flex;flex-direction:column;align-items:flex-start;}
.footer-col h4{font-family:var(--font-display);font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#ffffff;margin:.25rem 0 .65rem;}
.footer-col a{color:#d4d4d8;text-decoration:none;font-size:.92rem;min-height:38px;display:inline-flex;align-items:center;gap:.45rem;}
.footer-col a:hover{color:var(--yolk-gold);}
.footer-social{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.8rem;}
.footer-social a{min-height:38px;min-width:38px;padding:.4rem;border:1px solid #3f3f46;color:#ffffff;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--btn-radius);transition:border-color .15s,color .15s,background .15s;}
.footer-social a:hover{border-color:var(--yolk-gold);color:#000000;background:var(--yolk-gold);}
.community-tag{font-size:.82rem;color:var(--yolk-gold);margin:.7rem 0 0;font-weight:650;}
.footer-fine{max-width:1280px;padding:1.1rem 3rem 2rem;margin:auto;color:#a1a1aa;font-size:.82rem;border-top:1px solid #222224;}

/* Phase 5 Growth Loops: Section heads, Remix CTA & Pantry Picker */
ul.ingredients li.ing-section-head{list-style:none;padding:.85rem 0 .25rem;border-bottom:1px solid var(--line);font-family:var(--font-display);font-size:1rem;text-transform:uppercase;letter-spacing:.06em;color:#000000;}
.remix-callout{margin:2rem 0 0;padding:1.25rem 1.4rem;border:1px solid var(--line);border-left:5px solid var(--yolk-gold);border-radius:var(--radius);background:var(--card);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;}
.remix-copy{flex:1 1 240px;min-width:0;}
.remix-copy h2{margin:0 0 .25rem;font-size:1.4rem;}
.remix-copy p{margin:0;color:var(--muted);font-size:.92rem;}
.remix-cta-link{display:inline-flex;align-items:center;gap:.4rem;padding:.65rem 1.15rem;background:#000000;color:var(--yolk-gold);border-radius:var(--btn-radius);font-family:var(--font-display);font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;min-height:44px;}
.remix-cta-link:hover{background:var(--yolk-gold);color:#000000;text-decoration:none;}
.remix-cta-link .social-icon{width:16px;height:16px;}
.pantry-picker{margin-top:.85rem;padding-top:.85rem;border-top:1px solid #26262a;display:grid;gap:.55rem;min-width:0;}
.pantry-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.25rem .75rem;}
.pantry-head h2{margin:0;font-size:1.25rem;color:var(--yolk-gold);}
.pantry-head span{font-size:.82rem;color:#d4d4d8;}
.pantry-selected{display:flex;flex-wrap:wrap;gap:.35rem;}
.pantry-selected-pill{background:var(--yolk-gold);color:#000000;border:1px solid var(--yolk-gold);border-radius:var(--btn-radius);font:inherit;font-size:.8rem;font-weight:750;padding:.24rem .6rem;cursor:pointer;}
.pantry-staples{display:flex;flex-wrap:wrap;gap:.35rem;}
.discovery .pantry-chip{cursor:pointer;min-height:36px;padding:.28rem .68rem;font-size:.82rem;}
.discovery .pantry-chip[aria-pressed="true"]{background:var(--yolk-gold);border-color:var(--yolk-gold);color:#000000;font-weight:750;}
.pantry-add-row{display:flex;flex-wrap:wrap;gap:.45rem;align-items:stretch;}
.pantry-add-row input{flex:1 1 180px;min-width:0;min-height:40px;padding:.4rem .75rem;background:#000000;border:1px solid #333338;border-radius:var(--btn-radius);color:#ffffff;font:inherit;font-size:.9rem;}
.pantry-add-row button.pantry-add-btn{background:#1c1c20;color:var(--yolk-gold);border:1px solid #3f3f46;border-radius:var(--btn-radius);font:inherit;font-weight:650;padding:.4rem .85rem;cursor:pointer;min-height:40px;}
.pantry-status{margin:0;font-size:.84rem;color:var(--yolk-gold);font-weight:600;}
.pantry-match-pill{display:inline-flex;align-items:center;gap:.25rem;font-size:.74rem;font-weight:750;padding:.14rem .45rem;background:rgb(255 209 102 / .14);color:var(--yolk-gold);border:1px solid rgb(255 209 102 / .45);border-radius:var(--btn-radius);margin:.25rem 0 0;align-self:flex-start;}
.empty-gap-prompts{margin-top:.85rem;padding-top:.85rem;border-top:1px solid #26262a;display:grid;gap:.45rem;justify-items:center;}
.empty-gap-prompts p{margin:0;font-size:.88rem;color:#d4d4d8;}
.empty-gap-chips{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;}

/* Dark & Light Explicit Theme Overrides + OS Preference (D1, D10) */
@media (prefers-color-scheme: dark){
  html:not([data-theme="light"]){color-scheme:dark;--bg:#0c0c0e;--card:#161619;--ink:#fafafa;--muted:#a1a1aa;--line:#27272a;--line-strong:#52525b;--brand:#ffd166;--brand-strong:#ffe08a;}
  html:not([data-theme="light"]) *:focus-visible{outline-color:var(--yolk-gold);}
  html:not([data-theme="light"]) .recipe-page .time-meta,html:not([data-theme="light"]) .recipe-page .untested,html:not([data-theme="light"]) .recipe-page .machine-note,html:not([data-theme="light"]) .recipe-page .tested-banner{border-left-color:var(--yolk-gold);}
  html:not([data-theme="light"]) .recipe-actions .cook-open,html:not([data-theme="light"]) .scaler button[aria-pressed=true],html:not([data-theme="light"]) .unit-toggle button[aria-pressed=true],html:not([data-theme="light"]) ol.steps li::before{background:var(--yolk-gold);color:#000000;border-color:var(--yolk-gold);}
  html:not([data-theme="light"]) .recipe-actions .jump:hover,html:not([data-theme="light"]) .recipe-actions .share-jump:hover,html:not([data-theme="light"]) .copy-ing-btn:hover,html:not([data-theme="light"]) .step-timer-chip.is-running{background:var(--yolk-gold);color:#000000;border-color:var(--yolk-gold);}
  html:not([data-theme="light"]) .step-timer-chip{border-color:var(--yolk-gold);color:var(--yolk-gold);}
  html:not([data-theme="light"]) .meter-dots span.is-on,html:not([data-theme="light"]) .time-seg-cook,html:not([data-theme="light"]) .cook-bar-fill{background:var(--yolk-gold);}
  html:not([data-theme="light"]) .recipe-page .contributor-avatar{background:var(--yolk-gold);color:#000000;}
  html:not([data-theme="light"]) .cooked-by-pill{background:#1c1917;color:var(--yolk-gold);border-color:#52525b;}
  html:not([data-theme="light"]) .related-recipes{border-top-color:var(--yolk-gold);}
  html:not([data-theme="light"]) .related-card:hover{border-color:var(--yolk-gold);}
  html:not([data-theme="light"]) .related-arrow{color:var(--yolk-gold);}
  html:not([data-theme="light"]) .remix-cta-link{background:var(--yolk-gold);color:#000000;}
}
html[data-theme="dark"]{color-scheme:dark;--bg:#0c0c0e;--card:#161619;--ink:#fafafa;--muted:#a1a1aa;--line:#27272a;--line-strong:#52525b;--brand:#ffd166;--brand-strong:#ffe08a;}
html[data-theme="dark"] *:focus-visible{outline-color:var(--yolk-gold);}
html[data-theme="dark"] .site-header *:focus-visible{outline-color:#000000;}
html[data-theme="dark"] .recipe-page .time-meta,html[data-theme="dark"] .recipe-page .untested,html[data-theme="dark"] .recipe-page .machine-note,html[data-theme="dark"] .recipe-page .tested-banner{border-left-color:var(--yolk-gold);}
html[data-theme="dark"] .recipe-actions .cook-open,html[data-theme="dark"] .scaler button[aria-pressed=true],html[data-theme="dark"] .unit-toggle button[aria-pressed=true],html[data-theme="dark"] ol.steps li::before{background:var(--yolk-gold);color:#000000;border-color:var(--yolk-gold);}
html[data-theme="dark"] .recipe-actions .jump:hover,html[data-theme="dark"] .recipe-actions .share-jump:hover,html[data-theme="dark"] .copy-ing-btn:hover,html[data-theme="dark"] .step-timer-chip.is-running{background:var(--yolk-gold);color:#000000;border-color:var(--yolk-gold);}
html[data-theme="dark"] .step-timer-chip{border-color:var(--yolk-gold);color:var(--yolk-gold);}
html[data-theme="dark"] .meter-dots span.is-on,html[data-theme="dark"] .time-seg-cook,html[data-theme="dark"] .cook-bar-fill{background:var(--yolk-gold);}
html[data-theme="dark"] .recipe-page .contributor-avatar{background:var(--yolk-gold);color:#000000;}
html[data-theme="dark"] .cooked-by-pill{background:#1c1917;color:var(--yolk-gold);border-color:#52525b;}
html[data-theme="dark"] ul.ingredients input{accent-color:var(--yolk-gold);}
html[data-theme="dark"] .related-recipes{border-top-color:var(--yolk-gold);}
html[data-theme="dark"] .related-card:hover{border-color:var(--yolk-gold);}
html[data-theme="dark"] .related-arrow{color:var(--yolk-gold);}
html[data-theme="dark"] .remix-cta-link{background:var(--yolk-gold);color:#000000;}

html[data-theme="light"] body{background:#faf8f3;}
html[data-theme="light"] main:not(.discovery){box-shadow:none;border-top-color:#000000;}
html[data-theme="light"] main.wide.discovery{background:#faf8f3;color:#111111;}
html[data-theme="light"] .after-hero{background:#faf8f3;border-bottom-color:#e4e2dc;}
html[data-theme="light"] .hero-mosaic{background:#faf8f3;}
html[data-theme="light"] .after-copy .eyebrow{color:#7c4a03;}
html[data-theme="light"] .after-copy h1,html[data-theme="light"] .index-heading h2,html[data-theme="light"] .index-heading h1,html[data-theme="light"] .index-group-title{color:#000000;}
html[data-theme="light"] .after-copy p,html[data-theme="light"] .index-heading p{color:#3f3f46;}
html[data-theme="light"] .discovery-cta{background:#000000;color:#ffffff;}
html[data-theme="light"] .discovery-cta:hover{background:var(--yolk-gold);color:#000000;}
html[data-theme="light"] .discovery-cta-secondary{color:#000000;border-color:#9c988f;}
html[data-theme="light"] .discovery .chip{color:#111111;background:#ffffff;border-color:#d4d4d8;}
html[data-theme="light"] .discovery .chip:hover{background:#f1f1f1;color:#000000;border-color:#000000;}
html[data-theme="light"] .discovery .chip[aria-current=page]{background:#000000;border-color:#000000;color:var(--yolk-gold);}
html[data-theme="light"] .cat-rail-ring{background:#ffffff;border-color:#d4d4d8;color:#000000;}
html[data-theme="light"] .cat-rail-label{color:#111111;}
html[data-theme="light"] .discovery .cat-rail .chip.cat-rail-item[aria-current=page]{background:transparent;color:#000000;}
html[data-theme="light"] .discovery .cat-rail .chip.cat-rail-item[aria-current=page] .cat-rail-ring{background:#000000;border-color:#000000;color:var(--yolk-gold);}
html[data-theme="light"] .discovery-search{background:#ffffff;color:#000000;border-color:#d4d4d8;}
html[data-theme="light"] .discovery-search::placeholder{color:#52525b;}
html[data-theme="light"] .discovery-search:focus{border-color:#000000;outline-color:#000000;}
html[data-theme="light"] .hero-search-row{background:#ffffff;border-color:#9c988f;}
html[data-theme="light"] .hero-search-row:focus-within{border-color:#000000;box-shadow:0 0 0 1px #000000;}
html[data-theme="light"] .hero-search input{color:#000000;}
html[data-theme="light"] .hero-search input::placeholder,html[data-theme="light"] .hero-search-icon{color:#52525b;}
html[data-theme="light"] .hero-search button{background:#000000;color:var(--yolk-gold);}
html[data-theme="light"] .hero-prompt{color:#000000;}
html[data-theme="light"] .hero-quick a{background:#ffffff;color:#111111;border-color:#d4d4d8;}
html[data-theme="light"] .hero-quick a:hover{background:#f1f1f1;border-color:#000000;color:#000000;}
html[data-theme="light"] .view-toggle{border-color:#d4d4d8;}
html[data-theme="light"] .view-toggle button{background:#ffffff;color:#3f3f46;}
html[data-theme="light"] .view-toggle button+button{border-color:#d4d4d8;}
html[data-theme="light"] .view-toggle button[aria-pressed="true"]{background:#000000;color:var(--yolk-gold);}
html[data-theme="light"] .discovery-list,html[data-theme="light"] .discovery-list li{border-color:#e4e2dc;}
html[data-theme="light"] .discovery-list[data-view="grid"] li{background:#ffffff;border:1px solid #e4e2dc;}
html[data-theme="light"] .discovery-list[data-view="grid"] li:hover{border-color:#000000;}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) h3 a{color:#000000;}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) .eyebrow{color:#52525b;}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) .contributor-link{color:#18181b;}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) .contributor-avatar{background:#000000;color:var(--yolk-gold);}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) .row-end .icon-stat,html[data-theme="light"] .discovery-list:not([data-view="grid"]) .recipe-number,html[data-theme="light"] .discovery-list:not([data-view="grid"]) .status-label{color:#52525b;border-color:#d4d4d8;}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) .save-btn{color:#000000;border-color:#d4d4d8;}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) .save-btn[aria-pressed="true"]{background:#000000;color:var(--yolk-gold);border-color:#000000;}
html[data-theme="light"] .discovery-list:not([data-view="grid"]) .row-end a,html[data-theme="light"] .see-all{color:#000000;}
html[data-theme="light"] .editorial-split{background:#111113;border-color:#111113;}
html[data-theme="light"] .search-page-form,html[data-theme="light"] .hub-hero,html[data-theme="light"] .hub-directory-card,html[data-theme="light"] .saved-sync-banner,html[data-theme="light"] .recent-links-list li,html[data-theme="light"] .inferred-note,html[data-theme="light"] .empty-search-card{background:#ffffff;border-color:#e4e2dc;color:var(--ink);}
html[data-theme="light"] .search-main-row,html[data-theme="light"] .search-filters select{background:#faf8f3;border-color:#9c988f;color:var(--ink);}
html[data-theme="light"] .search-main-row input{color:#000000;}
html[data-theme="light"] .search-main-row button,html[data-theme="light"] .apply-filters-btn{background:#000000;color:var(--yolk-gold);border-color:#000000;}
html[data-theme="light"] .search-filters label,html[data-theme="light"] .search-count,html[data-theme="light"] .hub-intro,html[data-theme="light"] .hub-directory-card p,html[data-theme="light"] .saved-sync-banner p,html[data-theme="light"] .discovery-index .crumbs a,html[data-theme="light"] .discovery-index .crumbs [aria-current="page"]{color:#3f3f46;}
html[data-theme="light"] .hub-hero h1,html[data-theme="light"] .hub-directory-card h2 a,html[data-theme="light"] .saved-section h2,html[data-theme="light"] .recent-links-list a,html[data-theme="light"] .cat-heading-link,html[data-theme="light"] .pantry-head h2{color:#000000;}
html[data-theme="light"] .pantry-picker,html[data-theme="light"] .empty-gap-prompts{border-color:#e4e2dc;}
html[data-theme="light"] .pantry-head span,html[data-theme="light"] .empty-gap-prompts p{color:#3f3f46;}
html[data-theme="light"] .pantry-add-row input{background:#faf8f3;border-color:#9c988f;color:#000000;}
html[data-theme="light"] .pantry-add-row button.pantry-add-btn{background:#f1f1f1;color:#000000;border-color:#9c988f;}
html[data-theme="light"] .pantry-selected-pill,html[data-theme="light"] .discovery .pantry-chip[aria-pressed="true"]{background:#000000;border-color:#000000;color:var(--yolk-gold);}
html[data-theme="light"] .pantry-match-pill{background:#fef3c7;color:#78350f;border-color:#f59e0b;}
html[data-theme="light"] .pantry-status{color:#9a6700;}
html[data-theme="light"] .btn-clear{color:#000000;border-color:#9c988f;}

/* Responsive & Mobile First-Screen Optimization (N2, N3, D6) */
@media(max-width:720px){
  body{padding-bottom:calc(4.75rem + env(safe-area-inset-bottom));}
  .header-inner{padding:.55rem 1rem;gap:.4rem;flex-wrap:nowrap;}
  .header-search-form,.site-nav a.nav-secondary,.header-tools{display:none !important;}
  .nav-search-mobile{display:inline-flex !important;}
  .site-nav{flex-wrap:nowrap;}
  .site-nav a.nav-search{min-width:42px;justify-content:center;border:1px solid #d4d4d8;}
  .nav-search-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
  .mobile-menu{display:block;}
  .brand-word{font-size:1.58rem;}
  .site-nav{gap:.15rem;}
  .site-nav a{font-size:.86rem;padding:.28rem .48rem;min-height:38px;}
  .site-nav a.nav-share-cta{padding:.3rem .65rem;}
  .after-hero{grid-template-columns:minmax(0,1fr);}
  .after-copy{padding:1.15rem 1rem 1rem;}
  .after-copy h1{font-size:clamp(2rem,8.5vw,2.65rem);margin:.4rem 0 .35rem;}
  .after-copy p{font-size:.92rem;line-height:1.45;margin:0 0 .75rem;}
  .hero-search{margin-bottom:.45rem;}
  .hero-search input{min-height:44px;}
  .hero-cta-row{display:none;}
  .after-copy p.hero-quick,.hero-quick{flex-wrap:nowrap;overflow-x:auto;width:100%;max-width:100%;scrollbar-width:none;margin-bottom:.25rem;padding-bottom:.15rem;}
  .hero-quick::-webkit-scrollbar{display:none;}
  .hero-quick a{flex:0 0 auto;min-height:34px;font-size:.8rem;padding:.25rem .65rem;}
  .identity-art{max-height:108px;border-radius:0;}
  .hero-mosaic{grid-template-columns:repeat(4,1fr);grid-template-rows:1fr;gap:4px;padding:0 1rem .75rem;min-height:92px;max-height:92px;}
  .mosaic-tile{border-radius:6px;}
  .mosaic-title{font-size:.74rem;-webkit-line-clamp:1;}
  .mosaic-badge{display:none;}
  .featured-recipe{grid-template-columns:minmax(0,1fr);gap:.6rem;padding:1.1rem 1rem;margin:.85rem 1rem 0;}
  .featured-recipe h2{font-size:1.7rem;}
  .featured-facts{justify-content:flex-start;}
  .discovery-index{padding:1.45rem 1rem 2.25rem;}
  .index-heading h2,.index-heading h1{font-size:1.85rem;}
  .discovery-toolbar{gap:.75rem;}
  .toolbar-controls{flex:1 1 auto;width:100%;flex-wrap:wrap;}
  .discovery-search-wrap{flex:1 1 180px;max-width:none;}
  .discovery .cat-rail .chip.cat-rail-item{min-width:74px;}
  .cat-rail-ring{width:46px;height:46px;}
  .discovery-list[data-view="grid"]{grid-template-columns:repeat(auto-fill,minmax(220px,1fr));}
  .discovery-list[data-view="list"] li{grid-template-columns:1.5rem minmax(0,1fr) auto;gap:.55rem;padding:1.15rem .35rem;margin:0 -.35rem;}
  .discovery-list[data-view="list"] li.has-thumb{grid-template-columns:1.5rem 3.8rem minmax(0,1fr) auto;}
  .discovery-list[data-view="list"] .recipe-thumb{width:3.8rem;}
  .discovery-list[data-view="list"] .recipe-thumb img,.discovery-list[data-view="list"] .recipe-thumb .category-art-svg{width:3.8rem;height:3.8rem;}
  .discovery-list h3{font-size:1.25rem;}
  .row-end{min-width:52px;}
  .row-end .icon-stat{font-size:.7rem;gap:.2rem;}
  .editorial-splits{padding:0 1rem 2.25rem;gap:1rem;}
  .editorial-split{grid-template-columns:minmax(0,1fr);min-height:0;}
  .editorial-split--flip .editorial-split-copy{order:0;}
  .editorial-split-copy{padding:1.5rem 1.25rem;}
  .editorial-jumbo{font-size:clamp(2.45rem,11.5vw,3.4rem);}
  .editorial-split-media{min-height:210px;max-height:240px;}
  .hub-hero{grid-template-columns:minmax(0,1fr);padding:1.1rem;}
  .recipe-page{padding:1.25rem 1rem 3rem;}
  .recipe-actions{top:3.6rem;padding:.55rem 0;}
  .recipe-page h1{font-size:2.15rem;}
  .recipe-actions .cook-open{margin-left:0;width:100%;}
  .steps-col>h2{margin-top:1.75rem;}
  .footer-inner{grid-template-columns:1fr 1fr;padding:2rem 1rem 1.25rem;}
  .footer-fine{padding:1rem 1rem 2rem;}
  .mobile-tab-bar{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;bottom:0;left:0;right:0;z-index:35;background:#000000;border-top:1px solid #222224;padding:.25rem .25rem calc(.25rem + env(safe-area-inset-bottom));}
  .mobile-tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.16rem;color:#a1a1aa;text-decoration:none;font-size:.7rem;font-weight:600;padding:.35rem .2rem;min-height:48px;}
  .mobile-tab .social-icon{width:18px;height:18px;}
  .mobile-tab[aria-current="page"]{color:var(--yolk-gold);font-weight:750;}
  .mobile-tab--share{color:var(--yolk-gold);}
  .mobile-tab--share .social-icon{background:var(--yolk-gold);color:#000000;border-radius:999px;padding:2px;width:22px;height:22px;}
  .tab-icon-wrap{position:relative;display:inline-flex;}
  .tab-badge{position:absolute;top:-5px;right:-10px;min-width:16px;height:16px;padding:0 3px;background:var(--yolk-gold);color:#000000;font-size:.66rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;}
}
@media(max-width:480px){
  .footer-inner{grid-template-columns:1fr;}
}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto !important;}
  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;}
  .discovery-list[data-view="grid"] li:hover,.related-card:hover,.hub-directory-card:hover,.featured-recipe:hover h2 .icon-arrow,.mosaic-tile:hover img,.discovery-list[data-view="grid"] li:hover .recipe-thumb img,.discovery-list[data-view="grid"] li:hover .recipe-thumb .category-art-svg,.discovery-list[data-view="grid"] li:hover .card-art-fallback .category-art-svg,.cat-rail-item:hover .cat-rail-ring,.editorial-split:hover .editorial-split-media img{transform:none !important;}
}
@media print{
  body,.site-header,.site-footer,main,main.wide.discovery{background:white !important;color:black !important;padding-bottom:0 !important;box-shadow:none !important;border:0 !important;}
  .share,.site-header,.site-footer,.recipe-actions,.scaler,.unit-toggle,.cook-mode,.langs,.crumbs-nav,.related-recipes,.remix-callout,.copy-ing-btn,.ing-progress,.theme-toggle,.view-toggle,.mobile-tab-bar,.search-sheet,.save-btn,.step-timer-chip,.ing-icon,.editorial-splits{display:none !important;}
  main{max-width:none;}
  .recipe-page{border:0;padding:0;}
  .recipe-body-grid{display:block;}
  .ingredients-col{position:static;border:0;padding:0;}
  ul.ingredients input{display:none;}
  ul.ingredients li{border-bottom:0;}
}
`;

/** Backwards-compatible alias while transitioning callers to DESIGN_SYSTEM_CSS. */
export const AFTER_HOURS_CSS = DESIGN_SYSTEM_CSS;
