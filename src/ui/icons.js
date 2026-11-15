const svg = (body, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  board: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="7" width="6" height="6"/><path d="M16 7v6M18 7v6M7 17h10"/>'),
  cpu: svg('<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'),
  fan: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5"/><path d="M12 10.5c0-3 1-5.5 3.5-5.5M13.3 12.8c2.6 1.5 4.3 3.6 3 5.8M10.7 12.8c-2.6 1.5-5.3 1.9-6.5-.3"/>'),
  ram: svg('<rect x="2" y="7" width="20" height="9" rx="1"/><path d="M6 10v3M10 10v3M14 10v3M18 10v3M5 16v2M19 16v2"/>'),
  drive: svg('<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 12h6M17 12h.01"/>'),
  gpu: svg('<rect x="2" y="6" width="20" height="10" rx="1.5"/><circle cx="8" cy="11" r="2.5"/><circle cx="16" cy="11" r="2.5"/><path d="M5 16v3h8"/>'),
  bolt: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  sound: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  mute: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>'),
  view: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  power: svg('<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>', 16),
  warn: svg('<path d="M12 3 2 21h20z"/><path d="M12 10v4M12 18h.01"/>', 16),
  x: svg('<path d="M18 6 6 18M6 6l12 12"/>', 16),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 16),
  star: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
  vr: svg('<path d="M3 8h18v8h-5l-2-3h-4l-2 3H3z"/><circle cx="7.5" cy="12" r="1"/><circle cx="16.5" cy="12" r="1"/>'),
};
