import * as THREE from 'three';

export const VR_FONT = '"Space Grotesk", system-ui, sans-serif';
export const VR_MONO = '"JetBrains Mono", ui-monospace, monospace';
export const VR_COLORS = {
  bg: 'rgba(13,15,21,0.94)',
  raise: 'rgba(255,255,255,0.05)',
  raise2: 'rgba(255,255,255,0.1)',
  line: 'rgba(255,255,255,0.14)',
  text: '#e6edf3',
  muted: '#8b95a7',
  accent: '#5eead4',
  accentInk: '#032420',
  bar: '#13a898',
  barMuted: '#4b5263',
  warn: '#ffd166',
  bad: '#ff4d6d',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/**
 * A flat panel floating in the world, drawn on a canvas. A view is a function that
 * draws with the helpers below and registers clickable buttons; controller rays hit
 * the plane, and the hit's UV picks the button.
 */
export function createPanel({ width = 1.1, pxW = 1200, pxH = 900 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, (width * pxH) / pxW),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }),
  );
  mesh.renderOrder = 10;
  const group = new THREE.Group();
  group.add(mesh);
  group.visible = false;

  let view = null;
  let hover = null;
  let buttons = [];

  const api = {
    ctx,
    w: pxW,
    h: pxH,
    get hover() { return hover; },
    /** Background card for the whole panel. */
    frame() {
      ctx.clearRect(0, 0, pxW, pxH);
      ctx.fillStyle = VR_COLORS.bg;
      roundRect(ctx, 0, 0, pxW, pxH, 36);
      ctx.fill();
      ctx.strokeStyle = VR_COLORS.line;
      ctx.lineWidth = 3;
      roundRect(ctx, 1.5, 1.5, pxW - 3, pxH - 3, 35);
      ctx.stroke();
    },
    text(str, x, y, { size = 28, weight = 500, color = VR_COLORS.text, font = VR_FONT, align = 'left', max = 0 } = {}) {
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = color;
      let s = size;
      do { ctx.font = `${weight} ${s}px ${font}`; s -= 1; } while (max && ctx.measureText(str).width > max && s > 12);
      ctx.fillText(str, x, y);
      ctx.textAlign = 'left';
    },
    /** Word-wrapped text; returns the y below the last line. */
    para(str, x, y, maxW, { size = 24, color = VR_COLORS.muted, lineH = size * 1.35 } = {}) {
      ctx.font = `400 ${size}px ${VR_FONT}`;
      ctx.fillStyle = color;
      let line = '';
      for (const word of str.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = word; y += lineH; } else line = test;
      }
      if (line) { ctx.fillText(line, x, y); y += lineH; }
      return y;
    },
    rect(x, y, w, h, fill, r = 14) {
      ctx.fillStyle = fill;
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
    },
    /** A clickable button. variant: 'primary' | 'ghost' | 'row' | 'danger' | 'tab' */
    button(id, x, y, w, h, label, { variant = 'ghost', disabled = false, active = false, size = 28, sub = null } = {}) {
      const hot = !disabled && hover === id;
      let fill = VR_COLORS.raise, stroke = VR_COLORS.line, ink = VR_COLORS.text;
      if (variant === 'primary') { fill = hot ? '#7ff0de' : VR_COLORS.accent; stroke = 'transparent'; ink = VR_COLORS.accentInk; }
      else if (variant === 'danger') { fill = hot ? 'rgba(255,61,127,0.25)' : 'rgba(255,61,127,0.12)'; stroke = 'rgba(255,61,127,0.6)'; ink = '#ffb3c8'; }
      else if (variant === 'row') { fill = active ? 'rgba(94,234,212,0.12)' : hot ? VR_COLORS.raise2 : 'transparent'; stroke = active ? 'rgba(94,234,212,0.6)' : hot ? VR_COLORS.line : 'transparent'; }
      else if (variant === 'tab') { fill = active ? VR_COLORS.raise2 : hot ? VR_COLORS.raise : 'transparent'; stroke = 'transparent'; ink = active ? VR_COLORS.text : VR_COLORS.muted; }
      else if (hot) fill = VR_COLORS.raise2;
      if (disabled) { ctx.globalAlpha = 0.4; }
      ctx.fillStyle = fill;
      roundRect(ctx, x, y, w, h, 14);
      ctx.fill();
      if (stroke !== 'transparent') {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 3;
        roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 13);
        ctx.stroke();
      }
      if (label) {
        if (variant === 'row') {
          api.text(label, x + 22, y + (sub ? h / 2 - 4 : h / 2 + size * 0.35), { size, weight: 600, color: ink, max: w - 44 });
          if (sub) api.text(sub, x + 22, y + h / 2 + 28, { size: 21, color: VR_COLORS.muted, max: w - 44 });
        } else {
          api.text(label, x + w / 2, y + h / 2 + size * 0.36, { size, weight: 600, color: ink, align: 'center', max: w - 24 });
        }
      }
      ctx.globalAlpha = 1;
      if (!disabled) buttons.push({ id, x, y, w, h });
    },
  };

  function draw() {
    buttons = [];
    view?.(api);
    tex.needsUpdate = true;
  }

  return {
    group,
    mesh,
    get visible() { return group.visible; },
    show(fn) {
      view = fn;
      hover = null;
      draw();
      group.visible = true;
    },
    hide() {
      group.visible = false;
      view = null;
    },
    refresh() { if (group.visible) draw(); },
    /** Button id under a texture coordinate, or null. */
    hit(uv) {
      const x = uv.x * pxW, y = (1 - uv.y) * pxH;
      const b = buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      return b ? b.id : null;
    },
    setHover(id) {
      if (id === hover) return;
      hover = id;
      draw();
    },
    /** For tests: every clickable id currently on the panel. */
    get buttonIds() { return buttons.map((b) => b.id); },
    canvas,
  };
}
