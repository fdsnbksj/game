import { useLocation } from 'react-router';

/**
 * Where a page was opened from, if a link said so (the puzzle's ⋯ menu passes
 * `state={{ from: '/nonograms' }}`), so its back arrow returns there; otherwise home.
 */
export function useCameFrom() {
  const state = useLocation().state as { from?: string } | null;
  return () => (typeof state?.from === 'string' && state.from.startsWith('/') ? state.from : '/');
}
