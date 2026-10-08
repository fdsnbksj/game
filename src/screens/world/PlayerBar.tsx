import { Link } from 'react-router';
import { useKnowledgeStore } from '../../knowledgeStore';
import { useNonogramStore } from '../../nonogramStore';
import { useGameStore } from '../../store';

/** Who you are, along the top: your avatar and name, your tower floor, cards kept, and settings. */
export function PlayerBar() {
  const name = useGameStore((s) => s.player?.displayName);
  const level = useNonogramStore((s) => s.level);
  const cards = useKnowledgeStore((s) => s.saved.length);
  return (
    <header className="player-bar">
      <Link className="player-avatar" to="/account" aria-label="Your account">
        {name ? name.slice(0, 1).toUpperCase() : '·'}
      </Link>
      <div className="player-who">
        <strong>{name ?? 'Traveller'}</strong>
        <span className="player-chips">
          <span className="player-chip tower" title="Puzzle Tower floor">
            Lv {level}
          </span>
          <span className="player-chip cards" title="Cards kept">
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <rect x="5" y="3" width="13" height="18" rx="2.5" fill="currentColor" />
            </svg>
            {cards}
          </span>
        </span>
      </div>
      <Link className="icon-button" to="/settings" aria-label="Settings">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm8-3.2-.02-.66 1.9-1.5-1.8-3.1-2.3.8a7.6 7.6 0 0 0-1.14-.66L16.3 4.4h-3.6l-.36 2.4c-.4.18-.78.4-1.14.66l-2.3-.8-1.8 3.1 1.9 1.5L9 12l.02.66-1.9 1.5 1.8 3.1 2.3-.8c.36.26.74.48 1.14.66l.36 2.4h3.6l.36-2.4c.4-.18.78-.4 1.14-.66l2.3.8 1.8-3.1-1.9-1.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </header>
  );
}
