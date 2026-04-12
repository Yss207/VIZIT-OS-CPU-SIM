/*
  CPU Scheduling — Interactive Learning Guide
  main.js  (merged: base + v4 enhancements)

  Sections:
    1.  Process color map
    2.  CPU chip animation          (anime.js — kept from base)
    3.  Program → Process animation (anime.js — v4 version)
    4.  Process state diagram       (Canvas API — kept from base)
    5.  Scheduling scenarios        (tab switcher)
    6.  Ready queue animation
    7.  Generic Gantt / table helpers + throughput helper
    8.  Ready queue panel helpers   (v4: renderRQ, setCPUNow)
    9.  Hero live animation         (v4: buildHeroCompete)
   10.  Context switch animation    (v4: animateContextSwitch)
   11.  CPU Burst / I/O loop        (v4: animateBurstLoop)
   12.  Scheduling goal detail      (v4: showGoal)
   13.  Algorithm chooser           (v4: chooseAlgo)
   14.  FCFS simulator              (v4: ready queue + convoy + throughput)
   15.  SJF / SRTF simulator        (v4: ready queue + starvation + preemption events)
   16.  Priority simulator          (v4: ready queue)
   17.  Round Robin simulator       (v4: queue rotation + throughput)
   18.  Side nav + phase progress bar
*/


