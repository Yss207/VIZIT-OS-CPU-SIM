/*
  CPU Scheduling — Interactive Learning Guide
  main.js  (ported from cpu-scheduling-v4)

  Sections:
    1.  Colors & utils
    2.  Gantt / table helpers
    3.  Ready queue helpers
    4.  Hero live animation
    5.  Context switch animation
    6.  Program → Process animation
    7.  CPU Burst / I/O loop animation
    8.  State diagram (Canvas)
    9.  Queue animation
   10.  Scenario tabs
   11.  Goals interactive
   12.  Algorithm chooser
   13.  Convoy effect demo
   14.  Starvation visualization
   15.  RR queue rotation
   16.  FCFS simulator
   17.  SJF / SRTF simulator
   18.  Priority simulator
   19.  Round Robin simulator
   20.  Progress nav
*/

// ══════════════════════════════════════════════════
// 1. COLORS & UTILS
// ══════════════════════════════════════════════════
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


// ══════════════════════════════════════════════════
// 2. GANTT / TABLE HELPERS
// ══════════════════════════════════════════════════
function buildGantt(blocks, cid, tid, total) {
  const gc = document.getElementById(cid), tc = document.getElementById(tid);
  gc.innerHTML = ''; tc.innerHTML = '';
  const mxW = Math.min(gc.parentElement.offsetWidth - 48 || 500, 600);
  const sc = t => Math.max(24, (t / total) * mxW);
  blocks.forEach((b, i) => {
    const c = b.name === 'IDLE' ? { bg: '#111', text: '#333', border: '#222' } : pColor(b.name);
    const w = sc(b.end - b.start);
    const el = document.createElement('div');
    el.className = 'gantt-block';
    el.style.cssText = `width:${w}px;background:${c.bg};color:${c.text};border:1px solid ${c.border};opacity:0;animation:slideIn 0.25s ease ${i * 0.05}s forwards;font-size:11px;border-radius:4px;`;
    el.innerHTML = `<span>${b.name}</span>`;
    gc.appendChild(el);
  });
  const ticks = new Set([0]);
  blocks.forEach(b => { ticks.add(b.start); ticks.add(b.end); });
  let ll = -20;
  [...ticks].sort((a, b) => a - b).forEach(t => {
    const left = (t / total) * mxW;
    if (left - ll < 16) return; ll = left;
    const tk = document.createElement('span');
    tk.style.cssText = `position:absolute;left:${left}px;font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;`;
    tk.textContent = t; tc.appendChild(tk);
  });
  tc.style.position = 'relative'; tc.style.height = '16px';
}

function buildResultTable(id, procs) {
  const tb = document.getElementById(id); tb.innerHTML = '';
  procs.forEach(p => {
    const c = pColor(p.name); const tat = p.ct - p.at, wt = tat - p.bt;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td><td>${p.ct}</td><td style="color:var(--accent2)">${tat}</td><td style="color:var(--accent)">${wt}</td>`;
    tb.appendChild(tr);
  });
}

function calcAvgs(ps) {
  const n = ps.length;
  return {
    awt: (ps.reduce((s, p) => s + (p.ct - p.at - p.bt), 0) / n).toFixed(2),
    atat: (ps.reduce((s, p) => s + (p.ct - p.at), 0) / n).toFixed(2)
  };
}

function tput(ps) {
  const total = Math.max(...ps.map(p => p.ct));
  return (ps.length / total).toFixed(3);
}


// ══════════════════════════════════════════════════
// 3. READY QUEUE HELPERS
// ══════════════════════════════════════════════════
function renderRQ(elId, procs, currentTime, type = 'fifo') {
  const el = document.getElementById(elId); if (!el) return; el.innerHTML = '';
  let avail = procs.filter(p => p.at <= currentTime && p.rem > 0);
  if (type === 'sjf') avail = avail.sort((a, b) => a.rem - b.rem);
  if (type === 'prio') avail = avail.sort((a, b) => a.prio - b.prio);
  if (avail.length === 0) { el.innerHTML = '<div style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;">empty</div>'; return; }
  avail.forEach((p, i) => {
    const c = pColor(p.name);
    const div = document.createElement('div');
    div.className = 'rq-item';
    div.style.cssText = `background:${c.bg};color:${c.text};border-color:${c.border};font-size:11px;padding:5px 10px;`;
    div.textContent = `${p.name} ${type === 'sjf' ? `(rem=${p.rem})` : type === 'prio' ? `(prio=${p.prio})` : `(BT=${p.bt})`}${i === 0 ? ' ← next' : ''}`;
    el.appendChild(div);
  });
}

function setCPUNow(elId, name) {
  const el = document.getElementById(elId); if (!el) return;
  if (name && name !== 'IDLE') {
    const c = pColor(name);
    el.style.borderColor = c.border; el.style.color = c.text; el.textContent = name;
  } else {
    el.style.borderColor = 'var(--border)'; el.style.color = 'var(--muted)'; el.textContent = '—';
  }
}


// ══════════════════════════════════════════════════
// 4. HERO — live competing processes
// ══════════════════════════════════════════════════
const heroProcs = [
  { name: 'P1', bt: 5, color: '#7c6aff' },
  { name: 'P2', bt: 3, color: '#ff6a6a' },
  { name: 'P3', bt: 8, color: '#6affb8' },
  { name: 'P4', bt: 2, color: '#ffb86a' }
];
let heroTimer;

function buildHeroCompete() {
  const el = document.getElementById('hero-compete'); if (!el) return;
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
  let idx = 0, rem = heroProcs.map(p => p.bt);
  const cpuBar = document.getElementById('hero-cpu-bar');
  heroTimer = setInterval(() => {
    const p = heroProcs[idx % heroProcs.length];
    if (rem[idx % heroProcs.length] > 0) {
      rem[idx % heroProcs.length] -= 0.2;
      const pct = Math.max(0, (p.bt - rem[idx % heroProcs.length]) / p.bt * 100);
      const b = document.getElementById(`hero-bar-${p.name}`);
      const s = document.getElementById(`hero-status-${p.name}`);
      if (b) b.style.width = pct + '%';
      if (s) { s.textContent = 'running'; s.style.color = p.color; }
      if (cpuBar) { cpuBar.style.background = p.color + '33'; cpuBar.style.borderColor = p.color; cpuBar.textContent = p.name; cpuBar.style.color = p.color; }
      heroProcs.forEach((q, qi) => {
        if (qi !== idx % heroProcs.length) {
          const st = document.getElementById(`hero-status-${q.name}`);
          if (st && rem[qi] > 0) { st.textContent = 'waiting'; st.style.color = 'var(--muted)'; }
        }
      });
    } else { idx++; }
    if (rem.every(r => r <= 0)) {
      rem = heroProcs.map(p => p.bt);
      heroProcs.forEach(p => { const b = document.getElementById(`hero-bar-${p.name}`); if (b) b.style.width = '0%'; });
    }
  }, 100);
}

buildHeroCompete();


// ══════════════════════════════════════════════════
// 5. CONTEXT SWITCH ANIMATION
// ══════════════════════════════════════════════════
function animateContextSwitch() {
  const steps = [
    { cpu: 'P1', pc: 'PC=0x00A', p1: 'PC=0x00A\nR1=12, R2=7', p2: 'PC=0x03F\nR1=44, R2=2', p1op: 1, p2op: 0.3, log: "P1 is running. CPU registers hold P1's state." },
    { cpu: 'SAVING…', pc: 'saving…', p1: 'PC=0x00A\nR1=12, R2=7', p2: 'PC=0x03F\nR1=44, R2=2', p1op: 1, p2op: 0.3, log: "OS interrupt! Saving P1's registers (PC, R1, R2…) to P1's PCB in memory." },
    { cpu: 'LOADING…', pc: 'loading…', p1: 'PC=0x00A\nR1=12, R2=7', p2: 'PC=0x03F\nR1=44, R2=2', p1op: 0.3, p2op: 1, log: "Loading P2's saved state from P2's PCB. CPU now has P2's register values." },
    { cpu: 'P2', pc: 'PC=0x03F', p1: 'PC=0x00A\nR1=12, R2=7', p2: 'PC=0x03F\nR1=44, R2=2', p1op: 0.3, p2op: 1, log: "P2 is now running. P1's state is safely stored. This is a context switch." },
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
    if (p1) { p1.textContent = s.p1; p1.style.opacity = s.p1op; }
    if (p2) { p2.textContent = s.p2; p2.style.opacity = s.p2op; }
    if (log) log.innerHTML = `<strong>[Step ${i + 1}/4]</strong> ${s.log}`;
    if (box) box.style.borderColor = s.cpu === 'P2' ? '#ff6a6a' : s.cpu === 'P1' ? '#7c6aff' : '#ffb86a';
    i++;
    if (i < steps.length) setTimeout(step, 1200);
  }
  i = 0; step();
}
animateContextSwitch();


// ══════════════════════════════════════════════════
// 6. PROGRAM → PROCESS ANIMATION
// ══════════════════════════════════════════════════
function animateProgramToProcess() {
  const el = document.getElementById('prog-proc-viz'); el.innerHTML = '';
  const stages = [
    { id: 's0', icon: '📄', top: 'source.c', bot: 'on disk', color: '#555', border: '#444' },
    { id: 'arr0', arrow: true, label: 'compile', color: '#666' },
    { id: 's1', icon: '💾', top: 'program.exe', bot: 'binary', color: '#7c6aff', border: '#7c6aff' },
    { id: 'arr1', arrow: true, label: 'exec()', color: '#888' },
    { id: 's2', icon: '⚡', top: 'Process', bot: 'PID 4821', color: '#6affb8', border: '#6affb8', glow: true },
  ];
  stages.forEach(s => {
    const div = document.createElement('div'); div.id = s.id;
    if (s.arrow) {
      div.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;opacity:0;padding:0 8px;`;
      div.innerHTML = `<div style="width:40px;height:2px;background:${s.color};position:relative;"><div style="position:absolute;right:-6px;top:-4px;color:${s.color};font-size:10px;">▶</div></div><div style="font-size:9px;color:${s.color};font-family:JetBrains Mono;letter-spacing:1px;">${s.label}</div>`;
    } else {
      div.style.cssText = `display:flex;flex-direction:column;align-items:center;opacity:0;`;
      div.innerHTML = `<div style="width:100px;height:100px;background:${s.color}12;border:2px solid ${s.border};border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;${s.glow ? `box-shadow:0 0 0px ${s.border};` : ''}"><div style="font-size:28px;">${s.icon}</div><div style="font-size:11px;font-weight:800;color:${s.color};font-family:JetBrains Mono;">${s.top}</div><div style="font-size:9px;color:${s.color}80;font-family:JetBrains Mono;">${s.bot}</div></div>`;
    }
    el.appendChild(div);
  });
  const tl = anime.timeline({ easing: 'easeOutExpo' });
  tl.add({ targets: '#s0', opacity: [0, 1], translateY: [30, 0], duration: 500 })
    .add({ targets: '#arr0', opacity: [0, 1], translateX: [-20, 0], duration: 400 }, '-=100')
    .add({ targets: '#s1', opacity: [0, 1], scale: [0.5, 1.05, 1], duration: 600 }, '-=100')
    .add({ targets: '#arr1', opacity: [0, 1], translateX: [-20, 0], duration: 400 }, '-=100')
    .add({ targets: '#s2', opacity: [0, 1], scale: [0.3, 1.1, 1], duration: 700 }, '-=100')
    .add({ targets: '#s2 > div', boxShadow: ['0 0 0px #6affb8', '0 0 40px #6affb844', '0 0 20px #6affb822'], duration: 1000, easing: 'easeInOutSine' }, '-=200')
    .add({ targets: '#s0', opacity: [1, 0.3], duration: 600, easing: 'easeInOutSine' }, '-=600');
}
animateProgramToProcess();


