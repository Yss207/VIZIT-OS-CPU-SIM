/*
  CPU Scheduling — Interactive Learning Guide
  main.js

  Sections in this file (in order):
    1. Process color map
    2. CPU chip animation  (anime.js)
    3. Program → Process animation  (anime.js)
    4. Process state diagram  (Canvas API, requestAnimationFrame)
    5. Scheduling scenarios  (static tab switcher)
    6. Ready queue animation
    7. Generic Gantt / table helpers
    8. FCFS simulator
    9. SJF / SRTF simulator
   10. Priority simulator
   11. Round Robin simulator
   12. Side nav + phase progress bar
*/


/* ─────────────────────────────────────────
   1. PROCESS COLORS
   Each process name maps to a fixed set of
   background / text / border values.
   Keeping colors consistent across every
   Gantt, table, and label is the main point.
───────────────────────────────────────── */
const COLORS = {
  P1: { bg: '#2a2050', text: '#a99aff', border: '#7c6aff' },
  P2: { bg: '#2a1520', text: '#ff9a9a', border: '#ff6a6a' },
  P3: { bg: '#102820', text: '#8affcc', border: '#6affb8' },
  P4: { bg: '#2a2010', text: '#ffd098', border: '#ffb86a' },
  P5: { bg: '#2a1028', text: '#ffaaf0', border: '#ff6adf' },
};
const PC = ['P1', 'P2', 'P3', 'P4', 'P5'];

function pColor(name) {
  const idx = PC.indexOf(name);
  return COLORS[PC[idx >= 0 ? idx % 5 : 0]];
}


/* ─────────────────────────────────────────
   2. CPU CHIP ANIMATION
   Builds an inline SVG of a CPU die with four
   quadrants (ALU, CU, REGS, CACHE), then runs
   a looping anime.js timeline to simulate
   signal flow: left pins → signal dot → core
   glow → right pins → top/bottom pins.
   Clicking a quadrant label shows a description.
───────────────────────────────────────── */
function buildCPUAnimeViz() {
  const el = document.getElementById('cpu-anime-viz');
  if (!el) return;

  el.innerHTML = `
    <svg id="cpu-svg" width="320" height="280" style="overflow:visible;">
      <rect id="chip-body" x="90" y="80" width="140" height="120" rx="12"
        fill="#1a1a2e" stroke="#7c6aff" stroke-width="2"/>

      ${[0, 1, 2, 3].map(i => `<rect class="pin-left"  x="60"  y="${106 + i * 22}" width="28" height="8" rx="4" fill="#7c6aff" opacity="0.3"/>`).join('')}
      ${[0, 1, 2, 3].map(i => `<rect class="pin-right" x="232" y="${106 + i * 22}" width="28" height="8" rx="4" fill="#7c6aff" opacity="0.3"/>`).join('')}
      ${[0, 1, 2].map(i => `<rect class="pin-top"    x="${118 + i * 28}" y="52"  width="8" height="26" rx="4" fill="#6affb8" opacity="0.3"/>`).join('')}
      ${[0, 1, 2].map(i => `<rect class="pin-bot"    x="${118 + i * 28}" y="202" width="8" height="26" rx="4" fill="#ff6a6a" opacity="0.3"/>`).join('')}

      <line x1="160" y1="82"  x2="160" y2="198" stroke="#2a2a38" stroke-width="1"/>
      <line x1="92"  y1="140" x2="228" y2="140" stroke="#2a2a38" stroke-width="1"/>

      <text x="126" y="116" text-anchor="middle" fill="#7c6aff"  font-size="9" font-family="JetBrains Mono" font-weight="700">ALU</text>
      <text x="194" y="116" text-anchor="middle" fill="#6affb8"  font-size="9" font-family="JetBrains Mono" font-weight="700">CU</text>
      <text x="126" y="175" text-anchor="middle" fill="#ff6adf"  font-size="9" font-family="JetBrains Mono" font-weight="700">REGS</text>
      <text x="194" y="175" text-anchor="middle" fill="#ffb86a"  font-size="9" font-family="JetBrains Mono" font-weight="700">CACHE</text>

      <circle id="signal-dot"  cx="92"  cy="140" r="5"  fill="#7c6aff" opacity="0"/>
      <circle id="core-glow"   cx="160" cy="140" r="18" fill="#7c6aff" opacity="0.06"/>
      <text   id="core-label"  x="160"  y="145"  text-anchor="middle" fill="#7c6aff" font-size="10" font-family="JetBrains Mono" font-weight="800">CORE</text>

      <text x="160" y="255" text-anchor="middle" fill="#555" font-size="9" font-family="JetBrains Mono">CPU executes ONE process at a time</text>
      <text id="proc-label" x="160" y="42" text-anchor="middle" fill="#6affb8" font-size="11" font-family="JetBrains Mono" font-weight="700" opacity="0">Running: P1</text>
    </svg>
    <div id="cpu-info" class="text-center mt-3 px-2"
      style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;line-height:1.6;min-height:72px;">
      Click a component to learn what it does
    </div>
  `;

  const svg = document.getElementById('cpu-svg');
  const info = document.getElementById('cpu-info');

  const componentInfo = {
    ALU: { color: '#7c6aff', text: 'ALU: Arithmetic Logic Unit: performs all math (add, subtract, multiply) and logical comparisons (greater than, equal). This is where actual computation happens.' },
    CU: { color: '#6affb8', text: 'Control Unit: reads each instruction and tells other parts what to do: fetch from memory, send to ALU, write result. It directs the whole Fetch-Decode-Execute cycle.' },
    REGS: { color: '#ff6adf', text: 'Registers: the CPU\'s own tiny, ultra-fast storage. Values being computed right now live here. Way faster than RAM. When the OS switches processes, it saves and restores these.' },
    CACHE: { color: '#ffb86a', text: 'Cache: a fast buffer between CPU and RAM. Frequently used data is kept here so the CPU doesn\'t have to wait for slower main memory.' },
  };

  svg.querySelectorAll('text').forEach(t => {
    const key = t.textContent.trim();
    if (!componentInfo[key]) return;
    t.style.cursor = 'pointer';
    t.addEventListener('click', () => {
      const c = componentInfo[key];
      info.innerHTML = `<span style="color:${c.color};font-weight:700">${key}:</span> ${c.text.split(':')[1]}`;
      anime({ targets: t, opacity: [1, 0.3, 1], duration: 400, easing: 'easeInOutSine' });
    });
  });

  startCPUAnim();
}

