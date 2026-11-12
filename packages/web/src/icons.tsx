/**
 * Pure inline SVG brand marks, culinary category icons, social brand marks,
 * and editorial empty-state illustrations. Zero external icon fonts or requests.
 */

export function TwinYolkLogoMark({ className = 'brand-yolks-svg' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 22" aria-hidden="true" focusable="false">
      <ellipse className="yolk-one" cx="11.5" cy="11.5" rx="8.2" ry="7.6" fill="currentColor" />
      <ellipse className="yolk-two" cx="26.8" cy="10.5" rx="7.4" ry="7" fill="#ffd166" />
      <path d="M7.8 8.3a4.2 3.8 0 0 1 4.6-1.9" fill="none" stroke="#211729" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path d="M23.5 7.6a3.6 3.3 0 0 1 4-1.6" fill="none" stroke="#211729" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className = 'icon-arrow' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4.5 11.5L11.5 4.5" />
      <path d="M5.5 4.5h6v6" />
    </svg>
  );
}

export function CategoryIcon({ slug, className = 'cat-icon' }: { slug?: string | null; className?: string }) {
  if (!slug) return null;
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {slug === 'soups-stews' ? (
        <>
          <path d="M3.5 9.5h13v3a5.5 5.5 0 0 1-5.5 5.5H9a5.5 5.5 0 0 1-5.5-5.5v-3z" />
          <path d="M2 9.5h16M7 6c0-1 .8-1.5.8-2.5M10 6c0-1 .8-1.5.8-2.5M13 6c0-1 .8-1.5.8-2.5" />
        </>
      ) : slug === 'tacos-tortillas' ? (
        <>
          <path d="M3 14.5a7 7 0 0 1 14 0H3z" />
          <path d="M6.2 11.2c.8-.7 1.8-.7 2.5 0 .8.7 1.8.7 2.6 0 .7-.7 1.7-.7 2.5 0" />
        </>
      ) : slug === 'dumplings' ? (
        <>
          <path d="M3 13.5c0-4.2 3.1-7 7-7s7 2.8 7 7c0 1.2-.9 2-2.2 2H5.2c-1.3 0-2.2-.8-2.2-2z" />
          <path d="M6.5 7.5l1.2 2M10 6.5v2.3M13.5 7.5l-1.2 2" />
        </>
      ) : slug === 'desserts-baking' ? (
        <>
          <path d="M5.5 11.5l1.2 5.5h6.6l1.2-5.5" />
          <path d="M4.5 11.5a3 3 0 0 1 2.2-5 3.2 3.2 0 0 1 6.6 0 3 3 0 0 1 2.2 5H4.5z" />
        </>
      ) : slug === 'drinks' ? (
        <>
          <path d="M5.5 4.5h9l-1.2 8a3.3 3.3 0 0 1-6.6 0l-1.2-8z" />
          <path d="M10 15.8v2.2M7.5 18h5M12.5 2.5L11 7.5" />
        </>
      ) : slug === 'breakfast' ? (
        <>
          <path d="M10 3.2c4.2 0 6.8 3.2 6.8 6.9 0 3.9-2.9 6.7-6.8 6.7s-6.8-2.8-6.8-6.7C3.2 6.4 5.8 3.2 10 3.2z" />
          <circle cx="10.2" cy="10.6" r="2.7" />
        </>
      ) : slug === 'mains' ? (
        <>
          <path d="M3.5 13.5a6.5 6.5 0 0 1 13 0" />
          <path d="M2 13.5h16M10 5v2" />
          <circle cx="10" cy="4.2" r="1" />
        </>
      ) : slug === 'sides' ? (
        <>
          <path d="M3.5 10.5h13a6.5 6.5 0 0 1-13 0z" />
          <path d="M7 10.5c0-2.5 2-4.5 4.8-4.5 0 2.5-2 4.5-4.8 4.5z" />
        </>
      ) : slug === 'snacks-dips' ? (
        <>
          <path d="M3.5 11.5h13a5.5 5.5 0 0 1-11 0" />
          <path d="M9.5 4.5l3.8 5.2-5.6.8 1.8-6z" />
        </>
      ) : (
        <circle cx="10" cy="10" r="5" />
      )}
    </svg>
  );
}

