/**
 * Icônes monochromes dessinées pour le site (grille 24 × 24, trait 1,5).
 * Utilisées côté serveur (composant Icon) et côté client (réservation).
 */
export const icons = {
  plane:
    '<path d="M21 12c0-.8-.7-1.5-1.5-1.5H14L9.5 4H8l2 6.5H5.5L4 8.5H3l.8 3.5L3 15.5h1l1.5-2H10L8 20h1.5l4.5-6.5h5.5c.8 0 1.5-.7 1.5-1.5Z"/>',
  train:
    '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M8 21l1.5-3.5M16 21l-1.5-3.5"/><circle cx="9" cy="13.5" r=".6" fill="currentColor"/><circle cx="15" cy="13.5" r=".6" fill="currentColor"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.25"/>',
  family:
    '<circle cx="9" cy="8" r="2.75"/><path d="M3.5 19.5c.4-3.2 2.7-5.25 5.5-5.25s5.1 2.05 5.5 5.25"/><circle cx="16.75" cy="9.5" r="2.25"/><path d="M15.4 14.5c.4-.15.85-.25 1.35-.25 2.3 0 4.1 1.7 4.5 4.25"/>',
  route:
    '<circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="5.5" r="2"/><path d="M8 18.5h7.75a3.25 3.25 0 0 0 0-6.5h-7.5a3.25 3.25 0 0 1 0-6.5H16"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  phone:
    '<path d="M6.6 3.5h2.3l1.4 4-1.9 1.3a12 12 0 0 0 6.8 6.8l1.3-1.9 4 1.4v2.3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  swap: '<path d="M8 20V4M4.5 7.5 8 4l3.5 3.5M16 4v16M12.5 16.5 16 20l3.5-3.5"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13"/>',
  star: '<path d="m12 3.2 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-6 7-6s6.2 2.4 7 6"/>',
  luggage: '<rect x="6" y="7" width="12" height="13" rx="2"/><path d="M9.5 7V4.5h5V7M10 11v5M14 11v5"/>',
  alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.75v5M12 16.25h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.75h.01"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
} as const;

export type IconName = keyof typeof icons;

export const iconSvg = (name: IconName, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