function startCPUAnim() {
  const tl = anime.timeline({ loop: true, easing: 'easeInOutSine' });
  tl
    .add({ targets: '.pin-left', opacity: [0.3, 1, 0.3], duration: 600, delay: anime.stagger(80) })
    .add({ targets: '#signal-dot', cx: [62, 228], opacity: [0, 1, 0], duration: 900, easing: 'easeInOutQuad' }, '-=200')
    .add({ targets: '#core-glow', opacity: [0.06, 0.25, 0.06], r: [18, 26, 18], duration: 600 }, '-=300')
    .add({ targets: '#proc-label', opacity: [0, 1, 1, 0], duration: 1200 }, '-=200')
    .add({ targets: '.pin-right', opacity: [0.3, 1, 0.3], duration: 600, delay: anime.stagger(80) }, '-=400')
    .add({ targets: '.pin-top', opacity: [0.3, 0.8, 0.3], duration: 400, delay: anime.stagger(60) })
    .add({ targets: '.pin-bot', opacity: [0.3, 0.8, 0.3], duration: 400, delay: anime.stagger(60) }, '-=200')
    .add({ duration: 500 });
}

function restartCPUAnim() {
  anime.remove('.pin-left,.pin-right,.pin-top,.pin-bot,#signal-dot,#core-glow,#proc-label');
  startCPUAnim();
}

buildCPUAnimeViz();


/* ─────────────────────────────────────────
   3. PROGRAM → PROCESS ANIMATION
   Shows source.c → compile → program.exe →
   exec() → Process (PID 4821) as a sequenced
   anime.js timeline. The source file fades out
   at the end to imply it's been "consumed".
───────────────────────────────────────── */
function animateProgramToProcess() {
  const el = document.getElementById('prog-proc-viz');
  el.innerHTML = '';

  const stages = [
    { id: 's0', icon: '📄', top: 'source.c', bot: 'on disk', color: '#888', border: '#555' },
    { id: 's1', icon: '💾', top: 'program.exe', bot: 'binary', color: '#7c6aff', border: '#7c6aff' },
    { id: 's2', icon: '⚡', top: 'Process', bot: 'PID 4821', color: '#6affb8', border: '#6affb8' },
  ];

  const labels = ['compile', 'exec()'];
  const lineColors = ['#7c6aff', '#6affb8'];

  stages.forEach((s, i) => {
    const card = document.createElement('div');
    card.id = s.id;
    card.style.cssText = `opacity:0;flex-shrink:0;`;
    card.innerHTML = `
      <div style="width:110px;height:110px;background:${s.color}12;border:2px solid ${s.border};
        border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
        <div style="font-size:30px;line-height:1;">${s.icon}</div>
        <div style="font-size:11px;font-weight:800;color:${s.color};font-family:'JetBrains Mono',monospace;">${s.top}</div>
        <div style="font-size:9px;color:${s.color}80;font-family:'JetBrains Mono',monospace;">${s.bot}</div>
      </div>`;
    el.appendChild(card);

    if (i < stages.length - 1) {
      const arrow = document.createElement('div');
      arrow.style.cssText = `flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 12px;`;
      arrow.innerHTML = `
        <div style="width:48px;height:2px;background:${lineColors[i]};border-radius:2px;"></div>
        <div style="font-size:9px;color:${lineColors[i]};font-family:'JetBrains Mono',monospace;letter-spacing:1px;">${labels[i]}</div>`;
      el.appendChild(arrow);
    }
  });

  el.style.cssText = `width:100%;display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;`;

  const tl = anime.timeline({ easing: 'easeOutExpo' });
  tl
    .add({ targets: '#s0', opacity: [0, 1], translateY: [20, 0], duration: 500 })
    .add({ targets: '#s1', opacity: [0, 1], scale: [0.5, 1.05, 1], duration: 600 }, '-=100')
    .add({ targets: '#s2', opacity: [0, 1], scale: [0.3, 1.1, 1], duration: 700 }, '-=100')
    .add({ targets: '#s2 > div', boxShadow: ['0 0 0px #6affb8', '0 0 40px #6affb855', '0 0 20px #6affb830'], duration: 1000, easing: 'easeInOutSine' }, '-=200');
}

animateProgramToProcess();


/* ─────────────────────────────────────────
   4. PROCESS STATE DIAGRAM  (Canvas)

   Layout: NEW → READY → RUNNING → TERMINATED
   on a single horizontal row. WAITING drops
   below RUNNING with two arcs connecting it.

   Each frame: clear → background → draw edges
   (with travelling white dots) → draw nodes.
   Clicking a node or the bottom cards dims
   everything else and shows a detail card.
───────────────────────────────────────── */
const STATE_NODES_DEF = [
  { id: 'new', label: 'NEW', color: '#7c6aff', desc: 'Process just created. OS allocating resources.' },
  { id: 'ready', label: 'READY', color: '#6affb8', desc: 'In memory, waiting for CPU. Scheduler picks from here.' },
  { id: 'running', label: 'RUNNING', color: '#ff6a6a', desc: 'Actively executing on CPU. Only one process per core.' },
  { id: 'terminated', label: 'TERMINATED', color: '#8f8f9b', desc: 'Finished. OS reclaims all memory and resources.' },
  { id: 'waiting', label: 'WAITING', color: '#ffb86a', desc: 'Blocked on I/O or event. CPU is free during this time.' },
];