// ══════════════════════════════════════════════════
// 7. CPU BURST VIZ — looping
// ══════════════════════════════════════════════════
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
  if (!el) return; el.innerHTML = ''; if (logEl) logEl.style.opacity = '0';
  const rows = [{ segs: burstSegs }, { segs: burstSegs2 }, { segs: burstSegs3 }];
  rows.forEach((r, ri) => {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:12px;`;
    const nameEl = document.createElement('div');
    const c = ri === 0 ? '#7c6aff' : ri === 1 ? '#ff6a6a' : '#6affb8';
    nameEl.style.cssText = `width:80px;font-size:10px;font-family:JetBrains Mono;color:${c};font-weight:700;flex-shrink:0;text-align:right;white-space:pre;`;
    nameEl.textContent = r.segs[0].proc;
    const barEl = document.createElement('div'); barEl.style.cssText = `display:flex;gap:2px;height:36px;`;
    r.segs.forEach(seg => {
      const s = document.createElement('div');
      const isCPU = seg.type === 'cpu' || seg.type === 'p1' || seg.type === 'p2';
      const bg = seg.c || (isCPU ? seg.color : '#0f0f18'); const bc = seg.c || seg.color;
      s.style.cssText = `width:${seg.w}px;background:${bg}${isCPU ? '2a' : '15'};border:1px solid ${bc}${isCPU ? '' : '33'};border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;font-family:JetBrains Mono;color:${isCPU ? (seg.c || seg.color) : '#444'};white-space:nowrap;overflow:hidden;padding:0 4px;transition:filter 0.3s;`;
      s.dataset.rowIdx = ri; s.textContent = seg.label; barEl.appendChild(s);
    });
    row.appendChild(nameEl); row.appendChild(barEl); el.appendChild(row);
  });
  anime({
    targets: el.children, opacity: [0, 1], translateX: [-24, 0],
    delay: anime.stagger(260), duration: 600, easing: 'easeOutExpo',
    complete: () => { if (logEl) anime({ targets: logEl, opacity: [0, 1], duration: 600, easing: 'easeInOutSine' }); }
  });
  let cur = 0;
  setTimeout(() => {
    const barCells = [];
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


// ══════════════════════════════════════════════════
// 8. STATE DIAGRAM (Canvas — dynamic bezier system)
// ══════════════════════════════════════════════════
const STATE_NODES_DEF = [
  { id: 'new',        label: 'NEW',        color: '#7c6aff', desc: 'Process just created via fork()/exec(). OS allocating memory, setting up PCB. Not yet in ready queue.' },
  { id: 'ready',      label: 'READY',      color: '#6affb8', desc: 'In memory with all resources except the CPU. Sits in the ready queue. The scheduler picks from here — this is where scheduling decisions happen.' },
  { id: 'running',    label: 'RUNNING',    color: '#ff6a6a', desc: 'Has the CPU and is executing instructions. Only ONE process per core at a time. Arrives via the scheduler\'s Ready→Running decision.' },
  { id: 'terminated', label: 'TERMINATED', color: '#8f8f9b', desc: 'Finished execution. OS reclaims all memory and resources. Process removed from all queues.' },
  { id: 'waiting',    label: 'WAITING',    color: '#ffb86a', desc: 'Waiting for I/O — disk, network, keyboard. CPU is released. When I/O completes, moves back to Ready (not directly to Running).' },
];
const STATE_EDGES_DEF = [
  { from: 'new',     to: 'ready',      label: 'Admit',      color: '#7c6aff' },
  { from: 'ready',   to: 'running',    label: 'Dispatch ★', color: '#6affb8' },
  { from: 'running', to: 'terminated', label: 'Completion', color: '#8f8f9b' },
  { from: 'running', to: 'ready',      label: 'Preempt',    color: '#ff9a9a' },
  { from: 'running', to: 'waiting',    label: 'I/O Request',color: '#ffb86a' },
  { from: 'waiting', to: 'ready',      label: 'I/O Done',   color: '#ffb86a' },
];

let sdCanvas, sdCtx, sdNodes = [], sdEdges = [], sdAnimFrame = null, sdActiveNode = null;
const SD_DOT_SPEED = 0.45; // units per frame
let sdDots = STATE_EDGES_DEF.map(() => ({ t: Math.random() }));

function sdSetup() {
  sdCanvas = document.getElementById('state-canvas');
  if (!sdCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = sdCanvas.parentElement.clientWidth || 860;
  const cssH = Math.round(cssW * 0.42);
  sdCanvas.style.height = cssH + 'px';
  sdCanvas.width  = Math.round(cssW * dpr);
  sdCanvas.height = Math.round(cssH * dpr);
  sdCtx = sdCanvas.getContext('2d');
  sdCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sdBuildNodes(cssW, cssH);
  if (!sdAnimFrame) sdLoop();
}

function sdBuildNodes(W, H) {
  const mainY = H * 0.35;
  const waitY = H * 0.78;
  const xs = [W * 0.09, W * 0.33, W * 0.57, W * 0.91];
  const defs = STATE_NODES_DEF;
  sdNodes = [
    { ...defs[0], x: xs[0], y: mainY },   // NEW
    { ...defs[1], x: xs[1], y: mainY },   // READY
    { ...defs[2], x: xs[2], y: mainY },   // RUNNING
    { ...defs[3], x: xs[3], y: mainY },   // TERMINATED
    { ...defs[4], x: (xs[1] + xs[2]) / 2, y: waitY }, // WAITING
  ];
  sdEdges = STATE_EDGES_DEF.map(e => ({
    ...e,
    fromNode: sdNodes.find(n => n.id === e.from),
    toNode:   sdNodes.find(n => n.id === e.to),
  }));
}

function sdEdgePoints(e) {
  const { fromNode: A, toNode: B } = e;
  // Control points — unique arcs for each edge pair direction
  const key = e.from + '->' + e.to;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
  const dx = B.x - A.x, dy = B.y - A.y;
  const perp = { x: -dy, y: dx };
  const len = Math.hypot(perp.x, perp.y) || 1;
  let bow = 0;
  if (key === 'ready->running')    bow = -0.28;
  if (key === 'running->ready')    bow =  0.28;
  if (key === 'running->waiting')  bow =  0.35;
  if (key === 'waiting->ready')    bow = -0.35;
  const cp1x = mx + (perp.x / len) * bow * Math.hypot(dx, dy);
  const cp1y = my + (perp.y / len) * bow * Math.hypot(dx, dy);
  // cubic: use symmetric control points
  const t1x = A.x + (cp1x - A.x) * 0.5, t1y = A.y + (cp1y - A.y) * 0.5;
  const t2x = B.x + (cp1x - B.x) * 0.5, t2y = B.y + (cp1y - B.y) * 0.5;
  return { p0: { x: A.x, y: A.y }, p1: { x: t1x, y: t1y }, p2: { x: t2x, y: t2y }, p3: { x: B.x, y: B.y }, midX: cp1x, midY: cp1y };
}

function sdCubicAt(pts, t) {
  const u = 1 - t;
  return {
    x: u*u*u*pts.p0.x + 3*u*u*t*pts.p1.x + 3*u*t*t*pts.p2.x + t*t*t*pts.p3.x,
    y: u*u*u*pts.p0.y + 3*u*u*t*pts.p1.y + 3*u*t*t*pts.p2.y + t*t*t*pts.p3.y,
  };
}

function sdRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function sdLoop() {
  if (!sdCtx) return;
  const W = sdCanvas.width  / (window.devicePixelRatio || 1);
  const H = sdCanvas.height / (window.devicePixelRatio || 1);
  sdCtx.clearRect(0, 0, W, H);

  // Draw edges
  sdEdges.forEach((e, i) => {
    const pts = sdEdgePoints(e);
    const isHot = sdActiveNode && (e.from === sdActiveNode || e.to === sdActiveNode);
    const alpha = sdActiveNode ? (isHot ? 1 : 0.08) : 0.7;
    sdCtx.save();
    sdCtx.globalAlpha = alpha;
    sdCtx.strokeStyle = e.color;
    sdCtx.lineWidth = isHot ? 2.2 : 1.6;
    if (isHot) { sdCtx.shadowColor = e.color; sdCtx.shadowBlur = 10; }
    sdCtx.beginPath();
    sdCtx.moveTo(pts.p0.x, pts.p0.y);
    sdCtx.bezierCurveTo(pts.p1.x, pts.p1.y, pts.p2.x, pts.p2.y, pts.p3.x, pts.p3.y);
    sdCtx.stroke();
    sdCtx.shadowBlur = 0;

    // Arrow head
    const tArrow = 0.97;
    const pa = sdCubicAt(pts, tArrow), pb = sdCubicAt(pts, 1.0);
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    sdCtx.fillStyle = e.color;
    sdCtx.save(); sdCtx.translate(pts.p3.x, pts.p3.y); sdCtx.rotate(ang);
    sdCtx.beginPath(); sdCtx.moveTo(0,0); sdCtx.lineTo(-10,-4); sdCtx.lineTo(-10,4); sdCtx.closePath(); sdCtx.fill();
    sdCtx.restore();

    // Edge label pill
    const lx = pts.midX, ly = pts.midY;
    const txt = e.label;
    sdCtx.font = isHot ? 'bold 10px JetBrains Mono' : '9px JetBrains Mono';
    const tw = sdCtx.measureText(txt).width;
    const pw = tw + 12, ph = 16, pr = 6;
    sdCtx.fillStyle = '#0d0d16';
    sdRoundRect(sdCtx, lx - pw/2, ly - ph/2, pw, ph, pr);
    sdCtx.fill();
    sdCtx.strokeStyle = e.color + (isHot ? 'cc' : '55');
    sdCtx.lineWidth = 1;
    sdRoundRect(sdCtx, lx - pw/2, ly - ph/2, pw, ph, pr);
    sdCtx.stroke();
    sdCtx.fillStyle = e.color;
    sdCtx.textAlign = 'center'; sdCtx.textBaseline = 'middle';
    sdCtx.fillText(txt, lx, ly);

    // Traveling dot
    sdDots[i].t = (sdDots[i].t + SD_DOT_SPEED / 100) % 1;
    const dp = sdCubicAt(pts, sdDots[i].t);
    const dotAlpha = sdActiveNode ? (isHot ? 0.95 : 0.05) : 0.7;
    sdCtx.globalAlpha = dotAlpha * (0.5 + 0.5 * Math.sin(sdDots[i].t * Math.PI));
    sdCtx.fillStyle = '#fff';
    sdCtx.beginPath(); sdCtx.arc(dp.x, dp.y, 3, 0, Math.PI * 2); sdCtx.fill();

    sdCtx.restore();
  });

  // Draw nodes on top
  const NODE_W = 88, NODE_H = 36, NODE_R = 18;
  sdNodes.forEach(n => {
    const isA = sdActiveNode === n.id;
    const alpha = sdActiveNode ? (isA ? 1 : 0.15) : 0.92;
    sdCtx.save();
    sdCtx.globalAlpha = alpha;
    if (isA) { sdCtx.shadowColor = n.color; sdCtx.shadowBlur = 24; }
    // Fill
    sdCtx.fillStyle = n.color + '22';
    sdRoundRect(sdCtx, n.x - NODE_W/2, n.y - NODE_H/2, NODE_W, NODE_H, NODE_R);
    sdCtx.fill();
    // Border
    sdCtx.strokeStyle = n.color;
    sdCtx.lineWidth = isA ? 2.5 : 1.8;
    sdRoundRect(sdCtx, n.x - NODE_W/2, n.y - NODE_H/2, NODE_W, NODE_H, NODE_R);
    sdCtx.stroke();
    sdCtx.shadowBlur = 0;
    // Label
    sdCtx.font = 'bold 12px "JetBrains Mono", monospace';
    sdCtx.fillStyle = n.color;
    sdCtx.textAlign = 'center'; sdCtx.textBaseline = 'middle';
    sdCtx.fillText(n.label, n.x, n.y);
    // Scheduler note on RUNNING
    if (n.id === 'running' && !sdActiveNode) {
      sdCtx.font = '8px JetBrains Mono';
      sdCtx.fillStyle = '#6affb8';
      sdCtx.globalAlpha = 0.55;
      sdCtx.fillText('← scheduler', n.x, n.y + NODE_H / 2 + 10);
    }
    sdCtx.restore();
  });

  sdAnimFrame = requestAnimationFrame(sdLoop);
}

document.getElementById('state-canvas')?.addEventListener('click', e => {
  if (!sdCanvas) return;
  const rect = sdCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = sdCanvas.width / dpr, cssH = sdCanvas.height / dpr;
  const mx = (e.clientX - rect.left) * (cssW / rect.width);
  const my = (e.clientY - rect.top)  * (cssH / rect.height);
  const NODE_W = 88, NODE_H = 36;
  const hit = sdNodes.find(n => Math.abs(n.x - mx) < NODE_W/2 + 6 && Math.abs(n.y - my) < NODE_H/2 + 6);
  sdActiveNode = hit ? (sdActiveNode === hit.id ? null : hit.id) : null;
  showStateDetail(sdActiveNode);
});

function highlightStateFromCard(id) {
  sdActiveNode = sdActiveNode === id ? null : id;
  showStateDetail(sdActiveNode);
}

function showStateDetail(id) {
  const detail = document.getElementById('state-detail');
  const titleEl = document.getElementById('state-detail-title');
  const textEl  = document.getElementById('state-detail-text');
  if (!id) { detail.classList.add('hidden'); return; }
  const n = STATE_NODES_DEF.find(x => x.id === id);
  if (!n) return;
  detail.classList.remove('hidden');
  detail.style.cssText = `background:var(--surface);border:1px solid ${n.color}44;border-top:2px solid ${n.color};border-radius:16px;padding:20px 24px;margin-bottom:24px;`;
  if (titleEl) { titleEl.style.color = n.color; titleEl.textContent = 'STATE: ' + n.label + (id === 'running' ? ' ← The Scheduling Decision' : ''); }
  if (textEl) textEl.textContent = n.desc;
}

function resetStateViz() {
  sdActiveNode = null;
  const d = document.getElementById('state-detail');
  if (d) d.classList.add('hidden');
}

window.addEventListener('resize', () => {
  if (sdAnimFrame) { cancelAnimationFrame(sdAnimFrame); sdAnimFrame = null; }
  sdSetup();
});
sdSetup();


// ══════════════════════════════════════════════════
// 9. QUEUE ANIMATION
// ══════════════════════════════════════════════════
const queueProcs = [{ name: 'P1', bt: 5 }, { name: 'P2', bt: 3 }, { name: 'P3', bt: 7 }, { name: 'P4', bt: 2 }];

function runQueueAnim() {
  const qv = document.getElementById('queue-viz'), cv = document.getElementById('cpu-proc'), dv = document.getElementById('done-viz');
  qv.innerHTML = ''; dv.innerHTML = ''; cv.textContent = '—';
  const procs = [...queueProcs];
  procs.forEach((p, i) => {
    const el = document.createElement('div'); const c = pColor(p.name);
    el.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:7px 14px;border-radius:8px;font-weight:700;font-size:12px;font-family:'JetBrains Mono',monospace;opacity:0;animation:fadeUp 0.3s ease ${i * 0.1}s forwards;`;
    el.textContent = `${p.name} (BT=${p.bt})`; qv.appendChild(el);
  });
  let delay = 600;
  procs.forEach(p => {
    setTimeout(() => {
      cv.textContent = p.name; cv.style.color = pColor(p.name).text;
      if (qv.firstChild) qv.removeChild(qv.firstChild);
    }, delay);
    delay += 800;
    setTimeout(() => {
      const done = document.createElement('div'); const c = pColor(p.name);
      done.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace;`;
      done.textContent = `✓ ${p.name}`; dv.appendChild(done);
      if (procs.indexOf(p) === procs.length - 1) cv.textContent = '—';
    }, delay);
    delay += 200;
  });
}
runQueueAnim();


// ══════════════════════════════════════════════════
// 10. SCENARIO TABS
// ══════════════════════════════════════════════════
const scenarios = [
  { title: 'No Scheduling — Chaos', bars: [{ name: 'P1', segs: [{ w: 80, c: '#7c6aff' }, { w: 30, c: '#111' }] }, { name: 'P2', segs: [{ w: 20, c: '#111' }, { w: 60, c: '#ff6a6a' }, { w: 40, c: '#111' }] }, { name: 'P3', segs: [{ w: 100, c: '#111' }, { w: 80, c: '#6affb8' }] }, { name: 'CPU', segs: [{ w: 80, c: '#7c6aff' }, { w: 20, c: '#111', label: 'IDLE' }, { w: 60, c: '#ff6a6a' }, { w: 40, c: '#111', label: 'IDLE' }, { w: 80, c: '#6affb8' }] }], logColor: '#ff6a6a', log: 'CPU is idle 24% of the time. No ordering, no fairness, no efficiency.' },
  { title: 'One Process Hogs CPU — Starvation', bars: [{ name: 'P1 (BT=50)', segs: [{ w: 280, c: '#7c6aff' }] }, { name: 'P2', segs: [{ w: 280, c: '#1a1a1a', label: 'WAITING…' }] }, { name: 'P3', segs: [{ w: 280, c: '#1a1a1a', label: 'WAITING…' }] }], logColor: '#ff6a6a', log: 'P2 and P3 starve. Without preemption, one long process blocks everything.' },
  { title: 'I/O Bound Process — CPU Wastage', bars: [{ name: 'P1 (I/O)', segs: [{ w: 30, c: '#7c6aff' }, { w: 60, c: '#ffb86a', label: 'I/O' }, { w: 30, c: '#7c6aff' }, { w: 60, c: '#ffb86a', label: 'I/O' }, { w: 30, c: '#7c6aff' }] }, { name: 'CPU', segs: [{ w: 30, c: '#7c6aff' }, { w: 60, c: '#111', label: 'IDLE' }, { w: 30, c: '#7c6aff' }, { w: 60, c: '#111', label: 'IDLE' }, { w: 30, c: '#7c6aff' }] }], logColor: '#ffb86a', log: 'CPU idle 60% of the time. A scheduler would fill those gaps with another process.' },
  { title: 'With Scheduling — Efficient', bars: [{ name: 'P1', segs: [{ w: 40, c: '#7c6aff' }, { w: 40, c: '#1a1a2a' }, { w: 40, c: '#7c6aff' }, { w: 40, c: '#1a1a2a' }, { w: 40, c: '#7c6aff' }] }, { name: 'P2', segs: [{ w: 40, c: '#1a1a2a' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#1a1a2a' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#1a1a2a' }] }, { name: 'CPU', segs: [{ w: 40, c: '#7c6aff' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#7c6aff' }, { w: 40, c: '#ff6a6a' }, { w: 40, c: '#7c6aff' }] }], logColor: '#6affb8', log: 'CPU utilization ~100%. Processes interleave. This is what scheduling achieves.' }
];

function showScenario(idx, btn) {
  document.querySelectorAll('#scenario-tabs button').forEach(b => { b.className = 'btn btn-ghost text-xs'; });
  btn.className = 'btn btn-primary text-xs';
  const sc = scenarios[idx]; const el = document.getElementById('scenario-viz');
  el.innerHTML = `<div style="margin-bottom:10px;font-size:13px;font-weight:700;color:#ccc;">${sc.title}</div>` +
    sc.bars.map(bar => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><div style="width:90px;font-size:10px;font-family:JetBrains Mono;color:var(--muted);text-align:right;flex-shrink:0;">${bar.name}</div><div style="display:flex;gap:1px;height:30px;">${bar.segs.map(seg => `<div style="width:${seg.w}px;background:${seg.c};border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;color:${seg.c === '#111' || seg.c === '#1a1a1a' || seg.c === '#1a1a2a' ? '#444' : 'rgba(255,255,255,0.7)'};font-family:JetBrains Mono;font-weight:700;">${seg.label || ''}</div>`).join('')}</div></div>`).join('') +
    `<div class="highlight-box ${idx === 3 ? 'green' : idx === 0 ? 'red' : ''} text-sm mt-4" style="border-left-color:${sc.logColor}">${sc.log}</div>`;
}
showScenario(0, document.querySelector('#scenario-tabs button'));


// ══════════════════════════════════════════════════
// 11. GOALS INTERACTIVE
// ══════════════════════════════════════════════════
const goalData = {
  util: { color: 'var(--accent3)', title: '↑ CPU Utilization', text: 'Keep the CPU working as much as possible. An idle CPU is wasted hardware. Modern systems target 40–90% CPU utilization. Best achieved by overlapping CPU and I/O work — exactly what scheduling enables.', algo: 'All algorithms improve utilization over no scheduling. Round Robin and SRTF are especially effective.' },
  tput: { color: 'var(--accent4)', title: '↑ Throughput', text: 'Complete as many processes as possible per unit of time. Throughput = processes / total time. More relevant for batch systems than interactive ones.', algo: 'SJF maximises throughput by finishing short jobs quickly. Round Robin can hurt throughput due to context switch overhead.' },
  tat: { color: 'var(--accent2)', title: '↓ Turnaround Time', text: 'Minimise total time from process arrival to completion. TAT = CT − AT. Includes waiting time and burst time. Critical for batch jobs where the user is waiting for total completion.', algo: 'SJF gives minimum average TAT for non-preemptive. SRTF for preemptive.' },
  wt: { color: 'var(--accent)', title: '↓ Waiting Time', text: 'Minimise time processes spend in the ready queue doing nothing. WT = TAT − BT. Directly measures scheduling inefficiency — a process waiting is a process being held back.', algo: 'SJF is provably optimal for average waiting time. FCFS often has the worst waiting time due to the convoy effect.' },
  rt: { color: 'var(--p5)', title: '↓ Response Time', text: 'Minimise time until a process first gets the CPU. RT = first CPU start − AT. Critical for interactive systems — a user clicking a button wants a response immediately, not after all other jobs finish.', algo: 'Round Robin gives the best response time for interactive workloads. FCFS gives the worst when a long job runs first.' }
};

function showGoal(key) {
  const g = goalData[key]; const box = document.getElementById('goal-detail-box');
  box.innerHTML = `<div class="text-xs font-bold tracking-widest mb-2" style="color:${g.color};">${g.title}</div><p class="text-sm text-gray-300 mb-3">${g.text}</p><div class="highlight-box text-xs" style="border-left-color:${g.color}"><strong>Algorithm connection:</strong> ${g.algo}</div>`;
}


// ══════════════════════════════════════════════════
// 12. ALGORITHM CHOOSER
// ══════════════════════════════════════════════════
const algoRec = {
  wt: { algo: 'SJF / SRTF', color: 'var(--p2)', why: "SJF is provably optimal for average waiting time among non-preemptive algorithms. SRTF is globally optimal. If you know burst times, use these.", caveat: "Watch for starvation — add aging if processes have mixed burst lengths." },
  rt: { algo: 'Round Robin', color: 'var(--p4)', why: "RR guarantees every process gets CPU time within one quantum cycle. Response time = at most (n−1)×Q for n processes. Best for interactive, user-facing systems.", caveat: "Choose Q carefully — too small and context switches dominate." },
  fair: { algo: 'Round Robin', color: 'var(--p4)', why: "RR is the only algorithm that completely eliminates starvation by design. No process waits more than one full cycle of the queue.", caveat: "Average waiting time is worse than SJF, but no process ever starves." },
  prio: { algo: 'Priority Scheduling', color: 'var(--p3)', why: "Priority scheduling directly encodes importance. Critical tasks run first. Use preemptive variant if urgency is time-sensitive.", caveat: "Must implement aging to prevent low-priority processes from starving." },
  simple: { algo: 'FCFS', color: 'var(--p1)', why: "FCFS requires no scheduling logic — just a queue. Zero overhead, trivial to implement. Fine when all jobs have similar burst times.", caveat: "Suffers badly from the convoy effect when burst times vary significantly." }
};

function chooseAlgo(key) {
  const r = algoRec[key]; const box = document.getElementById('chooser-result');
  document.querySelectorAll('.chooser-btn').forEach(b => { b.style.borderColor = 'var(--border)'; b.style.background = 'var(--surface2)'; });
  if (event.target) {
    event.target.style.borderColor = r.color;
    event.target.style.background = r.color + '22';
  }
  box.innerHTML = `<div class="text-xs font-bold tracking-widest mb-2" style="color:${r.color};">RECOMMENDATION</div><div class="text-2xl font-extrabold mb-3" style="color:${r.color};">${r.algo}</div><p class="text-sm text-gray-300 mb-3">${r.why}</p><div class="highlight-box text-xs" style="border-left-color:${r.color};"><strong>Caveat:</strong> ${r.caveat}</div>`;
  box.style.borderTop = `2px solid ${r.color}`;
}


// ══════════════════════════════════════════════════
// 13. CONVOY EFFECT
// ══════════════════════════════════════════════════
function updateConvoy() {
  const p1bt = parseInt(document.getElementById('convoy-slider').value);
  const p2bt = 2, p3bt = 1;
  const total = p1bt + p2bt + p3bt;
  const el = document.getElementById('convoy-viz');
  const scale = w => (w / total) * 480;
  const procs = [{ name: 'P1', at: 0, bt: p1bt, color: '#7c6aff' }, { name: 'P2', at: 0, bt: p2bt, color: '#ff6a6a' }, { name: 'P3', at: 0, bt: p3bt, color: '#6affb8' }];
  const gantt = [{ name: 'P1', start: 0, end: p1bt }, { name: 'P2', start: p1bt, end: p1bt + p2bt }, { name: 'P3', start: p1bt + p2bt, end: total }];
  el.innerHTML = '';
  const wt_p2 = p1bt, wt_p3 = p1bt + p2bt; const awt = ((0 + wt_p2 + wt_p3) / 3).toFixed(1);
  const gRow = document.createElement('div'); gRow.style.cssText = 'display:flex;height:36px;border-radius:6px;overflow:hidden;gap:1px;margin-bottom:6px;';
  gantt.forEach(b => { const p = procs.find(p => p.name === b.name); gRow.innerHTML += `<div style="width:${scale(b.end - b.start)}px;background:${p.color}33;border:1px solid ${p.color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${p.color};font-family:JetBrains Mono;">${b.name}</div>`; });
  el.appendChild(gRow);
  procs.forEach((p, i) => {
    const wt = i === 0 ? 0 : i === 1 ? wt_p2 : wt_p3;
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:4px;';
    row.innerHTML = `<div style="width:24px;font-size:10px;color:${p.color};font-family:JetBrains Mono;font-weight:700;">${p.name}</div><div style="flex:1;height:10px;background:var(--surface2);border-radius:5px;overflow:hidden;"><div style="width:${wt > 0 ? (wt / total * 100) : 0}%;height:100%;background:${p.color};border-radius:5px;transition:width 0.3s;"></div></div><div style="width:80px;font-size:10px;font-family:JetBrains Mono;color:${wt > 0 ? p.color : 'var(--muted)'};">WT = ${wt}</div>`;
    el.appendChild(row);
  });
  const note = document.createElement('div'); note.className = 'highlight-box red text-xs mt-3';
  note.textContent = `Avg WT = ${awt}. P2 and P3 each waited ${wt_p2} and ${wt_p3} units just because P1 ran first. This is the Convoy Effect.`;
  el.appendChild(note);
}
updateConvoy();


// ══════════════════════════════════════════════════
// 14. STARVATION VIZ
// ══════════════════════════════════════════════════
function animateStarvation() {
  const el = document.getElementById('starvation-viz'); const log = document.getElementById('starvation-log');
  el.innerHTML = ''; if (log) log.style.opacity = '0';
  const arrivals = [
    { t: 0, label: 't=0', procs: [{ name: 'P_long', bt: 20, rem: 20, color: '#ff6a6a' }, { name: 'P2', bt: 3, rem: 3, color: '#7c6aff' }] },
    { t: 3, label: 't=3 (P3 arrives)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', waiting: true }, { name: 'P3', bt: 2, rem: 2, color: '#6affb8' }] },
    { t: 5, label: 't=5 (P4 arrives)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', waiting: true }, { name: 'P4', bt: 1, rem: 1, color: '#ffb86a' }] },
    { t: 6, label: 't=6 (P5 arrives)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', waiting: true }, { name: 'P5', bt: 4, rem: 4, color: '#ff6adf' }] },
    { t: 10, label: 't=10 — P_long still waiting (WT=10)', procs: [{ name: 'P_long', bt: 20, rem: 17, color: '#ff6a6a', starving: true }] },
  ];
  arrivals.forEach((ev, i) => {
    const row = document.createElement('div'); row.style.cssText = 'opacity:0;display:flex;align-items:center;gap:12px;';
    const timeEl = document.createElement('div'); timeEl.style.cssText = 'width:190px;font-size:10px;font-family:JetBrains Mono;color:var(--muted);flex-shrink:0;'; timeEl.textContent = ev.label;
    const procsEl = document.createElement('div'); procsEl.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
    ev.procs.forEach(p => {
      const pill = document.createElement('span'); pill.className = 'proc-pill';
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
animateStarvation();


// ══════════════════════════════════════════════════
// 15. RR QUEUE ROTATION
// ══════════════════════════════════════════════════
function animateRRRotation() {
  const el = document.getElementById('rr-rotation-viz'); const log = document.getElementById('rr-rotation-log');
  el.innerHTML = ''; if (log) log.style.opacity = '0';
  const states = [
    { queue: ['P1', 'P2', 'P3'], running: '—', label: 'Initial queue. P1 is next.' },
    { queue: ['P2', 'P3'], running: 'P1', label: 'P1 gets the CPU for quantum Q.' },
    { queue: ['P2', 'P3', 'P1'], running: 'P1→back', label: "P1's quantum expires. P1 goes to the back of the queue." },
    { queue: ['P3', 'P1'], running: 'P2', label: 'P2 now runs for Q units.' },
    { queue: ['P3', 'P1', 'P2'], running: 'P2→back', label: "P2's quantum expires. P2 goes to back." },
    { queue: ['P1', 'P2'], running: 'P3', label: 'P3 runs. Everyone gets fair turns.' },
  ];
  const container = document.createElement('div'); el.appendChild(container);
  let step = 0;
  function showStep() {
    if (step >= states.length) { if (log) anime({ targets: log, opacity: [0, 1], duration: 500, easing: 'easeInOutSine' }); return; }
    const s = states[step]; container.innerHTML = '';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:8px 0;';
    const qLabel = document.createElement('div'); qLabel.style.cssText = 'font-size:10px;color:var(--muted);font-family:JetBrains Mono;width:80px;flex-shrink:0;'; qLabel.textContent = 'Queue:';
    const qEl = document.createElement('div'); qEl.style.cssText = 'display:flex;gap:6px;';
    s.queue.forEach((p, i) => {
      const c = pColor(p); const pill = document.createElement('span'); pill.className = 'proc-pill';
      pill.style.cssText = `background:${c.bg};color:${c.text};border:1px solid ${c.border};${i === 0 ? 'box-shadow:0 0 8px ' + c.border + '88;' : ''}`;
      pill.textContent = p + (i === 0 ? ' ← next' : ''); qEl.appendChild(pill);
    });
    const cpuEl = document.createElement('div'); cpuEl.style.cssText = 'font-size:10px;color:var(--muted);font-family:JetBrains Mono;';
    cpuEl.innerHTML = `CPU: <strong style="color:${s.running !== '—' ? pColor(s.running.split('→')[0]).text : 'var(--muted)'};">${s.running}</strong>`;
    const logEl2 = document.createElement('div'); logEl2.style.cssText = 'font-size:11px;color:var(--text);flex:1;'; logEl2.textContent = s.label;
    row.appendChild(qLabel); row.appendChild(qEl); row.appendChild(cpuEl); row.appendChild(logEl2);
    container.appendChild(row);
    anime({ targets: row, opacity: [0, 1], translateX: [-10, 0], duration: 400, easing: 'easeOutCubic' });
    step++;
    if (step < states.length) setTimeout(showStep, 900);
    else { if (log) setTimeout(() => anime({ targets: log, opacity: [0, 1], duration: 500 }), 400); }
  }
  showStep();
}
animateRRRotation();


// ══════════════════════════════════════════════════
// 16. FCFS SIMULATOR
// ══════════════════════════════════════════════════
const fcfsData = [{ name: 'P1', at: 0, bt: 5 }, { name: 'P2', at: 1, bt: 3 }, { name: 'P3', at: 2, bt: 8 }, { name: 'P4', at: 4, bt: 2 }];
let fcfsState = { step: 0, done: false };

function initFCFS() {
  document.getElementById('fcfs-input-table').innerHTML = '';
  fcfsData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('fcfs-input-table').innerHTML += `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td></tr>`;
  });
}

function computeFCFS(data) {
  const sorted = [...data].sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  let t = 0; const gantt = [], res = [];
  for (const p of sorted) {
    if (t < p.at) { gantt.push({ name: 'IDLE', start: t, end: p.at }); t = p.at; }
    gantt.push({ name: p.name, start: t, end: t + p.bt });
    res.push({ ...p, ct: t + p.bt }); t += p.bt;
  }
  return { gantt, procs: res, total: t };
}

function fcfsReset() {
  fcfsState = { step: 0, done: false };
  document.getElementById('fcfs-gantt').innerHTML = ''; document.getElementById('fcfs-timeline').innerHTML = '';
  document.getElementById('fcfs-results').classList.add('hidden');
  document.getElementById('fcfs-log').textContent = 'Press Step to walk through one process at a time.';
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
    renderRQ('fcfs-rq', fcfsData.filter(p => p.at < t).map(p => { const g = gantt.find(g => g.name === p.name); return { ...p, rem: g && g.end > t ? p.bt : 0 }; }), t, 'fifo');
    setCPUNow('fcfs-cpu-now', cur.name === 'IDLE' ? null : cur.name);
    const proc = procs.find(p => p.name === cur.name);
    if (proc) document.getElementById('fcfs-log').innerHTML = `<strong style="color:${pColor(proc.name).text}">${proc.name}</strong> runs t=${cur.start}→${cur.end}. WT=${proc.ct - proc.at - proc.bt}`;
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
  }
}

let fcfsTimer;
function fcfsAuto() { clearInterval(fcfsTimer); fcfsReset(); fcfsTimer = setInterval(() => { fcfsStep(); if (fcfsState.done) clearInterval(fcfsTimer); }, 600); }
initFCFS();


// ══════════════════════════════════════════════════
// 17. SJF / SRTF SIMULATOR
// ══════════════════════════════════════════════════
const sjfData = [{ name: 'P1', at: 0, bt: 8 }, { name: 'P2', at: 1, bt: 4 }, { name: 'P3', at: 2, bt: 9 }, { name: 'P4', at: 3, bt: 5 }];

function initSJF() {
  document.getElementById('sjf-input-table').innerHTML = '';
  sjfData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('sjf-input-table').innerHTML += `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td></tr>`;
  });
}

