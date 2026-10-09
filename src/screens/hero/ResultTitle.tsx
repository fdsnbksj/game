import { LOSE_LINES, pick, WIN_LINES } from './memes';

/** A fight's end, meme-style: a giant W or L and a caption. */
export function ResultTitle({ won, n }: { won: boolean; n: number }) {
  return (
    <>
      <p className={`result-big ${won ? 'win' : 'lose'}`}>{won ? 'W' : 'L'}</p>
      <p className="result-caption">{pick(won ? WIN_LINES : LOSE_LINES, n)}</p>
    </>
  );
}