const STATE_EDGES_DEF = [
  { from: 'new', to: 'ready', label: 'Admit', color: '#7c6aff' },
  { from: 'ready', to: 'running', label: 'Dispatch', color: '#6affb8' },
  { from: 'running', to: 'terminated', label: 'Completion', color: '#8f8f9b' },
  { from: 'running', to: 'ready', label: 'Preempt', color: '#ff9a9a' },
  { from: 'running', to: 'waiting', label: 'I/O Request', color: '#ffb86a' },
  { from: 'waiting', to: 'ready', label: 'I/O Done', color: '#ffb86a' },
];

let sdNodes = [], sdActiveState = null, sdAnimFrame = null;
let sdCanvas = null, sdCtx = null, sdDots = [];

function sdSetup() {
  sdCanvas = document.getElementById('state-canvas');
  if (!sdCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const container = sdCanvas.parentElement;
  const cssW = container.clientWidth || 860;
  const cssH = Math.round(cssW * 0.42);

  sdCanvas.style.height = cssH + 'px';
  sdCanvas.width = Math.round(cssW * dpr);
  sdCanvas.height = Math.round(cssH * dpr);

  sdCtx = sdCanvas.getContext('2d');
  sdCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  sdBuildNodes(cssW, cssH);
  if (!sdAnimFrame) sdLoop();
}

function sdBuildNodes(W, H) {
  const mainY = H * 0.35;
  const waitY = H * 0.80;
  const xs = [W * 0.09, W * 0.33, W * 0.57, W * 0.91];
  const ids = ['new', 'ready', 'running', 'terminated'];

  sdNodes = STATE_NODES_DEF.map(def => {
    const idx = ids.indexOf(def.id);
    const x = idx >= 0 ? xs[idx] : W * 0.57;
    const y = def.id === 'waiting' ? waitY : mainY;
    const w = def.id === 'waiting' ? 96 : 80;
    return { ...def, x, y, w, h: 32 };
  });

  // each dot tracks position (0..1) along its edge path
  sdDots = STATE_EDGES_DEF.map((_, i) => ({
    edgeIdx: i,
    t: i / STATE_EDGES_DEF.length,
    speed: 0.004 + Math.random() * 0.002,
  }));
}

function sdNodeRect(n) {
  return { l: n.x - n.w / 2, t: n.y - n.h / 2, r: n.x + n.w / 2, b: n.y + n.h / 2 };
}

// Returns the bezier control points for an edge.
// Special cases handle the Preempt arc and the I/O arcs.
function sdEdgePoints(edge) {
  const fn = sdNodes.find(n => n.id === edge.from);
  const tn = sdNodes.find(n => n.id === edge.to);
  if (!fn || !tn) return null;

  const dy = tn.y - fn.y;
  let sx, sy, ex, ey, c1x, c1y, c2x, c2y;

  if (edge.from === 'running' && edge.to === 'ready') {
    // arcs below the main row
    const W = sdCanvas.width / (window.devicePixelRatio || 1);
    const H = sdCanvas.height / (window.devicePixelRatio || 1);
    sx = fn.x - fn.w / 2; sy = fn.y;
    ex = tn.x + tn.w / 2; ey = tn.y;
    c1x = sx - 20; c1y = fn.y + H * 0.22;
    c2x = ex + 20; c2y = tn.y + H * 0.22;
    return { sx, sy, ex, ey, c1x, c1y, c2x, c2y };
  }

  if (edge.from === 'running' && edge.to === 'waiting') {
    sx = fn.x; sy = fn.y + fn.h / 2;
    ex = tn.x + tn.w / 2; ey = tn.y;
    return { sx, sy, ex, ey, c1x: sx, c1y: sy + 20, c2x: ex + 10, c2y: ey - 20 };
  }

  if (edge.from === 'waiting' && edge.to === 'ready') {
    const wn = sdNodes.find(n => n.id === 'waiting');
    ex = tn.x - tn.w / 2; ey = tn.y;
    return { sx: wn.x - wn.w / 2, sy: wn.y, ex, ey, c1x: wn.x - wn.w / 2 - 20, c1y: wn.y, c2x: ex - 30, c2y: ey - 20 };
  }

  // horizontal default
  if (Math.abs(dy) < 5) {
    sx = fn.x + fn.w / 2; sy = fn.y;
    ex = tn.x - tn.w / 2; ey = tn.y;
    c1x = sx + (ex - sx) / 3; c1y = sy;
    c2x = sx + 2 * (ex - sx) / 3; c2y = ey;
    return { sx, sy, ex, ey, c1x, c1y, c2x, c2y };
  }

  // vertical default
  sx = fn.x; sy = fn.y + fn.h / 2;
  ex = tn.x; ey = tn.y - tn.h / 2;
  c1x = sx; c1y = (sy + ey) / 2;
  c2x = ex; c2y = (sy + ey) / 2;
  return { sx, sy, ex, ey, c1x, c1y, c2x, c2y };
}

// Evaluate a cubic bezier at t ∈ [0, 1]
function sdCubicAt(p, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p.sx + 3 * mt * mt * t * p.c1x + 3 * mt * t * t * p.c2x + t * t * t * p.ex,
    y: mt * mt * mt * p.sy + 3 * mt * mt * t * p.c1y + 3 * mt * t * t * p.c2y + t * t * t * p.ey,
  };
}

