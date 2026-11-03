/** Selected visual direction 3. Decorative art is local, separate from recipe media. */
export const AFTER_HOURS_CSS = `
:root {--plum:#211729;--lime:#e0fa80;--brand:#493253;--brand-strong:#302038;--ink:#261b2c;--muted:#64586a;--bg:#faf8f3;--card:#fffdf8;--line:#d7d0cc;--line-strong:#827384;--radius:0;--font-display:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;}
body {background:var(--plum);}
h1,h2,h3 {font-family:var(--font-display);letter-spacing:-.045em;font-weight:750;}
h1 {font-size:clamp(2rem,5vw,3.2rem);line-height:1.05;}
a:focus-visible,button:focus-visible {outline:3px solid #8a5b98;outline-offset:4px;}
.site-header {background:var(--plum);border-color:#605469;color:var(--lime);}
.header-inner {max-width:1160px;padding:1.1rem 1.5rem;gap:1rem 1.5rem;}
.brand {color:inherit;gap:.4rem;}
.brand-word {font-family:var(--font-display);font-weight:800;font-size:1.8rem;letter-spacing:-.09em;}
.brand-yolks {font-size:1.05rem;letter-spacing:.05em;}
.site-nav {margin-left:auto;}
.site-nav a,.language-nav a {color:var(--lime);font-weight:500;font-size:.9rem;border-radius:0;min-height:44px;display:inline-flex;align-items:center;padding:.4rem .65rem;}
.site-nav a:hover,.language-nav a:hover {background:#3b2d43;color:var(--lime);}
.language-nav {display:flex;flex-wrap:wrap;gap:0 .15rem;}
.language-nav a {text-decoration:none;}
.language-nav a[aria-current=page] {text-decoration:underline;text-underline-offset:6px;}
main {background:var(--bg);}
main.wide.discovery {max-width:1160px;padding:0;margin:auto;background:var(--plum);color:#faf7f4;}
.eyebrow {font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;font-weight:650;}
.after-hero {display:grid;grid-template-columns:1.1fr 1fr;border-bottom:1px solid #64566a;}
.after-copy {padding:3.5rem 3rem 3rem;display:flex;flex-direction:column;align-items:flex-start;}
.after-copy .eyebrow {color:var(--lime);}
.after-copy h1 {text-transform:uppercase;color:var(--lime);font-size:clamp(2.3rem,5.7vw,4.8rem);line-height:.98;margin:1.4rem 0;max-width:13ch;}
.after-copy p {max-width:27ch;font-size:1.05rem;margin:0 0 1.8rem;}
.discovery-cta {display:flex;justify-content:space-between;gap:2rem;padding:1rem 1.2rem;background:var(--lime);color:var(--plum);font-weight:700;text-decoration:none;width:100%;max-width:300px;margin-top:auto;}
.identity-art {position:relative;margin:0;min-width:0;overflow:hidden;}
.identity-art img {width:100%;height:100%;object-fit:cover;display:block;}
.identity-art figcaption {position:absolute;bottom:.6rem;right:.6rem;left:.6rem;margin-left:auto;max-width:180px;background:#faf8f3ed;color:var(--plum);font-size:.65rem;line-height:1.35;padding:.45rem;}
.featured-recipe {display:grid;grid-template-columns:1.1fr 1fr;gap:2rem;padding:2.5rem 3rem;background:var(--lime);color:var(--plum);}
.featured-recipe h2 {font-size:clamp(1.8rem,4vw,3.2rem);line-height:1.05;max-width:15ch;margin:.8rem 0 0;}
.featured-recipe h2 a {color:inherit;text-decoration:none;}
.featured-recipe h2 span {display:inline-block;margin-left:.65rem;}
.featured-facts {display:flex;align-items:center;justify-content:flex-end;gap:.6rem;flex-wrap:wrap;}
.icon-stat {display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;}
.fact-icon {width:18px;height:18px;flex-shrink:0;vertical-align:middle;}
.featured-facts>span {border:1px solid currentColor;padding:.4rem .6rem;font-size:.8rem;}
.discovery-index {padding:2.5rem 3rem 3.5rem;scroll-margin-top:1rem;}
.index-heading {display:flex;gap:1rem;align-items:baseline;justify-content:space-between;flex-wrap:wrap;}
.index-heading h2 {font-size:2.25rem;color:var(--lime);margin:0;}
.index-heading p {font-size:.85rem;margin:0;color:#ded6df;}
.discovery .cat-nav {margin:1.25rem 0 1.75rem;gap:.4rem;}
.discovery .chip {background:transparent;color:#f6f1f7;border:1px solid #87798e;border-radius:0;min-height:44px;font-weight:500;font-size:.85rem;padding:.5rem .8rem;}
.discovery .chip[aria-current=page] {background:var(--lime);border-color:var(--lime);color:var(--plum);}
.discovery-list {list-style:none;padding:0;margin:0;}
.discovery-list li {display:grid;grid-template-columns:2rem minmax(0,1fr) auto;gap:1rem;border-top:1px solid #65566e;padding:1.5rem 0;}
.recipe-number {font-size:.7rem;color:#c6b9cd;}
.discovery-list h3 {font-size:1.45rem;line-height:1.15;margin:.35rem 0 .5rem;}
.discovery-list h3 a {color:#faf7f4;text-decoration:none;}
.discovery-list a:hover {text-decoration:underline;}
.discovery-list .eyebrow {color:#d8cddc;font-weight:400;}
.status-label {color:var(--lime);font-size:.75rem;}
.featured-recipe .status-label {color:var(--plum);}
.fallback-language {display:block;font-size:.75rem;color:#dfd7e4;}
.row-end {display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;min-width:65px;}
.row-end .icon-stat {font-size:.75rem;color:#ded5e4;}
.row-end .fact-icon {width:14px;height:14px;}
.row-end a {color:var(--lime);font-size:1.6rem;line-height:1;text-decoration:none;min-height:44px;min-width:44px;text-align:right;}
.site-footer {background:var(--plum);color:#ede5f0;border-top:1px solid #65566e;}
.site-footer .brand {color:var(--lime);}
.footer-inner {max-width:1160px;padding:2.5rem 1.5rem;}
.footer-col a,.footer-note,.footer-fine {color:#d4c8dc;}
.footer-col a {min-height:44px;display:flex;align-items:center;}
.footer-fine {max-width:1100px;padding-bottom:2rem;margin:auto;}
.recipe-page {max-width:900px;padding:2rem 3rem 4rem;border-top:5px solid var(--lime);}
.recipe-page .crumbs a {color:#66536e;}
.recipe-page .time-meta {border:none;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:1rem 0;background:none;gap:.8rem 1rem;}
.time-item {display:inline-flex;align-items:center;gap:.4rem;}
.recipe-actions {padding:1rem 0;border-bottom:1px solid var(--line);}
.recipe-page .recipe-actions button,.recipe-page .recipe-actions .jump {border-radius:0;min-height:44px;}
.recipe-actions .jump {display:inline-flex;align-items:center;}
.recipe-actions .cook-open {background:var(--plum);}
.recipe-page h2 {margin-top:2rem;}
.cook-mode {color:var(--ink);background:var(--bg);}
.cook-mode button {border-radius:0;min-height:44px;}
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
 .after-copy p {font-size:.8rem;line-height:1.5;margin-bottom:1rem;}
 .discovery-cta {font-size:.75rem;gap:.5rem;padding:.8rem;}
 .identity-art img {object-position:50% center;}
 .identity-art figcaption {font-size:.5rem;right:.25rem;left:.25rem;bottom:.25rem;padding:.25rem;}
 .featured-recipe {grid-template-columns:1fr;gap:1rem;padding:1.5rem 1rem;}
 .featured-recipe h2 {font-size:2rem;max-width:14ch;}
 .featured-facts {justify-content:flex-start;}
 .discovery-index {padding:1.75rem 1rem 2.5rem;}
 .index-heading h2 {font-size:1.8rem;}
 .index-heading p {font-size:.75rem;}
 .discovery .chip {font-size:.75rem;padding:.4rem .6rem;}
 .discovery-list li {grid-template-columns:1.1rem minmax(0,1fr) auto;gap:.5rem;padding:1.2rem 0;}
 .discovery-list h3 {font-size:1.1rem;}
 .discovery-list .eyebrow {font-size:.6rem;}
 .row-end {min-width:54px;}
 .row-end .icon-stat {font-size:.65rem;gap:.2rem;}
 .row-end .fact-icon {display:none;}
 .recipe-page {padding:1.25rem 1rem 3rem;}
 .recipe-page h1 {font-size:2rem;}
 .recipe-actions .cook-open {margin-left:0;}
 .footer-fine {padding:0 1rem 2rem;}
}
@media print {body,.site-header,.site-footer,main.wide.discovery{background:white;color:black;} .site-header,.site-footer {display:none;} .recipe-page{border:0;}}
`;
