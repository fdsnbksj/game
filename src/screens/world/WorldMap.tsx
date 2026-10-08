import { useNavigate, Link } from 'react-router';
import { HeroGlyph } from '../../components/GameGlyphs';
import { tierOf } from '../../games/hero/arena';
import { BOT_LEVELS } from '../../games/hero/bots';
import { BOT_COUNT, heroLevel } from '../../games/hero/stats';
import { useHeroStore } from '../../heroStore';
import { lastRoom } from '../../lastPage';
import { useNonogramStore } from '../../nonogramStore';
import { ZONES, zoneOf, type ZoneId } from './zones';

/** The three landmarks, drawn in a 100×100 box so the map and the zone banners can share them. */
export function Landmark({ zone }: { zone: ZoneId }) {
  if (zone === 'keep') {
    // A castle: a wall, three towers with pointed roofs, a gate.
    return (
      <g className="landmark-art keep">
        <rect x="18" y="52" width="64" height="34" rx="2" className="fill" />
        {[18, 30, 42, 54, 66, 76].map((x) => (
          <rect key={x} x={x} y="46" width="6" height="7" className="fill" />
        ))}
        <rect x="12" y="34" width="16" height="52" rx="1.5" className="fill" />
        <rect x="72" y="34" width="16" height="52" rx="1.5" className="fill" />
        <rect x="41" y="22" width="18" height="64" rx="1.5" className="fill" />
        <path d="M10 35 20 18 30 35z M70 35 80 18 90 35z M39 23 50 4 61 23z" className="roof" />
        <path d="M43 86V72a7 7 0 0 1 14 0v14z" className="door" />
        <rect x="47" y="34" width="6" height="9" rx="3" className="window" />
        <rect x="17.5" y="46" width="5" height="7" rx="2.5" className="window" />
        <rect x="77.5" y="46" width="5" height="7" rx="2.5" className="window" />
      </g>
    );
  }
  if (zone === 'tower') {
    // A tall tower, tapering, with lit windows climbing it.
    return (
      <g className="landmark-art tower">
        <path d="M34 92 38 26h24l4 66z" className="fill" />
        <rect x="32" y="20" width="36" height="8" rx="1.5" className="fill" />
        {[32, 38, 44, 50, 56, 62].map((x) => (
          <rect key={x} x={x} y="15" width="4" height="6" className="fill" />
        ))}
        <path d="M36 16 50 0 64 16z" className="roof" />
        {[36, 50, 64, 78].map((y, i) => (
          <rect key={y} x={i % 2 ? 53 : 43} y={y} width="5" height="8" rx="2.5" className="window" />
        ))}
        <path d="M44 92V84a6 6 0 0 1 12 0v8z" className="door" />
      </g>
    );
  }
  // A colosseum: two tiers of arches in an oval.
  return (
    <g className="landmark-art arena">
      <ellipse cx="50" cy="78" rx="44" ry="14" className="fill" />
      <path d="M6 78V52c0-8 20-14 44-14s44 6 44 14v26" className="fill" />
      <ellipse cx="50" cy="52" rx="44" ry="14" className="roof" />
      <ellipse cx="50" cy="52" rx="32" ry="8" className="pit" />
      {[14, 26, 38, 50, 62, 74, 86].map((x) => (
        <path key={x} d={`M${x - 4} 80v-9a4 4 0 0 1 8 0v9z`} className="window" />
      ))}
      <path d="M50 26v12M50 26l10 4-10 4" className="flag" />
    </g>
  );
}

/** A small star field, laid out by a fixed formula so it never jumps between renders. */
const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 73.13) % 360,
  y: (i * 41.7) % 230,
  r: i % 5 === 0 ? 1.4 : 0.8,
  delay: (i % 7) * 0.6,
}));

/**
 * Where each landmark sits on the map (its 100×100 art scaled to `size`). A phone's screen is
 * narrower than the map, whose sides are trimmed, so everything stays between x 36 and 324.
 */
const PLACES: Record<ZoneId, { x: number; y: number; size: number }> = {
  keep: { x: 180, y: 165, size: 118 },
  tower: { x: 106, y: 360, size: 100 },
  arena: { x: 252, y: 405, size: 108 },
};

/**
 * The world: a night map with three landmarks to travel to. Tap one to enter its zone and
 * pick a game. A game still on (a room you're in) shows as a banner across the top.
 */
