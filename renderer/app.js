// --- Constants ---
const MODES = {
  work: { label: '工作', ms: 25 * 60 * 1000, color: '#E74C3C' },
  shortBreak: { label: '短休', ms: 5 * 60 * 1000, color: '#2ECC71' },
  longBreak: { label: '长休', ms: 15 * 60 * 1000, color: '#3498DB' },
};

const CIRCUMFERENCE = 2 * Math.PI * 88; // ~552.92

// --- State ---
let currentMode = 'work';
let status = 'idle';       // 'idle' | 'running' | 'paused'
let remainingMs = MODES.work.ms;
let targetEndTime = null;  // Date.now() when timer should fire
let animFrameId = null;
let sessionCount = 0;

// --- DOM refs ---
const ringProgress = document.getElementById('ringProgress');
const timerText = document.getElementById('timerText');
const sessionCountEl = document.getElementById('sessionCount');
const chkAlwaysOnTop = document.getElementById('chkAlwaysOnTop');
const timerContainer = document.querySelector('.timer-container');

// --- Audio ---
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound() {
  try {
    ensureAudio();
    const now = audioCtx.currentTime;
    // Simple 2-tone beep
    [0, 0.15].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.3, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });
  } catch (_) { /* audio unavailable */ }
}

// --- Persistence ---
function saveState() {
  localStorage.setItem('pomodoro_state', JSON.stringify({
    currentMode,
    status,
    remainingMs,
    sessionCount,
    alwaysOnTop: chkAlwaysOnTop.checked,
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem('pomodoro_state');
    if (!raw) return;
    const data = JSON.parse(raw);
    currentMode = data.currentMode || 'work';
    status = data.status || 'idle';
    remainingMs = data.remainingMs ?? MODES[currentMode].ms;
    sessionCount = data.sessionCount || 0;
    if (data.alwaysOnTop) {
      chkAlwaysOnTop.checked = true;
      window.electronAPI?.setAlwaysOnTop(true);
    }
    if (status === 'running') {
      // Recalculate from wall clock
      const elapsed = Date.now() - (data._savedAt || Date.now());
      remainingMs = Math.max(0, remainingMs - elapsed);
      if (remainingMs <= 0) {
        remainingMs = 0;
        status = 'idle';
        handleComplete();
      }
    }
  } catch (_) { /* ignore corrupted state */ }
}

function saveWithTimestamp() {
  const data = {
    currentMode,
    status,
    remainingMs,
    sessionCount,
    alwaysOnTop: chkAlwaysOnTop.checked,
    _savedAt: Date.now(),
  };
  localStorage.setItem('pomodoro_state', JSON.stringify(data));
}

// --- Display ---
function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateDisplay(ms) {
  timerText.textContent = formatTime(ms);
  const totalMs = MODES[currentMode].ms;
  const fraction = totalMs > 0 ? ms / totalMs : 1;
  updateRing(fraction);
}

function updateRing(fraction) {
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

// --- Mode ---
function setMode(mode) {
  if (status === 'running') return; // block mode switch while running
  currentMode = mode;
  remainingMs = MODES[mode].ms;
  status = 'idle';
  targetEndTime = null;
  updateDisplay(remainingMs);
  updateModeButtons();
  updateRingColor();
  saveState();
}

function updateModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });
}

function updateRingColor() {
  ringProgress.style.stroke = MODES[currentMode].color;
}

// --- Timer engine ---
function start() {
  if (status === 'running') return;

  // Unlock audio on first user interaction
  ensureAudio();

  if (status === 'paused') {
    targetEndTime = Date.now() + remainingMs;
  } else {
    remainingMs = MODES[currentMode].ms;
    targetEndTime = Date.now() + remainingMs;
  }
  status = 'running';
  saveState();
  tick();
}

function pause() {
  if (status !== 'running') return;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  remainingMs = Math.max(0, targetEndTime - Date.now());
  targetEndTime = null;
  status = 'paused';
  updateDisplay(remainingMs);
  saveState();
}

function reset() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  status = 'idle';
  remainingMs = MODES[currentMode].ms;
  targetEndTime = null;
  updateDisplay(remainingMs);
  saveState();
}

function tick() {
  if (status !== 'running') return;

  const now = Date.now();
  const msLeft = Math.max(0, targetEndTime - now);
  updateDisplay(msLeft);

  if (msLeft <= 0) {
    status = 'idle';
    remainingMs = 0;
    targetEndTime = null;
    updateDisplay(0);
    handleComplete();
    saveState();
    return;
  }

  animFrameId = requestAnimationFrame(tick);
}

function handleComplete() {
  sessionCount++;
  sessionCountEl.textContent = sessionCount;

  // Visual feedback
  timerContainer.classList.add('flashing');
  setTimeout(() => timerContainer.classList.remove('flashing'), 2000);

  // Sound
  playSound();

  // Native notification
  window.electronAPI?.notifyCompleted(currentMode);
}

// --- Event bindings ---
document.getElementById('btnStart').addEventListener('click', start);
document.getElementById('btnPause').addEventListener('click', pause);
document.getElementById('btnReset').addEventListener('click', reset);

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

chkAlwaysOnTop.addEventListener('change', () => {
  window.electronAPI?.setAlwaysOnTop(chkAlwaysOnTop.checked);
  saveState();
});

// Title bar
document.getElementById('btnMin').addEventListener('click', () => {
  window.electronAPI?.minimizeWindow();
});
document.getElementById('btnClose').addEventListener('click', () => {
  window.electronAPI?.closeWindow();
});

// Save state before unload
window.addEventListener('beforeunload', () => {
  if (status === 'running') {
    remainingMs = Math.max(0, targetEndTime - Date.now());
    saveWithTimestamp();
  } else {
    saveState();
  }
});

// --- Init ---
ringProgress.style.strokeDasharray = CIRCUMFERENCE;
ringProgress.style.strokeDashoffset = '0';
loadState();
sessionCountEl.textContent = sessionCount;
updateDisplay(remainingMs);
updateModeButtons();
updateRingColor();

// If timer was running, resume
if (status === 'running' && remainingMs > 0) {
  targetEndTime = Date.now() + remainingMs;
  tick();
} else if (status === 'running' && remainingMs <= 0) {
  status = 'idle';
  remainingMs = 0;
}
