// Small drawn icons for the wonder games: coins, points, shields, the resources and the
// science symbols, so a card or a city can be read at a glance. Colours come from the
// palette in src/index.css (`--icon-*` and `--res-*`).

export type IconName =
  | 'coin'
  | 'points'
  | 'shield'
  | 'defeat'
  | 'stage'
  | 'trade'
  | 'chain'
  | 'wood'
  | 'stone'
  | 'clay'
  | 'ore'
  | 'glass'
  | 'cloth'
  | 'papyrus'
  | 'compass'
  | 'gear'
  | 'tablet';

const LABELS: Record<IconName, string> = {
  coin: 'coin',
  points: 'points',
  shield: 'shield',
  defeat: 'defeat',
  stage: 'wonder stage',
  trade: 'trade',
  chain: 'chain',
  wood: 'wood',
  stone: 'stone',
  clay: 'clay',
  ore: 'ore',
  glass: 'glass',
  cloth: 'cloth',
  papyrus: 'papyrus',
  compass: 'compass',
  gear: 'gear',
  tablet: 'tablet',
};

function Shape({ name }: { name: IconName }) {
  switch (name) {
    case 'coin':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill="var(--icon-coin)" />
          <circle cx="12" cy="12" r="6" fill="none" stroke="var(--icon-coin-edge)" strokeWidth="1.6" />
        </>
      );
    case 'points':
      // A star: points at the end of the game.
      return <path d="M12 2.5l2.8 6.1 6.7.7-5 4.5 1.4 6.6L12 17l-5.9 3.4 1.4-6.6-5-4.5 6.7-.7z" fill="var(--icon-points)" />;
    case 'shield':
      return <path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" fill="var(--icon-shield)" />;
    case 'defeat':
      return (
        <>
          <path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" fill="var(--icon-defeat)" />
          <path d="M8.5 12h7" stroke="var(--icon-on-dark)" strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case 'stage':
      return (
        <>
          <path d="M12 4 21 20H3z" fill="var(--icon-stage)" />
          <path d="M7.5 13h9M5.5 17h13" stroke="var(--icon-on-dark)" strokeWidth="1.2" opacity="0.5" />
        </>
      );
    case 'trade':
      return <path d="M4 8h13l-3-3M20 16H7l3 3" fill="none" stroke="var(--icon-trade)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
    case 'chain':
      return (
        <g fill="none" stroke="var(--icon-trade)" strokeWidth="2" strokeLinecap="round">
          <path d="M10 14l4-4" />
          <path d="M8.5 11.5 6.8 13.2a3 3 0 0 0 4.2 4.2l1.7-1.7" />
          <path d="M15.5 12.5l1.7-1.7a3 3 0 0 0-4.2-4.2l-1.7 1.7" />
        </g>
      );
    case 'wood':
      // A log, end on.
      return (
        <>
          <rect x="3" y="8" width="15" height="8" rx="2" fill="var(--res-wood)" />
          <ellipse cx="18" cy="12" rx="3" ry="4" fill="var(--icon-wood-end)" />
          <ellipse cx="18" cy="12" rx="1.3" ry="1.8" fill="none" stroke="var(--res-wood)" strokeWidth="0.9" />
        </>
      );
    case 'stone':
      return (
        <>
          <path d="M3 18 6 10l5-3 5 2 5 9z" fill="var(--res-stone)" />
          <path d="M6 10l4 3 6-4M10 13l-1 5" fill="none" stroke="var(--icon-on-dark)" strokeWidth="1" opacity="0.35" />
        </>
      );
    case 'clay':
      // A brick.
      return (
        <>
          <path d="M3 10l5-3h13l-5 3z" fill="var(--icon-clay-top)" />
          <path d="M3 10h13v8H3z" fill="var(--res-clay)" />
          <path d="M16 10l5-3v8l-5 3z" fill="var(--icon-clay-side)" />
        </>
      );
    case 'ore':
      // A pickaxe, so ore doesn't read as stone.
      return (
        <>
          <path d="M6.5 20.5 15 12" stroke="var(--icon-wood-end)" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M4 7.5C8 3.5 15 3 20.5 6.5L18.5 9C14.5 6.8 10 7 6.5 9.5z" fill="var(--res-ore)" />
          <circle cx="16.2" cy="6.8" r="1.1" fill="var(--icon-glint)" />
        </>
      );
    case 'glass':
      // A flask.
      return (
        <>
          <path d="M9.5 3h5v5l5 10a2 2 0 0 1-1.8 3H6.3a2 2 0 0 1-1.8-3l5-10z" fill="var(--res-glass)" opacity="0.9" />
          <path d="M6.5 15h11" stroke="var(--icon-on-dark)" strokeWidth="1" opacity="0.4" />
        </>
      );
    case 'cloth':
      // A folded bolt of cloth.
      return (
        <>
          <path d="M4 7h16v4H4z" fill="var(--res-cloth)" />
          <path d="M4 11h16v4H4z" fill="var(--icon-cloth-dark)" />
          <path d="M4 15h16v3H4z" fill="var(--res-cloth)" />
        </>
      );
    case 'papyrus':
      // A scroll.
      return (
        <>
          <rect x="6" y="5" width="12" height="14" rx="1" fill="var(--res-papyrus)" />
          <rect x="4" y="3.5" width="16" height="3" rx="1.5" fill="var(--icon-scroll-roll)" />
          <rect x="4" y="17.5" width="16" height="3" rx="1.5" fill="var(--icon-scroll-roll)" />
          <path d="M9 10h6M9 13h5" stroke="var(--icon-on-light)" strokeWidth="1" opacity="0.5" />
        </>
      );
    case 'compass':
      // A drawing compass.
      return (
        <g stroke="var(--icon-science)" strokeWidth="2" strokeLinecap="round" fill="none">
          <circle cx="12" cy="5" r="1.8" fill="var(--icon-science)" />
          <path d="M11 6.5 6 20M13 6.5 18 20M8 15h8" />
        </g>
      );
    case 'gear':
      return (
        <g fill="var(--icon-science)">
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x="10.6" y="2.5" width="2.8" height="4" rx="0.6" transform={`rotate(${i * 45} 12 12)`} />
          ))}
          <circle cx="12" cy="12" r="6.5" />
          <circle cx="12" cy="12" r="2.4" fill="var(--icon-on-dark)" />
        </g>
      );
    case 'tablet':
      // A stone tablet with marks.
      return (
        <>
          <path d="M6 4h12a1 1 0 0 1 1 1v15H5V5a1 1 0 0 1 1-1z" fill="var(--icon-science)" />
          <path d="M8 8h8M8 11h8M8 14h5" stroke="var(--icon-on-dark)" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
  }
}

/** One icon, inline with text. */
export function Icon({ name, size = 14, title }: { name: IconName; size?: number; title?: string }) {
  return (
    <svg className="game-icon" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title ?? LABELS[name]}>
      <Shape name={name} />
    </svg>
  );
}

/** An icon with a number beside it: "3 [coin]" reads as 3 coins. */
export function Count({ name, n, size = 14 }: { name: IconName; n: number | string; size?: number }) {
  return (
    <span className="icon-count">
      <span>{n}</span>
      <Icon name={name} size={size} />
    </span>
  );
}
