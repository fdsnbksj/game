import type { FighterId } from '../../games/brawl/fighters';

/** Each fighter by their weapon. */
export function WeaponGlyph({ fighter }: { fighter: FighterId }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      {fighter === 'knight' && (
        <>
          <path d="M18.5 3.5 20.5 5.5 9 17l-2-2z" fill="currentColor" />
          <path d="M5 13.5l5.5 5.5-1.4 1.4-5.5-5.5z" fill="currentColor" opacity="0.7" />
          <path d="M5.2 17.4 3.5 19.1l1.4 1.4 1.7-1.7z" fill="currentColor" opacity="0.7" />
        </>
      )}
      {fighter === 'smith' && (
        <>
          <path d="M5 19.6 14.2 10.4l1.4 1.4-9.2 9.2z" fill="currentColor" opacity="0.7" />
          <path d="M12.6 4.4l3.2-1.6 5.4 5.4-1.6 3.2z" fill="currentColor" />
          <path d="M11.3 6.9l5.8 5.8-1.8 1.8-5.8-5.8z" fill="currentColor" />
        </>
      )}
      {fighter === 'lancer' && (
        <>
          <path d="M3.3 19.3 16 6.6l1.4 1.4L4.7 20.7z" fill="currentColor" opacity="0.7" />
          <path d="M21 3l-1.6 6.4-2.6-2.6-2.2-2.2z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
