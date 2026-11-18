// How each catalog part looks in 3D. Dimensions follow the real products
// (reference or typical partner designs); colours are original.

export const GPU_LOOKS = {
  // length and height in metres, thickness in expansion slots (20 mm each)
  rx7600: { length: 0.204, height: 0.115, slots: 2, fans: 2, design: 'radeon', label: 'RX 7600' },
  rtx4060: { length: 0.240, height: 0.112, slots: 2, fans: 2, design: 'geforce', label: 'RTX 4060' },
  rtx4070s: { length: 0.267, height: 0.120, slots: 2.5, fans: 3, design: 'geforce', label: 'RTX 4070 SUPER' },
  rx7900xt: { length: 0.276, height: 0.123, slots: 2.5, fans: 3, design: 'radeon', label: 'RX 7900 XT' },
  rtx4090: { length: 0.330, height: 0.137, slots: 3.5, fans: 3, design: 'flagship', label: 'RTX 4090' },
};

export const GPU_DESIGNS = {
  radeon: { shroud: 0x17181c, trim: 0x2a2c33, accent: 0xd8263a, backplate: 0x1c1d22, text: '#e6e6e6', rgb: false },
  geforce: { shroud: 0x1a1c20, trim: 0x8a8f99, accent: 0x76b900, backplate: 0x24272d, text: '#d9dde3', rgb: false },
  flagship: { shroud: 0xb8bdc6, trim: 0x23262c, accent: 0x5eead4, backplate: 0x2b2e35, text: '#14161b', rgb: true },
};

export const BOARD_LOOKS = {
  b550: { pcb: '#1b1d22', heatsink: 0x2b2e35, accent: 0xff8a3d, slot: 0x23262c, label: 'B550', socket: 'AM4' },
  'b760-d4': { pcb: '#16191d', heatsink: 0x8e939c, accent: 0x9aa3b2, slot: 0x2b2f36, label: 'B760', socket: 'LGA1700' },
  b650: { pcb: '#121417', heatsink: 0x1f2329, accent: 0x5eead4, slot: 0x1c1f24, label: 'B650', socket: 'AM5' },
  z790: { pcb: '#111214', heatsink: 0x26282e, accent: 0xff3d5a, slot: 0x2a2b30, label: 'Z790', socket: 'LGA1700', rgb: true },
  x670e: { pcb: '#e9ebee', heatsink: 0xcfd3d9, accent: 0x7c8794, slot: 0xdfe2e6, label: 'X670E', socket: 'AM5', light: true },
};

export const RAM_LOOKS = {
  'd4-16': { spreader: 0x1c1f26, accent: 0xc2410c, rgb: false, height: 0.031 },
  'd4-32': { spreader: 0x8b1e2a, accent: 0x1c1f26, rgb: false, height: 0.034 },
  'd5-32': { spreader: 0xd9dde3, accent: 0x1c1f26, rgb: true, height: 0.036 },
  'd5-64': { spreader: 0x15171c, accent: 0x5c6370, rgb: true, height: 0.042 },
};
