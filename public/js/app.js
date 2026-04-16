const state = {
  isSleeping: false,
  currentSession: null,
  selectedQuality: 0,
  timerInterval: null
};

// --- Init ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupStarRating();
  await checkStatus();
  loadLastSleep();
}

// --- API helpers ---
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  return res.json();
}

// --- Status ---
async function checkStatus() {
  const data = await api('/status');
  state.isSleeping = data.is_sleeping;
  state.currentSession = data.current_session;
  updateUI();

  if (state.isSleeping) {
    startTimer();
  }
}

function updateUI() {
  const btn = document.getElementById('sleep-btn');
  const icon = document.getElementById('hero-icon');
  const label = document.getElementById('hero-label');
  const statusText = document.getElementById('status-text');
  const statusTimer = document.getElementById('status-timer');

  if (state.isSleeping) {
    btn.className = 'hero-btn state-sleeping';
    icon.innerHTML = '&#9788;'; // sun
    label.textContent = "I'm awake!";
    statusText.textContent = 'Sleeping...';
    statusText.className = 'status-text sleeping';
  } else {
    btn.className = 'hero-btn state-awake';
    icon.innerHTML = '&#9790;'; // moon
    label.textContent = "I'm going to sleep";
    statusText.textContent = "You're awake";
    statusText.className = 'status-text awake';
    statusTimer.textContent = '';
    clearInterval(state.timerInterval);
  }
}

// --- Timer ---
function startTimer() {
  if (!state.currentSession) return;
  updateTimerDisplay();
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  if (!state.currentSession) return;
  const start = new Date(state.currentSession.sleep_start + 'Z').getTime();
  const elapsed = Date.now() - start;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  document.getElementById('status-timer').textContent =
    `${h}h ${pad(m)}m ${pad(s)}s`;
}

function pad(n) { return n.toString().padStart(2, '0'); }

// --- Sleep Toggle ---
async function toggleSleep() {
  if (navigator.vibrate) navigator.vibrate(50);

  if (state.isSleeping) {
    // Show quality modal
    state.selectedQuality = 0;
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.getElementById('quality-modal').style.display = 'flex';
  } else {
    // Start sleeping
    const data = await api('/sleep', { method: 'POST' });
    state.isSleeping = true;
    state.currentSession = { id: data.id, sleep_start: data.sleep_start };
    updateUI();
    startTimer();
  }
}

async function submitWake(skip = false) {
  document.getElementById('quality-modal').style.display = 'none';
  const body = skip ? {} : { quality: state.selectedQuality || null };
  const data = await api('/wake', { method: 'POST', body });

  state.isSleeping = false;
  state.currentSession = null;
  updateUI();
  loadLastSleep();

  // Show the duration briefly in status
  const statusText = document.getElementById('status-text');
  statusText.textContent = `Slept ${formatDuration(data.duration_minutes)}`;
}

// --- Star Rating ---
function setupStarRating() {
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      state.selectedQuality = val;
      document.querySelectorAll('.star').forEach((s, i) => {
        s.classList.toggle('active', i < val);
      });
    });
  });
}

// --- Last Sleep ---
async function loadLastSleep() {
  const data = await api('/records?days=30&limit=1');
  const card = document.getElementById('today-card');
  if (data.records.length > 0) {
    const r = data.records[0];
    card.style.display = 'block';
    document.getElementById('today-duration').textContent = formatDuration(r.duration_minutes);
    document.getElementById('today-quality').textContent = r.quality
      ? '\u2605'.repeat(r.quality) + '\u2606'.repeat(5 - r.quality)
      : '';
    // Color code
    const el = document.getElementById('today-duration');
    el.className = 'today-duration ' + durationClass(r.duration_minutes);
  } else {
    card.style.display = 'none';
  }
}

// --- History ---
async function loadHistory() {
  const data = await api('/records?days=90&limit=100');
  const list = document.getElementById('history-list');

  if (data.records.length === 0) {
    list.innerHTML = '<p class="empty-msg">No sleep records yet. Start tracking!</p>';
    return;
  }

  // Group by date
  const groups = {};
  data.records.forEach(r => {
    const date = r.sleep_start.split(' ')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(r);
  });

  let html = '';
  for (const [date, records] of Object.entries(groups)) {
    const dateLabel = formatDate(date);
    html += `<div class="history-date-group">
      <div class="history-date">${dateLabel}</div>`;

    records.forEach(r => {
      const startTime = formatTime(r.sleep_start);
      const endTime = r.sleep_end ? formatTime(r.sleep_end) : 'ongoing';
      const dur = formatDuration(r.duration_minutes);
      const cls = durationClass(r.duration_minutes);
      const stars = r.quality
        ? `<div class="history-stars">${'\u2605'.repeat(r.quality)}${'\u2606'.repeat(5 - r.quality)}</div>`
        : '';

      html += `<div class="history-item">
        <div class="history-item-info">
          <div class="history-time">${startTime} - ${endTime}</div>
          <div class="history-duration ${cls}">${dur}</div>
          ${stars}
        </div>
        <button class="history-delete" onclick="deleteRecord(${r.id})" title="Delete">&times;</button>
      </div>`;
    });

    html += '</div>';
  }

  list.innerHTML = html;
}

async function deleteRecord(id) {
  if (!confirm('Delete this sleep record?')) return;
  await api('/records/' + id, { method: 'DELETE' });
  loadHistory();
}

// --- View Switching ---
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });

  if (name === 'history') loadHistory();
  if (name === 'charts') loadCharts(7);
}

// --- Formatting ---
function formatDuration(min) {
  if (!min) return '0m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function durationClass(min) {
  if (!min) return '';
  const hours = min / 60;
  if (hours >= 7) return 'good';
  if (hours >= 6) return 'okay';
  return 'poor';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (today - d) / 86400000;

  if (diff < 1) return 'Today';
  if (diff < 2) return 'Yesterday';

  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

function formatTime(isoStr) {
  const d = new Date(isoStr + 'Z');
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
