const state = {
  isSleeping: false,
  currentSession: null,
  selectedQuality: 0,
  timerInterval: null
};

// ── API (auth-aware) ──
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers['Authorization'] = 'Bearer ' + auth.token;
  const res = await fetch('/api' + path, {
    headers, ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

// ── Init (called after successful auth) ──
async function init() {
  setupStarRating();
  updateThemeMetaColor();
  updateGreeting();
  await checkStatus();
  loadLastSleep();
  updateTodayStrip();
  await initStudy();
}

// ── Greeting (India Standard Time) ──
function istHour() {
  // Get current hour in Asia/Kolkata (IST, UTC+5:30)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const hh = parts.find(p => p.type === 'hour')?.value;
  return parseInt(hh, 10);
}

function updateGreeting() {
  const h = istHour();
  let greet;
  if (h >= 5 && h < 12) greet = 'Good morning';
  else if (h >= 12 && h < 17) greet = 'Good afternoon';
  else if (h >= 17 && h < 21) greet = 'Good evening';
  else greet = 'Good night';

  const el = document.getElementById('greeting-time');
  const nameEl = document.getElementById('greeting-name');
  if (el) el.textContent = greet;
  if (nameEl && auth.user) nameEl.textContent = auth.user.display_name || auth.user.name || '';
}

// Refresh greeting every minute so it updates if user leaves the app open
setInterval(() => { if (document.getElementById('view-home')?.classList.contains('active')) updateGreeting(); }, 60000);

// ── Sleep Status ──
async function checkStatus() {
  const data = await api('/status');
  if (!data) return;
  state.isSleeping = data.is_sleeping;
  state.currentSession = data.current_session;
  updateSleepUI();
  if (state.isSleeping) {
    startTimer();
    showSessionNotification('sleep-session', 'SleepLogs — sleeping', 'Tap Stop when you wake up');
  }
}

function updateSleepUI() {
  const btn = document.getElementById('sleep-btn');
  const icon = document.getElementById('hero-icon');
  const label = document.getElementById('hero-label');
  const statusText = document.getElementById('status-text');
  const dot = document.getElementById('sleep-dot');

  if (state.isSleeping) {
    btn.className = 'hero-btn state-sleeping';
    icon.innerHTML = '&#9788;';
    label.textContent = "I'm awake!";
    statusText.textContent = 'Sleeping...';
    dot?.classList.add('active-sleep');
  } else {
    btn.className = 'hero-btn state-awake';
    icon.innerHTML = '&#9790;';
    label.textContent = "I'm going to sleep";
    statusText.textContent = "You're awake";
    dot?.classList.remove('active-sleep');
    document.getElementById('status-timer').textContent = '';
    clearInterval(state.timerInterval);
  }
}

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
  const el = document.getElementById('status-timer');
  if (el) el.textContent = `${h}h ${pad(m)}m ${pad(s)}s`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ── Sleep Toggle ──
async function toggleSleep() {
  if (navigator.vibrate) navigator.vibrate(50);
  if (state.isSleeping) {
    state.selectedQuality = 0;
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.getElementById('quality-modal').style.display = 'flex';
  } else {
    const data = await api('/sleep', { method: 'POST' });
    if (!data || data.error) return;
    state.isSleeping = true;
    state.currentSession = { id: data.id, sleep_start: data.sleep_start };
    updateSleepUI();
    startTimer();
    showSessionNotification('sleep-session', 'SleepLogs — sleeping', 'Tap Stop when you wake up');
  }
}

async function submitWake(skip = false) {
  document.getElementById('quality-modal').style.display = 'none';
  const body = skip ? {} : { quality: state.selectedQuality || null };
  const data = await api('/wake', { method: 'POST', body });
  if (!data) return;
  state.isSleeping = false;
  state.currentSession = null;
  clearInterval(state.timerInterval);
  updateSleepUI();
  loadLastSleep();
  updateTodayStrip();
  closeSessionNotification('sleep-session');
  const statusText = document.getElementById('status-text');
  if (statusText) statusText.textContent = `Slept ${formatDuration(data.duration_minutes)}`;
}

// ── Star Rating ──
function setupStarRating() {
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      state.selectedQuality = val;
      document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('active', i < val));
    });
  });
}

// ── Last Sleep (home card) ──
async function loadLastSleep() {
  const data = await api('/records?days=30&limit=1');
  if (!data) return;
  // no separate today-card anymore; strip handles it
}

// ── Today Strip ──
async function updateTodayStrip() {
  const today = new Date().toISOString().slice(0, 10);

  // Sleep today
  api('/records?days=1&limit=10').then(d => {
    if (!d) return;
    const todayMin = d.records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const el = document.getElementById('strip-sleep-val');
    if (el) el.textContent = todayMin > 0 ? formatDuration(todayMin) : '—';
  });

  // Study today
  api('/study/records?days=1').then(d => {
    if (!d) return;
    const todayMin = d.records.reduce((s, r) => s + (r.duration_minutes || 0), 0);
    const el = document.getElementById('strip-study-val');
    if (el) el.textContent = todayMin > 0 ? formatDuration(todayMin) : '—';
  });

  // Exercise today
  api('/exercise/records?days=1').then(d => {
    if (!d) return;
    const el = document.getElementById('strip-exercise-val');
    if (el) el.textContent = d.records.length > 0 ? d.records.length + ' log' + (d.records.length > 1 ? 's' : '') : '—';
  });
}

