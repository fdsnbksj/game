import { NavLink } from 'react-router';

const TABS = [
  {
    to: '/',
    label: 'Home',
    icon: <path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  },
  {
    to: '/hero/wardrobe',
    label: 'Wardrobe',
    icon: <path d="M9 4l3 2 3-2 5 3-2 4-2-1v10H8V10l-2 1-2-4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  },
  {
    to: '/hero/summon',
    label: 'Summon',
    icon: (
      <>
        <circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 13h14M12 3v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="13" r="2" fill="currentColor" />
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

/** The tabs along the bottom, game-style: home (your hero), the wardrobe, Summon, the rankings, and you. */
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
