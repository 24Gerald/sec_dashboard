import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useStore } from '@/data/store';
import { isOpen } from '@/lib/metrics';

interface NavItem { to: string; label: string; icon: string; count?: number; group?: string }

export function Layout({ children }: { children: React.ReactNode }) {
  const { data, online, live, theme, toggleTheme, lastSync } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState('');
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const openFindings = data.findings.filter(isOpen).length;
  const activeTasks = data.tasks.filter((t) => t.status !== 'done').length;
  const newSoc = data.socEvents.filter((s) => s.status === 'new').length;

  const items: NavItem[] = [
    { to: '/', label: 'Command centre', icon: 'dashboard', group: 'Overview' },
    { to: '/engagements', label: 'Engagements', icon: 'target', count: data.engagements.length },
    { to: '/findings', label: 'Findings', icon: 'bug', count: openFindings },
    { to: '/simulator', label: 'Attack simulator', icon: 'crosshair', group: 'Analysis' },
    { to: '/assets', label: 'Assets', icon: 'layers', count: data.assets.length },
    { to: '/timeline', label: 'Timeline', icon: 'activity' },
    { to: '/tasks', label: 'Tasks & work', icon: 'kanban', count: activeTasks, group: 'Operations' },
    { to: '/soc', label: 'SOC monitor', icon: 'radar', count: newSoc },
    { to: '/builds', label: 'Builds & tooling', icon: 'wrench', count: data.builds.length },
    { to: '/reports', label: 'Reports', icon: 'file', count: data.reports.length },
    { to: '/team', label: 'Team & effort', icon: 'users', group: 'Team' },
    { to: '/present', label: 'Presentation', icon: 'presentation' },
  ];

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) nav(`/findings?q=${encodeURIComponent(q.trim())}`); };

  let lastGroup = '';
  return (
    <div className={`app${collapsed ? ' app--collapsed' : ''}`}>
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <span className="logo"><Logo /></span>
          <div>
            <div className="brand__name">ARK STUDIOS</div>
            <div className="brand__sub">Security Ops</div>
          </div>
        </div>
        <nav>
          {items.map((it) => {
            const showGroup = it.group && it.group !== lastGroup;
            if (it.group) lastGroup = it.group;
            return (
              <React.Fragment key={it.to}>
                {showGroup && <div className="nav__group">{it.group}</div>}
                <NavLink to={it.to} end={it.to === '/'} className={({ isActive }) => `nav__item${isActive ? ' nav__item--active' : ''}`} title={it.label}>
                  <Icon name={it.icon} size={18} />
                  <span>{it.label}</span>
                  {it.count !== undefined && it.count > 0 && <span className="nav__count">{it.count}</span>}
                </NavLink>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="sidebar__foot">
          <div className="row gap-8">
            <span className={`online-dot${online ? ' online-dot--on online-dot--live' : ''}`} />
            {online ? 'Authoring server live' : 'Static / read-only'}
          </div>
          {lastSync && <div className="text-xs mt-4">Synced {new Date(lastSync).toLocaleTimeString()}</div>}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn--ghost btn--icon btn--sm hide-mobile" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar"><Icon name="menu" size={16} /></button>
          <button className="btn btn--ghost btn--icon btn--sm only-mobile" onClick={() => setMobileOpen((o) => !o)} aria-label="Open menu"><Icon name="menu" size={18} /></button>
          <form className="topbar__search hide-mobile" onSubmit={onSearch}>
            <Icon name="search" size={15} />
            <input className="input input--sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search findings, engagements…" />
          </form>
          <div className="topbar__actions">
            {live && <span className="badge badge--good badge--sm hide-mobile"><span className="badge__dot" />Live data</span>}
            <button className="btn btn--ghost btn--icon btn--sm" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle light/dark">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <NavLink to="/present" className="btn btn--primary btn--sm"><Icon name="presentation" size={15} />Present</NavLink>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}


export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--bg-3)" />
      <path d="M16 5l9 4v7c0 5.5-3.8 9.6-9 11-5.2-1.4-9-5.5-9-11V9l9-4z" fill="none" stroke="var(--accent)" strokeWidth="2.2" />
      <path d="M11 17l3.5 3.5L21.5 13" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