function sdLoop() {
  const W = sdCanvas.width / (window.devicePixelRatio || 1);
  const H = sdCanvas.height / (window.devicePixelRatio || 1);
  const ctx = sdCtx;

  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#0c0c15';
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, H - 8, 16);
  ctx.fill();

  // edges first so nodes render on top
  STATE_EDGES_DEF.forEach(edge => {
    const geo = sdEdgePoints(edge);
    if (!geo) return;
    const fromId = edge.from;
    const toId = edge.to;
    const isActive = sdActiveState && (fromId === sdActiveState || toId === sdActiveState);
    const alpha = sdActiveState ? (isActive ? 1 : 0.12) : 0.7;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (isActive) { ctx.shadowColor = edge.color; ctx.shadowBlur = 18; }

    ctx.strokeStyle = edge.color;
    ctx.lineWidth = isActive ? 2.5 : 1.8;
    ctx.beginPath();
    ctx.moveTo(geo.sx, geo.sy);
    ctx.bezierCurveTo(geo.c1x, geo.c1y, geo.c2x, geo.c2y, geo.ex, geo.ey);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // arrowhead
    const near = sdCubicAt(geo, 0.92);
    const angle = Math.atan2(geo.ey - near.y, geo.ex - near.x);
    ctx.fillStyle = edge.color;
    ctx.save();
    ctx.translate(geo.ex, geo.ey);
    ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // label pill midpoint
    const mid = sdCubicAt(geo, 0.5);
    ctx.font = `${isActive ? '700' : '600'} 9px JetBrains Mono`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const lw = ctx.measureText(edge.label).width + 14;
    const lh = 18;
    const lx = mid.x - lw / 2, ly = mid.y - lh / 2;
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 9);
    ctx.fillStyle = 'rgba(8,8,16,0.94)'; ctx.fill();
    ctx.strokeStyle = edge.color + '55'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = edge.color;
    ctx.fillText(edge.label, mid.x, mid.y);

    ctx.restore();
  });

  // travelling direction dots
  sdDots.forEach(dot => {
    const edge = STATE_EDGES_DEF[dot.edgeIdx];
    const isActive = sdActiveState && ([edge.from, edge.to].includes(sdActiveState));
    const baseAlpha = sdActiveState ? (isActive ? 0.9 : 0.0) : 0.55;
    dot.t = (dot.t + dot.speed) % 1;
    if (baseAlpha < 0.05) return;

    const geo = sdEdgePoints(edge);
    if (!geo) return;
    const pos = sdCubicAt(geo, dot.t);

    ctx.save();
    ctx.globalAlpha = baseAlpha * (0.4 + 0.6 * Math.sin(dot.t * Math.PI));
    ctx.shadowColor = edge.color;
    ctx.shadowBlur = isActive ? 14 : 8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, isActive ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // nodes on top
  sdNodes.forEach(node => {
    const isActive = sdActiveState === node.id;
    const alpha = sdActiveState ? (isActive ? 1 : 0.28) : 0.95;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (isActive) {
      ctx.shadowColor = node.color; ctx.shadowBlur = 28;
      ctx.strokeStyle = node.color + '55'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(node.x - node.w / 2 - 7, node.y - node.h / 2 - 7, node.w + 14, node.h + 14, 20);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.shadowColor = isActive ? node.color : 'transparent';
    ctx.shadowBlur = isActive ? 16 : 0;
    ctx.beginPath();
    ctx.roundRect(node.x - node.w / 2, node.y - node.h / 2, node.w, node.h, 14);
    ctx.fillStyle = node.color + (isActive ? '22' : '18'); ctx.fill();
    ctx.strokeStyle = node.color; ctx.lineWidth = isActive ? 2.5 : 1.8; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = node.color;
    ctx.font = '700 11px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, node.x, node.y);

    ctx.restore();
  });

  sdAnimFrame = requestAnimationFrame(sdLoop);
}

function highlightStateFromCard(id) {
  sdActiveState = sdActiveState === id ? null : id;
  showStateDetail(sdActiveState);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('state-canvas')?.addEventListener('click', e => {
    const rect = sdCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = sdNodes.find(n => {
      const r = sdNodeRect(n);
      return mx >= r.l && mx <= r.r && my >= r.t && my <= r.b;
    });
    sdActiveState = hit ? (sdActiveState === hit.id ? null : hit.id) : null;
    showStateDetail(sdActiveState);
  });
});

function showStateDetail(id) {
  const detail = document.getElementById('state-detail');
  if (!id) { detail.classList.add('hidden'); return; }

  const node = STATE_NODES_DEF.find(n => n.id === id);
  if (!node) return;

  const extras = {
    new: 'Created via fork() or exec(). Not yet in the ready queue: the OS is still setting up its memory space and PCB.',
    ready: 'Has all resources except the CPU. Sits in the ready queue. This is where the scheduler makes its decision.',
    running: 'Given the CPU by the scheduler. Executing instructions right now. Only one process per core can be here at once.',
    waiting: 'Waiting for I/O to complete: a disk read, network packet, or keyboard input. Releases the CPU voluntarily.',
    terminated: 'Called exit() or returned from main(). The OS reclaims its memory, closes file descriptors, and removes its PCB.',
  };

  detail.classList.remove('hidden');
  detail.style.cssText = `background:var(--surface);border:1px solid ${node.color}44;border-top:2px solid ${node.color};border-radius:16px;padding:24px 28px;margin-bottom:24px;`;
  document.getElementById('state-detail-title').style.color = node.color;
  document.getElementById('state-detail-title').textContent = `STATE: ${node.label}`;
  document.getElementById('state-detail-text').textContent = extras[id] || node.desc;
}

function resetStateViz() {
  sdActiveState = null;
  document.getElementById('state-detail').classList.add('hidden');
}

window.addEventListener('resize', () => {
  cancelAnimationFrame(sdAnimFrame);
  sdAnimFrame = null;
  sdSetup();
});

sdSetup();


/* ─────────────────────────────────────────
   5. SCHEDULING SCENARIOS  (tab switcher)
   Four pre-baked scenarios shown as horizontal
   bar charts. Clicking a tab swaps the content.
───────────────────────────────────────── */
const scenarios = [
  {
    title: 'No Scheduling: Chaos',
    bars: [
      { name: 'P1', segs: [{ w: 80, c: '#7c6aff' }, { w: 30, c: '#111' }] },
      { name: 'P2', segs: [{ w: 20, c: '#111' }, { w: 60, c: '#ff6a6a' }, { w: 40, c: '#111' }] },
      { name: 'P3', segs: [{ w: 100, c: '#111' }, { w: 80, c: '#6affb8' }] },
      { name: 'CPU', segs: [{ w: 80, c: '#7c6aff' }, { w: 20, c: '#111', label: 'IDLE' }, { w: 60, c: '#ff6a6a' }, { w: 40, c: '#111', label: 'IDLE' }, { w: 80, c: '#6affb8' }] },
    ],
    logColor: '#ff6a6a',
    log: 'CPU is idle 24% of the time. Random execution means poor response and wasted resources.',
  },
  {
    title: 'One Process Hogs the CPU: Starvation',
    bars: [
      { name: 'P1 (BT=50)', segs: [{ w: 280, c: '#7c6aff' }] },
      { name: 'P2', segs: [{ w: 280, c: '#1a1a1a', label: 'WAITING…' }] },
      { name: 'P3', segs: [{ w: 280, c: '#1a1a1a', label: 'WAITING…' }] },
    ],
    logColor: '#ff6a6a',
    log: 'P2 and P3 starve while P1 runs uninterrupted. This is the Convoy Effect in FCFS.',
  },
  {
    title: 'I/O Bound Process: CPU Wastage',
    bars: [
      { name: 'P1 (I/O heavy)', segs: [{ w: 30, c: '#7c6aff' }, { w: 60, c: '#ffb86a', label: 'I/O' }, { w: 30, c: '#7c6aff' }, { w: 60, c: '#ffb86a', label: 'I/O' }, { w: 30, c: '#7c6aff' }, { w: 60, c: '#ffb86a', label: 'I/O' }] },
      { name: 'CPU', segs: [{ w: 30, c: '#7c6aff' }, { w: 60, c: '#111', label: 'IDLE' }, { w: 30, c: '#7c6aff' }, { w: 60, c: '#111', label: 'IDLE' }, { w: 30, c: '#7c6aff' }, { w: 60, c: '#111', label: 'IDLE' }] },
    ],
    logColor: '#ffb86a',
    log: 'CPU is idle ~66% of the time! A scheduler would use that time to run other processes.',
  },
  {
    title: 'With CPU Scheduling: Efficient',
    bars: [
      { name: 'P1', segs: [{ w: 40, c: '#7c6aff' }, { w: 40, c: '#1a1a2a' }, { w: 40, c: '#7c6aff' }, { w: 40, c: '#1a1a2a' }, { w: 40, c: '#7c6aff' }] },
      { name: 'P2', segs: [{ w: 40, c: '#1a1a2a' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#1a1a2a' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#1a1a2a' }] },
      { name: 'CPU', segs: [{ w: 40, c: '#7c6aff' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#7c6aff' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#7c6aff' }] },
    ],
    logColor: '#6affb8',
    log: 'CPU utilization: ~100%. Processes interleave efficiently. This is what scheduling achieves.',
  },
];

function showScenario(idx, btn) {
  document.querySelectorAll('#scenario-tabs button').forEach(b => {
    b.className = 'btn btn-ghost text-xs';
  });
  btn.className = 'btn btn-primary text-xs';

  const sc = scenarios[idx];
  const el = document.getElementById('scenario-viz');

  el.innerHTML =
    `<div style="margin-bottom:12px;font-size:13px;font-weight:700;color:#ccc;">${sc.title}</div>` +
    sc.bars.map(bar => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:100px;font-size:11px;font-family:JetBrains Mono;color:var(--muted);text-align:right;flex-shrink:0;">${bar.name}</div>
        <div style="display:flex;gap:1px;height:32px;flex-wrap:wrap;">
          ${bar.segs.map(seg =>
      `<div style="width:${seg.w}px;background:${seg.c};border-radius:3px;
              display:flex;align-items:center;justify-content:center;
              font-size:9px;color:${['#111', '#1a1a1a', '#1a1a2a'].includes(seg.c) ? '#444' : 'rgba(255,255,255,0.7)'};
              font-family:JetBrains Mono;font-weight:700;">${seg.label || ''}</div>`
    ).join('')}
        </div>
      </div>`
    ).join('') +
    `<div class="highlight-box ${idx === 3 ? 'green' : idx === 0 ? 'red' : ''} text-sm mt-4" style="border-left-color:${sc.logColor}">${sc.log}</div>`;
}

showScenario(0, document.querySelector('#scenario-tabs button'));


/* ─────────────────────────────────────────
   6. READY QUEUE ANIMATION
   Processes pop into the queue column, then
   get picked one at a time by the scheduler
   and moved to the CPU box, then to Done.
───────────────────────────────────────── */
const queueProcs = [
  { name: 'P1', bt: 5 }, { name: 'P2', bt: 3 }, { name: 'P3', bt: 7 }, { name: 'P4', bt: 2 }
];

function runQueueAnim() {
  const qv = document.getElementById('queue-viz');
  const cv = document.getElementById('cpu-proc');
  const dv = document.getElementById('done-viz');
  qv.innerHTML = ''; dv.innerHTML = ''; cv.textContent = '—';

  const procs = [...queueProcs];

  procs.forEach((p, i) => {
    const el = document.createElement('div');
    const c = pColor(p.name);
    el.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.text};
      padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;
      font-family:'JetBrains Mono',monospace;
      opacity:0;animation:fadeUp 0.3s ease ${i * 0.1}s forwards;`;
    el.textContent = `${p.name} (BT=${p.bt})`;
    qv.appendChild(el);
  });

  let delay = 600;
  procs.forEach(p => {
    setTimeout(() => {
      cv.textContent = p.name;
      cv.style.color = pColor(p.name).text;
      if (qv.firstChild) qv.removeChild(qv.firstChild);
    }, delay);
    delay += 800;

    setTimeout(() => {
      const done = document.createElement('div');
      const c = pColor(p.name);
      done.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.text};
        padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;
        font-family:'JetBrains Mono',monospace;`;
      done.textContent = `✓ ${p.name}`;
      dv.appendChild(done);
      if (procs.indexOf(p) === procs.length - 1) cv.textContent = '—';
    }, delay);
    delay += 200;
  });
}

runQueueAnim();


/* ─────────────────────────────────────────
   7. GENERIC GANTT / TABLE HELPERS
   Used by all four algorithm simulators.
───────────────────────────────────────── */

// Build a Gantt bar + timeline tick row.
// blocks   — array of { name, start, end }
// containerId / timelineId — DOM ids
// totalTime — used to compute proportional widths
function buildGantt(blocks, containerId, timelineId, totalTime) {
  const gc = document.getElementById(containerId);
  const tc = document.getElementById(timelineId);
  gc.innerHTML = ''; tc.innerHTML = '';

  const maxW = gc.parentElement.offsetWidth - 48 || 500;
  const scale = t => Math.max(28, (t / totalTime) * Math.min(maxW, 600));

  blocks.forEach((b, i) => {
    const c = b.name === 'IDLE' ? { bg: '#111', text: '#333', border: '#222' } : pColor(b.name);
    const w = scale(b.end - b.start);
    const el = document.createElement('div');
    el.className = 'gantt-block';
    el.style.cssText = `width:${w}px;background:${c.bg};color:${c.text};
      border:1px solid ${c.border};
      opacity:0;animation:slideIn 0.25s ease ${i * 0.06}s forwards;
      font-size:11px;border-radius:4px;`;
    el.innerHTML = `<span>${b.name}</span>`;
    gc.appendChild(el);
  });

  // time axis ticks, skip any that would overlap
  const ticks = new Set([0]);
  blocks.forEach(b => { ticks.add(b.start); ticks.add(b.end); });
  let lastLeft = -20;

  [...ticks].sort((a, b) => a - b).forEach(t => {
    const left = (t / totalTime) * Math.min(maxW, 600);
    if (left - lastLeft < 16) return;
    lastLeft = left;
    const tick = document.createElement('span');
    tick.style.cssText = `position:absolute;left:${left}px;font-size:10px;
      color:var(--muted);font-family:'JetBrains Mono',monospace;`;
    tick.textContent = t;
    tc.appendChild(tick);
  });

  tc.style.position = 'relative';
  tc.style.height = '16px';
}

// Populate the per-process results table (AT, BT, CT, TAT, WT)
function buildResultTable(tbodyId, processes, ganttResult) {
  const tb = document.getElementById(tbodyId);
  tb.innerHTML = '';
  processes.forEach(p => {
    const c = pColor(p.name);
    const tat = p.ct - p.at;
    const wt = tat - p.bt;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td>
      <td>${p.at}</td><td>${p.bt}</td><td>${p.ct}</td>
      <td style="color:var(--accent2)">${tat}</td>
      <td style="color:var(--accent)">${wt}</td>`;
    tb.appendChild(tr);
  });
}

// Returns avg WT and avg TAT as formatted strings
function calcAvgs(processes) {
  const n = processes.length;
  const awt = processes.reduce((s, p) => s + (p.ct - p.at - p.bt), 0) / n;
  const atat = processes.reduce((s, p) => s + (p.ct - p.at), 0) / n;
  return { awt: awt.toFixed(2), atat: atat.toFixed(2) };
}


/* ─────────────────────────────────────────
   8. FCFS SIMULATOR
   Non-preemptive. Processes run in arrival
   order. Supports Step (one at a time) and
   Auto (timed playback at 500ms per step).
───────────────────────────────────────── */
const fcfsData = [
  { name: 'P1', at: 0, bt: 5 },
  { name: 'P2', at: 1, bt: 3 },
  { name: 'P3', at: 2, bt: 8 },
  { name: 'P4', at: 4, bt: 2 },
];
let fcfsState = { step: 0, gantt: [], procs: [], done: false };

function initFCFS() {
  document.getElementById('fcfs-input-table').innerHTML = '';
  fcfsData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('fcfs-input-table').innerHTML +=
      `<tr>
        <td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td>
        <td>${p.at}</td><td>${p.bt}</td>
       </tr>`;
  });
}

function computeFCFS(data) {
  const sorted = [...data].sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  let t = 0;
  const gantt = [], res = [];
  for (const p of sorted) {
    if (t < p.at) { gantt.push({ name: 'IDLE', start: t, end: p.at }); t = p.at; }
    gantt.push({ name: p.name, start: t, end: t + p.bt });
    res.push({ ...p, ct: t + p.bt });
    t += p.bt;
  }
  return { gantt, procs: res, total: t };
}

function fcfsReset() {
  fcfsState = { step: 0, gantt: [], procs: [], done: false };
  document.getElementById('fcfs-gantt').innerHTML = '';
  document.getElementById('fcfs-timeline').innerHTML = '';
  document.getElementById('fcfs-results').classList.add('hidden');
  document.getElementById('fcfs-log').textContent = 'Press Step to walk through the algorithm one process at a time.';
}

function fcfsStep() {
  if (fcfsState.done) return;
  const { gantt, procs, total } = computeFCFS(fcfsData);
  fcfsState.step++;
  buildGantt(gantt.slice(0, fcfsState.step), 'fcfs-gantt', 'fcfs-timeline', total);

  const proc = procs[fcfsState.step - 1];
  if (proc) {
    document.getElementById('fcfs-log').innerHTML =
      `<strong style="color:${pColor(proc.name).text}">${proc.name}</strong> runs from t=${gantt.find(g => g.name === proc.name)?.start} to t=${proc.ct}. TAT=${proc.ct - proc.at}, WT=${proc.ct - proc.at - proc.bt}`;
  }

  if (fcfsState.step >= gantt.length) {
    fcfsState.done = true;
    document.getElementById('fcfs-results').classList.remove('hidden');
    buildResultTable('fcfs-result-table', procs, gantt);
    const avgs = calcAvgs(procs);
    document.getElementById('fcfs-awt').textContent = avgs.awt;
    document.getElementById('fcfs-atat').textContent = avgs.atat;
  }
}

let fcfsTimer;
function fcfsAuto() {
  clearInterval(fcfsTimer);
  fcfsReset();
  fcfsTimer = setInterval(() => {
    fcfsStep();
    if (fcfsState.done) clearInterval(fcfsTimer);
  }, 500);
}

initFCFS();


/* ─────────────────────────────────────────
   9. SJF / SRTF SIMULATOR
   Toggling the checkbox switches between
   non-preemptive SJF and preemptive SRTF.
   Both share the same compute function.
───────────────────────────────────────── */
const sjfData = [
  { name: 'P1', at: 0, bt: 8 },
  { name: 'P2', at: 1, bt: 4 },
  { name: 'P3', at: 2, bt: 9 },
  { name: 'P4', at: 3, bt: 5 },
];

function initSJF() {
  document.getElementById('sjf-input-table').innerHTML = '';
  sjfData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('sjf-input-table').innerHTML +=
      `<tr>
        <td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td>
        <td>${p.at}</td><td>${p.bt}</td>
       </tr>`;
  });
}

function computeSJF(data, preemptive) {
  const procs = data.map(p => ({ ...p, rem: p.bt, ct: 0 }));
  let t = 0, done = 0;
  const gantt = [];
  let last = null;

  // upper bound on iterations to avoid runaway loops
  const total = data.reduce((s, p) => Math.max(s, p.at) + 1, 0)
    + data.reduce((s, p) => s + p.bt, 0);

  while (done < procs.length) {
    const avail = procs.filter(p => p.at <= t && p.rem > 0);
    if (!avail.length) {
      if (last !== 'IDLE') gantt.push({ name: 'IDLE', start: t, end: t + 1 });
      else gantt[gantt.length - 1].end++;
      t++; last = 'IDLE'; continue;
    }

    const pick = avail.reduce((a, b) => a.rem <= b.rem ? a : b);

    if (preemptive) {
      if (last !== pick.name) gantt.push({ name: pick.name, start: t, end: t + 1 });
      else gantt[gantt.length - 1].end++;
      pick.rem--;
      if (pick.rem === 0) { pick.ct = t + 1; done++; }
      t++; last = pick.name;
    } else {
      gantt.push({ name: pick.name, start: t, end: t + pick.rem });
      t += pick.rem; pick.ct = t; pick.rem = 0; done++; last = pick.name;
    }
  }
  return { gantt, procs, total: t };
}

function sjfReset() {
  document.getElementById('sjf-gantt').innerHTML = '';
  document.getElementById('sjf-timeline').innerHTML = '';
  document.getElementById('sjf-results').classList.add('hidden');
  document.getElementById('sjf-log').innerHTML =
    'Toggle SRTF mode and click <strong>Auto</strong> to see how preemption changes the result.';
}

function sjfAuto() {
  const preemptive = document.getElementById('srtf-toggle').checked;
  const { gantt, procs, total } = computeSJF(sjfData, preemptive);
  buildGantt(gantt, 'sjf-gantt', 'sjf-timeline', total);
  document.getElementById('sjf-results').classList.remove('hidden');
  buildResultTable('sjf-result-table', procs, gantt);
  const avgs = calcAvgs(procs);
  document.getElementById('sjf-awt').textContent = avgs.awt;
  document.getElementById('sjf-atat').textContent = avgs.atat;
  document.getElementById('sjf-log').innerHTML =
    `<strong>${preemptive ? 'SRTF' : 'SJF'}</strong> complete. ${preemptive ? 'Preemption occurred when shorter jobs arrived.' : 'No preemption: once started, runs to completion.'}`;
}

initSJF();


/* ─────────────────────────────────────────
   10. PRIORITY SIMULATOR
   Lower prio number = higher priority.
   Toggle switches preemptive / non-preemptive.
───────────────────────────────────────── */
const prioData = [
  { name: 'P1', at: 0, bt: 10, prio: 3 },
  { name: 'P2', at: 1, bt: 1, prio: 1 },
  { name: 'P3', at: 2, bt: 2, prio: 4 },
  { name: 'P4', at: 3, bt: 1, prio: 5 },
  { name: 'P5', at: 4, bt: 5, prio: 2 },
];

function initPrio() {
  document.getElementById('prio-input-table').innerHTML = '';
  prioData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('prio-input-table').innerHTML +=
      `<tr>
        <td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td>
        <td>${p.at}</td><td>${p.bt}</td>
        <td><span style="color:var(--accent3);font-weight:700;">${p.prio}</span></td>
       </tr>`;
  });
}

function computePriority(data, preemptive) {
  const procs = data.map(p => ({ ...p, rem: p.bt, ct: 0 }));
  let t = 0, done = 0;
  const gantt = [];
  let last = null;

  while (done < procs.length) {
    const avail = procs.filter(p => p.at <= t && p.rem > 0);
    if (!avail.length) {
      if (last !== 'IDLE') gantt.push({ name: 'IDLE', start: t, end: t + 1 });
      else gantt[gantt.length - 1].end++;
      t++; last = 'IDLE'; continue;
    }

    // lower prio number wins
    const pick = avail.reduce((a, b) => a.prio <= b.prio ? a : b);

    if (preemptive) {
      if (last !== pick.name) gantt.push({ name: pick.name, start: t, end: t + 1 });
      else gantt[gantt.length - 1].end++;
      pick.rem--;
      if (pick.rem === 0) { pick.ct = t + 1; done++; }
      t++; last = pick.name;
    } else {
      gantt.push({ name: pick.name, start: t, end: t + pick.rem });
      t += pick.rem; pick.ct = t; pick.rem = 0; done++; last = pick.name;
    }
  }
  return { gantt, procs, total: t };
}

function prioReset() {
  document.getElementById('prio-gantt').innerHTML = '';
  document.getElementById('prio-timeline').innerHTML = '';
  document.getElementById('prio-results').classList.add('hidden');
}

function prioAuto() {
  const preemptive = document.getElementById('prio-preemptive').checked;
  const { gantt, procs, total } = computePriority(prioData, preemptive);
  buildGantt(gantt, 'prio-gantt', 'prio-timeline', total);
  document.getElementById('prio-results').classList.remove('hidden');

  const tb = document.getElementById('prio-result-table');
  tb.innerHTML = '';
  procs.forEach(p => {
    const c = pColor(p.name);
    const tat = p.ct - p.at, wt = tat - p.bt;
    tb.innerHTML += `<tr>
      <td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td>
      <td>${p.at}</td><td>${p.bt}</td>
      <td style="color:var(--accent3)">${p.prio}</td>
      <td>${p.ct}</td>
      <td style="color:var(--accent2)">${tat}</td>
      <td style="color:var(--accent)">${wt}</td>
    </tr>`;
  });

  const avgs = calcAvgs(procs);
  document.getElementById('prio-awt').textContent = avgs.awt;
  document.getElementById('prio-atat').textContent = avgs.atat;
  document.getElementById('prio-log').innerHTML =
    `<strong>${preemptive ? 'Preemptive Priority' : 'Non-Preemptive Priority'}</strong>: P2 (prio=1) runs first regardless of arrival order.`;
}

initPrio();


/* ─────────────────────────────────────────
   11. ROUND ROBIN SIMULATOR
   Quantum is set via a range slider. The
   context switch count updates with each run.
   Try quantum=1 vs quantum=10 to see the
   FCFS convergence effect.
───────────────────────────────────────── */
const rrData = [
  { name: 'P1', at: 0, bt: 5 },
  { name: 'P2', at: 1, bt: 3 },
  { name: 'P3', at: 2, bt: 8 },
  { name: 'P4', at: 4, bt: 6 },
];

function initRR() {
  document.getElementById('rr-input-table').innerHTML = '';
  rrData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('rr-input-table').innerHTML +=
      `<tr>
        <td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td>
        <td>${p.at}</td><td>${p.bt}</td>
       </tr>`;
  });
}

