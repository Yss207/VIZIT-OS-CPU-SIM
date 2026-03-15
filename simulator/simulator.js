/*
  CPU Scheduling Simulator
  simulator.js

  Sections:
    1. Color helpers
    2. State — processes, playback vars
    3. Process management  (add, remove, clear, randomize)
    4. Process list renderer
    5. Algorithm selector handler
    6. Compute router  (dispatches to the right algorithm)
    7. Playback engine  (Step, Auto, speed control)
    8. Gantt renderer
    9. Results table renderer
   10. Metrics finaliser
   11. Algorithm implementations
       — FCFS
       — SJF (non-preemptive)
       — SRTF (preemptive SJF)
       — Round Robin
       — Priority non-preemptive
       — Priority preemptive
       — mergeBlocks utility
*/


/* ─────────────────────────────────────────
   1. COLOR HELPERS
   Seven colors rotate through processes in
   order. The same index used for the badge
   (pc-N) and the Gantt block (gb-N) so a
   process always looks the same everywhere.
───────────────────────────────────────── */
const PC_COUNT = 7;
function pcClass(idx) { return 'pc-' + (idx % PC_COUNT); }
function gbClass(idx) { return 'gb-' + (idx % PC_COUNT); }

// Maps process id → color index, set at creation time
const procColorMap = {};


/* ─────────────────────────────────────────
   2. STATE
───────────────────────────────────────── */
let processes    = [];
let processCount = 0;

// Playback state for step/auto mode
let simSchedule  = [];   // full computed schedule array
let simMetrics   = [];   // per-process metric objects
let simStepIdx   = 0;    // index of the next block to reveal
let simAutoTimer = null; // setInterval handle, null when stopped

// ms between auto steps — index matches slider value 1..5
const SPEED_MAP = [700, 440, 260, 130, 55];
let speedIdx    = 2;     // default: 1× speed (260ms)

window.onload = () => randomizeProcesses();


/* ─────────────────────────────────────────
   3. PROCESS MANAGEMENT
───────────────────────────────────────── */
function addProcess(at = 0, bt = 1, pr = 1) {
  if (processes.length >= 8) { alert('Maximum 8 processes allowed.'); return; }
  processCount++;
  procColorMap[processCount] = (processCount - 1) % PC_COUNT;
  processes.push({ id: processCount, at, bt, pr });
  renderProcessList();
}

function removeProcess(id) {
  processes = processes.filter(p => p.id !== id);
  renderProcessList();
}

function clearProcesses() {
  processes = []; processCount = 0;
  stopAuto();
  document.getElementById('results-container').style.display = 'none';
  document.getElementById('results-container').style.opacity = '0';
  renderProcessList();
}

// Generates 3–5 processes with randomised AT, BT, and guaranteed-unique priorities
function randomizeProcesses() {
  clearProcesses();
  const n     = Math.floor(Math.random() * 3) + 3;
  let prios   = [1,2,3,4,5];
  prios.sort(() => Math.random() - 0.5);
  for (let i = 0; i < n; i++)
    addProcess(
      Math.floor(Math.random() * 10),
      Math.floor(Math.random() * 8) + 1,
      prios.pop()
    );
}

function updateProcessValue(id, field, value) {
  const p = processes.find(p => p.id === id);
  if (p) p[field] = parseInt(value) || 0;
}