function computeSJF(data, preemptive) {
  const procs = data.map(p => ({ ...p, rem: p.bt, ct: 0 }));
  let t = 0, done = 0; const gantt = []; let last = null; const events = [];
  while (done < procs.length) {
    const avail = procs.filter(p => p.at <= t && p.rem > 0);
    if (avail.length === 0) { if (last !== 'IDLE') gantt.push({ name: 'IDLE', start: t, end: t + 1 }); else gantt[gantt.length - 1].end++; t++; last = 'IDLE'; continue; }
    const pick = avail.reduce((a, b) => a.rem <= b.rem ? a : b);
    if (preemptive) {
      if (last !== pick.name) {
        if (last && last !== 'IDLE') events.push({ t, type: 'preempt', from: last, to: pick.name });
        gantt.push({ name: pick.name, start: t, end: t + 1 });
      } else gantt[gantt.length - 1].end++;
      pick.rem--; if (pick.rem === 0) { pick.ct = t + 1; done++; } t++; last = pick.name;
    } else {
      gantt.push({ name: pick.name, start: t, end: t + pick.rem }); t += pick.rem; pick.ct = t; pick.rem = 0; done++; last = pick.name;
    }
  }
  return { gantt, procs, total: t, events };
}

function sjfReset() {
  document.getElementById('sjf-gantt').innerHTML = ''; document.getElementById('sjf-timeline').innerHTML = '';
  document.getElementById('sjf-results').classList.add('hidden');
  document.getElementById('sjf-rq').innerHTML = '<div style="font-size:11px;color:var(--muted);font-family:JetBrains Mono;">Press Auto to begin</div>';
  setCPUNow('sjf-cpu-now', null);
  document.getElementById('sjf-log').innerHTML = 'Toggle SRTF and click Auto. Preemption events will be highlighted.';
}