export function FactIcon({ kind = 'clock' }: { kind?: string }) {
  return (
    <svg className="fact-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'servings' ? (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19.5v-1.8a5.5 5.5 0 0 1 11 0v1.8" />
          <circle cx="16.5" cy="9" r="2.5" />
          <path d="M15.5 14.2a4.5 4.5 0 0 1 5 4.4v.9" />
        </>
      ) : kind === 'prep' ? (
        <>
          <path d="M4 19.5h16" />
          <path d="M6.5 15.5L16.8 5.2a2.1 2.1 0 0 1 3 3L9.5 18.5H6.5v-3z" />
        </>
      ) : kind === 'cook' ? (
        <>
          <path d="M5 9.5h14v8.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9.5z" />
          <path d="M2.5 12h2.5m14 0h2.5M8.5 6.2V3.8m3.5 2.4V2.8m3.5 3.4V3.8" />
        </>
      ) : kind === 'rest' ? (
        <>
          <path d="M6.5 3.5h11M6.5 20.5h11" />
          <path d="M8 3.5v3.5l4 4-4 4v5.5M16 3.5v3.5l-4 4 4 4v5.5" />
        </>
      ) : kind === 'check' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.2 12.3l2.5 2.5 5.2-5.4" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6.5v5.5l3.8 2" />
        </>
      )}
    </svg>
  );
}