/* ─────────────────────────────────────────
   4. PROCESS LIST RENDERER
   Re-renders the entire list on every change.
   The PR field border turns green when a Priority
   algorithm is selected, to draw attention to it.
───────────────────────────────────────── */
function renderProcessList() {
  const container  = document.getElementById('process-list');
  const isPriority = ['PRINP','PRIP'].includes(document.getElementById('algo-select').value);

  if (processes.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="e-icon">📋</span>No processes yet. Add one or randomize.</div>`;
    return;
  }

  container.innerHTML = processes.map((p, i) => {
    const ci    = procColorMap[p.id] ?? 0;
    const prCls = isPriority ? 'pr-active' : '';
    return `
      <div class="proc-card" style="animation-delay:${i * 40}ms;">
        <div class="proc-badge ${pcClass(ci)}">P${p.id}</div>
        <div class="proc-fields">
          <div class="proc-field"><label><span>AT</span>
            <input type="number" min="0" value="${p.at}" onchange="updateProcessValue(${p.id},'at',this.value)"/>
          </label></div>
          <div class="proc-field"><label><span>BT</span>
            <input type="number" min="1" value="${p.bt}" onchange="updateProcessValue(${p.id},'bt',this.value)"/>
          </label></div>
          <div class="proc-field ${prCls}"><label title="Lower = Higher Priority"><span>PR</span>
            <input type="number" min="1" value="${p.pr}" onchange="updateProcessValue(${p.id},'pr',this.value)"/>
          </label></div>
        </div>
        <button class="proc-remove" onclick="removeProcess(${p.id})" title="Remove">✕</button>
      </div>`;
  }).join('');
}


/* ─────────────────────────────────────────
   5. ALGORITHM SELECTOR HANDLER
   Shows/hides the time quantum input and
   updates the description text. Also re-renders
   the process list so the PR highlight updates.
───────────────────────────────────────── */
const ALGO_DESCS = {
  FCFS:  'Processes execute in the order they arrive. Simple, but can cause high waiting time when a long process is at the front.',
  SJF:   'Picks the process with the smallest burst time. Optimal for minimising average waiting time, but can cause starvation.',
  SRTF:  'Preemptive SJF. A new process with shorter remaining time immediately preempts the current one.',
  RR:    'Each process gets a fixed time quantum. If it does not finish, it goes to the back of the queue. Fairness over efficiency.',
  PRINP: 'Non-Preemptive Priority. Runs the highest-priority process (lowest PR number). Once started, runs to completion.',
  PRIP:  'Preemptive Priority. A newly arrived higher-priority process immediately preempts the running one.',
};

function onAlgoChange() {
  const algo = document.getElementById('algo-select').value;
  document.getElementById('tq-container').style.display = algo === 'RR' ? 'block' : 'none';
  document.getElementById('algo-desc').textContent = ALGO_DESCS[algo] || '';
  renderProcessList();
}


/* ─────────────────────────────────────────
   6. COMPUTE ROUTER
   Deep-clones the process array before passing
   it to each algorithm so the originals are
   never mutated between runs.
───────────────────────────────────────── */
function computeAlgo(algo, queue, tq) {
  const q = JSON.parse(JSON.stringify(queue));
  if (algo === 'FCFS')  return calcFCFS(q);
  if (algo === 'SJF')   return calcSJF(q);
  if (algo === 'SRTF')  return calcSRTF(q);
  if (algo === 'RR')    return calcRR(q, tq);
  if (algo === 'PRINP') return calcPrioNP(q);
  if (algo === 'PRIP')  return calcPrioP(q);
}


/* ─────────────────────────────────────────
   7. PLAYBACK ENGINE

   initSim  — computes the full schedule, shows
              the results shell with all Gantt
              blocks dimmed and all table rows
              greyed out, ready for step-through.

   simStep  — reveals one block at a time.
              On the final block it finalises the
              metrics and resets the index so the
              next press restarts cleanly.

   simToggleAuto — starts or pauses the auto timer.
              Mirrors Step internally.

   revealBlock — the single place where a block
              transitions from "upcoming" to visible,
              applying the entrance animation and
              active glow, then updating the clock
              and table state.
───────────────────────────────────────── */
function updateSpeed(val) {
  speedIdx = parseInt(val) - 1;
  const labels = ['0.5×','0.75×','1×','2×','4×'];
  document.getElementById('speed-label').textContent = labels[speedIdx];
  // if already playing, restart the interval at the new speed
  if (simAutoTimer) { stopAuto(); startAutoTimer(); }
}

function setClock(t)  { document.getElementById('sim-clock').textContent  = t; }
function setStatus(s) { document.getElementById('sim-status').textContent = s; }
function showPlaybackBar() { document.getElementById('playback-bar').style.display = 'block'; }

function initSim() {
  if (!processes.length) return false;
  stopAuto();

  const algo = document.getElementById('algo-select').value;
  const tq   = parseInt(document.getElementById('tq-input').value) || 2;
  const res  = computeAlgo(algo, processes, tq);
  if (!res) return false;

  simSchedule = res.schedule;
  simMetrics  = res.metrics;
  simStepIdx  = 0;

  const rc = document.getElementById('results-container');
  rc.style.display = 'block';
  rc.style.opacity = '1';
  rc.classList.remove('pop-up');

  renderGanttAll(simSchedule, true);       // all blocks dimmed (upcoming)
  renderStatsTable(simMetrics, -1, null);  // all rows greyed out
  ['avg-wt','avg-tat','throughput','cpu-util'].forEach(id => document.getElementById(id).textContent = '—');
  ['calc-wt-formula','calc-tat-formula','calc-throughput','calc-cpu'].forEach(id => document.getElementById(id).textContent = '—');

  setClock(0); setStatus('Ready');
  showPlaybackBar();
  rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return true;
}

function simStep() {
  if (simStepIdx === 0) {
    if (!initSim()) return;
    document.getElementById('btn-step').textContent = 'Step →';
  }
  if (simStepIdx >= simSchedule.length) {
    simStepIdx = 0;
    initSim();
    return;
  }
  revealBlock(simStepIdx);
  simStepIdx++;
  if (simStepIdx >= simSchedule.length) {
    setStatus('Complete ✓');
    finaliseMetrics(simMetrics);
    simStepIdx = 0;
    document.getElementById('btn-step').textContent = 'Restart →';
  }
}

function simToggleAuto() {
  if (simAutoTimer) {
    stopAuto();
    document.getElementById('btn-auto').textContent = 'Auto ▶';
    setStatus('Paused');
  } else {
    if (simStepIdx === 0) { if (!initSim()) return; }
    document.getElementById('btn-auto').textContent = 'Pause ⏸';
    setStatus('Playing…');
    startAutoTimer();
  }
}

function startAutoTimer() {
  simAutoTimer = setInterval(() => {
    if (simStepIdx >= simSchedule.length) {
      stopAuto();
      document.getElementById('btn-auto').textContent = 'Auto ▶';
      setStatus('Complete ✓');
      finaliseMetrics(simMetrics);
      simStepIdx = 0;
      return;
    }
    revealBlock(simStepIdx);
    simStepIdx++;
  }, SPEED_MAP[speedIdx]);
}

function stopAuto() {
  clearInterval(simAutoTimer);
  simAutoTimer = null;
}

function revealBlock(i) {
  const block  = simSchedule[i];
  const blocks = document.querySelectorAll('#gantt-chart .gantt-block');

  // remove the active glow from the previous block
  blocks.forEach(b => b.classList.remove('active-block'));

  if (blocks[i]) {
    // remove the classes then force a reflow so the animation restarts from scratch
    blocks[i].classList.remove('upcoming', 'gb-enter');
    void blocks[i].offsetWidth;
    blocks[i].classList.add('gb-enter', 'active-block');
  }

  setClock(block.end);
  renderStatsTable(simMetrics, block.end, block.id);
}


/* ─────────────────────────────────────────
   8. GANTT RENDERER
   When upcoming=true, all blocks are dimmed.
   When upcoming=false, each block gets a staggered
   gb-enter animation so the chart builds left-to-right.
───────────────────────────────────────── */
function renderGanttAll(schedule, upcoming = false) {
  const container = document.getElementById('gantt-chart');
  const total     = schedule[schedule.length - 1].end;
  let seenStarts  = new Set();

  container.innerHTML = schedule.map((block, i) => {
    const pct       = (block.duration / total * 100).toFixed(3);
    const cls       = block.type === 'idle' ? 'gb-idle' : gbClass(block.ci ?? 0);
    const label     = block.type === 'idle' ? 'IDLE' : `P${block.id}`;
    const animClass = upcoming ? ' upcoming' : ' gb-enter';
    const delay     = upcoming ? '' : `animation-delay:${i * 52}ms;`;
    const showStart = i === 0 || !seenStarts.has(block.start);
    seenStarts.add(block.start);

    return `<div class="gantt-block ${cls}${animClass}" style="width:${pct}%;flex-shrink:0;${delay}" data-idx="${i}">
      ${label}
      ${showStart ? `<span class="g-tick g-tick-start">${block.start}</span>` : ''}
      <span class="g-tick g-tick-end">${block.end}</span>
    </div>`;
  }).join('');
}


/* ─────────────────────────────────────────
   9. RESULTS TABLE RENDERER
   currentTime controls which rows are shown
   as done vs pending. In step mode this is the
   end time of the most recently revealed block;
   Infinity means show everything.
───────────────────────────────────────── */
function renderStatsTable(metrics, currentTime, activeId) {
  const algo  = document.getElementById('algo-select').value;
  const hasPR = ['PRINP','PRIP'].includes(algo);
  const sorted = metrics.slice().sort((a,b) => a.id - b.id);

  const rows = sorted.map((m, rowIdx) => {
    const done   = currentTime === Infinity || m.ct <= currentTime;
    const active = m.id === activeId && !done;
    const cls    = done ? 'row-done' : (active ? 'row-active' : 'row-pending');
    const prCol  = hasPR ? `<td class="p-4" style="color:var(--accent3);">${m.pr ?? '-'}</td>` : '';
    const dim    = 'color:#2a2a44';
    const ctD    = done ? `<td class="p-4" style="color:var(--muted);">${m.ct}</td>`                        : `<td class="p-4" style="${dim};">—</td>`;
    const tatD   = done ? `<td class="p-4" style="color:var(--accent3);font-weight:700;">${m.tat}</td>`     : `<td class="p-4" style="${dim};">—</td>`;
    const wtD    = done ? `<td class="p-4" style="color:var(--accent);font-weight:700;">${m.wt}</td>`       : `<td class="p-4" style="${dim};">—</td>`;

    return `<tr class="${cls}" style="animation-delay:${rowIdx * 48}ms;">
      <td class="p-4">
        <div style="width:32px;height:32px;border-radius:7px;display:flex;align-items:center;
             justify-content:center;font-weight:800;font-size:12px;
             font-family:'JetBrains Mono',monospace;margin:0 auto;"
             class="${pcClass(m.ci??0)}">P${m.id}</div>
      </td>
      <td class="p-4" style="color:var(--muted);">${m.at}</td>
      <td class="p-4" style="color:var(--muted);">${m.bt}</td>
      ${prCol}${ctD}${tatD}${wtD}
    </tr>`;
  }).join('');

  const prHead = hasPR ? '<th class="p-4">PR</th>' : '';
  document.getElementById('stats-table').innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Process</th><th>AT</th><th>BT</th>${prHead}<th>CT</th>
        <th style="color:var(--accent3);">TAT</th>
        <th style="color:var(--accent);">WT</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}


/* ─────────────────────────────────────────
   10. METRICS FINALISER
   Called once the last block is revealed.
   Fills the calculations panel and triggers
   the staggered metric-pop animation.
───────────────────────────────────────── */
function finaliseMetrics(metrics) {
  renderStatsTable(metrics, Infinity, null);

  const n        = metrics.length;
  const maxCT    = Math.max(...metrics.map(m => m.ct));
  const totalBT  = metrics.reduce((s,m) => s + m.bt,  0);
  const totalWT  = metrics.reduce((s,m) => s + m.wt,  0);
  const totalTAT = metrics.reduce((s,m) => s + m.tat, 0);
  const wtVals   = metrics.map(m => m.wt);
  const tatVals  = metrics.map(m => m.tat);

  document.getElementById('calc-wt-formula').textContent  = `(${wtVals.join(' + ')}) / ${n}`;
  document.getElementById('calc-tat-formula').textContent = `(${tatVals.join(' + ')}) / ${n}`;
  document.getElementById('calc-throughput').textContent  = `${n} / ${maxCT}`;
  document.getElementById('calc-cpu').textContent         = `(${totalBT} / ${maxCT}) × 100`;

  document.getElementById('avg-wt').textContent     = (totalWT  / n).toFixed(2);
  document.getElementById('avg-tat').textContent    = (totalTAT / n).toFixed(2);
  document.getElementById('throughput').textContent = (n / maxCT).toFixed(3) + ' p/ms';
  document.getElementById('cpu-util').textContent   = ((totalBT / maxCT) * 100).toFixed(2) + '%';

  // remove the active glow on the last Gantt block
  document.querySelectorAll('#gantt-chart .active-block').forEach(b => b.classList.remove('active-block'));

  // staggered bounce-in for each metric value
  ['avg-wt','avg-tat','throughput','cpu-util'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('metric-pop');
    void el.offsetWidth; // force reflow so the animation restarts
    el.style.animationDelay = (i * 85) + 'ms';
    el.classList.add('metric-pop');
  });
}


/* ─────────────────────────────────────────
   11. ALGORITHM IMPLEMENTATIONS

   Each returns { schedule, metrics }.

   schedule  — array of blocks: { type, id, ci, start, end, duration }
               type is 'process' or 'idle'
   metrics   — array of per-process results: { id, ci, at, bt, ct, tat, wt }

   All preemptive algorithms work in 1-unit
   time steps and use mergeBlocks() at the end
   to collapse adjacent same-process blocks.
───────────────────────────────────────── */

// FCFS: sort by arrival, run to completion in order
function calcFCFS(queue) {
  queue.sort((a,b) => a.at === b.at ? a.id - b.id : a.at - b.at);
  let t = 0, schedule = [], metrics = [];
  queue.forEach(p => {
    if (t < p.at) { schedule.push({ type:'idle', start:t, end:p.at, duration:p.at-t }); t = p.at; }
    schedule.push({ type:'process', id:p.id, ci:procColorMap[p.id]??0, start:t, end:t+p.bt, duration:p.bt });
    t += p.bt;
    metrics.push({ id:p.id, ci:procColorMap[p.id]??0, at:p.at, bt:p.bt, ct:t, tat:t-p.at, wt:(t-p.at)-p.bt });
  });
  return { schedule, metrics };
}

// SJF: at each dispatch point, pick the arrived process with the smallest BT
function calcSJF(queue) {
  let t = 0, done = 0, schedule = [], metrics = [];
  let procs = queue.map(p => ({...p, isDone:false}));
  while (done < procs.length) {
    let avail = procs.filter(p => p.at <= t && !p.isDone);
    if (!avail.length) {
      let next = Math.min(...procs.filter(p=>!p.isDone).map(p=>p.at));
      schedule.push({ type:'idle', start:t, end:next, duration:next-t }); t = next; continue;
    }
    avail.sort((a,b) => a.bt === b.bt ? a.at-b.at : a.bt-b.bt);
    let p = avail[0];
    schedule.push({ type:'process', id:p.id, ci:procColorMap[p.id]??0, start:t, end:t+p.bt, duration:p.bt });
    t += p.bt; p.isDone = true; done++;
    metrics.push({ id:p.id, ci:procColorMap[p.id]??0, at:p.at, bt:p.bt, ct:t, tat:t-p.at, wt:(t-p.at)-p.bt });
  }
  return { schedule, metrics };
}

// SRTF: tick-by-tick. Preempts the current process if a newly arrived
// process has a shorter remaining burst time.
function calcSRTF(queue) {
  let t = 0, done = 0, schedule = [], metrics = [];
  let procs = queue.map(p => ({...p, rt:p.bt, isDone:false}));
  let prev = null, bs = 0;
  while (done < procs.length) {
    let avail = procs.filter(p => p.at <= t && !p.isDone);
    if (!avail.length) {
      if (prev) { schedule.push({ type:'process', id:prev.id, ci:procColorMap[prev.id]??0, start:bs, end:t, duration:t-bs }); prev = null; }
      let next = Math.min(...procs.filter(p=>!p.isDone).map(p=>p.at));
      schedule.push({ type:'idle', start:t, end:next, duration:next-t }); t = next; bs = t; continue;
    }
    avail.sort((a,b) => a.rt === b.rt ? a.at-b.at : a.rt-b.rt);
    let curr = avail[0];
    if (prev !== curr) {
      if (prev) schedule.push({ type:'process', id:prev.id, ci:procColorMap[prev.id]??0, start:bs, end:t, duration:t-bs });
      bs = t; prev = curr;
    }
    curr.rt--; t++;
    if (curr.rt === 0) {
      curr.isDone = true; done++;
      schedule.push({ type:'process', id:curr.id, ci:procColorMap[curr.id]??0, start:bs, end:t, duration:t-bs });
      metrics.push({ id:curr.id, ci:procColorMap[curr.id]??0, at:curr.at, bt:curr.bt, ct:t, tat:t-curr.at, wt:(t-curr.at)-curr.bt });
      prev = null; bs = t;
    }
  }
  return { schedule: mergeBlocks(schedule), metrics };
}

// Round Robin: circular queue, each process gets at most `tq` units per turn.
// New arrivals that come in during a quantum are added to the back of the queue.
function calcRR(queue, tq) {
  let t = 0, done = 0, schedule = [], metrics = [];
  let procs = queue.map(p => ({...p, rt:p.bt, isDone:false, inQ:false}));
  procs.sort((a,b) => a.at - b.at);
  let readyQ = [];
  procs.filter(p => p.at <= t).forEach(p => { readyQ.push(p); p.inQ = true; });

  while (done < procs.length) {
    if (!readyQ.length) {
      // CPU is idle — jump forward to the next arrival
      let next = procs.find(p => !p.isDone && !p.inQ);
      if (next) {
        if (t < next.at) { schedule.push({ type:'idle', start:t, end:next.at, duration:next.at-t }); t = next.at; }
        procs.filter(p => p.at <= t && !p.inQ && !p.isDone).forEach(p => { readyQ.push(p); p.inQ = true; });
      }
      continue;
    }
    let p = readyQ.shift(), run = Math.min(p.rt, tq), start = t;
    t += run; p.rt -= run;
    schedule.push({ type:'process', id:p.id, ci:procColorMap[p.id]??0, start, end:t, duration:run });
    // admit any processes that arrived during this quantum
    procs.filter(np => np.at > start && np.at <= t && !np.inQ && !np.isDone).forEach(np => { readyQ.push(np); np.inQ = true; });
    if (p.rt > 0) { readyQ.push(p); }
    else { p.isDone = true; done++; metrics.push({ id:p.id, ci:procColorMap[p.id]??0, at:p.at, bt:p.bt, ct:t, tat:t-p.at, wt:(t-p.at)-p.bt }); }
  }
  return { schedule: mergeBlocks(schedule), metrics };
}

// Priority non-preemptive: at each dispatch, pick lowest PR number.
// Once running, the process goes to completion.
function calcPrioNP(queue) {
  let t = 0, done = 0, schedule = [], metrics = [];
  let procs = queue.map(p => ({...p, isDone:false}));
  while (done < procs.length) {
    let avail = procs.filter(p => p.at <= t && !p.isDone);
    if (!avail.length) {
      let next = Math.min(...procs.filter(p=>!p.isDone).map(p=>p.at));
      schedule.push({ type:'idle', start:t, end:next, duration:next-t }); t = next; continue;
    }
    avail.sort((a,b) => a.pr === b.pr ? a.at-b.at : a.pr-b.pr);
    let p = avail[0];
    schedule.push({ type:'process', id:p.id, ci:procColorMap[p.id]??0, start:t, end:t+p.bt, duration:p.bt });
    t += p.bt; p.isDone = true; done++;
    metrics.push({ id:p.id, ci:procColorMap[p.id]??0, at:p.at, bt:p.bt, pr:p.pr, ct:t, tat:t-p.at, wt:(t-p.at)-p.bt });
  }
  return { schedule, metrics };
}

// Priority preemptive: tick-by-tick. A new arrival with a strictly lower
// PR number immediately kicks out the running process.
function calcPrioP(queue) {
  let t = 0, done = 0, schedule = [], metrics = [];
  let procs = queue.map(p => ({...p, rt:p.bt, isDone:false}));
  let prev = null, bs = 0;
  while (done < procs.length) {
    let avail = procs.filter(p => p.at <= t && !p.isDone);
    if (!avail.length) {
      if (prev) { schedule.push({ type:'process', id:prev.id, ci:procColorMap[prev.id]??0, start:bs, end:t, duration:t-bs }); prev = null; }
      let next = Math.min(...procs.filter(p=>!p.isDone).map(p=>p.at));
      schedule.push({ type:'idle', start:t, end:next, duration:next-t }); t = next; bs = t; continue;
    }
    avail.sort((a,b) => a.pr === b.pr ? a.at-b.at : a.pr-b.pr);
    let curr = avail[0];
    if (prev !== curr) {
      if (prev) schedule.push({ type:'process', id:prev.id, ci:procColorMap[prev.id]??0, start:bs, end:t, duration:t-bs });
      bs = t; prev = curr;
    }
    curr.rt--; t++;
    if (curr.rt === 0) {
      curr.isDone = true; done++;
      schedule.push({ type:'process', id:curr.id, ci:procColorMap[curr.id]??0, start:bs, end:t, duration:t-bs });
      metrics.push({ id:curr.id, ci:procColorMap[curr.id]??0, at:curr.at, bt:curr.bt, pr:curr.pr, ct:t, tat:t-curr.at, wt:(t-curr.at)-curr.bt });
      prev = null; bs = t;
    }
  }
  return { schedule: mergeBlocks(schedule), metrics };
}

// Collapses adjacent blocks of the same process into one.
// Needed after preemptive algorithms to avoid hundreds of 1-unit blocks.
function mergeBlocks(schedule) {
  let merged = [];
  for (let s of schedule) {
    const last = merged[merged.length-1];
    if (last && last.id === s.id && last.type === s.type) {
      last.end = s.end; last.duration += s.duration;
    } else {
      merged.push({...s});
    }
  }
  return merged;
}