function sjfAuto() {
  const preemptive = document.getElementById('srtf-toggle').checked;
  const { gantt, procs, total, events } = computeSJF(sjfData, preemptive);
  buildGantt(gantt, 'sjf-gantt', 'sjf-timeline', total);
  renderRQ('sjf-rq', procs.map(p => ({ ...p, rem: 0 })), total, 'sjf');
  setCPUNow('sjf-cpu-now', procs[procs.length - 1]?.name);
  document.getElementById('sjf-results').classList.remove('hidden');
  buildResultTable('sjf-result-table', procs);
  const avgs = calcAvgs(procs);
  document.getElementById('sjf-awt').textContent = avgs.awt;
  document.getElementById('sjf-atat').textContent = avgs.atat;
  let logMsg = `<strong>${preemptive ? 'SRTF' : 'SJF'}</strong> complete. `;
  if (preemptive && events.length > 0) {
    logMsg += `<strong style="color:var(--accent2);">⚡ ${events.length} preemption(s)</strong>: `;
    logMsg += events.map(e => `at t=${e.t} <strong style="color:${pColor(e.from).text}">${e.from}</strong> was preempted by <strong style="color:${pColor(e.to).text}">${e.to}</strong> (shorter remaining time)`).join('; ');
  } else if (preemptive) {
    logMsg += 'No preemptions — shorter job never arrived while another was running.';
  } else {
    logMsg += 'No preemption — once started, each process ran to completion.';
  }
  document.getElementById('sjf-log').innerHTML = logMsg;
  document.getElementById('sjf-rq').innerHTML = '<div style="font-size:11px;color:var(--accent3);font-family:JetBrains Mono;">All done ✓</div>';
}
initSJF();


