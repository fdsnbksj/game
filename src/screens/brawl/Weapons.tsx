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
      {weapon === 'gauntlets' && (
        <>
          <rect x="5" y="9" width="14" height="10" rx="3.5" fill="currentColor" />
          <rect x="5" y="5" width="14" height="5" rx="2" fill="currentColor" opacity="0.75" />
          <rect x="7" y="19" width="10" height="2.5" rx="1" fill="currentColor" opacity="0.55" />
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
      {weapon === 'bow' && (
        <>
          <path d="M7 3c7 3 7 15 0 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M7 3v18" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          <path d="M4 12h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M21 12l-3.5-2.2v4.4z" fill="currentColor" />
        </>
      )}
      {weapon === 'bombs' && (
        <>
          <circle cx="10.5" cy="14" r="6.5" fill="currentColor" />
          <path d="M14.5 9l2.5-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18.6" cy="5.2" r="1.7" fill="currentColor" opacity="0.7" />
        </>
      )}
    </svg>
  );
}
