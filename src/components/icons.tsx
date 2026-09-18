export function FlameIcon({ size = 18 }: { size?: number }) {
  return (
    <svg className="flame" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2c1 3.5 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4 2.5-5.3.2 1.7.9 2.8 2 3.3C10.3 8 11 5 12 2z"
        fill="currentColor"
      />
      <path d="M12 21a2.8 2.8 0 0 1-2.8-2.8c0-1.6 1.3-2.6 2.8-4.2 1.5 1.6 2.8 2.6 2.8 4.2A2.8 2.8 0 0 1 12 21z" fill="#fff6d0" />
    </svg>
  );
}