// ── Unified Activity Log (sleep + study + exercise) ──
async function loadUnifiedLog() {
  const list = document.getElementById('unified-log');
  if (!list) return;

  const [sleepR, studyR, exerR] = await Promise.all([
    api('/records?days=90&limit=200'),
    api('/study/records?days=90'),
    api('/exercise/records?days=90')
  ]);

  const items = [];

  (sleepR?.records || []).forEach(r => {
    items.push({
      kind: 'sleep',
      time: r.sleep_start,
      dateKey: r.sleep_start.split(' ')[0],
      html: renderSleepItem(r)
    });
  });
  (studyR?.records || []).forEach(r => {
    items.push({
      kind: 'study',
      time: r.session_start,
      dateKey: r.session_start.split(' ')[0],
      html: renderStudyItem(r)
    });
  });
  (exerR?.records || []).forEach(r => {
    items.push({
      kind: 'exercise',
      time: r.logged_at,
      dateKey: r.logged_at.split(' ')[0],
      html: renderExerciseItem(r)
    });
  });

  if (items.length === 0) {
    list.innerHTML = '<p class="empty-msg">No activity yet.<br>Start tracking sleep, study, or workouts!</p>';
    return;
  }

  // Sort descending by time
  items.sort((a, b) => b.time.localeCompare(a.time));

  // Group by date
  const groups = {};
  items.forEach(it => {
    (groups[it.dateKey] = groups[it.dateKey] || []).push(it);
  });

  let html = '';
  for (const [date, dayItems] of Object.entries(groups)) {
    html += `<div class="history-date-group">
      <div class="history-date">${formatDate(date)}</div>
      ${dayItems.map(i => i.html).join('')}
    </div>`;
  }
  list.innerHTML = html;
}

function renderSleepItem(r) {
  const dur = formatDuration(r.duration_minutes);
  const cls = durationClass(r.duration_minutes);
  const stars = r.quality ? `<div class="history-stars">${'\u2605'.repeat(r.quality)}${'\u2606'.repeat(5 - r.quality)}</div>` : '';
  const endTime = r.sleep_end ? formatTime(r.sleep_end) : 'ongoing';
  return `<div class="activity-item kind-sleep">
    <span class="ai-icon">&#9790;</span>
    <div class="ai-info">
      <div class="ai-title">Sleep</div>
      <div class="ai-sub">${formatTime(r.sleep_start)} – ${endTime}</div>
      ${stars}
    </div>
    <div>
      <div class="ai-dur ${cls}">${dur}</div>
      <button class="history-delete" onclick="deleteRecord(${r.id})" style="display:block;margin-top:4px">&times;</button>
    </div>
  </div>`;
}

function renderStudyItem(r) {
  const dur = formatDuration(r.duration_minutes);
  const icon = subjectIcon(r.subject);
  return `<div class="activity-item kind-study">
    <span class="ai-icon">${icon}</span>
    <div class="ai-info">
      <div class="ai-title">${r.subject}</div>
      <div class="ai-sub">Study &bull; ${formatTime(r.session_start)}</div>
    </div>
    <div>
      <div class="ai-dur study-color">${dur}</div>
      <button class="history-delete" onclick="deleteStudyRecord(${r.id})" style="display:block;margin-top:4px">&times;</button>
    </div>
  </div>`;
}

function renderExerciseItem(r) {
  const dur = formatDuration(r.duration_minutes);
  const icon = exerciseIcon(r.exercise_type);
  return `<div class="activity-item kind-exercise">
    <span class="ai-icon">${icon}</span>
    <div class="ai-info">
      <div class="ai-title">${r.exercise_type}</div>
      <div class="ai-sub">Workout</div>
    </div>
    <div>
      <div class="ai-dur exer-color">${dur}</div>
      <button class="history-delete" onclick="deleteExerciseRecord(${r.id})" style="display:block;margin-top:4px">&times;</button>
    </div>
  </div>`;
}

async function deleteRecord(id) {
  if (!confirm('Delete this sleep record?')) return;
  await api('/records/' + id, { method: 'DELETE' });
  loadUnifiedLog();
  updateTodayStrip();
}