// ══════════════════════════════════════════════════
// 18. PRIORITY SIMULATOR
// ══════════════════════════════════════════════════
const prioData = [{ name: 'P1', at: 0, bt: 10, prio: 3 }, { name: 'P2', at: 1, bt: 1, prio: 1 }, { name: 'P3', at: 2, bt: 2, prio: 4 }, { name: 'P4', at: 3, bt: 1, prio: 5 }, { name: 'P5', at: 4, bt: 5, prio: 2 }];

function initPrio() {
  document.getElementById('prio-input-table').innerHTML = '';
  prioData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('prio-input-table').innerHTML += `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td><td style="color:var(--accent3);font-weight:700;">${p.prio}</td></tr>`;
  });
}

function computePriority(data, preemptive) {
  const procs = data.map(p => ({ ...p, rem: p.bt, ct: 0 }));
  let t = 0, done = 0; const gantt = []; let last = null;
  while (done < procs.length) {
    const avail = procs.filter(p => p.at <= t && p.rem > 0);
    if (avail.length === 0) { if (last !== 'IDLE') gantt.push({ name: 'IDLE', start: t, end: t + 1 }); else gantt[gantt.length - 1].end++; t++; last = 'IDLE'; continue; }
    const pick = avail.reduce((a, b) => a.prio <= b.prio ? a : b);
    if (preemptive) {
      if (last !== pick.name) gantt.push({ name: pick.name, start: t, end: t + 1 }); else gantt[gantt.length - 1].end++;
      pick.rem--; if (pick.rem === 0) { pick.ct = t + 1; done++; } t++; last = pick.name;
    } else {
      gantt.push({ name: pick.name, start: t, end: t + pick.rem }); t += pick.rem; pick.ct = t; pick.rem = 0; done++; last = pick.name;
    }
  }
  return { gantt, procs, total: t };
}

