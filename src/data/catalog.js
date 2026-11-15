// Parts catalog. Prices are illustrative, performance numbers are a simplified
// model (relative "AAA benchmark" frame rates), not real benchmark data.

export const CATEGORIES = [
  { id: 'motherboard', label: 'Motherboard', short: 'Board', icon: 'board',
    hint: 'Start here: every other part plugs into the motherboard.' },
  { id: 'cpu', label: 'Processor', short: 'CPU', icon: 'cpu',
    hint: 'The CPU socket must match the motherboard socket.' },
  { id: 'cooler', label: 'CPU Cooler', short: 'Cooler', icon: 'fan',
    hint: 'Needs a mounting bracket for your socket and enough cooling headroom.' },
  { id: 'ram', label: 'Memory', short: 'RAM', icon: 'ram',
    hint: 'DDR4 and DDR5 are not interchangeable. Check what the board supports.' },
  { id: 'storage', label: 'Storage', short: 'Drive', icon: 'drive',
    hint: 'Your boot drive. NVMe is fastest, hard drives are slowest.' },
  { id: 'gpu', label: 'Graphics Card', short: 'GPU', icon: 'gpu',
    hint: 'Drives gaming performance. Optional if your CPU has integrated graphics.' },
  { id: 'psu', label: 'Power Supply', short: 'PSU', icon: 'bolt',
    hint: 'Aim for about 30% more wattage than the system draws at full load.' },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// Built-in coolers that ship with some CPUs.
export const STOCK_COOLER = {
  id: 'stock', category: 'cooler', name: 'Boxed stock cooler', price: 0,
  sockets: ['AM4', 'AM5', 'LGA1700'], tdpRating: 88, style: 'stock',
  specs: ['Included with CPU', '~88 W'],
};

export const PARTS = {
  motherboard: [
    { id: 'b550', name: 'B550 ATX', price: 120, socket: 'AM4', ramType: 'DDR4', maxRamSpeed: 4400, maxRamGB: 128, m2: 2,
      specs: ['AM4', 'DDR4', 'PCIe 4.0'] },
    { id: 'b760-d4', name: 'B760 ATX DDR4', price: 130, socket: 'LGA1700', ramType: 'DDR4', maxRamSpeed: 3600, maxRamGB: 128, m2: 2,
      specs: ['LGA1700', 'DDR4', 'PCIe 4.0'] },
    { id: 'b650', name: 'B650 ATX', price: 170, socket: 'AM5', ramType: 'DDR5', maxRamSpeed: 6400, maxRamGB: 192, m2: 3,
      specs: ['AM5', 'DDR5', 'PCIe 4.0'] },
    { id: 'z790', name: 'Z790 ATX DDR5', price: 230, socket: 'LGA1700', ramType: 'DDR5', maxRamSpeed: 7200, maxRamGB: 192, m2: 4,
      specs: ['LGA1700', 'DDR5', 'PCIe 5.0'] },
    { id: 'x670e', name: 'X670E ATX', price: 320, socket: 'AM5', ramType: 'DDR5', maxRamSpeed: 7800, maxRamGB: 192, m2: 4,
      specs: ['AM5', 'DDR5', 'PCIe 5.0'] },
  ],
  cpu: [
    { id: 'r5-5600', name: 'Ryzen 5 5600', price: 130, socket: 'AM4', cores: 6, threads: 12, watts: 76,
      igpu: null, stockCooler: true, gaming: 110, multi: 100,
      specs: ['AM4', '6C / 12T', '76 W', 'Cooler included'] },
    { id: 'i5-12400', name: 'Core i5-12400', price: 150, socket: 'LGA1700', cores: 6, threads: 12, watts: 117,
      igpu: { name: 'UHD 730', fps1080: 18 }, stockCooler: true, gaming: 125, multi: 105,
      specs: ['LGA1700', '6C / 12T', '117 W', 'iGPU', 'Cooler included'] },
    { id: 'i5-13600kf', name: 'Core i5-13600KF', price: 260, socket: 'LGA1700', cores: 14, threads: 20, watts: 181,
      igpu: null, stockCooler: false, gaming: 175, multi: 210,
      specs: ['LGA1700', '14C / 20T', '181 W'] },
    { id: 'r7-7800x3d', name: 'Ryzen 7 7800X3D', price: 380, socket: 'AM5', cores: 8, threads: 16, watts: 120,
      igpu: { name: 'Radeon 2CU', fps1080: 22 }, stockCooler: false, gaming: 230, multi: 165,
      specs: ['AM5', '8C / 16T', '120 W', 'iGPU', '3D V-Cache'] },
    { id: 'r9-7950x', name: 'Ryzen 9 7950X', price: 550, socket: 'AM5', cores: 16, threads: 32, watts: 230,
      igpu: { name: 'Radeon 2CU', fps1080: 22 }, stockCooler: false, gaming: 205, multi: 380,
      specs: ['AM5', '16C / 32T', '230 W', 'iGPU'] },
    { id: 'i9-14900k', name: 'Core i9-14900K', price: 550, socket: 'LGA1700', cores: 24, threads: 32, watts: 253,
      igpu: { name: 'UHD 770', fps1080: 20 }, stockCooler: false, gaming: 215, multi: 370,
      specs: ['LGA1700', '24C / 32T', '253 W', 'iGPU'] },
  ],
  cooler: [
    { id: 'lowpro', name: 'Low-profile 92 mm', price: 45, sockets: ['AM4', 'LGA1700'], tdpRating: 95, style: 'lowpro',
      specs: ['AM4 · LGA1700', '95 W', 'Quiet'] },
    { id: 'tower1', name: 'Single-tower 120 mm', price: 35, sockets: ['AM4', 'AM5', 'LGA1700'], tdpRating: 160, style: 'tower',
      specs: ['All sockets', '160 W'] },
    { id: 'tower2', name: 'Dual-tower 140 mm', price: 90, sockets: ['AM4', 'AM5', 'LGA1700'], tdpRating: 250, style: 'dual',
      specs: ['All sockets', '250 W'] },
    { id: 'aio240', name: '240 mm AIO liquid', price: 110, sockets: ['AM4', 'AM5', 'LGA1700'], tdpRating: 270, style: 'aio',
      specs: ['All sockets', '270 W', 'Top radiator'] },
  ],
  ram: [
    { id: 'd4-16', name: '16 GB DDR4-3200', price: 40, type: 'DDR4', gb: 16, speed: 3200, specs: ['DDR4', '2 × 8 GB', '3200 MT/s'] },
    { id: 'd4-32', name: '32 GB DDR4-3600', price: 70, type: 'DDR4', gb: 32, speed: 3600, specs: ['DDR4', '2 × 16 GB', '3600 MT/s'] },
    { id: 'd5-32', name: '32 GB DDR5-6000', price: 100, type: 'DDR5', gb: 32, speed: 6000, specs: ['DDR5', '2 × 16 GB', '6000 MT/s'] },
    { id: 'd5-64', name: '64 GB DDR5-6400', price: 210, type: 'DDR5', gb: 64, speed: 6400, specs: ['DDR5', '2 × 32 GB', '6400 MT/s'] },
  ],
  storage: [
    { id: 'hdd-2t', name: '2 TB Hard Drive', price: 55, iface: 'SATA', form: 'hdd', read: 200, bootSeconds: 38, specs: ['3.5" SATA', '7200 rpm', '200 MB/s'] },
    { id: 'sata-1t', name: '1 TB SATA SSD', price: 60, iface: 'SATA', form: 'ssd', read: 550, bootSeconds: 14, specs: ['2.5" SATA', '550 MB/s'] },
    { id: 'nvme3-1t', name: '1 TB NVMe Gen3', price: 65, iface: 'NVMe', form: 'm2', read: 3500, bootSeconds: 9, specs: ['M.2 NVMe', '3500 MB/s'] },
    { id: 'nvme4-2t', name: '2 TB NVMe Gen4', price: 130, iface: 'NVMe', form: 'm2', read: 7000, bootSeconds: 7, specs: ['M.2 NVMe', '7000 MB/s'] },
  ],
  gpu: [
    { id: 'rx7600', name: 'Radeon RX 7600', price: 260, watts: 165, vram: 8, fps1080: 95, specs: ['8 GB', '165 W'] },
    { id: 'rtx4060', name: 'GeForce RTX 4060', price: 300, watts: 115, vram: 8, fps1080: 100, specs: ['8 GB', '115 W', 'Efficient'] },
    { id: 'rtx4070s', name: 'GeForce RTX 4070 Super', price: 600, watts: 220, vram: 12, fps1080: 165, specs: ['12 GB', '220 W'] },
    { id: 'rx7900xt', name: 'Radeon RX 7900 XT', price: 700, watts: 315, vram: 20, fps1080: 200, specs: ['20 GB', '315 W'] },
    { id: 'rtx4090', name: 'GeForce RTX 4090', price: 1800, watts: 450, vram: 24, fps1080: 290, specs: ['24 GB', '450 W', 'Flagship'] },
  ],
  psu: [
    { id: 'psu450', name: '450 W Bronze', price: 45, watts: 450, rating: 'Bronze', specs: ['450 W', '80+ Bronze'] },
    { id: 'psu650', name: '650 W Gold', price: 85, watts: 650, rating: 'Gold', specs: ['650 W', '80+ Gold'] },
    { id: 'psu850', name: '850 W Gold', price: 120, watts: 850, rating: 'Gold', specs: ['850 W', '80+ Gold'] },
    { id: 'psu1000', name: '1000 W Platinum', price: 210, watts: 1000, rating: 'Platinum', specs: ['1000 W', '80+ Platinum'] },
  ],
};

for (const [category, list] of Object.entries(PARTS)) {
  for (const p of list) p.category = category;
}

const ALL = new Map();
for (const list of Object.values(PARTS)) for (const p of list) ALL.set(p.id, p);
ALL.set(STOCK_COOLER.id, STOCK_COOLER);

export function getPart(id) {
  return ALL.get(id) || null;
}
