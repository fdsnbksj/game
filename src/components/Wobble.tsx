// The cartoon look's wobbly hand-drawn lines: two SVG filters that nudge every edge a pixel or two
// with noise, so outlines look inked by hand. `#wobble` holds still; `#boil` swaps its noise
// three times a second, the "line boil" of hand-drawn cartoons, with no JavaScript running.
// Mounted once (App.tsx); CSS applies them (`filter: url(#boil)`), and reduced motion keeps
// to the still one.
export function Wobble() {
  return (
    <svg className="wobble-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="wobble" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="boil" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="noise">
          <animate attributeName="seed" values="3;7;11" dur="0.45s" calcMode="discrete" repeatCount="indefinite" />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
