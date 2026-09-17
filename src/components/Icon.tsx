import React from 'react';

/** Minimal inline icon set (stroke-based, currentColor). Keeps the bundle dependency-free. */
const P: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  shield: <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z" />,
  'shield-check': <><path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  bug: <><rect x="8" y="6" width="8" height="12" rx="4" /><path d="M12 6V3M5 9l3 1M19 9l-3 1M4 14h4M16 14h4M6 19l2.5-2M18 19l-2.5-2" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  crosshair: <><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  radar: <><circle cx="12" cy="12" r="8" /><path d="M12 12l5-4" /><path d="M12 12a5 5 0 015-1" opacity=".5" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></>,
  kanban: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  chart: <><path d="M4 20V4M20 20H4" /><rect x="7" y="12" width="3" height="5" /><rect x="12" y="8" width="3" height="9" /><rect x="17" y="5" width="3" height="12" /></>,
  presentation: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8M8 10l2.5 2.5L15 8" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M16 6a3 3 0 010 6M15 15c2 .5 4 2.2 4 5" /></>,
  wrench: <path d="M14 6a4 4 0 00-5.3 5.3L3 17v4h4l5.7-5.7A4 4 0 0018 10l-3 3-2-2 3-3a4 4 0 00-2-2z" />,
  bell: <><path d="M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 004 0" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  check: <path d="M5 12l5 5L20 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  'chevron-left': <path d="M15 6l-6 6 6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'arrow-up': <path d="M12 19V5M6 11l6-6 6 6" />,
  'arrow-down': <path d="M12 5v14M6 13l6 6 6-6" />,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>,
  code: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  download: <><path d="M12 4v10M8 10l4 4 4-4" /><path d="M4 18h16" /></>,
  play: <path d="M7 5l12 7-12 7z" />,
  pause: <><rect x="7" y="5" width="3" height="14" /><rect x="14" y="5" width="3" height="14" /></>,
  skip: <><path d="M6 5l8 7-8 7z" /><path d="M17 5v14" /></>,
  refresh: <><path d="M20 11a8 8 0 10-2 6" /><path d="M20 5v6h-6" /></>,
  moon: <path d="M20 14A8 8 0 018 3a7 7 0 100 18 8 8 0 0012-7z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  network: <><circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M12 7.5l-5 9M12 7.5l5 9M7.5 19h9" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  key: <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M15 12v2" /></>,
  database: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  cloud: <path d="M7 18a4 4 0 01-.5-8 6 6 0 0111.5 1.5A3.5 3.5 0 0117 18z" />,
  contract: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  coins: <><ellipse cx="9" cy="7" rx="5" ry="2.5" /><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7" /><ellipse cx="15" cy="15" rx="5" ry="2.5" /><path d="M10 15v3c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-3" /></>,
  fire: <path d="M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s0 2 2 2c1.5 0 1-3-.5-5C11 5 12 3 12 3z" />,
  zap: <path d="M13 2L4 14h7l-2 8 9-12h-7z" />,
  alert: <><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></>,
  gauge: <><path d="M4 18a8 8 0 1116 0" /><path d="M12 18l4-5" /><circle cx="12" cy="18" r="1" /></>,
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  book: <><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M19 3v16" /></>,
  flask: <path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7 15h10" />,
  building: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></>,
  trash: <><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" /></>,
  edit: <path d="M4 20h4L18 10l-4-4L4 16zM14 6l4 4" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V4a2 2 0 012-2h10" /></>,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v6h7V3M8 21v-6h8v6" /></>,
  grid: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></>,
  robot: <><rect x="5" y="8" width="14" height="11" rx="2" /><path d="M12 8V4M9 4h6" /><circle cx="9.5" cy="13" r="1" /><circle cx="14.5" cy="13" r="1" /><path d="M9 16h6M3 12v3M21 12v3" /></>,
  route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8 16.5c8-1 8-3 8-8.5" strokeDasharray="3 3" /></>,
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  hourglass: <path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />,
};

export interface IconProps extends React.SVGProps<SVGSVGElement> { name: string; size?: number }
export function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }: IconProps & { strokeWidth?: number }) {
  const path = P[name] ?? P.file;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {path}
    </svg>
  );
}
export const hasIcon = (name: string) => name in P;
