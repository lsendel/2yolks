/** Selected visual direction 3. Decorative art is local, separate from recipe media. */
export const AFTER_HOURS_CSS = `
:root {--plum:#211729;--plum-elev:#2b1e35;--lime:#e0fa80;--lime-hover:#ecff9e;--yolk-gold:#ffd166;--brand:#493253;--brand-strong:#302038;--ink:#261b2c;--muted:#64586a;--bg:#faf8f3;--card:#fffdf8;--line:#d7d0cc;--line-strong:#827384;--radius:0;--font-display:'Fraunces',Georgia,'Times New Roman',serif;}
html {scroll-behavior:smooth;scroll-padding-top:4.75rem;}
body {background:var(--plum);}
h1,h2,h3 {font-family:var(--font-display);letter-spacing:-.02em;font-weight:650;font-variation-settings:'SOFT' 35,'WONK' 0;}
h1 {font-size:clamp(2rem,5vw,3.2rem);line-height:1.06;}
.time-meta,.scaler,.ing-progress,.cook-progress,ul.ingredients {font-variant-numeric:tabular-nums;}
a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible {outline:3px solid #9d6cb0;outline-offset:3px;}
/* Header & Navigation */
.site-header {background:var(--plum);border-bottom:1px solid #605469;color:var(--lime);position:sticky;top:0;z-index:30;}
.header-inner {max-width:1160px;padding:.85rem 1.5rem;gap:.65rem 1.15rem;}
.brand {color:inherit;gap:.48rem;align-items:center;}
.brand-word {font-family:var(--font-display);font-weight:700;font-size:1.82rem;letter-spacing:-.035em;line-height:1;}
.brand-yolks-svg {width:2.15rem;height:1.25rem;flex-shrink:0;color:var(--lime);overflow:visible;}
.brand-yolks-svg .yolk-one,.brand-yolks-svg .yolk-two {transition:transform .22s ease;}
.brand:hover .brand-yolks-svg .yolk-one {transform:translateX(-1.2px);}
.brand:hover .brand-yolks-svg .yolk-two {transform:translate(1.8px,-1px);}
.site-nav {margin-left:auto;display:flex;align-items:center;flex-wrap:wrap;gap:.2rem;}
.site-nav a,.language-nav a {color:var(--lime);font-weight:500;font-size:.88rem;border-radius:0;min-height:42px;display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .6rem;text-decoration:none;transition:background .15s,color .15s;}
.site-nav a:hover,.language-nav a:hover {background:#3b2d43;color:var(--lime);}
.site-nav a.nav-share-cta {background:var(--lime);color:var(--plum);font-weight:750;padding:.38rem .8rem;margin-left:.25rem;border:1px solid var(--lime);}
.site-nav a.nav-share-cta:hover {background:var(--lime-hover);color:var(--plum);}
.site-nav a.nav-share-cta .social-icon {width:15px;height:15px;}
.header-tools {display:inline-flex;align-items:center;gap:.35rem;}
.language-nav {display:flex;flex-wrap:wrap;gap:0 .1rem;align-items:center;}
.language-nav a[aria-current=page] {text-decoration:underline;text-underline-offset:6px;font-weight:700;}
.theme-toggle {background:transparent;color:var(--lime);border:1px solid #65566e;border-radius:0;min-height:38px;min-width:38px;padding:.35rem .55rem;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;cursor:pointer;font:inherit;font-size:.78rem;font-weight:600;transition:border-color .15s,background .15s;}
.theme-toggle:hover {border-color:var(--lime);background:#3b2d43;}
.theme-toggle .social-icon {width:16px;height:16px;}
.theme-toggle .icon-sun {display:none;}
html[data-theme="dark"] .theme-toggle .icon-sun {display:inline-block;}
html[data-theme="dark"] .theme-toggle .icon-moon {display:none;}
/* Inline SVG sizing */
.icon-arrow {width:1.05em;height:1.05em;vertical-align:-.14em;flex-shrink:0;transition:transform .16s ease;}
.cat-icon {width:16px;height:16px;flex-shrink:0;opacity:.92;}
.social-icon {width:16px;height:16px;flex-shrink:0;}
/* Utilities */
.visually-hidden {position:absolute !important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
/* Header search + compact mobile menu */
.header-search-form {position:relative;display:flex;align-items:stretch;flex:1 1 200px;max-width:270px;min-width:170px;background:#2b1f35;border:1px solid #6e5f78;}
.header-search-form:focus-within {border-color:var(--lime);box-shadow:0 0 0 2px var(--lime);}
.header-search-icon {position:absolute;left:.65rem;top:50%;transform:translateY(-50%);width:15px;height:15px;color:#cbbdd4;pointer-events:none;}
.header-search-form input {flex:1;min-width:0;min-height:38px;padding:.35rem .5rem .35rem 2.05rem;background:transparent;border:0;color:#faf7f4;font:inherit;font-size:.86rem;}
.header-search-form input::placeholder {color:#b8abc2;}
.header-search-form input:focus-visible {outline:none;}
.header-search-form button {border:0;background:#3b2d43;color:var(--lime);font:inherit;font-size:.8rem;font-weight:700;padding:0 .75rem;cursor:pointer;border-left:1px solid #6e5f78;}
.header-search-form button:hover {background:var(--lime);color:var(--plum);}
.search-popover {position:absolute;left:0;right:0;top:calc(100% + 4px);background:var(--plum-elev);border:1px solid var(--lime);padding:.65rem .75rem;z-index:45;box-shadow:0 16px 32px rgb(0 0 0 / .45);display:grid;gap:.55rem;min-width:260px;}
.search-popover[hidden] {display:none !important;}
.suggest-heading {margin:0;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--lime);font-weight:750;}
.suggest-list {list-style:none;margin:0;padding:0;display:grid;gap:.15rem;}
.suggest-list a,.suggest-fallback-link {display:block;padding:.35rem .45rem;color:#faf7f4;text-decoration:none;font-size:.86rem;font-weight:550;border-bottom:1px solid #3d2f47;}
.suggest-list a:hover,.suggest-fallback-link:hover {background:#3b2d43;color:var(--lime);}
.nav-search-mobile {display:none !important;}
.site-nav a.nav-search .social-icon {width:17px;height:17px;}
.nav-saved-link {position:relative;}
.saved-count {display:inline-flex;align-items:center;justify-content:center;min-width:1.25rem;height:1.25rem;padding:0 .3rem;background:var(--lime);color:var(--plum);font-size:.72rem;font-weight:800;line-height:1;}
.mobile-menu {display:none;}
.mobile-menu summary {list-style:none;cursor:pointer;color:var(--lime);border:1px solid #65566e;min-height:42px;min-width:42px;display:inline-flex;align-items:center;justify-content:center;}
.mobile-menu summary::-webkit-details-marker {display:none;}
.mobile-menu summary .social-icon {width:20px;height:20px;}
.mobile-menu[open] summary {background:var(--lime);color:var(--plum);border-color:var(--lime);}
.mobile-menu-panel {position:absolute;left:0;right:0;top:100%;background:var(--plum);border-bottom:1px solid #605469;padding:.5rem 1rem 1rem;display:flex;flex-direction:column;gap:.35rem;box-shadow:0 18px 30px rgb(0 0 0 / .35);}
.mobile-menu-panel nav {display:flex;flex-direction:column;}
.mobile-menu-panel nav a {color:#faf7f4;text-decoration:none;font-weight:600;font-size:1.05rem;min-height:48px;display:flex;align-items:center;border-bottom:1px solid #3d2f47;}
.mobile-menu-panel nav a.mobile-sub-link {padding-left:1rem;font-size:.94rem;color:#d8cedf;}
.mobile-menu-panel nav a:hover {color:var(--lime);}
.mobile-menu-panel .mobile-menu-langs {flex-direction:row;gap:1rem;}
.mobile-menu-panel .mobile-menu-langs a {font-size:.92rem;color:var(--lime);border-bottom:0;}
.mobile-menu-panel .mobile-menu-langs a[aria-current=page] {text-decoration:underline;text-underline-offset:6px;}
.theme-toggle-menu {align-self:flex-start;margin-top:.35rem;padding:.45rem .75rem;}
/* Full-screen search sheet */
.search-sheet {position:fixed;inset:0;z-index:65;background:var(--plum);color:#faf7f4;padding:1rem 1rem 5.5rem;overflow-y:auto;display:flex;flex-direction:column;gap:1rem;}
.search-sheet[hidden] {display:none !important;}
.search-sheet-head {display:flex;align-items:center;justify-content:space-between;gap:1rem;border-bottom:1px solid #605469;padding-bottom:.65rem;}
.search-sheet-title {font-family:var(--font-display);font-size:1.35rem;font-weight:700;color:var(--lime);}
.search-sheet-close {background:#2b1f35;color:var(--lime);border:1px solid #6e5f78;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;}
.search-sheet-form {display:flex;align-items:stretch;background:#2b1f35;border:1px solid var(--lime);}
.search-sheet-form input {flex:1;min-width:0;min-height:50px;padding:.6rem .9rem;background:transparent;border:0;color:#faf7f4;font:inherit;font-size:1rem;}
.search-sheet-form input::placeholder {color:#b8abc2;}
.search-sheet-form button {border:0;background:var(--lime);color:var(--plum);font:inherit;font-weight:750;padding:0 1.15rem;cursor:pointer;}
.search-sheet-section h3 {margin:0 0 .45rem;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:#ded5e4;font-family:var(--font-body);}
.search-sheet-row {display:flex;align-items:center;justify-content:space-between;gap:.5rem;}
.quiet-link {background:transparent;border:0;color:var(--lime);font:inherit;font-size:.8rem;cursor:pointer;text-decoration:underline;padding:.25rem 0;}
.search-sheet-chips {display:flex;flex-wrap:wrap;gap:.45rem;}
.search-sheet .chip {color:var(--lime);border:1px solid #6e5f78;background:#2b1f35;padding:.4rem .75rem;text-decoration:none;font-size:.86rem;font-weight:600;min-height:38px;display:inline-flex;align-items:center;}
/* Hero search */
.hero-search {display:flex;flex-direction:column;gap:.45rem;width:100%;max-width:31rem;margin:0 0 .8rem;}
.hero-prompt {font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--lime);}
.hero-search-row {display:flex;align-items:stretch;width:100%;background:#2b1f35;border:1px solid #87798e;position:relative;}
.hero-search-row:focus-within {border-color:var(--lime);box-shadow:0 0 0 2px var(--lime);}
.hero-search-icon {position:absolute;left:.9rem;top:50%;transform:translateY(-50%);width:18px;height:18px;color:#cbbdd4;pointer-events:none;}
.hero-search input {flex:1;min-width:0;min-height:52px;padding:.6rem .9rem .6rem 2.6rem;background:transparent;border:0;color:#faf7f4;font:inherit;font-size:1rem;}
.hero-search input::placeholder {color:#b8abc2;}
.hero-search input:focus-visible {outline:none;}
.hero-search button {border:0;background:var(--lime);color:var(--plum);font:inherit;font-weight:750;padding:0 1.2rem;cursor:pointer;}
.hero-search button:hover {background:var(--lime-hover);}
.hero-quick {display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 1.6rem !important;max-width:none !important;}
.hero-quick a {color:var(--lime);border:1px solid #65566e;padding:.3rem .7rem;font-size:.84rem;font-weight:600;text-decoration:none;min-height:36px;display:inline-flex;align-items:center;}
.hero-quick a:hover {border-color:var(--lime);background:#3b2d43;}
/* Main & Discovery */
main {background:var(--bg);color:var(--ink);transition:background-color .18s ease,color .18s ease;}
main.wide.discovery {max-width:1160px;padding:0;margin:auto;background:var(--plum);color:#faf7f4;}
.eyebrow {font-family:var(--font-body);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;font-weight:650;}
.after-hero {display:grid;grid-template-columns:1.1fr 1fr;border-bottom:1px solid #64566a;}
.after-copy {padding:3.5rem 3rem 3rem;display:flex;flex-direction:column;align-items:flex-start;}
.after-copy .eyebrow {color:var(--lime);}
.after-copy h1 {color:var(--lime);font-size:clamp(2.35rem,5.5vw,4.55rem);line-height:1.01;letter-spacing:-.025em;margin:1.25rem 0;max-width:13.5ch;}
.after-copy p {max-width:31ch;font-size:1.08rem;line-height:1.58;color:#ede6f0;margin:0 0 1.8rem;}
.hero-cta-row {display:flex;flex-wrap:wrap;gap:.75rem;width:100%;margin-top:auto;}
.discovery-cta {display:inline-flex;justify-content:space-between;align-items:center;gap:1.5rem;padding:.95rem 1.25rem;background:var(--lime);color:var(--plum);font-weight:750;text-decoration:none;min-width:210px;transition:background .15s,transform .15s;}
.discovery-cta:hover {background:var(--lime-hover);transform:translateY(-2px);}
.discovery-cta:hover .icon-arrow {transform:translate(2px,-2px);}
.discovery-cta-secondary {display:inline-flex;align-items:center;gap:.5rem;padding:.95rem 1.15rem;border:1px solid #87798e;color:#faf7f4;font-weight:650;text-decoration:none;transition:border-color .15s,color .15s;}
.discovery-cta-secondary:hover {border-color:var(--lime);color:var(--lime);}
.identity-art {position:relative;margin:0;min-width:0;overflow:hidden;}
.identity-art img {width:100%;height:100%;object-fit:cover;display:block;}
.identity-art figcaption {position:absolute;bottom:.6rem;right:.6rem;left:.6rem;margin-left:auto;max-width:205px;background:#faf8f3ed;color:var(--plum);font-size:.66rem;line-height:1.35;padding:.45rem .55rem;}
.featured-recipe {position:relative;display:grid;grid-template-columns:1.15fr 1fr;gap:2rem;padding:2.35rem 3rem;background:var(--lime);color:var(--plum);transition:background .15s;}
.featured-recipe:hover {background:#e7fc94;}
.featured-recipe h2 {font-size:clamp(1.8rem,4vw,3.1rem);line-height:1.06;max-width:17ch;margin:.5rem 0 0;}
.featured-recipe h2 a {color:inherit;text-decoration:none;display:inline-flex;align-items:baseline;gap:.55rem;flex-wrap:wrap;}
.featured-recipe h2 a::after {content:'';position:absolute;inset:0;}
.featured-recipe:hover h2 .icon-arrow {transform:translate(3px,-3px);}
.featured-facts {display:flex;align-items:center;justify-content:flex-end;gap:.6rem;flex-wrap:wrap;}
.icon-stat {display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;}
.fact-icon {width:17px;height:17px;flex-shrink:0;vertical-align:middle;}
.featured-facts>span {border:1px solid currentColor;padding:.4rem .65rem;font-size:.82rem;font-weight:600;}
.discovery-index {padding:2.5rem 3rem 3.5rem;scroll-margin-top:4.5rem;}
.index-heading {display:flex;gap:1rem;align-items:baseline;justify-content:space-between;flex-wrap:wrap;}
.index-heading h2 {font-size:2.2rem;color:var(--lime);margin:0;}
.index-heading p {font-size:.88rem;margin:0;color:#ded6df;}
.discovery-toolbar {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1rem;margin:1.25rem 0 1.75rem;}
.discovery .cat-nav {margin:0;gap:.4rem;flex:1 1 520px;}
.discovery .chip {background:transparent;color:#f6f1f7;border:1px solid #87798e;border-radius:0;min-height:42px;font-weight:500;font-size:.84rem;padding:.45rem .8rem;gap:.4rem;transition:border-color .15s,background .15s,color .15s;}
.discovery .chip:hover {border-color:var(--lime);color:var(--lime);}
.discovery .chip[aria-current=page] {background:var(--lime);border-color:var(--lime);color:var(--plum);font-weight:700;}
.toolbar-controls {display:flex;align-items:center;gap:.6rem;flex:0 1 380px;justify-content:flex-end;}
.discovery-search-wrap {flex:1 1 240px;min-width:190px;}
.discovery-search {width:100%;min-height:42px;padding:.48rem .85rem;background:#2b1f35;border:1px solid #87798e;border-radius:0;color:#faf7f4;font:inherit;font-size:.88rem;}
.discovery-search::placeholder {color:#b8abc2;}
.discovery-search:focus {border-color:var(--lime);outline:2px solid var(--lime);outline-offset:1px;}
.view-toggle {display:inline-flex;border:1px solid #87798e;}
.view-toggle button {background:transparent;color:#ded5e4;border:0;min-height:40px;padding:.4rem .65rem;display:inline-flex;align-items:center;gap:.35rem;cursor:pointer;font:inherit;font-size:.78rem;font-weight:600;}
.view-toggle button+button {border-left:1px solid #87798e;}
.view-toggle button[aria-pressed="true"] {background:var(--lime);color:var(--plum);font-weight:750;}
/* Discovery List View (default) */
.lang-notice {display:flex;align-items:center;flex-wrap:wrap;gap:.5rem .75rem;margin:0 0 1.25rem;padding:.6rem .9rem;border:1px solid #65566e;border-radius:10px;color:#faf7f4;font-size:.95rem;}
.lang-notice .chip {min-height:0;}
.discovery-list {list-style:none;padding:0;margin:0;border-bottom:1px solid #65566e;}
.index-group {margin-top:2rem;}
.index-group[hidden] {display:none !important;}
.index-group-head {display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin:0 0 .4rem;}
.index-group-title {display:inline-flex;align-items:center;gap:.5rem;font-size:1.15rem;margin:0;color:#faf7f4;}
.see-all {display:inline-flex;align-items:center;gap:.3rem;color:var(--lime);font-weight:650;text-decoration:none;font-size:.95rem;min-height:44px;}
.see-all:hover {text-decoration:underline;}
.discovery-list li {position:relative;display:grid;grid-template-columns:2.2rem minmax(0,1fr) auto;gap:1rem;border-top:1px solid #65566e;padding:1.3rem .75rem;margin:0 -.75rem;transition:background .15s,border-color .15s,transform .15s;}
.discovery-list li.has-thumb {grid-template-columns:2.2rem 4.75rem minmax(0,1fr) auto;}
.recipe-thumb {display:flex;flex-direction:column;align-items:center;gap:.25rem;width:4.75rem;}
.recipe-thumb img {width:4.75rem;height:4.75rem;object-fit:cover;display:block;border-radius:4px;border:1px solid #65566e;}
/* The honesty label is readable plain text below the image, never a tiny overlay on top of it. */
.thumb-label {font-size:.73rem;line-height:1.25;text-align:center;color:#d2c2da;}
.discovery-list li[hidden] {display:none !important;}
.discovery-list li:hover {background:rgb(224 250 128 / .06);}
.recipe-number {font-size:.75rem;font-weight:700;color:#c6b9cd;padding-top:.2rem;font-variant-numeric:tabular-nums;}
.discovery-list h3 {font-size:1.42rem;line-height:1.2;margin:.12rem 0 .38rem;}
.discovery-list h3 a {color:#faf7f4;text-decoration:none;}
.discovery-list h3 a.stretched-row::after {content:'';position:absolute;inset:0;z-index:1;}
.discovery-list a:hover {text-decoration:underline;}
.discovery-list .eyebrow {display:inline-flex;align-items:center;gap:.35rem;color:var(--lime);font-weight:650;margin-bottom:.15rem;opacity:.95;}
.card-intro {display:none;font-size:.88rem;line-height:1.48;color:#d8cedf;margin:.2rem 0 .55rem;}
.row-badges {display:flex;flex-wrap:wrap;gap:.35rem .6rem;align-items:center;}
.status-label {color:#d8cedf;border:1px solid #756580;padding:.08rem .48rem;font-size:.73rem;font-weight:550;}
.tested-badge {display:inline-flex;align-items:center;gap:.28rem;background:var(--lime);color:var(--plum);padding:.1rem .52rem;font-size:.73rem;font-weight:750;}
.tested-badge .fact-icon {width:13px;height:13px;}
.featured-recipe .status-label {color:var(--plum);border-color:var(--plum);}
.featured-recipe .tested-badge {background:var(--plum);color:var(--lime);}
.fallback-language,.provenance-badge {display:inline-block;font-size:.73rem;color:#dfd7e4;border:1px solid #756580;padding:.08rem .45rem;}
.row-end {display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:.5rem;min-width:72px;}
.row-end-actions {display:inline-flex;align-items:center;gap:.35rem;position:relative;z-index:2;}
.save-btn {position:relative;z-index:2;background:transparent;color:#ded5e4;border:1px solid #756580;min-width:38px;min-height:38px;padding:.3rem .5rem;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;cursor:pointer;font:inherit;font-size:.84rem;font-weight:650;transition:background .15s,color .15s,border-color .15s;}
.save-btn:hover {border-color:var(--lime);color:var(--lime);}
.save-btn .icon-heart-filled {display:none;}
.save-btn[aria-pressed="true"] {background:var(--lime);color:var(--plum);border-color:var(--lime);}
.save-btn[aria-pressed="true"] .icon-heart-outline {display:none;}
.save-btn[aria-pressed="true"] .icon-heart-filled {display:inline-block;}
.save-btn--labeled {padding:.42rem .85rem;min-height:44px;}
.recipe-page .save-btn {color:var(--ink);border-color:var(--line-strong);background:var(--card);}
.recipe-page .save-btn:hover {border-color:var(--plum);color:var(--plum);}
.recipe-page .save-btn[aria-pressed="true"] {background:var(--plum);color:var(--lime);border-color:var(--plum);}
.related-card .save-btn {color:var(--ink);border-color:var(--line-strong);background:var(--card);min-width:34px;min-height:34px;padding:.25rem .42rem;}
.related-card .save-btn[aria-pressed="true"] {background:var(--plum);color:var(--lime);border-color:var(--plum);}
.row-end .icon-stat {font-size:.78rem;color:#ded5e4;}
.row-end .fact-icon {width:14px;height:14px;}
.row-end a {color:var(--lime);font-size:1.35rem;line-height:1;text-decoration:none;min-height:34px;min-width:34px;display:inline-flex;align-items:center;justify-content:flex-end;transition:transform .15s;}
.discovery-list li:hover .row-end a {transform:translate(3px,-3px);}
.cat-heading-link {color:inherit;text-decoration:none;}
.cat-heading-link:hover {color:var(--lime);text-decoration:underline;}
.home-browse-all {margin:2rem 0 0;display:flex;justify-content:center;}
/* Search page & filters (Q3, Q4) */
.search-page .crumbs-nav,.discovery-index .crumbs-nav {margin-bottom:.75rem;}
.discovery-index .crumbs a,.discovery-index .crumbs [aria-current="page"] {color:#dfd7e4;}
.discovery-index .crumbs a:hover {color:var(--lime);}
.search-page-form {display:grid;gap:.9rem;margin:1.25rem 0 1rem;background:var(--plum-elev);border:1px solid #65566e;padding:1rem 1.1rem;}
.search-main-row {display:flex;align-items:stretch;background:#211729;border:1px solid #87798e;position:relative;}
.search-main-row:focus-within {border-color:var(--lime);box-shadow:0 0 0 2px var(--lime);}
.search-bar-icon {position:absolute;left:.85rem;top:50%;transform:translateY(-50%);width:18px;height:18px;color:#cbbdd4;pointer-events:none;}
.search-main-row input {flex:1;min-width:0;min-height:48px;padding:.55rem .85rem .55rem 2.5rem;background:transparent;border:0;color:#faf7f4;font:inherit;font-size:1rem;}
.search-main-row button {border:0;background:var(--lime);color:var(--plum);font:inherit;font-weight:750;padding:0 1.25rem;cursor:pointer;}
.search-filters {display:flex;flex-wrap:wrap;gap:.75rem 1rem;align-items:flex-end;}
.search-filters label {display:grid;gap:.3rem;font-size:.78rem;font-weight:650;color:#dfd7e4;flex:1 1 145px;}
.search-filters select {min-height:40px;padding:.35rem .55rem;background:#211729;color:#faf7f4;border:1px solid #756580;font:inherit;font-size:.86rem;}
.search-filters label.filter-check {display:inline-flex;align-items:center;gap:.45rem;flex:0 1 auto;min-height:40px;font-size:.86rem;cursor:pointer;}
.search-filters label.filter-check input {width:1rem;height:1rem;accent-color:var(--lime);}
.apply-filters-btn {min-height:40px;padding:.4rem 1rem;background:transparent;color:var(--lime);border:1px solid var(--lime);font:inherit;font-weight:700;font-size:.86rem;cursor:pointer;}
.apply-filters-btn:hover {background:var(--lime);color:var(--plum);}
.filter-pills {display:flex;flex-wrap:wrap;gap:.45rem;margin:.75rem 0;}
.active-filter-chip {background:#3b2d43 !important;border-color:var(--lime) !important;color:var(--lime) !important;font-weight:650 !important;}
.inferred-note {margin:.5rem 0 1rem;padding:.55rem .85rem;border-left:3px solid var(--yolk-gold);background:#2b1e35;color:#ede5f0;font-size:.86rem;}
.search-results-bar {display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin:.75rem 0 1rem;}
.search-count {margin:0;font-size:.9rem;font-weight:650;color:#ded5e4;}
.pagination {display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-top:1.75rem;padding-top:1rem;border-top:1px solid #65566e;}
.pagination-info {font-size:.88rem;color:#ded5e4;}
/* Category / Collection / Cuisine Hubs (N4, N5) */
.hub-hero {display:grid;grid-template-columns:1.3fr minmax(0,260px);gap:1.5rem;align-items:center;padding:1.4rem 1.5rem;background:var(--plum-elev);border:1px solid #65566e;margin-bottom:1.25rem;}
.hub-hero .eyebrow {color:var(--lime);display:inline-flex;align-items:center;gap:.35rem;}
.hub-hero h1 {color:var(--lime);margin:.35rem 0 .6rem;}
.hub-intro {margin:0 0 1rem;color:#ede6f0;max-width:58ch;font-size:1rem;}
.hub-actions {display:flex;flex-wrap:wrap;gap:.5rem;}
.hub-hero-media {margin:0;}
.hub-hero-media img {width:100%;height:175px;object-fit:cover;display:block;border:1px solid #756580;}
.hub-hero-media figcaption {font-size:.74rem;color:#d2c2da;margin-top:.3rem;}
.hub-related-nav {margin:.5rem 0 1rem;}
.hub-directory-grid {list-style:none;padding:0;margin:1.25rem 0 0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1rem;}
.hub-directory-card {position:relative;background:var(--plum-elev);border:1px solid #65566e;padding:1.2rem;display:grid;gap:.45rem;transition:border-color .15s,transform .15s;}
.hub-directory-card:hover {border-color:var(--lime);transform:translateY(-2px);}
.hub-directory-card .eyebrow {color:var(--lime);display:inline-flex;align-items:center;gap:.35rem;}
.hub-directory-card h2 {margin:0;font-size:1.35rem;}
.hub-directory-card h2 a {color:#faf7f4;text-decoration:none;}
.hub-directory-card h2 a.stretched::after {content:'';position:absolute;inset:0;}
.hub-directory-card p {margin:0;color:#d8cedf;font-size:.9rem;line-height:1.48;}
/* Saved & Recently viewed (N6) */
.saved-sync-banner {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;padding:.9rem 1.1rem;border:1px solid #756580;border-left:4px solid var(--lime);background:var(--plum-elev);margin:1rem 0 1.25rem;}
.saved-sync-banner p {margin:0;font-size:.92rem;color:#ede6f0;}
.saved-section {margin-top:1.5rem;}
.saved-section h2 {color:var(--lime);margin:0 0 .85rem;font-size:1.4rem;}
.recent-links-list {list-style:none;padding:0;margin:0;display:grid;gap:.45rem;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));}
.recent-links-list li {border:1px solid #65566e;background:var(--plum-elev);padding:.7rem .85rem;display:flex;flex-direction:column;gap:.2rem;}
.recent-links-list a {color:#faf7f4;font-weight:650;text-decoration:none;}
.recent-links-list a:hover {color:var(--lime);text-decoration:underline;}
.recent-cat {font-size:.76rem;color:#c6b9cd;}
/* Mobile bottom tab bar (N3) */
.mobile-tab-bar {display:none;}
/* Discovery Card Grid View */
.discovery-list[data-view="grid"] {display:grid;grid-template-columns:repeat(auto-fill,minmax(285px,1fr));gap:1.15rem;border-bottom:0;}
.discovery-list[data-view="grid"] li,.discovery-list[data-view="grid"] li.has-thumb {display:flex;flex-direction:column;align-items:stretch;gap:.65rem;margin:0;padding:1.25rem;background:var(--plum-elev);border:1px solid #65566e;}
.discovery-list[data-view="grid"] li:hover {border-color:var(--lime);transform:translateY(-2px);background:#31223d;}
.discovery-list[data-view="grid"] .recipe-number {align-self:flex-start;padding:0;opacity:.75;}
.discovery-list[data-view="grid"] .recipe-thumb {width:100%;align-items:flex-start;}
.discovery-list[data-view="grid"] .recipe-thumb img {width:100%;height:170px;border-radius:2px;}
.discovery-list[data-view="grid"] .card-intro {display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.discovery-list[data-view="grid"] .row-end {margin-top:auto;padding-top:.65rem;border-top:1px solid rgb(135 121 142 / .35);flex-direction:row;align-items:center;width:100%;}
/* Empty Search State */
.empty-search-card {text-align:center;padding:2.5rem 1.5rem;border:1px dashed #756580;background:var(--plum-elev);margin-top:1rem;color:#ede5f0;}
.empty-skillet-svg {width:132px;height:82px;color:#d6c8e0;margin:0 auto .65rem;display:block;}
.suggestions-list {list-style:none;padding:0;margin:.5rem 0 1rem;display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem;}
.suggestions-list a {color:var(--lime);border:1px solid #756580;padding:.25rem .65rem;text-decoration:none;}
.empty-actions {display:flex;flex-wrap:wrap;justify-content:center;gap:.65rem;margin-top:1rem;}
.btn-clear,.empty-share-link {background:transparent;color:var(--lime);border:1px solid var(--lime);padding:.5rem .95rem;font:inherit;font-size:.86rem;font-weight:650;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:.4rem;}
.empty-share-link {background:var(--lime);color:var(--plum);}
/* Footer */
.site-footer {background:var(--plum);color:#ede5f0;border-top:1px solid #65566e;margin-top:0;}
.site-footer .brand {color:var(--lime);}
.footer-inner {max-width:1160px;padding:2.5rem 1.5rem 1.5rem;grid-template-columns:1.8fr 1fr 1fr 1.1fr;}
.footer-col a,.footer-note,.footer-fine {color:#d4c8dc;}
.footer-col {display:flex;flex-direction:column;align-items:flex-start;}
.footer-col a {min-height:40px;display:inline-flex;align-items:center;gap:.45rem;}
.footer-col a:hover {color:var(--lime);}
.footer-social {display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.65rem;}
.footer-social a {min-height:38px;min-width:38px;padding:.4rem;border:1px solid #65566e;color:#ede5f0;display:inline-flex;align-items:center;justify-content:center;border-radius:0;transition:border-color .15s,color .15s,background .15s;}
.footer-social a:hover {border-color:var(--lime);color:var(--plum);background:var(--lime);}
.community-tag {font-size:.82rem;color:var(--lime);margin:.6rem 0 0;font-weight:600;}
.footer-fine {max-width:1130px;padding:1rem 1.5rem 2rem;margin:auto;border-top:1px solid #4d3e56;}
/* Recipe Page */
.recipe-page {max-width:1020px;padding:2.25rem 3rem 4rem;border-top:5px solid var(--lime);}
.recipe-page .crumbs-nav {margin-bottom:1rem;}
.recipe-page .crumbs a {color:var(--muted);font-weight:500;}
.recipe-header {margin-bottom:1.25rem;}
.recipe-eyebrow {display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;font-weight:750;color:var(--plum);background:var(--lime);padding:.24rem .65rem;text-decoration:none;margin-bottom:.65rem;}
.recipe-eyebrow:hover {background:#d2f264;}
.recipe-page h1 {margin:.15rem 0 .75rem;font-size:clamp(2.15rem,4.5vw,3.15rem);}
.recipe-intro {font-size:1.12rem;line-height:1.65;color:var(--ink);opacity:.9;max-width:66ch;margin:0;}
.recipe-page .time-meta {border:1px solid var(--line);border-left:4px solid var(--plum);padding:.85rem 1.15rem;background:var(--card);gap:.75rem 1.5rem;margin:1.25rem 0 .85rem;border-radius:0;}
.time-item {display:inline-flex;align-items:center;gap:.4rem;font-weight:600;}
.time-label {font-weight:500;}
.recipe-actions {position:sticky;top:4.1rem;z-index:20;background:var(--bg);padding:.65rem 0;border-bottom:1px solid var(--line);margin:0 0 1rem;gap:.6rem;}
.recipe-page .recipe-actions button,.recipe-page .recipe-actions .jump,.recipe-page .recipe-actions .share-jump {border-radius:0;min-height:44px;}
.recipe-actions .jump,.recipe-actions .share-jump {display:inline-flex;align-items:center;gap:.35rem;padding:.45rem .9rem;border:1px solid var(--line-strong);background:var(--card);color:var(--ink);font-weight:650;font-size:.92rem;text-decoration:none;}
.recipe-actions .jump:hover,.recipe-actions .share-jump:hover {border-color:var(--plum);background:#f3efe8;text-decoration:none;}
.recipe-actions .print-open {padding:.45rem 1rem;border-color:var(--line-strong);font-size:.92rem;}
.recipe-actions .cook-open {background:var(--plum);color:var(--lime);padding:.55rem 1.35rem;font-size:.95rem;letter-spacing:.01em;transition:background .15s,transform .12s;}
.recipe-actions .cook-open:hover {background:var(--brand-strong);transform:translateY(-1px);}
.recipe-page .langs {margin:.5rem 0 1rem;}
.recipe-page .langs .chip {border-radius:0;border-color:var(--line-strong);background:var(--card);color:var(--ink);padding:.28rem .7rem;}
.recipe-page .untested,.recipe-page .machine-note,.recipe-page .tested-banner {border-radius:0;border:1px solid var(--line);border-left:4px solid var(--plum);background:var(--card);color:var(--ink);padding:.75rem 1rem;margin:.75rem 0;font-size:.92rem;}
.recipe-page .untested .badge,.recipe-page .machine-note .badge,.recipe-page .tested-banner .badge {border-radius:0;background:var(--plum);color:var(--lime);border:none;padding:.15rem .5rem;margin-right:.35rem;text-transform:uppercase;letter-spacing:.04em;font-size:.7rem;}
.recipe-body-grid {margin-top:1.75rem;}
.section-head {display:flex;align-items:center;justify-content:space-between;gap:.65rem;flex-wrap:wrap;margin-bottom:.75rem;}
.section-head h2,.steps-col>h2 {margin:0;font-size:1.65rem;}
.steps-col>h2 {margin-bottom:.75rem;}
.ing-tools {display:inline-flex;align-items:center;gap:.4rem;flex-wrap:wrap;}
.ing-progress {font-size:.78rem;font-weight:700;color:var(--muted);}
.copy-ing-btn {border:1px solid var(--line-strong);background:var(--bg);color:var(--ink);border-radius:0;padding:.3rem .62rem;font-size:.78rem;font-weight:650;cursor:pointer;min-height:34px;display:inline-flex;align-items:center;gap:.32rem;}
.copy-ing-btn:hover {border-color:var(--plum);background:var(--plum);color:var(--lime);}
.scaler button,.unit-toggle button {border-radius:0;min-height:36px;border-color:var(--line-strong);}
.scaler button[aria-pressed=true],.unit-toggle button[aria-pressed=true] {background:var(--plum);color:var(--lime);border-color:var(--plum);}
ul.ingredients li {padding:.5rem 0;border-bottom:1px dashed var(--line);}
ul.ingredients label {gap:.65rem;line-height:1.45;}
ul.ingredients input {width:1.1rem;height:1.1rem;accent-color:var(--plum);}
ol.steps li {padding:.85rem 0 .85rem 3rem;margin:0;border-bottom:1px solid var(--line);line-height:1.68;}
ol.steps li:last-child {border-bottom:0;}
ol.steps li::before {top:.85rem;width:2rem;height:2rem;background:var(--plum);color:var(--lime);display:inline-flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:750;}
@media(min-width:820px){
 .recipe-body-grid {display:grid;grid-template-columns:minmax(290px,345px) minmax(0,1fr);gap:2.75rem;align-items:start;}
 .ingredients-col {position:sticky;top:4.75rem;background:var(--card);border:1px solid var(--line);padding:1.35rem 1.4rem;}
}
/* Share Card */
.recipe-page .share {background:var(--plum);color:#faf7f4;border-left:5px solid var(--lime);padding:1.35rem 1.5rem;margin:2.5rem 0 0;display:flex;flex-direction:column;align-items:stretch;gap:.9rem;}
.share-head {display:flex;flex-direction:column;gap:.2rem;}
.share-head .share-label {color:var(--lime);font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;}
.share-head .share-label strong {color:#fff;font-size:1.05rem;text-transform:none;letter-spacing:-.01em;}
.share-sub {color:#d8cddc;font-size:.88rem;}
.share-buttons {display:flex;flex-wrap:wrap;gap:.5rem;}
.recipe-page .share button,.recipe-page .share a.share-link {border-radius:0;min-height:40px;padding:.45rem .88rem;border:1px solid #756580;background:#2e2038;color:#faf7f4;font-weight:650;font-size:.85rem;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;cursor:pointer;transition:background .15s,color .15s,border-color .15s;}
.recipe-page .share button[hidden] {display:none;}
.recipe-page .share .share-copy,.recipe-page .share .share-native,.recipe-page .share .share-story-btn {background:var(--lime);color:var(--plum);border-color:var(--lime);font-weight:750;}
.recipe-page .share button:hover,.recipe-page .share a.share-link:hover {background:var(--lime);color:var(--plum);border-color:var(--lime);text-decoration:none;}
.share-more summary {cursor:pointer;color:var(--lime);font-weight:650;font-size:.88rem;min-height:40px;display:inline-flex;align-items:center;gap:.4rem;list-style:none;}
.share-more summary::-webkit-details-marker {display:none;}
.share-more summary::after {content:'';width:.45rem;height:.45rem;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .15s;}
.share-more[open] summary::after {transform:rotate(225deg) translateY(-1px);}
.share-more[open] summary {margin-bottom:.6rem;}
/* Related Recipes */
.related-recipes {margin-top:2.25rem;padding-top:1.75rem;border-top:2px solid var(--plum);}
.related-recipes h2 {margin:0 0 1rem;font-size:1.5rem;}
.related-grid {list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1rem;}
.related-card {position:relative;background:var(--card);border:1px solid var(--line);padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.45rem;transition:border-color .15s,transform .15s;}
.related-card:hover {border-color:var(--plum);transform:translateY(-2px);}
.related-card .eyebrow {color:var(--muted);}
.related-card h3 {font-size:1.1rem;line-height:1.25;margin:0;}
.related-card h3 a {color:var(--ink);text-decoration:none;}
.related-card h3 a.stretched::after {content:'';position:absolute;inset:0;}
.related-meta {margin-top:auto;padding-top:.4rem;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:.82rem;}
.related-arrow {color:var(--plum);font-weight:750;font-size:1.05rem;}
/* Cook Mode */
.cook-mode {color:var(--ink);background:var(--bg);z-index:60;}
.cook-mode button {border-radius:0;min-height:44px;}
.cook-bar {height:4px;background:var(--line);width:100%;overflow:hidden;}
.cook-bar-fill {height:100%;background:var(--plum);width:0%;transition:width .2s ease;}
/* Dark & Light Explicit Theme Overrides */
html[data-theme="dark"] {color-scheme:dark;--bg:#1b1322;--card:#261b2e;--ink:#f7f3fa;--muted:#c7b9d1;--line:#473852;--line-strong:#776385;--brand:#e0fa80;--brand-strong:#c9e85b;}
html[data-theme="dark"] .recipe-page .time-meta,html[data-theme="dark"] .recipe-page .untested,html[data-theme="dark"] .recipe-page .machine-note {border-left-color:var(--lime);}
html[data-theme="dark"] .recipe-actions .cook-open,html[data-theme="dark"] .scaler button[aria-pressed=true],html[data-theme="dark"] .unit-toggle button[aria-pressed=true],html[data-theme="dark"] ol.steps li::before {background:var(--lime);color:var(--plum);border-color:var(--lime);}
html[data-theme="dark"] .recipe-actions .jump:hover,html[data-theme="dark"] .recipe-actions .share-jump:hover,html[data-theme="dark"] .copy-ing-btn:hover {background:var(--lime);color:var(--plum);border-color:var(--lime);}
html[data-theme="dark"] ul.ingredients input {accent-color:var(--lime);}
html[data-theme="dark"] .related-recipes {border-top-color:var(--lime);}
html[data-theme="dark"] .related-card:hover {border-color:var(--lime);}
html[data-theme="dark"] .related-arrow {color:var(--lime);}
html[data-theme="dark"] .cook-bar-fill {background:var(--lime);}
html[data-theme="light"] body {background:#faf8f3;}
html[data-theme="light"] main.wide.discovery {background:#faf8f3;color:#261b2c;}
html[data-theme="light"] .after-copy .eyebrow,html[data-theme="light"] .index-heading h2 {color:var(--plum);}
html[data-theme="light"] .after-copy h1 {color:var(--plum);}
html[data-theme="light"] .after-copy p,html[data-theme="light"] .index-heading p {color:#4d3e56;}
html[data-theme="light"] .discovery-cta-secondary {color:var(--plum);border-color:var(--plum);}
html[data-theme="light"] .discovery .chip {color:var(--plum);border-color:#9e91a6;}
html[data-theme="light"] .discovery .chip:hover {background:#efeae0;color:var(--plum);border-color:var(--plum);}
html[data-theme="light"] .discovery .chip[aria-current=page] {background:var(--plum);border-color:var(--plum);color:var(--lime);}
html[data-theme="light"] .discovery-search {background:#fffdf8;color:var(--plum);border-color:#827384;}
html[data-theme="light"] .discovery-search::placeholder {color:#7a6c82;}
html[data-theme="light"] .discovery-search:focus {border-color:var(--plum);outline-color:var(--plum);}
html[data-theme="light"] .hero-search {background:#fffdf8;border-color:#827384;}
html[data-theme="light"] .hero-search:focus-within {border-color:var(--plum);box-shadow:0 0 0 2px var(--plum);}
html[data-theme="light"] .hero-search input {color:var(--plum);}
html[data-theme="light"] .hero-search input::placeholder,html[data-theme="light"] .hero-search-icon {color:#7a6c82;}
html[data-theme="light"] .hero-search button {background:var(--plum);color:var(--lime);}
html[data-theme="light"] .hero-quick a {color:var(--plum);border-color:#9e91a6;}
html[data-theme="light"] .hero-quick a:hover {background:#efeae0;}
html[data-theme="light"] .view-toggle {border-color:#827384;}
html[data-theme="light"] .view-toggle button {color:var(--plum);}
html[data-theme="light"] .view-toggle button[aria-pressed="true"] {background:var(--plum);color:var(--lime);}
html[data-theme="light"] .discovery-list,html[data-theme="light"] .discovery-list li {border-color:#d7d0cc;}
html[data-theme="light"] .discovery-list[data-view="grid"] li {background:#fffdf8;border-color:#d7d0cc;}
html[data-theme="light"] .discovery-list h3 a {color:var(--plum);}
html[data-theme="light"] .discovery-list .eyebrow {color:#493253;}
html[data-theme="light"] .card-intro,html[data-theme="light"] .row-end .icon-stat,html[data-theme="light"] .recipe-number,html[data-theme="light"] .thumb-label,html[data-theme="light"] .status-label,html[data-theme="light"] .fallback-language,html[data-theme="light"] .provenance-badge {color:#574860;border-color:#bfb5c4;}
html[data-theme="light"] .row-end a {color:var(--plum);}
html[data-theme="light"] .save-btn {color:var(--plum);border-color:#827384;}
html[data-theme="light"] .save-btn[aria-pressed="true"] {background:var(--plum);color:var(--lime);border-color:var(--plum);}
html[data-theme="light"] .search-page-form,html[data-theme="light"] .hub-hero,html[data-theme="light"] .hub-directory-card,html[data-theme="light"] .saved-sync-banner,html[data-theme="light"] .recent-links-list li,html[data-theme="light"] .inferred-note {background:#fffdf8;border-color:#d7d0cc;color:var(--ink);}
html[data-theme="light"] .search-main-row,html[data-theme="light"] .search-filters select {background:#faf8f3;border-color:#827384;color:var(--ink);}
html[data-theme="light"] .search-main-row input {color:var(--plum);}
html[data-theme="light"] .search-main-row button,html[data-theme="light"] .apply-filters-btn {background:var(--plum);color:var(--lime);border-color:var(--plum);}
html[data-theme="light"] .search-filters label,html[data-theme="light"] .search-count,html[data-theme="light"] .hub-intro,html[data-theme="light"] .hub-directory-card p,html[data-theme="light"] .saved-sync-banner p,html[data-theme="light"] .discovery-index .crumbs a,html[data-theme="light"] .discovery-index .crumbs [aria-current="page"] {color:#4d3e56;}
html[data-theme="light"] .hub-hero h1,html[data-theme="light"] .hub-directory-card h2 a,html[data-theme="light"] .saved-section h2,html[data-theme="light"] .recent-links-list a,html[data-theme="light"] .cat-heading-link {color:var(--plum);}
@media(max-width:720px){
 body {padding-bottom:calc(4.75rem + env(safe-area-inset-bottom));}
 .header-inner {padding:.55rem 1rem;gap:.4rem;flex-wrap:nowrap;}
 .header-search-form,.site-nav a.nav-secondary,.header-tools {display:none !important;}
 .nav-search-mobile {display:inline-flex !important;}
 .site-nav {flex-wrap:nowrap;}
 .site-nav a.nav-search {min-width:42px;justify-content:center;border:1px solid #65566e;}
 .nav-search-label {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
 .mobile-menu {display:block;}
 .hero-search input {min-height:50px;}
 /* Search + header CTA replace the hero buttons on phones, so recipes start sooner. */
 .hero-cta-row {display:none;}
 .hero-quick {margin-bottom:.25rem !important;}
 .brand-word {font-size:1.52rem;}
 .site-nav {gap:.15rem;}
 .site-nav a {font-size:.78rem;padding:.28rem .45rem;min-height:38px;}
 .site-nav a.nav-share-cta {padding:.3rem .6rem;}
 .header-tools {width:100%;justify-content:space-between;border-top:1px solid #605469;padding-top:.35rem;}
 .language-nav a {font-size:.76rem;padding:.2rem .5rem .2rem 0;min-height:34px;}
 .after-hero {grid-template-columns:1fr;}
 .after-copy {padding:2rem 1.15rem 1.75rem;}
 .after-copy h1 {font-size:clamp(2.05rem,8vw,3.1rem);margin:.85rem 0;}
 .after-copy p {font-size:.95rem;line-height:1.52;margin-bottom:1.25rem;}
 .identity-art {max-height:190px;}
 .featured-recipe {grid-template-columns:1fr;gap:1rem;padding:1.5rem 1.15rem;}
 .featured-recipe h2 {font-size:1.95rem;}
 .featured-facts {justify-content:flex-start;}
 .discovery-index {padding:1.75rem 1.15rem 2.5rem;}
 .index-heading h2 {font-size:1.8rem;}
 .discovery-toolbar {flex-direction:column;align-items:stretch;}
 .discovery .cat-nav {flex:1 1 auto;}
 .toolbar-controls {flex:1 1 auto;width:100%;flex-wrap:wrap;}
 .discovery-search-wrap {flex:1 1 180px;}
 .discovery .chip {font-size:.78rem;padding:.4rem .65rem;}
 .discovery-list li {grid-template-columns:1.5rem minmax(0,1fr) auto;gap:.55rem;padding:1.15rem .35rem;margin:0 -.35rem;}
 .discovery-list li.has-thumb {grid-template-columns:1.5rem 3.8rem minmax(0,1fr) auto;}
 .recipe-thumb {width:3.8rem;}
 .recipe-thumb img {width:3.8rem;height:3.8rem;}
 .discovery-list h3 {font-size:1.16rem;}
 .row-end {min-width:52px;}
 .row-end .icon-stat {font-size:.7rem;gap:.2rem;}
 .hub-hero {grid-template-columns:1fr;padding:1.1rem;}
 .recipe-page {padding:1.25rem 1rem 3rem;}
 .recipe-actions {top:3.6rem;padding:.55rem 0;}
 .recipe-page h1 {font-size:2rem;}
 .recipe-actions .cook-open {margin-left:0;width:100%;}
 .steps-col>h2 {margin-top:1.75rem;}
 .footer-inner {grid-template-columns:1fr 1fr;}
 .footer-fine {padding:1rem 1rem 2rem;}
 .mobile-tab-bar {display:grid;grid-template-columns:repeat(5,1fr);position:fixed;bottom:0;left:0;right:0;z-index:35;background:var(--plum);border-top:1px solid #605469;padding:.25rem .25rem calc(.25rem + env(safe-area-inset-bottom));}
 .mobile-tab {display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.16rem;color:#ded5e4;text-decoration:none;font-size:.7rem;font-weight:600;padding:.35rem .2rem;min-height:48px;}
 .mobile-tab .social-icon {width:18px;height:18px;}
 .mobile-tab[aria-current="page"] {color:var(--lime);font-weight:750;}
 .mobile-tab--share {color:var(--lime);}
 .mobile-tab--share .social-icon {background:var(--lime);color:var(--plum);border-radius:999px;padding:2px;width:22px;height:22px;}
 .tab-icon-wrap {position:relative;display:inline-flex;}
 .tab-badge {position:absolute;top:-5px;right:-10px;min-width:16px;height:16px;padding:0 3px;background:var(--lime);color:var(--plum);font-size:.66rem;font-weight:800;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;}
}
@media(max-width:480px){
 .footer-inner {grid-template-columns:1fr;}
}
@media print {body,.site-header,.site-footer,main.wide.discovery{background:white;color:black;padding-bottom:0 !important;} .site-header,.site-footer,.related-recipes,.copy-ing-btn,.ing-progress,.theme-toggle,.view-toggle,.mobile-tab-bar,.search-sheet,.save-btn {display:none !important;} .recipe-page{border:0;padding:0;} .recipe-body-grid{display:block;} .ingredients-col{position:static;border:0;padding:0;}}
`;