export function WorldMap() {
  const navigate = useNavigate();
  const level = useNonogramStore((s) => s.level);
  const hero = {
    level: useHeroStore((s) => heroLevel(s.tree)),
    next: useHeroStore((s) => Math.min(BOT_COUNT, s.cleared + 1)),
    fighting: useHeroStore((s) => !!s.fight),
    points: useHeroStore((s) => s.unspent()),
    rating: useHeroStore((s) => s.arena?.rating ?? null),
  };
  const room = lastRoom();
  const roomGame = room ? zoneOf(room.split('/')[1])?.games.find((g) => g.id === room.split('/')[1]) : undefined;
  const badges: Record<ZoneId, string> = {
    keep: `${ZONES[0].games.length} games`,
    tower: `Floor ${level}`,
    arena: 'Fight',
  };

  return (
    <div className="world-map">
      {room && roomGame && (
        <Link className="battle-banner" to={room}>
          <span className="battle-dot" aria-hidden="true" />
          <span>
            <span className="micro">Battle in progress</span>
            <strong>
              {roomGame.name} · {room.split('/')[2]}
            </strong>
          </span>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5L8 5.5z" fill="currentColor" />
          </svg>
        </Link>
      )}
      {/* The main game, one tap from opening the app, under the thumb. */}
      <Link className="hero-banner" to="/hero">
        <span className="game-glyph hero">
          <HeroGlyph />
        </span>
        <span>
          <span className="micro">
            Your hero · Lv {hero.level}
            {hero.rating !== null && ` · ${tierOf(hero.rating)}`}
            {hero.points > 0 && ` · ${hero.points} ${hero.points === 1 ? 'point' : 'points'} to spend`}
          </span>
          <strong>{hero.fighting ? 'Continue your fight' : `Next: ${BOT_LEVELS[hero.next - 1].name}`}</strong>
        </span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M8 5.5v13l10.5-6.5L8 5.5z" fill="currentColor" />
        </svg>
      </Link>
      <svg className="map-svg" viewBox="0 0 360 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="The world map">
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="20%" r="70%">
            <stop offset="0" className="map-glow-in" />
            <stop offset="1" stopColor="transparent" />
          </radialGradient>
          {(['keep', 'tower', 'arena'] as const).map((z) => (
            <radialGradient key={z} id={`halo-${z}`}>
              <stop offset="0" className={`halo-in ${z}`} />
              <stop offset="1" stopColor="transparent" />
            </radialGradient>
          ))}
        </defs>
        <rect width="360" height="560" className="map-sky" />
        <rect width="360" height="560" fill="url(#map-glow)" />
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} className="map-star" style={{ animationDelay: `${s.delay}s` }} />
        ))}
        {/* The land: one island, with a lower shelf to the south. */}
        <path className="map-land" d="M20 250C10 190 60 110 130 92c70-18 150-6 190 40 36 42 34 110 22 170-10 60-2 120-30 170-30 52-110 70-170 62C70 526 22 480 14 410 8 360 30 310 20 250z" />
        <path className="map-land-edge" d="M14 410c8 70 56 116 128 124 60 8 140-10 170-62" />
        {/* A river winding down between the tower and the arena. */}
        <path className="map-river" d="M200 96c-20 60 40 90 10 150-26 52-60 70-36 130 20 50 70 70 60 150" />
        {/* Trails between the landmarks. */}
        <path className="map-trail" d="M180 200C150 250 124 290 108 330" />
        <path className="map-trail" d="M182 202c36 50 56 120 66 172" />
        <path className="map-trail" d="M120 380c40 30 80 40 116 32" />
        {/* Clouds drifting over it all. */}
        <g className="map-cloud slow">
          <ellipse cx="60" cy="70" rx="38" ry="10" />
          <ellipse cx="80" cy="62" rx="22" ry="9" />
        </g>
        <g className="map-cloud">
          <ellipse cx="290" cy="270" rx="34" ry="9" />
          <ellipse cx="306" cy="263" rx="18" ry="8" />
        </g>

        {(['keep', 'tower', 'arena'] as const).map((z) => {
          const place = PLACES[z];
          const zone = ZONES.find((x) => x.id === z)!;
          const half = place.size / 2;
          const enter = () => navigate(`/zone/${z}`);
          return (
            <g
              key={z}
              className={`landmark ${z}`}
              role="link"
              tabIndex={0}
              aria-label={`${zone.name}: ${badges[z]}`}
              onClick={enter}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') enter();
              }}
            >
              <circle cx={place.x} cy={place.y} r={place.size * 0.72} fill={`url(#halo-${z})`} className="landmark-halo" />
              <g transform={`translate(${place.x - half} ${place.y - half}) scale(${place.size / 100})`}>
                <Landmark zone={z} />
              </g>
              {/* The name plate, and its badge. */}
              <g transform={`translate(${place.x} ${place.y + half + 12})`}>
                <rect x="-64" y="-12" width="128" height="24" rx="12" className="plate" />
                <text className="plate-name" textAnchor="middle" y="4.5">
                  {zone.name}
                </text>
                <g transform="translate(0 20)">
                  <rect x="-30" y="-9" width="60" height="18" rx="9" className={`plate-badge ${z}`} />
                  <text className="plate-badge-text" textAnchor="middle" y="4">
                    {badges[z]}
                  </text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
