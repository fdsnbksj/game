import { NavLink } from 'react-router';

const TABS = [
  {
    to: '/',
    label: 'Map',
    icon: <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  },
  {
    to: '/saved',
    label: 'Cards',
    icon: (
      <>
        <rect x="7" y="3.5" width="12" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.5 7v11.5A2.5 2.5 0 0 0 7 21h9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
  },
  {
    to: '/ranks',
    label: 'Ranks',
    icon: (
      <path
        d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4M8.5 20h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    to: '/account',
    label: 'Me',
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.5 20.5c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
  },
];

/** The four tabs along the bottom, game-style: the map, your cards, the rankings, and you. */
export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {t.icon}
          </svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