function computeRR(data, q) {
  const procs = data.map(p => ({ ...p, rem: p.bt, ct: 0 }));
  let t = 0, cs = 0;
  const gantt = [], queue = [];
  let i = 0;
  const sorted = [...procs].sort((a, b) => a.at - b.at);

  while (i < sorted.length && sorted[i].at <= t) { queue.push(sorted[i]); i++; }

  let safety = 0;
  while (queue.length > 0 && safety++ < 2000) {
    const p = queue.shift();
    const run = Math.min(q, p.rem);
    gantt.push({ name: p.name, start: t, end: t + run });
    t += run; p.rem -= run;

    while (i < sorted.length && sorted[i].at <= t) { queue.push(sorted[i]); i++; }

    if (p.rem > 0) { queue.push(p); cs++; }
    else { p.ct = t; }
  }
  return { gantt, procs, total: t, cs };
}

function rrReset() {
  document.getElementById('rr-gantt').innerHTML = '';
  document.getElementById('rr-timeline').innerHTML = '';
  document.getElementById('rr-results').classList.add('hidden');
  document.getElementById('rr-log').innerHTML =
    'Try quantum = 1 vs quantum = 10 on the same processes. Watch how metrics change.';
}

function rrAuto() {
  const q = parseInt(document.getElementById('rr-quantum-slider').value);
  const { gantt, procs, total, cs } = computeRR(rrData, q);
  buildGantt(gantt, 'rr-gantt', 'rr-timeline', total);
  document.getElementById('rr-results').classList.remove('hidden');
  buildResultTable('rr-result-table', procs, gantt);
  const avgs = calcAvgs(procs);
  document.getElementById('rr-awt').textContent = avgs.awt;
  document.getElementById('rr-atat').textContent = avgs.atat;
  document.getElementById('rr-cs').textContent = cs;
  document.getElementById('rr-log').innerHTML =
    `Quantum = <strong>${q}</strong>: ${cs} context switches. ${q <= 2 ? 'Small quantum → many switches, better response time.' :
      q >= 8 ? 'Large quantum → fewer switches, behaves like FCFS.' :
        'Balanced quantum.'
    }`;
}