function prioReset() {
  document.getElementById('prio-gantt').innerHTML = ''; document.getElementById('prio-timeline').innerHTML = '';
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
  const tb = document.getElementById('prio-result-table'); tb.innerHTML = '';
  procs.forEach(p => {
    const c = pColor(p.name); const tat = p.ct - p.at, wt = tat - p.bt;
    tb.innerHTML += `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td><td style="color:var(--accent3)">${p.prio}</td><td>${p.ct}</td><td style="color:var(--accent2)">${tat}</td><td style="color:var(--accent)">${wt}</td></tr>`;
  });
  const avgs = calcAvgs(procs);
  document.getElementById('prio-awt').textContent = avgs.awt;
  document.getElementById('prio-atat').textContent = avgs.atat;
  document.getElementById('prio-log').innerHTML = `<strong>${preemptive ? 'Preemptive' : 'Non-Preemptive'} Priority</strong>: P2 (prio=1) runs first. Queue sorted by priority — lower number runs before higher.`;
  setCPUNow('prio-cpu-now', null);
  document.getElementById('prio-rq').innerHTML = '<div style="font-size:11px;color:var(--accent3);font-family:JetBrains Mono;">All done ✓</div>';
}
initPrio();


// ══════════════════════════════════════════════════
// 19. ROUND ROBIN SIMULATOR
// ══════════════════════════════════════════════════
const rrData = [{ name: 'P1', at: 0, bt: 5 }, { name: 'P2', at: 1, bt: 3 }, { name: 'P3', at: 2, bt: 8 }, { name: 'P4', at: 4, bt: 6 }];

