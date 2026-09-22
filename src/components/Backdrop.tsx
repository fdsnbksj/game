/**
 * The scene behind every screen: a night gradient, a receding grid floor and two slow
 * light blobs. Glass panels need something behind them to blur, or they're just grey.
 */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-glow one" />
      <div className="backdrop-glow two" />
      <div className="backdrop-horizon" />
      <div className="backdrop-grid" />
    </div>
  );
}