initRR();


/* ─────────────────────────────────────────
   12. SIDE NAV + PHASE PROGRESS BAR

   Both update on scroll. The nav dots
   elongate when their section is active.
   The phase bar shows checkmarks for
   completed phases and highlights the current.
───────────────────────────────────────── */
const sections = [
  'hero', 'what-cpu', 'what-process', 'state-diagram',
  'what-sched', 'why', 'metrics',
  'fcfs', 'sjf', 'priority', 'rr', 'comparison', 'simulator',
];
const dots = document.querySelectorAll('.nav-dot');

const phaseMap = {
  'hero': 'foundations',
  'what-cpu': 'foundations',
  'what-process': 'foundations',
  'state-diagram': 'foundations',
  'what-sched': 'scheduling',
  'why': 'scheduling',
  'metrics': 'scheduling',
  'fcfs': 'algorithms',
  'sjf': 'algorithms',
  'priority': 'algorithms',
  'rr': 'algorithms',
  'comparison': 'algorithms',
  'simulator': 'algorithms',
};

function updatePhaseBar(activeSection) {
  const phase = phaseMap[activeSection] || 'foundations';
  const phases = ['foundations', 'scheduling', 'algorithms', 'simulator'];
  const resolve = phase === 'algorithms'
    ? (activeSection === 'simulator' ? 'simulator' : 'algorithms')
    : phase;
  const activeIdx = phases.indexOf(resolve);

  phases.forEach((p, i) => {
    const el = document.getElementById('pbar-' + p);
    const icon = document.getElementById('picon-' + p);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < activeIdx) {
      el.classList.add('done');
      icon.textContent = '✔';
    } else if (i === activeIdx) {
      el.classList.add('active');
      icon.textContent = p === 'simulator' ? '▶' : String(i + 1);
    } else {
      icon.textContent = p === 'simulator' ? '▶' : String(i + 1);
    }
  });
}

function updateNav() {
  let activeId = sections[0];
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.4) activeId = id;
  });

  dots.forEach(d => d.classList.toggle('active', d.getAttribute('data-target') === activeId));
  updatePhaseBar(activeId);
}

dots.forEach(dot => {
  dot.addEventListener('click', () => {
    document.getElementById(dot.getAttribute('data-target'))?.scrollIntoView({ behavior: 'smooth' });
  });
});

window.addEventListener('scroll', updateNav, { passive: true });
updateNav();
