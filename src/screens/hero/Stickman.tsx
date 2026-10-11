/**
 * A plain stick figure, in the current colour, facing right (`flip` faces it left). Its
 * front arm is its own path, so CSS can swing it (`.punch` in index.css).
 */
export function Stickman({ flip = false, className = '' }: { flip?: boolean; className?: string }) {
  return (
    <svg className={`stickman${className ? ` ${className}` : ''}`} viewBox="0 0 60 100" aria-hidden="true">
      <g transform={flip ? 'translate(60 0) scale(-1 1)' : undefined} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="30" cy="16" r="10" />
        <path d="M30 26v34M30 36l-14 14M30 60l-12 30M30 60l12 30" />
        <path className="stickman-arm" d="M30 36l16 10" />
      </g>
    </svg>
  );
}