// ── Profile ──
async function loadProfile() {
  const data = await api('/auth/me');
  if (!data) return;

  document.getElementById('profile-avatar').src = data.picture || '';
  document.getElementById('profile-name').textContent = data.display_name || data.name || '';
  document.getElementById('profile-email').textContent = data.email || '';

  // Stat tiles (lifetime totals)
  const [sleepS, studyS, exerS] = await Promise.all([
    api('/stats?days=365'),
    api('/study/stats?days=365'),
    api('/exercise/stats?days=365')
  ]);

  const grid = document.getElementById('profile-stats');
  if (grid) grid.innerHTML = `
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--sleep-hi)">${sleepS?.total_records || 0}</div><div class="stat-tile-label">Sleeps</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--study-hi)">${studyS?.total_sessions || 0}</div><div class="stat-tile-label">Study sessions</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--exer-hi)">${exerS?.total_workouts || 0}</div><div class="stat-tile-label">Workouts</div></div>
  `;

  const scheduleMap = { regular:'Regular 9–5', shift:'Shift Work', flexible:'Flexible', student:'Student' };
  const exerMap = { daily:'Every day', few_times_week:'4–5x/week', weekly:'2–3x/week', rarely:'Rarely', never:'Never' };

  const info = document.getElementById('profile-info');
  if (info) info.innerHTML = [
    data.age ? `<div class="profile-row"><span class="profile-row-label">Age</span><span class="profile-row-val">${data.age}</span></div>` : '',
    data.gender ? `<div class="profile-row"><span class="profile-row-label">Gender</span><span class="profile-row-val">${capitalize(data.gender)}</span></div>` : '',
    `<div class="profile-row"><span class="profile-row-label">Sleep goal</span><span class="profile-row-val">${data.sleep_goal_hours || 8}h / night</span></div>`,
    data.occupation ? `<div class="profile-row"><span class="profile-row-label">Occupation</span><span class="profile-row-val">${data.occupation}</span></div>` : '',
    data.work_schedule ? `<div class="profile-row"><span class="profile-row-label">Schedule</span><span class="profile-row-val">${scheduleMap[data.work_schedule] || data.work_schedule}</span></div>` : '',
    data.exercise_frequency ? `<div class="profile-row"><span class="profile-row-label">Exercise</span><span class="profile-row-val">${exerMap[data.exercise_frequency] || data.exercise_frequency}</span></div>` : ''
  ].join('');
}

// ═══════════════════════════════════════════════
//  Session Notifications (lock-screen controls)
// ═══════════════════════════════════════════════

// Ask for notification permission (safe on iOS / older browsers)
async function ensureNotifPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch { return false; }
}

async function showSessionNotification(tag, title, body) {
  if (!('serviceWorker' in navigator)) return;
  const ok = await ensureNotifPermission();
  if (!ok) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      tag,
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      requireInteraction: true,
      silent: true,
      renotify: false,
      actions: [{ action: 'stop', title: 'Stop' }],
      data: { tag, startedAt: Date.now() }
    });
  } catch (e) { console.warn('notif show failed', e); }
}

async function closeSessionNotification(tag) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const notifs = await reg.getNotifications({ tag });
    notifs.forEach(n => n.close());
  } catch {}
}

// Handle "Stop" action from the lock screen
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, tag } = event.data || {};
    if (type !== 'stop-session') return;
    window.focus();
    if (tag === 'sleep-session' && state.isSleeping) {
      // Open quality-rating modal (same as pressing "I'm awake!")
      switchView('home');
      toggleSleep();
    } else if (tag === 'study-session' && typeof studyState !== 'undefined' && studyState.isStudying) {
      toggleStudy();
    }
  });
}

// ── Theme management (light / dark / system) ──
function setTheme(theme) {
  if (!['light', 'dark', 'system'].includes(theme)) theme = 'dark';
  localStorage.setItem('sleeplogs_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeMetaColor();
  updateThemePickerUI();
  // Re-render charts if on charts view (so grid colors refresh)
  if (document.getElementById('view-charts')?.classList.contains('active')) {
    if (typeof loadCharts === 'function') loadCharts(chartPeriod);
  }
}

function updateThemeMetaColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute('content', bg);
}

function updateThemePickerUI() {
  const current = localStorage.getItem('sleeplogs_theme') || 'dark';
  document.querySelectorAll('.theme-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.themeVal === current);
  });
}

// React to OS theme changes when set to "system"
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('sleeplogs_theme') || 'dark') === 'system') {
      updateThemeMetaColor();
      if (document.getElementById('view-charts')?.classList.contains('active')) {
        if (typeof loadCharts === 'function') loadCharts(chartPeriod);
      }
    }
  });
}

// Compatibility shim for old cached HTML referencing switchLog()
function switchLog() { loadUnifiedLog(); }

// ── View Switching ──
function switchView(name) {
  document.querySelectorAll('#app-container .view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));

  if (name === 'home') updateGreeting();
  if (name === 'log') loadUnifiedLog();
  if (name === 'charts') loadCharts(chartPeriod);
  if (name === 'profile') { loadProfile(); updateThemePickerUI(); }
}

// ── Formatters ──
function formatDuration(min) {
  if (!min && min !== 0) return '—';
  if (min < 1) return '< 1m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function durationClass(min) {
  if (!min) return 'poor';
  const h = min / 60;
  return h >= 7 ? 'good' : h >= 6 ? 'okay' : 'poor';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(isoStr) {
  return new Date(isoStr + 'Z').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : ''; }

function shakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}