function initRR() {
  document.getElementById('rr-input-table').innerHTML = '';
  rrData.forEach(p => {
    const c = pColor(p.name);
    document.getElementById('rr-input-table').innerHTML += `<tr><td><span class="proc-pill" style="background:${c.bg};color:${c.text};">${p.name}</span></td><td>${p.at}</td><td>${p.bt}</td></tr>`;
  });
}

function computeRR(data, q) {
  const procs = data.map(p => ({ ...p, rem: p.bt, ct: 0 }));
  let t = 0; const gantt = []; let cs = 0; const queue = []; let i = 0;
  const sorted = [...procs].sort((a, b) => a.at - b.at);
  while (i < sorted.length && sorted[i].at <= t) { queue.push(sorted[i]); i++; }
  let safety = 0;
  while (queue.length > 0 && safety++ < 2000) {
    const p = queue.shift(); const run = Math.min(q, p.rem);
    gantt.push({ name: p.name, start: t, end: t + run }); t += run; p.rem -= run;
    while (i < sorted.length && sorted[i].at <= t) { queue.push(sorted[i]); i++; }
    if (p.rem > 0) { queue.push(p); cs++; } else { p.ct = t; }
  }
  return { gantt, procs, total: t, cs };
}

function rrReset() {
  document.getElementById('rr-gantt').innerHTML = ''; document.getElementById('rr-timeline').innerHTML = '';
  document.getElementById('rr-results').classList.add('hidden');
  document.getElementById('rr-log').innerHTML = 'Try Q=1 vs Q=8. Watch context switches and avg wait trade against each other.';
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
  document.getElementById('rr-log').innerHTML = `Q=${q}: <strong>${cs}</strong> context switches. ${q <= 2 ? 'Small Q → many switches, better response time.' : q >= 7 ? 'Large Q → behaves like FCFS.' : 'Balanced.'}`;
}
initRR();


// ══════════════════════════════════════════════════
// 20. PROGRESS NAV (grouped, phase-colored)
// ══════════════════════════════════════════════════
const navSections = [
  // hero
  'hero',
  // group 01 — Foundations
  'what-cpu', 'what-process', 'cpu-exec', 'state-diagram',
  // group 02 — Scheduling
  'what-sched', 'why', 'metrics',
  // group 03 — Algorithms
  'fcfs', 'sjf', 'priority', 'rr', 'comparison',
  // Simulator
  'simulator',
];

