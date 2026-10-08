import type { WeaponId } from '../../games/brawl/weapons';

/** Each weapon as a small icon: in the score line, and in How to play. */
export function WeaponGlyph({ weapon, size = 26 }: { weapon: WeaponId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {weapon === 'fists' && (
        <>
          <rect x="6" y="8" width="12" height="9" rx="3" fill="currentColor" />
          <rect x="6" y="5.5" width="3" height="4" rx="1.4" fill="currentColor" opacity="0.8" />
          <rect x="9.6" y="5" width="3" height="4" rx="1.4" fill="currentColor" opacity="0.8" />
          <rect x="13.2" y="5.5" width="3" height="4" rx="1.4" fill="currentColor" opacity="0.8" />
          <rect x="8" y="17" width="8" height="3" rx="1" fill="currentColor" opacity="0.6" />
        </>
      )}
      {weapon === 'sword' && (
        <>
          <path d="M18.5 3.5 20.5 5.5 9 17l-2-2z" fill="currentColor" />
          <path d="M5 13.5l5.5 5.5-1.4 1.4-5.5-5.5z" fill="currentColor" opacity="0.7" />
          <path d="M5.2 17.4 3.5 19.1l1.4 1.4 1.7-1.7z" fill="currentColor" opacity="0.7" />
        </>
      )}
      {weapon === 'hammer' && (
        <>
          <path d="M5 19.6 14.2 10.4l1.4 1.4-9.2 9.2z" fill="currentColor" opacity="0.7" />
          <path d="M12.6 4.4l3.2-1.6 5.4 5.4-1.6 3.2z" fill="currentColor" />
          <path d="M11.3 6.9l5.8 5.8-1.8 1.8-5.8-5.8z" fill="currentColor" />
        </>
      )}
      {weapon === 'spear' && (
        <>
          <path d="M3.3 19.3 16 6.6l1.4 1.4L4.7 20.7z" fill="currentColor" opacity="0.7" />
          <path d="M21 3l-1.6 6.4-2.6-2.6-2.2-2.2z" fill="currentColor" />
        </>
      )}
      {weapon === 'axe' && (
        <>
          <path d="M5 20.4 15.6 9.8l1.4 1.4L6.4 21.8z" fill="currentColor" opacity="0.7" />
          <path d="M13 4.5c3.5-1.5 7 .5 7.5 4.5L15.5 9 13 6.5z" fill="currentColor" />
        </>
      )}
      {weapon === 'pistol' && (
        <>
          <rect x="4" y="8" width="14" height="5" rx="1.5" fill="currentColor" />
          <rect x="5" y="12" width="5" height="8" rx="1.5" fill="currentColor" opacity="0.75" />
        </>
      )}
      {weapon === 'rifle' && (
        <>
          <rect x="2" y="9" width="20" height="4.5" rx="1.5" fill="currentColor" />
          <rect x="8" y="13" width="3.5" height="6" rx="1" fill="currentColor" opacity="0.75" />
          <rect x="2" y="10" width="5" height="7" rx="1.5" fill="currentColor" opacity="0.6" />
        </>
      )}
      {weapon === 'shotgun' && (
        <>
          <rect x="7" y="8.5" width="15" height="5.5" rx="2" fill="currentColor" />
          <rect x="2" y="10" width="6" height="6.5" rx="2" fill="currentColor" opacity="0.6" />
        </>
      )}
      {weapon === 'sniper' && (
        <>
          <rect x="1.5" y="11" width="21" height="3" rx="1" fill="currentColor" />
          <rect x="8" y="7" width="7" height="3" rx="1" fill="currentColor" opacity="0.8" />
          <rect x="1.5" y="12" width="4" height="6" rx="1.5" fill="currentColor" opacity="0.6" />
        </>
      )}
      {weapon === 'rocket' && (
        <>
          <rect x="2" y="8" width="18" height="7" rx="3" fill="currentColor" />
          <path d="M20 9.5l3 2-3 2z" fill="currentColor" opacity="0.7" />
          <rect x="8" y="15" width="3" height="5" rx="1" fill="currentColor" opacity="0.7" />
        </>
      )}
      {weapon === 'scythe' && (
        <>
          <path d="M5 21 14.5 4.5l1.3.8L6.3 21.8z" fill="currentColor" opacity="0.7" />
          <path d="M14.5 4.5c3.5-1 6.5 1 7 4.5-2-2-4.5-2.6-7.5-2.2z" fill="currentColor" />
        </>
      )}
      {weapon === 'knives' && (
        <>
          <path d="M4 20 14 10l1.6 1.6-10 10z" fill="currentColor" />
          <path d="M9 15 19 5l1.6 1.6-10 10z" fill="currentColor" opacity="0.6" />
        </>
      )}
      {weapon === 'boomerang' && <path d="M4 8.5 9 5.5 18 14l-3 3.5-2-1.5 1.5-2L7.5 9.5 5.5 11z" fill="currentColor" />}
      {weapon === 'frost' && (
        <>
          <path d="M5 21 15 9l1.3 1.1-10 12z" fill="currentColor" opacity="0.7" />
          <circle cx="17.5" cy="6.5" r="3.5" fill="currentColor" />
          <path d="M17.5 1.5v10M12.5 6.5h10" stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </>
      )}
      {weapon === 'chicken' && (
        <>
          <ellipse cx="14" cy="13" rx="7" ry="5" fill="currentColor" />
          <path d="M3 9l7 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M20 11l3 1-3 1z" fill="currentColor" opacity="0.7" />
        </>
      )}
      {weapon === 'baguette' && (
        <>
          <rect x="1.5" y="9.5" width="21" height="6" rx="3" fill="currentColor" transform="rotate(-25 12 12.5)" />
        </>
      )}
      {weapon === 'banana' && <path d="M4 7c1 8 8 12 16 9-6-1-11-4-13-10z" fill="currentColor" />}
      {weapon === 'bubbles' && (
        <>
          <rect x="2" y="12" width="10" height="5" rx="2" fill="currentColor" />
          <circle cx="16" cy="9" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="20.5" cy="4.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </>
      )}
      {weapon === 'blower' && (
        <>
          <rect x="2" y="9" width="9" height="8" rx="2.5" fill="currentColor" />
          <rect x="10" y="11" width="10" height="3.5" rx="1.5" fill="currentColor" opacity="0.8" />
          <path d="M21 8l2-1M21.5 12.5h2M21 17l2 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {weapon === 'bow' && (
        <>
          <path d="M7 3c7 3 7 15 0 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M7 3v18" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <path d="M4 12h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M21 12l-3.5-2.2v4.4z" fill="currentColor" />
        </>
      )}
      {weapon === 'grenades' && (
        <>
          <circle cx="10.5" cy="14" r="6.5" fill="currentColor" />
          <path d="M14.5 9l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18.6" cy="5.2" r="1.7" fill="currentColor" opacity="0.7" />
        </>
      )}
    </svg>
  );
}
