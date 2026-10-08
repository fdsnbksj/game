import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { useKnowledgeStore } from '../knowledgeStore';

const Chevron = () => (
  <svg className="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Everything that isn't the puzzle, one tap away and out of the way. */
export function Menu({ onClose, onClear, canClear }: { onClose: () => void; onClear: () => void; canClear: boolean }) {
  const saved = useKnowledgeStore((s) => s.saved.length);
  // On body, so it covers the whole screen rather than sitting in the puzzle's layout.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <nav className="sheet" aria-label="Menu" onClick={(event) => event.stopPropagation()}>
        <div className="group">
          <Link className="row" to="/saved" state={{ from: '/nonograms' }}>
            <span>Saved cards</span>
            <span className="row-detail">{saved}</span>
            <Chevron />
          </Link>
          <Link className="row" to="/ranks" state={{ from: '/nonograms' }}>
            <span>Rankings</span>
            <Chevron />
          </Link>
          <Link className="row" to="/settings" state={{ from: '/nonograms' }}>
            <span>Settings</span>
            <Chevron />
          </Link>
        </div>
        <div className="group">
          <button
            className="row danger"
            disabled={!canClear}
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            Start this level over
          </button>
        </div>
      </nav>
    </div>,
    document.body,
  );
}
