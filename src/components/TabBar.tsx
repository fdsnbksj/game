import { NavLink } from 'react-router';

const TABS = [
  { to: '/', label: 'Home', icon: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z' },
  { to: '/ranks', label: 'Ranks', icon: 'M4 20V11h4v9zM10 20V5h4v15zM16 20v-7h4v7z' },
  { to: '/how', label: 'Guide', icon: 'M5 4h9l5 5v11H5zM14 4v5h5M8 13h8M8 16h6' },
  { to: '/profile', label: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1-4 4.5-6 8-6s7 2 8 6z' },
];

/** Glass navigation along the bottom of every screen but the battle. */
export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => (isActive ? 'tab-link active' : 'tab-link')}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d={tab.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
