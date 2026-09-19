/** The neon "Neon Brawl" logotype. Same look as the boot splash in index.html. */
export function Wordmark({ as: Tag = 'h1' }: { as?: 'h1' | 'div' }) {
  return (
    <Tag className="title">
      Neon <span>Brawl</span>
    </Tag>
  );
}
