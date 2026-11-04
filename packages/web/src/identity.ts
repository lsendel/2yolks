/** Selected visual direction 3. Decorative art is local, separate from recipe media. */
export const AFTER_HOURS_CSS = `
:root {--plum:#211729;--lime:#e0fa80;--brand:#493253;--brand-strong:#302038;--ink:#261b2c;--muted:#64586a;--bg:#faf8f3;--card:#fffdf8;--line:#d7d0cc;--line-strong:#827384;--radius:0;--font-display:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;}
html {scroll-behavior:smooth;}
body {background:var(--plum);}
h1,h2,h3 {font-family:var(--font-display);letter-spacing:-.045em;font-weight:750;}
h1 {font-size:clamp(2rem,5vw,3.2rem);line-height:1.05;}
a:focus-visible,button:focus-visible,input:focus-visible {outline:3px solid #8a5b98;outline-offset:3px;}
.site-header {background:var(--plum);border-color:#605469;color:var(--lime);position:sticky;top:0;z-index:30;}
.header-inner {max-width:1160px;padding:.95rem 1.5rem;gap:.75rem 1.5rem;}
.brand {color:inherit;gap:.4rem;}
.brand-word {font-family:var(--font-display);font-weight:800;font-size:1.8rem;letter-spacing:-.09em;}
.brand-yolks {font-size:1.05rem;letter-spacing:.05em;}
.site-nav {margin-left:auto;}
.site-nav a,.language-nav a {color:var(--lime);font-weight:500;font-size:.9rem;border-radius:0;min-height:44px;display:inline-flex;align-items:center;padding:.4rem .65rem;transition:background .15s;}
.site-nav a:hover,.language-nav a:hover {background:#3b2d43;color:var(--lime);}
.language-nav {display:flex;flex-wrap:wrap;gap:0 .15rem;}
.language-nav a {text-decoration:none;}
.language-nav a[aria-current=page] {text-decoration:underline;text-underline-offset:6px;font-weight:700;}
main {background:var(--bg);}
main.wide.discovery {max-width:1160px;padding:0;margin:auto;background:var(--plum);color:#faf7f4;}
.eyebrow {font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;font-weight:650;}
.after-hero {display:grid;grid-template-columns:1.1fr 1fr;border-bottom:1px solid #64566a;}
.after-copy {padding:3.5rem 3rem 3rem;display:flex;flex-direction:column;align-items:flex-start;}
.after-copy .eyebrow {color:var(--lime);}
.after-copy h1 {text-transform:uppercase;color:var(--lime);font-size:clamp(2.3rem,5.7vw,4.8rem);line-height:.98;margin:1.4rem 0;max-width:13ch;}
.after-copy p {max-width:29ch;font-size:1.08rem;line-height:1.55;color:#ede6f0;margin:0 0 1.8rem;}
.discovery-cta {display:flex;justify-content:space-between;align-items:center;gap:2rem;padding:1rem 1.25rem;background:var(--lime);color:var(--plum);font-weight:750;text-decoration:none;width:100%;max-width:300px;margin-top:auto;transition:background .15s,transform .15s;}
.discovery-cta:hover {background:#ecff9e;transform:translateY(-2px);}
.identity-art {position:relative;margin:0;min-width:0;overflow:hidden;}
.identity-art img {width:100%;height:100%;object-fit:cover;display:block;}
.identity-art figcaption {position:absolute;bottom:.6rem;right:.6rem;left:.6rem;margin-left:auto;max-width:190px;background:#faf8f3ed;color:var(--plum);font-size:.65rem;line-height:1.35;padding:.45rem;}
.featured-recipe {position:relative;display:grid;grid-template-columns:1.1fr 1fr;gap:2rem;padding:2.5rem 3rem;background:var(--lime);color:var(--plum);transition:background .15s;}
.featured-recipe:hover {background:#e7fc94;}
.featured-recipe h2 {font-size:clamp(1.8rem,4vw,3.2rem);line-height:1.05;max-width:16ch;margin:.6rem 0 0;}
.featured-recipe h2 a {color:inherit;text-decoration:none;}
.featured-recipe h2 a::after {content:'';position:absolute;inset:0;}
.featured-recipe h2 span {display:inline-block;margin-left:.65rem;transition:transform .15s;}
.featured-recipe:hover h2 span {transform:translate(3px,-3px);}
.featured-facts {display:flex;align-items:center;justify-content:flex-end;gap:.6rem;flex-wrap:wrap;}
.icon-stat {display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;}
.fact-icon {width:18px;height:18px;flex-shrink:0;vertical-align:middle;}
.featured-facts>span {border:1px solid currentColor;padding:.4rem .65rem;font-size:.82rem;font-weight:600;}
.discovery-index {padding:2.5rem 3rem 3.5rem;scroll-margin-top:4rem;}
.index-heading {display:flex;gap:1rem;align-items:baseline;justify-content:space-between;flex-wrap:wrap;}
.index-heading h2 {font-size:2.25rem;color:var(--lime);margin:0;}
.index-heading p {font-size:.88rem;margin:0;color:#ded6df;}
.discovery-toolbar {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem 1.25rem;margin:1.25rem 0 1.75rem;}
.discovery .cat-nav {margin:0;gap:.4rem;}
.discovery .chip {background:transparent;color:#f6f1f7;border:1px solid #87798e;border-radius:0;min-height:44px;font-weight:500;font-size:.85rem;padding:.5rem .85rem;transition:border-color .15s,background .15s,color .15s;}
.discovery .chip:hover {border-color:var(--lime);color:var(--lime);}
.discovery .chip[aria-current=page] {background:var(--lime);border-color:var(--lime);color:var(--plum);font-weight:700;}
.discovery-search-wrap {flex:0 1 280px;min-width:200px;}
.discovery-search {width:100%;min-height:44px;padding:.5rem .85rem;background:#2b1f35;border:1px solid #87798e;border-radius:0;color:#faf7f4;font:inherit;font-size:.88rem;}
.discovery-search::placeholder {color:#b8abc2;}
.discovery-search:focus {border-color:var(--lime);outline:2px solid var(--lime);outline-offset:1px;}
.discovery-list {list-style:none;padding:0;margin:0;border-bottom:1px solid #65566e;}
.discovery-list li {position:relative;display:grid;grid-template-columns:2.2rem minmax(0,1fr) auto;gap:1rem;border-top:1px solid #65566e;padding:1.35rem .75rem;margin:0 -.75rem;transition:background .15s;}
.discovery-list li.has-thumb {grid-template-columns:2.2rem 4.5rem minmax(0,1fr) auto;}
.recipe-thumb {position:relative;width:4.5rem;height:4.5rem;border-radius:8px;overflow:hidden;border:1px solid #65566e;}
.recipe-thumb img {width:100%;height:100%;object-fit:cover;display:block;}
.thumb-label {position:absolute;left:0;right:0;bottom:0;font-size:.6rem;line-height:1.25;text-align:center;background:rgb(0 0 0 / .55);color:#faf7f4;padding:.1rem 0;}
.discovery-list li[hidden] {display:none;}
.discovery-list li:hover {background:rgb(224 250 128 / .06);}
.recipe-number {font-size:.75rem;font-weight:700;color:#c6b9cd;padding-top:.2rem;font-variant-numeric:tabular-nums;}
.discovery-list h3 {font-size:1.45rem;line-height:1.18;margin:.15rem 0 .4rem;}
.discovery-list h3 a {color:#faf7f4;text-decoration:none;}
.discovery-list h3 a.stretched-row::after {content:'';position:absolute;inset:0;z-index:1;}
.discovery-list a:hover {text-decoration:underline;}
.discovery-list .eyebrow {display:block;color:var(--lime);font-weight:600;margin-bottom:.15rem;opacity:.9;}
.row-badges {display:flex;flex-wrap:wrap;gap:.35rem .75rem;align-items:center;}
.status-label {color:var(--lime);font-size:.75rem;font-weight:600;}
.featured-recipe .status-label {color:var(--plum);}
.fallback-language {display:inline-block;font-size:.75rem;color:#dfd7e4;border:1px solid #756580;padding:.05rem .45rem;}
.row-end {display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:.5rem;min-width:70px;}
.row-end .icon-stat {font-size:.78rem;color:#ded5e4;}
.row-end .fact-icon {width:14px;height:14px;}
.row-end a {color:var(--lime);font-size:1.6rem;line-height:1;text-decoration:none;min-height:36px;min-width:36px;text-align:right;transition:transform .15s;}
.discovery-list li:hover .row-end a {transform:translate(3px,-3px);}
.site-footer {background:var(--plum);color:#ede5f0;border-top:1px solid #65566e;margin-top:0;}
.site-footer .brand {color:var(--lime);}
.footer-inner {max-width:1160px;padding:2.5rem 1.5rem;}
.footer-col a,.footer-note,.footer-fine {color:#d4c8dc;}
.footer-col a {min-height:44px;display:flex;align-items:center;}
.footer-fine {max-width:1100px;padding-bottom:2rem;margin:auto;}
/* Recipe Page */
.recipe-page {max-width:1020px;padding:2.25rem 3rem 4rem;border-top:5px solid var(--lime);}
.recipe-page .crumbs-nav {margin-bottom:1rem;}
.recipe-page .crumbs a {color:#66536e;font-weight:500;}
.recipe-header {margin-bottom:1.25rem;}
.recipe-eyebrow {display:inline-block;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;font-weight:750;color:var(--plum);background:var(--lime);padding:.22rem .6rem;text-decoration:none;margin-bottom:.65rem;}
.recipe-eyebrow:hover {background:#d2f264;}
.recipe-page h1 {margin:.15rem 0 .75rem;font-size:clamp(2.1rem,4.5vw,3.1rem);}
.recipe-intro {font-size:1.12rem;line-height:1.65;color:#3d2f44;max-width:66ch;margin:0;}
.recipe-page .time-meta {border:1px solid var(--line);border-left:4px solid var(--plum);padding:.85rem 1.15rem;background:var(--card);gap:.75rem 1.5rem;margin:1.25rem 0 .85rem;border-radius:0;}
.time-item {display:inline-flex;align-items:center;gap:.4rem;font-weight:600;}
.time-label {font-weight:500;}
.recipe-actions {padding:.85rem 0 1rem;border-bottom:1px solid var(--line);margin:0 0 1rem;gap:.6rem;}
.recipe-page .recipe-actions button,.recipe-page .recipe-actions .jump,.recipe-page .recipe-actions .share-jump {border-radius:0;min-height:44px;}
.recipe-actions .jump,.recipe-actions .share-jump {display:inline-flex;align-items:center;padding:.45rem .9rem;border:1px solid var(--line-strong);background:var(--card);color:var(--ink);font-weight:650;font-size:.92rem;text-decoration:none;}
.recipe-actions .jump:hover,.recipe-actions .share-jump:hover {border-color:var(--plum);background:#f3efe8;text-decoration:none;}
.recipe-actions .print-open {padding:.45rem 1rem;border-color:var(--line-strong);font-size:.92rem;}
.recipe-actions .cook-open {background:var(--plum);color:var(--lime);padding:.55rem 1.35rem;font-size:.95rem;letter-spacing:.01em;transition:background .15s,transform .12s;}
.recipe-actions .cook-open:hover {background:var(--brand-strong);transform:translateY(-1px);}
.recipe-page .langs {margin:.5rem 0 1rem;}
.recipe-page .langs .chip {border-radius:0;border-color:var(--line-strong);background:var(--card);color:var(--ink);padding:.28rem .7rem;}
.recipe-page .untested,.recipe-page .machine-note {border-radius:0;border:1px solid var(--line);border-left:4px solid var(--plum);background:var(--card);color:var(--ink);padding:.75rem 1rem;margin:.75rem 0;font-size:.92rem;}
.recipe-page .untested .badge,.recipe-page .machine-note .badge {border-radius:0;background:var(--plum);color:var(--lime);border:none;padding:.15rem .5rem;margin-right:.35rem;text-transform:uppercase;letter-spacing:.04em;font-size:.7rem;}
.recipe-body-grid {margin-top:1.75rem;}
.section-head {display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin-bottom:.75rem;}
.section-head h2,.steps-col>h2 {margin:0;font-size:1.65rem;}
.steps-col>h2 {margin-bottom:.75rem;}
.ing-tools {display:inline-flex;align-items:center;gap:.5rem;}
.ing-progress {font-size:.78rem;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;}
.copy-ing-btn {border:1px solid var(--line-strong);background:var(--bg);color:var(--ink);border-radius:0;padding:.3rem .65rem;font-size:.78rem;font-weight:650;cursor:pointer;min-height:34px;}
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
 .recipe-body-grid {display:grid;grid-template-columns:minmax(280px,340px) minmax(0,1fr);gap:2.75rem;align-items:start;}
 .ingredients-col {position:sticky;top:4.75rem;background:var(--card);border:1px solid var(--line);padding:1.35rem 1.4rem;}
}
/* Share Card */
.recipe-page .share {background:var(--plum);color:#faf7f4;border-left:5px solid var(--lime);padding:1.35rem 1.5rem;margin:2.5rem 0 0;display:flex;flex-direction:column;align-items:stretch;gap:.9rem;}
.share-head {display:flex;flex-direction:column;gap:.2rem;}
.share-head .share-label {color:var(--lime);font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;}
.share-head .share-label strong {color:#fff;font-size:1.05rem;text-transform:none;letter-spacing:-.01em;}
.share-sub {color:#d8cddc;font-size:.88rem;}
.share-buttons {display:flex;flex-wrap:wrap;gap:.5rem;}
.recipe-page .share button,.recipe-page .share a.share-link {border-radius:0;min-height:40px;padding:.45rem .9rem;border:1px solid #756580;background:#2e2038;color:#faf7f4;font-weight:650;font-size:.86rem;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s,border-color .15s;}
.recipe-page .share button[hidden] {display:none;}
.recipe-page .share .share-copy,.recipe-page .share .share-native {background:var(--lime);color:var(--plum);border-color:var(--lime);font-weight:750;}
.recipe-page .share button:hover,.recipe-page .share a.share-link:hover {background:var(--lime);color:var(--plum);border-color:var(--lime);text-decoration:none;}
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
.related-arrow {color:var(--plum);font-weight:750;font-size:1.1rem;}
/* Cook Mode */
.cook-mode {color:var(--ink);background:var(--bg);}
.cook-mode button {border-radius:0;min-height:44px;}
.cook-bar {height:4px;background:var(--line);width:100%;overflow:hidden;}
.cook-bar-fill {height:100%;background:var(--plum);width:0%;transition:width .2s ease;}
@media(max-width:680px){
 .header-inner {padding:.6rem 1rem;gap:.2rem 1rem;}
 .brand-word {font-size:1.5rem;}
 .site-nav {gap:0;}
 .site-nav a {font-size:.75rem;padding:.25rem .35rem;}
 .language-nav {width:100%;border-top:1px solid #605469;justify-content:flex-start;}
 .language-nav a {font-size:.75rem;padding:.25rem .65rem .25rem 0;margin-right:.55rem;}
 .after-hero {grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);}
 .after-copy {padding:1.8rem 1rem;}
 .after-copy .eyebrow {font-size:.55rem;letter-spacing:.06em;}
 .after-copy h1 {font-size:clamp(1.8rem,7.5vw,3rem);margin:1rem 0;max-width:10ch;}
 .after-copy p {font-size:.82rem;line-height:1.5;margin-bottom:1rem;}
 .discovery-cta {font-size:.78rem;gap:.5rem;padding:.8rem;}
 .identity-art img {object-position:50% center;}
 .identity-art figcaption {font-size:.5rem;right:.25rem;left:.25rem;bottom:.25rem;padding:.25rem;}
 .featured-recipe {grid-template-columns:1fr;gap:1rem;padding:1.5rem 1rem;}
 .featured-recipe h2 {font-size:2rem;max-width:14ch;}
 .featured-facts {justify-content:flex-start;}
 .discovery-index {padding:1.75rem 1rem 2.5rem;}
 .index-heading h2 {font-size:1.8rem;}
 .index-heading p {font-size:.75rem;}
 .discovery-toolbar {flex-direction:column;align-items:stretch;}
 .discovery-search-wrap {flex:1 1 auto;width:100%;}
 .discovery .chip {font-size:.75rem;padding:.4rem .6rem;}
 .discovery-list li {grid-template-columns:1.4rem minmax(0,1fr) auto;gap:.5rem;padding:1.15rem .4rem;margin:0 -.4rem;}
 .discovery-list h3 {font-size:1.12rem;}
 .discovery-list .eyebrow {font-size:.6rem;}
 .row-end {min-width:54px;}
 .row-end .icon-stat {font-size:.65rem;gap:.2rem;}
 .row-end .fact-icon {display:none;}
 .recipe-page {padding:1.25rem 1rem 3rem;}
 .recipe-page h1 {font-size:2rem;}
 .recipe-actions .cook-open {margin-left:0;width:100%;}
 .steps-col>h2 {margin-top:1.75rem;}
 .footer-fine {padding:0 1rem 2rem;}
}
@media print {body,.site-header,.site-footer,main.wide.discovery{background:white;color:black;} .site-header,.site-footer,.related-recipes,.copy-ing-btn,.ing-progress {display:none !important;} .recipe-page{border:0;padding:0;} .recipe-body-grid{display:block;} .ingredients-col{position:static;border:0;padding:0;}}
`;
