// Each wonder drawn as a plain silhouette against the sky, for the board: our own shapes of the
// real historical buildings, nothing from the published game's art.

function Shape({ id }: { id: string }) {
  switch (id) {
    case 'giza':
      return (
        <>
          <path d="M14 52 42 16 70 52z" />
          <path d="M54 52 78 22 102 52z" />
          <path d="M90 52 103 35 116 52z" />
          <path d="M42 16 70 52H56z" className="shade" />
          <path d="M78 22 102 52H90z" className="shade" />
        </>
      );
    case 'rhodes':
      // The bronze giant astride the harbour mouth, torch held high.
      return (
        <>
          <rect x="30" y="44" width="16" height="8" />
          <rect x="74" y="44" width="16" height="8" />
          <path d="M38 44 57 24M82 44 63 24" className="limb" />
          <path d="M60 26V12" className="limb thick" />
          <circle cx="60" cy="8" r="3.4" />
          <path d="M60 15 70 4M60 15l-8 8" className="limb" />
          <circle cx="71" cy="3" r="2.4" className="fire" />
        </>
      );
    case 'alexandria':
      // Three tiers, the fire on top.
      return (
        <>
          <rect x="42" y="34" width="36" height="18" />
          <rect x="49" y="20" width="22" height="14" />
          <rect x="54" y="10" width="12" height="10" />
          <rect x="49" y="20" width="22" height="2" className="shade" />
          <rect x="42" y="34" width="36" height="2" className="shade" />
          <circle cx="60" cy="7" r="3.6" className="fire" />
        </>
      );
    case 'ephesus':
      // A temple front: steps, columns, pediment.
      return (
        <>
          <path d="M30 22 60 8 90 22z" />
          <rect x="30" y="22" width="60" height="3" />
          {[33, 41, 49, 57, 65, 73, 81].map((x) => (
            <rect key={x} x={x} y="26" width="4" height="20" />
          ))}
          <rect x="27" y="46" width="66" height="3" />
          <rect x="24" y="49" width="72" height="3" />
        </>
      );
    case 'babylon':
      // Stepped terraces spilling with green.
      return (
        <>
          <rect x="28" y="40" width="64" height="12" />
          <rect x="38" y="28" width="44" height="12" />
          <rect x="48" y="16" width="24" height="12" />
          {[
            [30, 40],
            [44, 40],
            [76, 40],
            [90, 40],
            [40, 28],
            [56, 28],
            [80, 28],
            [52, 16],
            [68, 16],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4" className="green" />
          ))}
        </>
      );
    case 'olympia':
      // The seated god inside his temple.
      return (
        <>
          <path d="M26 20 60 6 94 20z" />
          <rect x="26" y="20" width="68" height="3" />
          <rect x="28" y="23" width="5" height="26" />
          <rect x="87" y="23" width="5" height="26" />
          <circle cx="60" cy="27" r="3.6" />
          <path d="M53 33h14v9h6v7H47v-7h6z" />
          <path d="M69 31v18" className="limb" />
          <rect x="24" y="49" width="72" height="3" />
        </>
      );
    case 'halicarnassus':
      // A tomb on a high podium: colonnade, stepped roof, a chariot on top.
      return (
        <>
          <rect x="38" y="36" width="44" height="16" />
          {[40, 48, 56, 64, 72, 78].map((x) => (
            <rect key={x} x={x} y="25" width="3" height="11" />
          ))}
          <rect x="37" y="23" width="46" height="2" />
          <path d="M40 23h40l-4-4H44zM45 19h30l-4-4H49zM50 15h20l-4-4H54z" />
          <rect x="55" y="7" width="10" height="4" />
          <circle cx="57" cy="11" r="1.6" className="fire" />
          <circle cx="63" cy="11" r="1.6" className="fire" />
        </>
      );
    default:
      return <path d="M30 52 60 14 90 52z" />;
  }
}

/** A wonder standing on the ground, fitted to its box's height; the sky behind is the box's own background. */
export function WonderArt({ id }: { id: string }) {
  return (
    <svg className="wonder-art" viewBox="0 0 120 60" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <circle cx="104" cy="12" r="6" className="sun" />
      <g className="wonder-shape">
        <Shape id={id} />
      </g>
    </svg>
  );
}
