import type { CSSProperties, ReactNode } from 'react';

/** What a seat shows, besides the name. */
export interface SeatMarks {
  leader?: boolean;
  next?: boolean;
  lady?: boolean;
  /** On the team being voted on or on the quest. */
  team?: boolean;
  /** How they voted on the last team, once all votes were in. */
  vote?: 'approve' | 'reject';
  /** "Voted" or "Played" while waiting on others: that they have, not what. */
  done?: string;
  you?: boolean;
  /** Your night knowledge of them, shown only while you hold your role card. */
  knows?: 'evil' | 'merlin' | 'merlin-or-morgana';
}

/**
 * The table as it is: seats around an oval, in seating order, clockwise from the top. The
 * lead passes clockwise, so the next leader is always the seat after the leader's.
 * With `onPick`, seats can be tapped to choose players.
 */
export function TableView({
  playerIds,
  names,
  marks,
  picked = [],
  canPick,
  onPick,
  center,
}: {
  playerIds: string[];
  names: Record<string, string>;
  marks: (uid: string) => SeatMarks;
  picked?: string[];
  canPick?: (uid: string) => boolean;
  onPick?: (uid: string) => void;
  center?: ReactNode;
}) {
  const n = playerIds.length;
  return (
    <div className="table-view" style={{ '--n': n } as CSSProperties}>
      <div className="table-top" aria-hidden="true">
        {center}
        <span className="clockwise">Lead passes clockwise ↻</span>
      </div>
      <ol className="seats">
        {playerIds.map((uid, i) => {
          // Clockwise from 12 o'clock, on an oval a little wider than tall.
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const style = { left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 40 * Math.sin(angle)}%` } as CSSProperties;
          const m = marks(uid);
          const pickable = !!onPick && (canPick?.(uid) ?? true);
          const known = m.knows === 'evil' ? 'known-evil' : m.knows === 'merlin' ? 'known-merlin' : m.knows ? 'known-maybe' : null;
          const cls = ['seat', m.team && 'team', m.you && 'you', picked.includes(uid) && 'picked', pickable && 'pickable', m.leader && 'leading', known]
            .filter(Boolean)
            .join(' ');
          const body = (
            <>
              <span className="seat-name">{m.you ? 'You' : names[uid]}</span>
              <span className="seat-marks">
                {m.knows === 'evil' && <span className="mark evil">Evil</span>}
                {m.knows === 'merlin' && <span className="mark merlin">Merlin</span>}
                {m.knows === 'merlin-or-morgana' && <span className="mark maybe">Merlin?</span>}
                {m.leader && <span className="mark lead">Leader</span>}
                {m.next && <span className="mark">Next</span>}
                {m.lady && <span className="mark lady">Lady</span>}
                {m.vote === 'approve' && <span className="mark yes">✓</span>}
                {m.vote === 'reject' && <span className="mark no">✗</span>}
                {m.done && <span className="mark">{m.done}</span>}
              </span>
            </>
          );
          return (
            <li key={uid} className="seat-slot" style={style}>
              {onPick ? (
                <button className={cls} disabled={!pickable} aria-pressed={picked.includes(uid)} onClick={() => onPick(uid)}>
                  {body}
                </button>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