// Phase bar phase membership per section
const sectionPhase = {
  hero: 'foundations',
  'what-cpu': 'foundations', 'what-process': 'foundations', 'cpu-exec': 'foundations', 'state-diagram': 'foundations',
  'what-sched': 'scheduling', why: 'scheduling', metrics: 'scheduling',
  fcfs: 'algorithms', sjf: 'algorithms', priority: 'algorithms', rr: 'algorithms', comparison: 'algorithms',
  simulator: 'simulator',
};

const navDots = document.querySelectorAll('.nav-dot');

function updateNav() {
  let activeIdx = 0;
  navSections.forEach((id, i) => {
    const el = document.getElementById(id); if (!el) return;
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.45) activeIdx = i;
  });
  navDots.forEach((dot, i) => dot.classList.toggle('active', i === activeIdx));

  // Phase bar update
  const activeSection = navSections[activeIdx];
  const phase = sectionPhase[activeSection] || 'foundations';
  const phaseOrder = ['foundations', 'scheduling', 'algorithms', 'simulator'];
  const phaseIdx = phaseOrder.indexOf(phase);
  phaseOrder.forEach((p, pi) => {
    const step = document.getElementById('pbar-' + p);
    const icon = document.getElementById('picon-' + p);
    if (!step) return;
    step.classList.remove('active', 'done');
    if (pi < phaseIdx) {
      step.classList.add('done');
      if (icon) icon.textContent = '✓';
    } else if (pi === phaseIdx) {
      step.classList.add('active');
      if (icon) icon.textContent = pi + 1;
    } else {
      if (icon) icon.textContent = pi + 1;
    }
  });
}

navDots.forEach((dot) => {
  dot.addEventListener('click', () => {
    const target = dot.dataset.target;
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
  });
});
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();


// ══════════════════════════════════════════════════
// 21. CPU CHIP ANIMATION (anime.js)
// ══════════════════════════════════════════════════
let cpuAnimTimeline = null;

function buildCPUAnimeViz() {
  const el = document.getElementById('cpu-anime-viz');
  if (!el) return;

  const pinsLeft  = [0,1,2,3].map(i => `<rect class="pin-left"  x="60"  y="${106 + i*22}" width="28" height="8" rx="4" fill="#7c6aff" opacity="0.3"/>`).join('');
  const pinsRight = [0,1,2,3].map(i => `<rect class="pin-right" x="232" y="${106 + i*22}" width="28" height="8" rx="4" fill="#7c6aff" opacity="0.3"/>`).join('');
  const pinsTop   = [0,1,2].map(i => `<rect class="pin-top" x="${118 + i*22}" y="60"  width="8" height="28" rx="4" fill="#7c6aff" opacity="0.3"/>`).join('');
  const pinsBot   = [0,1,2].map(i => `<rect class="pin-bot" x="${118 + i*22}" y="192" width="8" height="28" rx="4" fill="#7c6aff" opacity="0.3"/>`).join('');

  el.innerHTML = `
  <svg id="cpu-svg" width="320" height="280" style="overflow:visible;display:block;margin:0 auto;">
    <!-- Chip body -->
    <rect id="chip-body" x="88" y="78" width="144" height="124" rx="12"
          fill="#1a1a2e" stroke="#7c6aff" stroke-width="2"/>
    <!-- Pins -->
    ${pinsLeft}${pinsRight}${pinsTop}${pinsBot}
    <!-- Core glow -->
    <circle id="core-glow" cx="160" cy="140" r="20" fill="#7c6aff" opacity="0.06"/>
    <!-- Quadrant dividers -->
    <line x1="160" y1="82"  x2="160" y2="198" stroke="#2a2a42" stroke-width="1"/>
    <line x1="92"  y1="140" x2="228" y2="140" stroke="#2a2a42" stroke-width="1"/>
    <!-- Quadrant labels -->
    <text class="cpu-quad" id="quad-alu"   x="124" y="120" text-anchor="middle" font-size="11" font-weight="700" font-family="JetBrains Mono" fill="#7c6aff" style="cursor:pointer;">ALU</text>
    <text class="cpu-quad" id="quad-cu"    x="196" y="120" text-anchor="middle" font-size="11" font-weight="700" font-family="JetBrains Mono" fill="#7c6aff" style="cursor:pointer;">CU</text>
    <text class="cpu-quad" id="quad-regs"  x="124" y="168" text-anchor="middle" font-size="11" font-weight="700" font-family="JetBrains Mono" fill="#7c6aff" style="cursor:pointer;">REGS</text>
    <text class="cpu-quad" id="quad-cache" x="196" y="168" text-anchor="middle" font-size="11" font-weight="700" font-family="JetBrains Mono" fill="#7c6aff" style="cursor:pointer;">CACHE</text>
    <!-- Signal dot -->
    <circle id="signal-dot" cx="62" cy="140" r="5" fill="#6affb8" opacity="0"/>
    <!-- Process label -->
    <text id="proc-label" x="160" y="244" text-anchor="middle" font-size="12" font-weight="800"
          font-family="JetBrains Mono" fill="#6affb8" opacity="0">EXECUTING…</text>
  </svg>
  <div id="cpu-info" style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px;font-family:JetBrains Mono;min-height:32px;padding:0 16px;">
    Click a component to learn what it does
  </div>`;

  // Quadrant info
  const quadInfo = {
    'quad-alu':   '⟨ALU⟩ Arithmetic Logic Unit — performs all maths and logic: ADD, SUB, AND, OR, comparisons.',
    'quad-cu':    '⟨CU⟩ Control Unit — fetches instructions, decodes them, coordinates all other components.',
    'quad-regs':  '⟨REGS⟩ Registers — ultra-fast on-chip storage (PC, IR, R0-R15). This is live execution data.',
    'quad-cache': '⟨CACHE⟩ L1 Cache — fastest memory tier. Holds recently accessed instructions and data.',
  };
  ['quad-alu','quad-cu','quad-regs','quad-cache'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      const info = document.getElementById('cpu-info');
      if (info) info.textContent = quadInfo[id];
    });
  });

  startCPUAnim();
}

function startCPUAnim() {
  if (cpuAnimTimeline) { cpuAnimTimeline.pause(); cpuAnimTimeline = null; }
  if (typeof anime === 'undefined') return;

  cpuAnimTimeline = anime.timeline({ loop: true, easing: 'easeInOutSine' });
  cpuAnimTimeline
    .add({ targets: '.pin-left',  opacity: [0.3, 1, 0.3], duration: 600, delay: anime.stagger(80) })
    .add({ targets: '#signal-dot', cx: [62, 230], opacity: [0, 1, 0], duration: 900 }, '-=200')
    .add({ targets: '#core-glow', opacity: [0.06, 0.28, 0.06], r: [20, 28, 20], duration: 700 }, '-=300')
    .add({ targets: '#proc-label', opacity: [0, 1, 1, 0], duration: 1200 }, '-=200')
    .add({ targets: '.pin-right', opacity: [0.3, 1, 0.3], duration: 600, delay: anime.stagger(80) }, '-=400')
    .add({ targets: '.pin-top',   opacity: [0.3, 0.8, 0.3], duration: 400, delay: anime.stagger(60) }, '-=300')
    .add({ targets: '.pin-bot',   opacity: [0.3, 0.8, 0.3], duration: 400, delay: anime.stagger(60) }, '-=200')
    .add({ targets: '#chip-body', stroke: ['#7c6aff', '#6affb8', '#7c6aff'], duration: 800 }, '-=400')
    .add({ targets: '.cpu-quad',  fill: ['#7c6aff', '#9d8fff', '#7c6aff'], duration: 600, delay: anime.stagger(100) }, '-=600');
}

function restartCPUAnim() {
  if (cpuAnimTimeline) { cpuAnimTimeline.pause(); cpuAnimTimeline = null; }
  startCPUAnim();
}

buildCPUAnimeViz();