export function SocialIcon({ name, className = 'social-icon' }: { name: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {name === 'instagram' ? (
        <>
          <rect x="3" y="3" width="14" height="14" rx="4" />
          <circle cx="10" cy="10" r="3.2" />
          <circle cx="14.3" cy="5.7" r="0.8" fill="currentColor" stroke="none" />
        </>
      ) : name === 'pinterest' ? (
        <>
          <circle cx="10" cy="10" r="7.5" />
          <path d="M8.6 15.8l1.2-5.2m-.4 2.1c.5.6 1.2.9 2 .9 1.9 0 3.2-1.7 3.2-3.8 0-2.1-1.7-3.6-4.1-3.6-2.7 0-4.4 1.8-4.4 3.8 0 .9.4 1.8 1.1 2.2" />
        </>
      ) : name === 'whatsapp' ? (
        <>
          <path d="M10 2.8a7.1 7.1 0 0 0-6.1 10.7L3 17l3.7-.9A7.1 7.1 0 1 0 10 2.8z" />
          <path d="M7.6 7.5c.2-.4.5-.4.7-.4h.5c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.4.5c.4.8 1.1 1.5 2 1.9l.5-.5c.2-.2.4-.2.6-.1l1.3.6c.3.1.4.3.4.5 0 .6-.5 1.2-1.2 1.3-1.2.2-3-.4-4.3-1.7-1.2-1.2-1.9-2.8-1.6-4.1z" />
        </>
      ) : name === 'x' ? (
        <path d="M4 3.8l4.8 6.3L4.2 16.2h1.6l3.8-4.9 3.6 4.9H16l-5.1-6.8 4.4-5.6h-1.6l-3.5 4.4-3.2-4.4H4z" />
      ) : name === 'facebook' ? (
        <path d="M11.5 17v-6h2.1l.4-2.5h-2.5V7c0-.7.3-1.2 1.3-1.2H14V3.5c-.4-.1-1.1-.2-2-.2-2 0-3.3 1.2-3.3 3.4v1.8H6.5V11h2.2v6h2.8z" />
      ) : name === 'reddit' ? (
        <>
          <circle cx="10" cy="11.3" r="5.5" />
          <circle cx="8" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
          <path d="M8 13.3c.6.5 1.3.7 2 .7s1.4-.2 2-.7M10 5.8l1.2-2.6 2.5.6" />
          <circle cx="14.7" cy="4.1" r="1" />
        </>
      ) : name === 'telegram' ? (
        <path d="M16.8 3.6L2.9 9.1c-.7.3-.7.8-.1 1l3.5 1.1 8.1-5.1-6.5 6v2.8l2-2 3.1 2.3c.6.3 1 .1 1.2-.6l2.6-11z" />
      ) : name === 'tiktok' ? (
        <path d="M11.8 3.2v9.2a2.8 2.8 0 1 1-2.2-2.7V7.3a5.1 5.1 0 1 0 4.5 5.1V7.6c.9.7 2 1.1 3.1 1.1V6.4c-1.7-.1-3.1-1.5-3.2-3.2h-2.2z" />
      ) : name === 'youtube' ? (
        <>
          <rect x="2.5" y="4.8" width="15" height="10.4" rx="2.8" />
          <path d="M8.5 7.8l4.2 2.2-4.2 2.2V7.8z" fill="currentColor" stroke="none" />
        </>
      ) : name === 'email' ? (
        <>
          <rect x="2.8" y="4.5" width="14.4" height="11" rx="1.6" />
          <path d="M3.2 5.2l6.8 5.3 6.8-5.3" />
        </>
      ) : name === 'story' ? (
        <>
          <rect x="5" y="2.2" width="10" height="15.6" rx="2" />
          <circle cx="8.8" cy="7.5" r="1.4" />
          <path d="M5.5 14l3-2.8 2.2 2 1.8-1.6 2 2.4" />
        </>
      ) : name === 'og' ? (
        <>
          <rect x="2.2" y="4.2" width="15.6" height="11.6" rx="1.6" />
          <circle cx="6.2" cy="8.2" r="1.3" />
          <circle cx="8.8" cy="8.2" r="1.1" />
          <path d="M4.5 12.6h6M12.5 7.5v5.1M12.5 7.5h3M12.5 10.1h3M12.5 12.6h3" />
        </>
      ) : name === 'card' || name === 'copy' ? (
        <>
          <rect x="6.5" y="6.5" width="10" height="10" rx="1.6" />
          <path d="M13.5 6.5V4.8c0-.9-.7-1.6-1.6-1.6H4.8c-.9 0-1.6.7-1.6 1.6v7.1c0 .9.7 1.6 1.6 1.6h1.7" />
        </>
      ) : name === 'list' ? (
        <>
          <path d="M8 5.5h8.5M8 10h8.5M8 14.5h8.5" />
          <path d="M3.5 5.5l1.2 1.2 2-2.1M3.5 10l1.2 1.2 2-2.1M4.2 14.5h1.5" />
        </>
      ) : name === 'grid' ? (
        <>
          <rect x="3" y="3" width="5.8" height="5.8" rx="1" />
          <rect x="11.2" y="3" width="5.8" height="5.8" rx="1" />
          <rect x="3" y="11.2" width="5.8" height="5.8" rx="1" />
          <rect x="11.2" y="11.2" width="5.8" height="5.8" rx="1" />
        </>
      ) : name === 'index' ? (
        <>
          <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
        </>
      ) : name === 'sun' ? (
        <>
          <circle cx="10" cy="10" r="3.6" />
          <path d="M10 2.3v2M10 15.7v2M2.3 10h2M15.7 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M15.4 4.6L14 6M6 14l-1.4 1.4" />
        </>
      ) : name === 'moon' ? (
        <path d="M15.6 11.8A6.2 6.2 0 0 1 8.2 4.4a6.3 6.3 0 1 0 7.4 7.4z" />
      ) : name === 'plus' ? (
        <path d="M10 4.2v11.6M4.2 10h11.6" />
      ) : (
        <>
          <circle cx="14.5" cy="4.8" r="2.1" />
          <circle cx="5.5" cy="10" r="2.1" />
          <circle cx="14.5" cy="15.2" r="2.1" />
          <path d="M7.4 9l5.2-3.1M7.4 11l5.2 3.1" />
        </>
      )}
    </svg>
  );
}

export function EmptySkilletIllustration() {
  return (
    <svg className="empty-skillet-svg" viewBox="0 0 148 92" fill="none" aria-hidden="true" focusable="false">
      <ellipse cx="62" cy="58" rx="44" ry="20" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <ellipse cx="62" cy="55" rx="38" ry="15" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.45" />
      <path d="M105 53l35-10a3.5 3.5 0 0 1 2 6.6L106 60" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="51" cy="54" r="7.5" fill="#e0fa80" opacity="0.9" />
      <circle cx="71" cy="52" r="6.5" fill="#ffd166" opacity="0.9" />
      <path d="M46 28c0-5 4-6 4-11M63 25c0-5 4-6 4-11M79 28c0-5 4-6 4-11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