/* ─────────────────────────────────────────
   1. PROCESS COLORS
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
   2. CPU CHIP ANIMATION (kept from base)
   anime.js inline SVG showing ALU/CU/REGS/CACHE
   with signal dot traversal. Click a quadrant
   label to see a description below.
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
    ALU: { color: '#7c6aff', text: 'Arithmetic Logic Unit: performs all math (add, subtract, multiply) and logical comparisons (greater than, equal). This is where actual computation happens.' },
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
      info.innerHTML = `<span style="color:${c.color};font-weight:700">${key}:</span> ${c.text}`;
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
   3. PROGRAM → PROCESS ANIMATION (v4 version)
   5 elements: source.c → arrow → program.exe
   → arrow → Process(PID). s0 fades to 0.3 at end.
───────────────────────────────────────── */
function animateProgramToProcess() {
  const el = document.getElementById('prog-proc-viz');
  el.innerHTML = '';

  const stages = [
    { id: 's0', icon: '📄', top: 'source.c', bot: 'on disk', color: '#555', border: '#444' },
    { id: 'arr0', arrow: true, label: 'compile', color: '#666' },
    { id: 's1', icon: '💾', top: 'program.exe', bot: 'binary', color: '#7c6aff', border: '#7c6aff' },
    { id: 'arr1', arrow: true, label: 'exec()', color: '#888' },
    { id: 's2', icon: '⚡', top: 'Process', bot: 'PID 4821', color: '#6affb8', border: '#6affb8', glow: true },
  ];

  stages.forEach(s => {
    const div = document.createElement('div');
    div.id = s.id;
    if (s.arrow) {
      div.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;opacity:0;padding:0 8px;`;
      div.innerHTML = `<div style="width:40px;height:2px;background:${s.color};position:relative;"><div style="position:absolute;right:-6px;top:-4px;color:${s.color};font-size:10px;">▶</div></div><div style="font-size:9px;color:${s.color};font-family:JetBrains Mono;letter-spacing:1px;">${s.label}</div>`;
    } else {
      div.style.cssText = `display:flex;flex-direction:column;align-items:center;opacity:0;`;
      div.innerHTML = `<div style="width:100px;height:100px;background:${s.color}12;border:2px solid ${s.border};border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;${s.glow ? `box-shadow:0 0 0px ${s.border};` : ''}"><div style="font-size:28px;">${s.icon}</div><div style="font-size:11px;font-weight:800;color:${s.color};font-family:JetBrains Mono;">${s.top}</div><div style="font-size:9px;color:${s.color}80;font-family:JetBrains Mono;">${s.bot}</div></div>`;
    }
    el.appendChild(div);
  });

  el.style.cssText = `width:100%;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;`;

  const tl = anime.timeline({ easing: 'easeOutExpo' });
  tl
    .add({ targets: '#s0', opacity: [0, 1], translateY: [30, 0], duration: 500 })
    .add({ targets: '#arr0', opacity: [0, 1], translateX: [-20, 0], duration: 400 }, '-=100')
    .add({ targets: '#s1', opacity: [0, 1], scale: [0.5, 1.05, 1], duration: 600 }, '-=100')
    .add({ targets: '#arr1', opacity: [0, 1], translateX: [-20, 0], duration: 400 }, '-=100')
    .add({ targets: '#s2', opacity: [0, 1], scale: [0.3, 1.1, 1], duration: 700 }, '-=100')
    .add({ targets: '#s2 > div', boxShadow: ['0 0 0px #6affb8', '0 0 40px #6affb844', '0 0 20px #6affb822'], duration: 1000, easing: 'easeInOutSine' }, '-=200')
    .add({ targets: '#s0', opacity: [1, 0.3], duration: 600, easing: 'easeInOutSine' }, '-=600');
}

animateProgramToProcess();


/* ─────────────────────────────────────────
   4. PROCESS STATE DIAGRAM — Canvas (kept from base)
   Responsive canvas with travelling dots along
   bezier edges. Click nodes or bottom cards to
   highlight a state and show its detail card.
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

  sdDots = STATE_EDGES_DEF.map((_, i) => ({
    edgeIdx: i,
    t: i / STATE_EDGES_DEF.length,
    speed: 0.004 + Math.random() * 0.002,
  }));
}

function sdNodeRect(n) {
  return { l: n.x - n.w / 2, t: n.y - n.h / 2, r: n.x + n.w / 2, b: n.y + n.h / 2 };
}

function sdEdgePoints(edge) {
  const fn = sdNodes.find(n => n.id === edge.from);
  const tn = sdNodes.find(n => n.id === edge.to);
  if (!fn || !tn) return null;

  const dy = tn.y - fn.y;
  let sx, sy, ex, ey, c1x, c1y, c2x, c2y;

  if (edge.from === 'running' && edge.to === 'ready') {
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

  if (Math.abs(dy) < 5) {
    sx = fn.x + fn.w / 2; sy = fn.y;
    ex = tn.x - tn.w / 2; ey = tn.y;
    c1x = sx + (ex - sx) / 3; c1y = sy;
    c2x = sx + 2 * (ex - sx) / 3; c2y = ey;
    return { sx, sy, ex, ey, c1x, c1y, c2x, c2y };
  }

  sx = fn.x; sy = fn.y + fn.h / 2;
  ex = tn.x; ey = tn.y - tn.h / 2;
  c1x = sx; c1y = (sy + ey) / 2;
  c2x = ex; c2y = (sy + ey) / 2;
  return { sx, sy, ex, ey, c1x, c1y, c2x, c2y };
}

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
  ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H - 8, 16); ctx.fill();

  STATE_EDGES_DEF.forEach(edge => {
    const geo = sdEdgePoints(edge);
    if (!geo) return;
    const isActive = sdActiveState && (edge.from === sdActiveState || edge.to === sdActiveState);
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

    const near = sdCubicAt(geo, 0.92);
    const angle = Math.atan2(geo.ey - near.y, geo.ex - near.x);
    ctx.fillStyle = edge.color;
    ctx.save();
    ctx.translate(geo.ex, geo.ey); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, -5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill();
    ctx.restore();

    const mid = sdCubicAt(geo, 0.5);
    ctx.font = `${isActive ? '700' : '600'} 9px JetBrains Mono`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
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
    ctx.beginPath(); ctx.arc(pos.x, pos.y, isActive ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

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
      ctx.stroke(); ctx.shadowBlur = 0;
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
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    new: 'Created via fork() or exec(). OS is allocating memory and setting up the PCB (Process Control Block). Not yet in the ready queue.',
    ready: 'Has all resources except the CPU. Sits in the ready queue. The scheduler picks from here — this is exactly where scheduling decisions happen.',
    running: 'Given the CPU by the scheduler (Ready → Running is THE scheduling decision). Executing instructions right now. Only one process per core can be here at once.',
    waiting: 'Waiting for I/O to complete — disk read, network packet, or keyboard input. CPU is released voluntarily. When I/O completes, moves back to Ready, not directly to Running.',
    terminated: 'Called exit() or returned from main(). OS reclaims its memory, closes file descriptors, and removes its PCB from all tables.',
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
   5. SCHEDULING SCENARIOS (tab switcher)
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
    log: 'CPU is idle 24% of the time. No ordering, no fairness, no efficiency.',
  },
  {
    title: 'One Process Hogs the CPU: Starvation',
    bars: [
      { name: 'P1 (BT=50)', segs: [{ w: 280, c: '#7c6aff' }] },
      { name: 'P2', segs: [{ w: 280, c: '#1a1a1a', label: 'WAITING…' }] },
      { name: 'P3', segs: [{ w: 280, c: '#1a1a1a', label: 'WAITING…' }] },
    ],
    logColor: '#ff6a6a',
    log: 'P2 and P3 starve while P1 runs uninterrupted. Without preemption, one long process blocks everything.',
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
  document.querySelectorAll('#scenario-tabs button').forEach(b => { b.className = 'btn btn-ghost text-xs'; });
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
   7. GENERIC GANTT / TABLE HELPERS + THROUGHPUT
───────────────────────────────────────── */
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

function buildResultTable(tbodyId, processes) {
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

function calcAvgs(processes) {
  const n = processes.length;
  const awt = processes.reduce((s, p) => s + (p.ct - p.at - p.bt), 0) / n;
  const atat = processes.reduce((s, p) => s + (p.ct - p.at), 0) / n;
  return { awt: awt.toFixed(2), atat: atat.toFixed(2) };
}

function tput(processes) {
  const total = Math.max(...processes.map(p => p.ct));
  return (processes.length / total).toFixed(3);
}


/* ─────────────────────────────────────────
   8. READY QUEUE PANEL HELPERS (v4)
   renderRQ — renders the live ready queue list
   setCPUNow — updates the "CPU NOW" display box
───────────────────────────────────────── */
function renderRQ(elId, procs, currentTime, type = 'fifo') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';

  let avail = procs.filter(p => p.at <= currentTime && p.rem > 0);
  if (type === 'sjf') avail = avail.sort((a, b) => a.rem - b.rem);
  if (type === 'prio') avail = avail.sort((a, b) => a.prio - b.prio);

  if (avail.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;">empty</div>';
    return;
  }

  avail.forEach((p, i) => {
    const c = pColor(p.name);
    const div = document.createElement('div');
    div.className = 'rq-item';
    div.style.cssText = `background:${c.bg};color:${c.text};border-color:${c.border};`;
    div.textContent = `${p.name} ${type === 'sjf' ? `(rem=${p.rem})` : type === 'prio' ? `(prio=${p.prio})` : `(BT=${p.bt})`}${i === 0 ? ' ← next' : ''}`;
    el.appendChild(div);
  });
}

function setCPUNow(elId, name) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (name && name !== 'IDLE') {
    const c = pColor(name);
    el.style.borderColor = c.border;
    el.style.color = c.text;
    el.textContent = name;
  } else {
    el.style.borderColor = 'var(--border)';
    el.style.color = 'var(--muted)';
    el.textContent = '—';
  }
}


/* ─────────────────────────────────────────
   9. HERO LIVE ANIMATION (v4)
   Competing process progress bars that run in a
   simple round-robin loop to show "CPU decides".
───────────────────────────────────────── */
const heroProcs = [
  { name: 'P1', bt: 5, color: '#7c6aff' },
  { name: 'P2', bt: 3, color: '#ff6a6a' },
  { name: 'P3', bt: 8, color: '#6affb8' },
  { name: 'P4', bt: 2, color: '#ffb86a' },
];
let heroTimer;

function buildHeroCompete() {
  const el = document.getElementById('hero-compete');
  if (!el) return;
  el.innerHTML = '';

  heroProcs.forEach(p => {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:10px;`;
    row.innerHTML = `
      <div style="width:40px;font-size:11px;font-weight:700;color:${p.color};font-family:JetBrains Mono;">${p.name}</div>
      <div style="flex:1;height:14px;background:var(--surface2);border-radius:7px;overflow:hidden;">
        <div id="hero-bar-${p.name}" style="height:100%;width:0%;background:${p.color};border-radius:7px;transition:width 0.1s;"></div>
      </div>
      <div id="hero-status-${p.name}" style="width:60px;font-size:10px;font-family:JetBrains Mono;color:var(--muted);text-align:right;">waiting</div>`;
    el.appendChild(row);
  });

  runHeroLoop();
}

function runHeroLoop() {
  clearInterval(heroTimer);
  let idx = 0;
  const rem = heroProcs.map(p => p.bt);
  const cpuBar = document.getElementById('hero-cpu-bar');

  heroTimer = setInterval(() => {
    const p = heroProcs[idx % heroProcs.length];
    const ri = idx % heroProcs.length;

    if (rem[ri] > 0) {
      rem[ri] -= 0.2;
      const pct = Math.max(0, (p.bt - rem[ri]) / p.bt * 100);
      const b = document.getElementById(`hero-bar-${p.name}`);
      const s = document.getElementById(`hero-status-${p.name}`);
      if (b) b.style.width = pct + '%';
      if (s) { s.textContent = 'running'; s.style.color = p.color; }
      if (cpuBar) { cpuBar.style.background = p.color + '33'; cpuBar.style.borderColor = p.color; cpuBar.textContent = p.name; cpuBar.style.color = p.color; }
      heroProcs.forEach((q, qi) => {
        if (qi !== ri) {
          const st = document.getElementById(`hero-status-${q.name}`);
          if (st && rem[qi] > 0) { st.textContent = 'waiting'; st.style.color = 'var(--muted)'; }
        }
      });
    } else {
      idx++;
    }

    if (rem.every(r => r <= 0)) {
      heroProcs.forEach((p, i) => {
        rem[i] = p.bt;
        const b = document.getElementById(`hero-bar-${p.name}`);
        if (b) b.style.width = '0%';
      });
    }
  }, 100);
}

buildHeroCompete();


/* ─────────────────────────────────────────
   10. CONTEXT SWITCH ANIMATION (v4)
   4-step walkthrough showing P1 save → P2 load.
───────────────────────────────────────── */
function animateContextSwitch() {
  const steps = [
    { cpu: 'P1', pc: 'PC=0x00A', p1op: 1, p2op: 0.3, log: "P1 is running. CPU registers hold P1's state." },
    { cpu: 'SAVING…', pc: 'saving…', p1op: 1, p2op: 0.3, log: "OS interrupt! Saving P1's registers (PC, R1, R2…) to P1's PCB in memory." },
    { cpu: 'LOADING…', pc: 'loading…', p1op: 0.3, p2op: 1, log: "Loading P2's saved state from P2's PCB. CPU now has P2's register values." },
    { cpu: 'P2', pc: 'PC=0x03F', p1op: 0.3, p2op: 1, log: "P2 is now running. P1's state is safely stored. This is a context switch." },
  ];

  let i = 0;

  function step() {
    if (i >= steps.length) return;
    const s = steps[i];
    const lbl = document.getElementById('ctx-running-label');
    const pc = document.getElementById('ctx-pc');
    const p1 = document.getElementById('ctx-p1-state');
    const p2 = document.getElementById('ctx-p2-state');
    const log = document.getElementById('ctx-log');
    const box = document.getElementById('ctx-cpu-box');

    if (lbl) lbl.textContent = s.cpu;
    if (pc) pc.textContent = s.pc;
    if (p1) p1.style.opacity = s.p1op;
    if (p2) p2.style.opacity = s.p2op;
    if (log) log.innerHTML = `<strong>[Step ${i + 1}/4]</strong> ${s.log}`;
    if (box) box.style.borderColor = s.cpu === 'P2' ? '#ff6a6a' : s.cpu === 'P1' ? '#7c6aff' : '#ffb86a';

    i++;
    if (i < steps.length) setTimeout(step, 1200);
  }

  i = 0; step();
}

animateContextSwitch();


/* ─────────────────────────────────────────
   11. CPU BURST / I/O LOOP ANIMATION (v4)
   Three rows: I/O-bound, CPU-bound, and the
   CPU timeline showing overlap. A segment
   scanner highlight loops over all cells.
───────────────────────────────────────── */
let burstLoopTimer = null;

const burstSegs = [
  { proc: 'P1\n(I/O-bound)', color: '#7c6aff', type: 'cpu', w: 55, label: 'CPU' },
  { proc: 'P1', color: '#7c6aff', type: 'io', w: 85, label: 'I/O Wait' },
  { proc: 'P1', color: '#7c6aff', type: 'cpu', w: 45, label: 'CPU' },
  { proc: 'P1', color: '#7c6aff', type: 'io', w: 75, label: 'I/O Wait' },
  { proc: 'P1', color: '#7c6aff', type: 'cpu', w: 40, label: 'CPU' },
];
const burstSegs2 = [
  { proc: 'P2\n(CPU-bound)', color: '#ff6a6a', type: 'cpu', w: 150, label: 'CPU Burst' },
  { proc: 'P2', color: '#ff6a6a', type: 'io', w: 28, label: 'I/O' },
  { proc: 'P2', color: '#ff6a6a', type: 'cpu', w: 122, label: 'CPU Burst' },
];
const burstSegs3 = [
  { proc: 'CPU\n(scheduled)', color: '#6affb8', type: 'p1', w: 55, label: 'P1', c: '#7c6aff' },
  { proc: 'CPU', color: '#6affb8', type: 'p2', w: 85, label: 'P2 (P1 I/O)', c: '#ff6a6a' },
  { proc: 'CPU', color: '#6affb8', type: 'p1', w: 45, label: 'P1', c: '#7c6aff' },
  { proc: 'CPU', color: '#6affb8', type: 'p2', w: 75, label: 'P2 (P1 I/O)', c: '#ff6a6a' },
  { proc: 'CPU', color: '#6affb8', type: 'p1', w: 40, label: 'P1', c: '#7c6aff' },
];

function stopBurstLoop() { clearInterval(burstLoopTimer); }

function animateBurstLoop() {
  const el = document.getElementById('burst-viz');
  const logEl = document.getElementById('burst-log');
  if (!el) return;
  el.innerHTML = '';
  if (logEl) logEl.style.opacity = '0';

  const rows = [{ segs: burstSegs }, { segs: burstSegs2 }, { segs: burstSegs3 }];

  rows.forEach((r, ri) => {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:12px;`;

    const nameEl = document.createElement('div');
    const c = ri === 0 ? '#7c6aff' : ri === 1 ? '#ff6a6a' : '#6affb8';
    nameEl.style.cssText = `width:80px;font-size:10px;font-family:JetBrains Mono;color:${c};font-weight:700;flex-shrink:0;text-align:right;white-space:pre;`;
    nameEl.textContent = r.segs[0].proc;

    const barEl = document.createElement('div');
    barEl.style.cssText = `display:flex;gap:2px;height:36px;`;

    r.segs.forEach(seg => {
      const s = document.createElement('div');
      const isCPU = seg.type === 'cpu' || seg.type === 'p1' || seg.type === 'p2';
      const bg = seg.c || (isCPU ? seg.color : '#0f0f18');
      const bc = seg.c || seg.color;
      s.style.cssText = `width:${seg.w}px;background:${bg}${isCPU ? '2a' : '15'};border:1px solid ${bc}${isCPU ? '' : '33'};border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;font-family:JetBrains Mono;color:${isCPU ? (seg.c || seg.color) : '#444'};white-space:nowrap;overflow:hidden;padding:0 4px;transition:filter 0.3s;`;
      s.dataset.rowIdx = ri;
      s.textContent = seg.label;
      barEl.appendChild(s);
    });

    row.appendChild(nameEl); row.appendChild(barEl); el.appendChild(row);
  });

  anime({
    targets: el.children, opacity: [0, 1], translateX: [-24, 0],
    delay: anime.stagger(260), duration: 600, easing: 'easeOutExpo',
    complete: () => { if (logEl) anime({ targets: logEl, opacity: [0, 1], duration: 600, easing: 'easeInOutSine' }); }
  });

  let cur = 0;
  const barCells = [];
  setTimeout(() => {
    el.querySelectorAll('[data-row-idx]').forEach(s => barCells.push(s));
    const spd = () => parseInt(document.getElementById('burst-speed')?.value || 700);
    stopBurstLoop();
    burstLoopTimer = setInterval(() => {
      barCells.forEach(s => s.style.filter = 'brightness(0.5)');
      if (barCells[cur]) barCells[cur].style.filter = 'brightness(1.6) drop-shadow(0 0 6px currentColor)';
      cur = (cur + 1) % barCells.length;
    }, spd());
  }, 1000);
}

animateBurstLoop();


/* ─────────────────────────────────────────
   12. SCHEDULING GOAL DETAIL (v4)
   Clicking a goal row in the "Why?" section
   updates the right-panel card.
───────────────────────────────────────── */
const goalData = {
  util: { color: 'var(--accent3)', title: '↑ CPU Utilization', text: 'Keep the CPU working as much as possible. An idle CPU is wasted hardware. Modern systems target 40–90% CPU utilization. Best achieved by overlapping CPU and I/O work — exactly what scheduling enables.', algo: 'All algorithms improve utilization over no scheduling. Round Robin and SRTF are especially effective.' },
  tput: { color: 'var(--accent4)', title: '↑ Throughput', text: 'Complete as many processes as possible per unit of time. Throughput = processes / total time. More relevant for batch systems than interactive ones.', algo: 'SJF maximises throughput by finishing short jobs quickly. Round Robin can hurt throughput due to context switch overhead.' },
  tat: { color: 'var(--accent2)', title: '↓ Turnaround Time', text: 'Minimise total time from process arrival to completion. TAT = CT − AT. Includes waiting time and burst time. Critical for batch jobs where the user is waiting for total completion.', algo: 'SJF gives minimum average TAT for non-preemptive. SRTF for preemptive.' },
  wt: { color: 'var(--accent)', title: '↓ Waiting Time', text: 'Minimise time processes spend in the ready queue doing nothing. WT = TAT − BT. Directly measures scheduling inefficiency — a process waiting is a process being held back.', algo: 'SJF is provably optimal for average waiting time. FCFS often has the worst waiting time due to the convoy effect.' },
  rt: { color: 'var(--p5)', title: '↓ Response Time', text: 'Minimise time until a process first gets the CPU. RT = first CPU start − AT. Critical for interactive systems — a user clicking a button wants a response immediately.', algo: 'Round Robin gives the best response time for interactive workloads. FCFS gives the worst when a long job runs first.' },
};

function showGoal(key) {
  const g = goalData[key];
  const box = document.getElementById('goal-detail-box');
  box.innerHTML = `
    <div class="text-xs font-bold tracking-widest mb-2" style="color:${g.color};">${g.title}</div>
    <p class="text-sm text-gray-300 mb-3">${g.text}</p>
    <div class="highlight-box text-xs" style="border-left-color:${g.color};">
      <strong>Algorithm connection:</strong> ${g.algo}
    </div>`;
}


/* ─────────────────────────────────────────
   13. ALGORITHM CHOOSER (v4)
   Interactive recommendation panel in the
   Comparison section.
───────────────────────────────────────── */
const algoRec = {
  wt: { algo: 'SJF / SRTF', color: 'var(--p2)', why: "SJF is provably optimal for average waiting time among non-preemptive algorithms. SRTF is globally optimal. If you know burst times, use these.", caveat: "Watch for starvation — add aging if processes have mixed burst lengths." },
  rt: { algo: 'Round Robin', color: 'var(--p4)', why: "RR guarantees every process gets CPU time within one quantum cycle. Best for interactive, user-facing systems.", caveat: "Choose Q carefully — too small and context switches dominate." },
  fair: { algo: 'Round Robin', color: 'var(--p4)', why: "RR is the only algorithm that completely eliminates starvation by design. No process waits more than one full cycle of the queue.", caveat: "Average waiting time is worse than SJF, but no process ever starves." },
  prio: { algo: 'Priority Scheduling', color: 'var(--p3)', why: "Priority scheduling directly encodes importance. Critical tasks run first. Use preemptive variant if urgency is time-sensitive.", caveat: "Must implement aging to prevent low-priority processes from starving." },
  simple: { algo: 'FCFS', color: 'var(--p1)', why: "FCFS requires no scheduling logic — just a queue. Zero overhead, trivial to implement. Fine when all jobs have similar burst times.", caveat: "Suffers badly from the convoy effect when burst times vary significantly." },
};

function chooseAlgo(key) {
  const r = algoRec[key];
  const box = document.getElementById('chooser-result');
  document.querySelectorAll('.chooser-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background = 'var(--surface2)';
  });
  if (event && event.target) {
    event.target.style.borderColor = r.color;
    event.target.style.background = r.color + '22';
  }
  box.innerHTML = `
    <div class="text-xs font-bold tracking-widest mb-2" style="color:${r.color};">RECOMMENDATION</div>
    <div class="text-2xl font-extrabold mb-3" style="color:${r.color};">${r.algo}</div>
    <p class="text-sm text-gray-300 mb-3">${r.why}</p>
    <div class="highlight-box text-xs" style="border-left-color:${r.color};">
      <strong>Caveat:</strong> ${r.caveat}
    </div>`;
  box.style.borderTop = `2px solid ${r.color}`;
}


/* ─────────────────────────────────────────
   14. FCFS SIMULATOR (v4 version)
   Adds: live ready queue panel, CPU NOW panel,
   convoy effect demo, throughput metric.
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
      `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td></tr>`;
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
  fcfsState = { step: 0, done: false };
  document.getElementById('fcfs-gantt').innerHTML = '';
  document.getElementById('fcfs-timeline').innerHTML = '';
  document.getElementById('fcfs-results').classList.add('hidden');
  document.getElementById('fcfs-log').textContent = 'Press Step to walk through the algorithm one process at a time.';
  document.getElementById('fcfs-rq').innerHTML = '<div style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;">Press Step to begin</div>';
  setCPUNow('fcfs-cpu-now', null);
}

function fcfsStep() {
  if (fcfsState.done) return;
  const { gantt, procs, total } = computeFCFS(fcfsData);
  fcfsState.step++;
  buildGantt(gantt.slice(0, fcfsState.step), 'fcfs-gantt', 'fcfs-timeline', total);

  const cur = gantt[fcfsState.step - 1];
  if (cur) {
    const t = cur.end;
    const pending = fcfsData.map(p => ({ ...p, rem: p.bt }))
      .filter(p => p.at < t)
      .filter(p => !gantt.slice(0, fcfsState.step).find(g => g.name === p.name && g.end <= t));
    renderRQ('fcfs-rq', pending, t, 'fifo');
    setCPUNow('fcfs-cpu-now', cur.name === 'IDLE' ? null : cur.name);

    const proc = procs.find(p => p.name === cur.name);
    if (proc) {
      document.getElementById('fcfs-log').innerHTML =
        `<strong style="color:${pColor(proc.name).text}">${proc.name}</strong> runs t=${cur.start}→${cur.end}. WT=${proc.ct - proc.at - proc.bt}`;
    }
  }

  if (fcfsState.step >= gantt.length) {
    fcfsState.done = true;
    document.getElementById('fcfs-results').classList.remove('hidden');
    buildResultTable('fcfs-result-table', procs);
    const avgs = calcAvgs(procs);
    document.getElementById('fcfs-awt').textContent = avgs.awt;
    document.getElementById('fcfs-atat').textContent = avgs.atat;
    document.getElementById('fcfs-tput').textContent = tput(procs);
    document.getElementById('fcfs-rq').innerHTML = '<div style="font-size:11px;color:var(--accent3);font-family:JetBrains Mono;">All done ✓</div>';
    setCPUNow('fcfs-cpu-now', null);
  }
}

let fcfsTimer;
function fcfsAuto() {
  clearInterval(fcfsTimer);
  fcfsReset();
  fcfsTimer = setInterval(() => {
    fcfsStep();
    if (fcfsState.done) clearInterval(fcfsTimer);
  }, 600);
}

// Convoy Effect interactive demo
function updateConvoy() {
  const p1bt = parseInt(document.getElementById('convoy-slider').value);
  const p2bt = 2, p3bt = 1;
  const total = p1bt + p2bt + p3bt;
  const el = document.getElementById('convoy-viz');
  const scale = w => (w / total) * 480;

  const procs = [
    { name: 'P1', at: 0, bt: p1bt, color: '#7c6aff' },
    { name: 'P2', at: 0, bt: p2bt, color: '#ff6a6a' },
    { name: 'P3', at: 0, bt: p3bt, color: '#6affb8' },
  ];
  const gantt = [
    { name: 'P1', start: 0, end: p1bt },
    { name: 'P2', start: p1bt, end: p1bt + p2bt },
    { name: 'P3', start: p1bt + p2bt, end: total },
  ];

  el.innerHTML = '';
  const wt_p2 = p1bt, wt_p3 = p1bt + p2bt;
  const awt = ((0 + wt_p2 + wt_p3) / 3).toFixed(1);

  const gRow = document.createElement('div');
  gRow.style.cssText = 'display:flex;height:36px;border-radius:6px;overflow:hidden;gap:1px;margin-bottom:6px;';
  gantt.forEach(b => {
    const p = procs.find(p => p.name === b.name);
    gRow.innerHTML += `<div style="width:${scale(b.end - b.start)}px;background:${p.color}33;border:1px solid ${p.color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${p.color};font-family:JetBrains Mono;">${b.name}</div>`;
  });
  el.appendChild(gRow);

  procs.forEach((p, i) => {
    const wt = i === 0 ? 0 : i === 1 ? wt_p2 : wt_p3;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:4px;';
    row.innerHTML = `
      <div style="width:24px;font-size:10px;color:${p.color};font-family:JetBrains Mono;font-weight:700;">${p.name}</div>
      <div style="flex:1;height:10px;background:var(--surface2);border-radius:5px;overflow:hidden;">
        <div style="width:${wt > 0 ? (wt / total * 100) : 0}%;height:100%;background:${p.color};border-radius:5px;transition:width 0.3s;"></div>
      </div>
      <div style="width:80px;font-size:10px;font-family:JetBrains Mono;color:${wt > 0 ? p.color : 'var(--muted)'};">WT = ${wt}</div>`;
    el.appendChild(row);
  });

  const note = document.createElement('div');
  note.className = 'highlight-box red text-xs mt-3';
  note.textContent = `Avg WT = ${awt}. P2 and P3 waited ${wt_p2} and ${wt_p3} units just because P1 ran first. This is the Convoy Effect.`;
  el.appendChild(note);
}

initFCFS();
updateConvoy();


/* ─────────────────────────────────────────
   15. SJF / SRTF SIMULATOR (v4 version)
   Adds: live ready queue, preemption event log,
   starvation viz, burst prediction.
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
      `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td></tr>`;
  });
}

function computeSJF(data, preemptive) {
  const procs = data.map(p => ({ ...p, rem: p.bt, ct: 0 }));
  let t = 0, done = 0;
  const gantt = [], events = [];
  let last = null;

  while (done < procs.length) {
    const avail = procs.filter(p => p.at <= t && p.rem > 0);
    if (!avail.length) {
      if (last !== 'IDLE') gantt.push({ name: 'IDLE', start: t, end: t + 1 });
      else gantt[gantt.length - 1].end++;
      t++; last = 'IDLE'; continue;
    }

    const pick = avail.reduce((a, b) => a.rem <= b.rem ? a : b);

    if (preemptive) {
      if (last !== pick.name) {
        if (last && last !== 'IDLE') events.push({ t, type: 'preempt', from: last, to: pick.name });
        gantt.push({ name: pick.name, start: t, end: t + 1 });
      } else {
        gantt[gantt.length - 1].end++;
      }
      pick.rem--;
      if (pick.rem === 0) { pick.ct = t + 1; done++; }
      t++; last = pick.name;
    } else {
      gantt.push({ name: pick.name, start: t, end: t + pick.rem });
      t += pick.rem; pick.ct = t; pick.rem = 0; done++; last = pick.name;
    }
  }
  return { gantt, procs, total: t, events };
}

function sjfReset() {
  document.getElementById('sjf-gantt').innerHTML = '';
  document.getElementById('sjf-timeline').innerHTML = '';
  document.getElementById('sjf-results').classList.add('hidden');
  document.getElementById('sjf-rq').innerHTML = '<div style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;">Press Auto to begin</div>';
  setCPUNow('sjf-cpu-now', null);
  document.getElementById('sjf-log').innerHTML = 'Toggle SRTF mode and click <strong>Auto</strong> to see how preemption changes the result.';
}

function sjfAuto() {
  const preemptive = document.getElementById('srtf-toggle').checked;
  const { gantt, procs, total, events } = computeSJF(sjfData, preemptive);
  buildGantt(gantt, 'sjf-gantt', 'sjf-timeline', total);

  renderRQ('sjf-rq', procs.map(p => ({ ...p, rem: 0 })), total, 'sjf');
  setCPUNow('sjf-cpu-now', null);

  document.getElementById('sjf-results').classList.remove('hidden');
  buildResultTable('sjf-result-table', procs);
  const avgs = calcAvgs(procs);
  document.getElementById('sjf-awt').textContent = avgs.awt;
  document.getElementById('sjf-atat').textContent = avgs.atat;

  let logMsg = `<strong>${preemptive ? 'SRTF' : 'SJF'}</strong> complete. `;
  if (preemptive && events.length > 0) {
    logMsg += `<strong style="color:var(--accent2);">⚡ ${events.length} preemption(s)</strong>: `;
    logMsg += events.map(e =>
      `at t=${e.t} <strong style="color:${pColor(e.from).text}">${e.from}</strong> was preempted by <strong style="color:${pColor(e.to).text}">${e.to}</strong> (shorter remaining time)`
    ).join('; ');
  } else if (preemptive) {
    logMsg += 'No preemptions — shorter job never arrived while another was running.';
  } else {
    logMsg += 'No preemption — once started, each process ran to completion.';
  }
  document.getElementById('sjf-log').innerHTML = logMsg;
  document.getElementById('sjf-rq').innerHTML = '<div style="font-size:11px;color:var(--accent3);font-family:JetBrains Mono;">All done ✓</div>';
}

// Starvation visualization
function animateStarvation() {
  const el = document.getElementById('starvation-viz');
  const log = document.getElementById('starvation-log');
  el.innerHTML = '';
  if (log) log.style.opacity = '0';

  const arrivals = [
    { t: 0, label: 't=0', procs: [{ name: 'P_long', bt: 20, rem: 20, color: '#ff6a6a' }, { name: 'P2', bt: 3, rem: 3, color: '#7c6aff' }] },
    { t: 3, label: 't=3 (P3 arrives)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', waiting: true }, { name: 'P3', bt: 2, rem: 2, color: '#6affb8' }] },
    { t: 5, label: 't=5 (P4 arrives)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', waiting: true }, { name: 'P4', bt: 1, rem: 1, color: '#ffb86a' }] },
    { t: 6, label: 't=6 (P5 arrives)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', waiting: true }, { name: 'P5', bt: 4, rem: 4, color: '#ff6adf' }] },
    { t: 10, label: 't=10 — P_long still waiting (WT=10)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', starving: true }] },
  ];

  arrivals.forEach(ev => {
    const row = document.createElement('div');
    row.style.cssText = 'opacity:0;display:flex;align-items:center;gap:12px;';

    const timeEl = document.createElement('div');
    timeEl.style.cssText = 'width:200px;font-size:10px;font-family:JetBrains Mono;color:var(--muted);flex-shrink:0;';
    timeEl.textContent = ev.label;

    const procsEl = document.createElement('div');
    procsEl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

    ev.procs.forEach(p => {
      const pill = document.createElement('span');
      pill.className = 'proc-pill';
      const bg = p.starving ? p.color + '22' : p.waiting ? p.color + '15' : p.color + '33';
      pill.style.cssText = `background:${bg};color:${p.color};border:1px solid ${p.color}${p.starving ? ';animation:pulse 1s infinite' : ''};`;
      pill.textContent = p.starving ? `${p.name} ← STARVING` : p.waiting ? `${p.name} (waiting, rem=${p.rem})` : `${p.name} (BT=${p.bt})`;
      procsEl.appendChild(pill);
    });

    row.appendChild(timeEl); row.appendChild(procsEl); el.appendChild(row);
  });

  anime({
    targets: el.children, opacity: [0, 1], translateX: [-16, 0],
    delay: anime.stagger(400), duration: 500, easing: 'easeOutCubic',
    complete: () => { if (log) anime({ targets: log, opacity: [0, 1], duration: 600, easing: 'easeInOutSine' }); }
  });
}

initSJF();
animateStarvation();


/* ─────────────────────────────────────────
   16. PRIORITY SIMULATOR (v4 version)
   Adds: live ready queue panel, CPU NOW panel.
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
      `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td><td style="color:var(--accent3);font-weight:700;">${p.prio}</td></tr>`;
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
  document.getElementById('prio-rq').innerHTML = '<div style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;">Press Auto to begin</div>';
  setCPUNow('prio-cpu-now', null);
}

function prioAuto() {
  const preemptive = document.getElementById('prio-preemptive').checked;
  const { gantt, procs, total } = computePriority(prioData, preemptive);
  buildGantt(gantt, 'prio-gantt', 'prio-timeline', total);
  renderRQ('prio-rq', procs.map(p => ({ ...p, rem: 0 })), total, 'prio');

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
    `<strong>${preemptive ? 'Preemptive Priority' : 'Non-Preemptive Priority'}</strong>: P2 (prio=1) runs first regardless of arrival order. Lower number = higher priority.`;
  setCPUNow('prio-cpu-now', null);
  document.getElementById('prio-rq').innerHTML = '<div style="font-size:11px;color:var(--accent3);font-family:JetBrains Mono;">All done ✓</div>';
}

initPrio();


/* ─────────────────────────────────────────
   17. ROUND ROBIN SIMULATOR (v4 version)
   Adds: queue rotation animation, throughput metric.
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
      `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td></tr>`;
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
    'Try quantum = 1 vs quantum = 8 on the same processes. Watch context switches and avg wait change.';
}

function rrAuto() {
  const q = parseInt(document.getElementById('rr-quantum-slider').value);
  const { gantt, procs, total, cs } = computeRR(rrData, q);
  buildGantt(gantt, 'rr-gantt', 'rr-timeline', total);
  document.getElementById('rr-results').classList.remove('hidden');
  buildResultTable('rr-result-table', procs);
  const avgs = calcAvgs(procs);
  document.getElementById('rr-awt').textContent = avgs.awt;
  document.getElementById('rr-atat').textContent = avgs.atat;
  document.getElementById('rr-cs').textContent = cs;
  document.getElementById('rr-tput').textContent = tput(procs);
  document.getElementById('rr-log').innerHTML =
    `Quantum = <strong>${q}</strong>: ${cs} context switches. ${q <= 2 ? 'Small quantum → many switches, better response time.' :
      q >= 8 ? 'Large quantum → fewer switches, behaves like FCFS.' :
        'Balanced quantum.'
    }`;
}

// Queue rotation animation
function animateRRRotation() {
  const el = document.getElementById('rr-rotation-viz');
  const log = document.getElementById('rr-rotation-log');
  el.innerHTML = '';
  if (log) log.style.opacity = '0';

  const states = [
    { queue: ['P1', 'P2', 'P3'], running: '—', label: 'Initial queue. P1 is next.' },
    { queue: ['P2', 'P3'], running: 'P1', label: 'P1 gets the CPU for quantum Q.' },
    { queue: ['P2', 'P3', 'P1'], running: 'P1→back', label: "P1's quantum expires. P1 goes to the back of the queue." },
    { queue: ['P3', 'P1'], running: 'P2', label: 'P2 now runs for Q units.' },
    { queue: ['P3', 'P1', 'P2'], running: 'P2→back', label: "P2's quantum expires. P2 goes to back." },
    { queue: ['P1', 'P2'], running: 'P3', label: 'P3 runs. Everyone gets fair turns.' },
  ];

  const container = document.createElement('div');
  el.appendChild(container);
  let step = 0;

  function showStep() {
    if (step >= states.length) {
      if (log) anime({ targets: log, opacity: [0, 1], duration: 500, easing: 'easeInOutSine' });
      return;
    }
    const s = states[step];
    container.innerHTML = '';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:8px 0;';

    const qLabel = document.createElement('div');
    qLabel.style.cssText = 'font-size:10px;color:var(--muted);font-family:JetBrains Mono;width:80px;flex-shrink:0;';
    qLabel.textContent = 'Queue:';

    const qEl = document.createElement('div');
    qEl.style.cssText = 'display:flex;gap:6px;';
    s.queue.forEach((p, i) => {
      const c = pColor(p);
      const pill = document.createElement('span');
      pill.className = 'proc-pill';
      pill.style.cssText = `background:${c.bg};color:${c.text};border:1px solid ${c.border};${i === 0 ? 'box-shadow:0 0 8px ' + c.border + '88;' : ''}`;
      pill.textContent = p + (i === 0 ? ' ← next' : '');
      qEl.appendChild(pill);
    });

    const cpuEl = document.createElement('div');
    cpuEl.style.cssText = 'font-size:10px;color:var(--muted);font-family:JetBrains Mono;';
    const runName = s.running.split('→')[0];
    const runColor = s.running !== '—' ? pColor(runName).text : 'var(--muted)';
    cpuEl.innerHTML = `CPU: <strong style="color:${runColor};">${s.running}</strong>`;

    const logEl2 = document.createElement('div');
    logEl2.style.cssText = 'font-size:11px;color:var(--text);flex:1;';
    logEl2.textContent = s.label;

    row.appendChild(qLabel); row.appendChild(qEl); row.appendChild(cpuEl); row.appendChild(logEl2);
    container.appendChild(row);

    anime({ targets: row, opacity: [0, 1], translateX: [-10, 0], duration: 400, easing: 'easeOutCubic' });

    step++;
    if (step < states.length) setTimeout(showStep, 900);
    else { if (log) setTimeout(() => anime({ targets: log, opacity: [0, 1], duration: 500 }), 400); }
  }

  showStep();
}

initRR();
animateRRRotation();


/* ─────────────────────────────────────────
   18. SIDE NAV + PHASE PROGRESS BAR
   Both update on scroll. nav includes cpu-exec.
───────────────────────────────────────── */
const sections = [
  'hero', 'what-cpu', 'what-process', 'cpu-exec', 'state-diagram',
  'what-sched', 'why', 'metrics',
  'fcfs', 'sjf', 'priority', 'rr', 'comparison', 'simulator',
];

const phaseMap = {
  'hero': 'foundations',
  'what-cpu': 'foundations',
  'what-process': 'foundations',
  'cpu-exec': 'foundations',
  'state-diagram': 'foundations',
  'what-sched': 'scheduling',
  'why': 'scheduling',
  'metrics': 'scheduling',
  'fcfs': 'algorithms',
  'sjf': 'algorithms',
  'priority': 'algorithms',
  'rr': 'algorithms',
  'comparison': 'algorithms',
  'simulator': 'simulator',
};

function updatePhaseBar(activeSection) {
  const phase = phaseMap[activeSection] || 'foundations';
  const phases = ['foundations', 'scheduling', 'algorithms', 'simulator'];
  const activeIdx = phases.indexOf(phase);

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

const dots = document.querySelectorAll('.nav-dot');

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
