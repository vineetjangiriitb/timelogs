const state = {
  activeSession: null,
  timerInterval: null,
  tasks: []
};

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

async function init() {
  updateThemeMetaColor();
  updateGreeting();
  await loadTasks();
  await checkStatus();
  setInterval(() => { if (document.getElementById('view-home')?.classList.contains('active')) updateGreeting(); }, 60000);

  // Set up task modal grids
  document.querySelectorAll('#task-color-grid .color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#task-color-grid .color-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });
  document.querySelectorAll('#task-icon-grid .icon-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#task-icon-grid .icon-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });
}

function istHour() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).formatToParts(new Date());
  return parseInt(parts.find(p => p.type === 'hour')?.value || 0, 10);
}

function updateGreeting() {
  const h = istHour();
  let greet = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 21 ? 'Good evening' : 'Good night';
  const el = document.getElementById('greeting-time');
  const nameEl = document.getElementById('greeting-name');
  if (el) el.textContent = greet;
  if (nameEl && auth.user) nameEl.textContent = auth.user.display_name || auth.user.name || '';
}

async function loadTasks() {
  const data = await api('/tasks');
  if (!data) return;
  state.tasks = data.tasks;
  renderTasks();
}

function renderTasks() {
  const container = document.getElementById('tasks-container');
  if (state.tasks.length === 0) {
    container.innerHTML = '<p class="empty-msg">No tasks yet. Create one to get started!</p>';
    return;
  }

  container.innerHTML = state.tasks.map(t => `
    <div class="task-btn-container" style="position: relative; display: flex; align-items: center;">
      <button class="task-btn \${state.activeSession?.task_id === t.id ? 'active' : ''}" 
              style="\${state.activeSession?.task_id === t.id ? 'background:'+t.color+'; color:#fff' : 'border-left: 4px solid '+t.color}" 
              onclick="handleTaskClick(\${t.id})"
              oncontextmenu="handleTaskLongPress(event, \${t.id})"
              ontouchstart="taskTouchStart(event, \${t.id})"
              ontouchend="taskTouchEnd(event)">
        <span class="task-icon">\${t.icon}</span>
        <span class="task-name">\${t.name}</span>
      </button>
      <button id="delete-task-\${t.id}" class="task-delete-btn" onclick="deleteTask(\${t.id})">Delete</button>
    </div>
  `).join('');
}

let touchTimer;
function taskTouchStart(e, id) {
  touchTimer = setTimeout(() => {
    showTaskDelete(id);
  }, 600);
}

function taskTouchEnd(e) {
  clearTimeout(touchTimer);
}

function handleTaskLongPress(e, id) {
  e.preventDefault();
  showTaskDelete(id);
}

function showTaskDelete(id) {
  document.querySelectorAll('.task-delete-btn').forEach(btn => btn.style.display = 'none');
  const btn = document.getElementById('delete-task-' + id);
  if (btn) btn.style.display = 'block';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.task-delete-btn') && !e.target.closest('.task-btn')) {
    document.querySelectorAll('.task-delete-btn').forEach(btn => btn.style.display = 'none');
  }
});

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  await api('/tasks/' + id, { method: 'DELETE' });
  await loadTasks();
}

async function handleTaskClick(id) {
  if (state.activeSession) {
    if (state.activeSession.task_id === id) {
      stopActiveTask();
    } else {
      alert("A task is already running. Please complete it first.");
    }
  } else {
    startTask(id);
  }
}

async function startTask(id) {
  const data = await api('/tasks/' + id + '/start', { method: 'POST' });
  if (!data || data.error) {
    if (data?.error) alert(data.error);
    return;
  }
  await checkStatus();
}

async function saveTask() {
  const name = document.getElementById('task-name').value.trim();
  if (!name) { shakeInput('task-name'); return; }
  
  const color = document.querySelector('#task-color-grid .color-opt.active')?.dataset.color;
  const icon = document.querySelector('#task-icon-grid .icon-opt.active')?.dataset.icon;

  const data = await api('/tasks', { method: 'POST', body: { name, color, icon } });
  if (data && !data.error) {
    document.getElementById('task-modal').style.display = 'none';
    document.getElementById('task-name').value = '';
    await loadTasks();
  }
}

async function checkStatus() {
  const data = await api('/status');
  if (!data) return;
  
  state.activeSession = data.current_session;
  renderTasks();
  
  const banner = document.getElementById('active-task-card');
  if (state.activeSession) {
    banner.style.display = 'flex';
    document.getElementById('active-task-status-text').textContent = 'Working on: ' + state.activeSession.task_name;
    document.getElementById('active-task-dot').style.background = state.activeSession.color;
    startTimer();
  } else {
    banner.style.display = 'none';
    clearInterval(state.timerInterval);
  }
}

function startTimer() {
  clearInterval(state.timerInterval);
  updateTimerDisplay();
  state.timerInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  if (!state.activeSession) return;
  const start = new Date(state.activeSession.start_time + 'Z').getTime();
  const elapsed = Date.now() - start;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  const el = document.getElementById('active-task-timer');
  if (el) el.textContent = \`\${h > 0 ? h+'h ' : ''}\${pad(m)}m \${pad(s)}s\`;
}

async function stopActiveTask() {
  const data = await api('/tasks/stop', { method: 'POST' });
  if (data && !data.error) {
    state.activeSession = null;
    await checkStatus();
    if (document.getElementById('view-log')?.classList.contains('active')) loadUnifiedLog();
  }
}

async function loadUnifiedLog() {
  const list = document.getElementById('unified-log');
  if (!list) return;

  const data = await api('/records?days=90');
  if (!data || !data.records || data.records.length === 0) {
    list.innerHTML = '<p class="empty-msg">No logs yet.</p>';
    return;
  }

  const items = data.records;
  items.sort((a, b) => b.start_time.localeCompare(a.start_time));

  const groups = {};
  items.forEach(it => {
    const key = it.start_time.split(' ')[0];
    (groups[key] = groups[key] || []).push(it);
  });

  let html = '';
  for (const [date, dayItems] of Object.entries(groups)) {
    html += \`<div class="history-date-group">
      <div class="history-date">\${formatDate(date)}</div>
      \${dayItems.map(r => \`
        <div class="activity-item kind-study" style="border-left-color: \${r.color}">
          <span class="ai-icon">\${r.icon}</span>
          <div class="ai-info">
            <div class="ai-title">\${r.task_name}</div>
            <div class="ai-sub">\${formatTime(r.start_time)}</div>
          </div>
          <div>
            <div class="ai-dur study-color" style="color:\${r.color}">\${formatDuration(r.duration_minutes)}</div>
            <button class="history-delete" onclick="deleteRecord(\${r.id})" style="display:block;margin-top:4px">&times;</button>
          </div>
        </div>\`).join('')}
    </div>\`;
  }
  list.innerHTML = html;
}

async function deleteRecord(id) {
  if (!confirm('Delete this log?')) return;
  await api('/records/' + id, { method: 'DELETE' });
  loadUnifiedLog();
}

async function loadProfile() {
  const data = await api('/auth/me');
  if (!data) return;

  document.getElementById('profile-avatar').src = data.picture || '';
  document.getElementById('profile-name').textContent = data.display_name || data.name || '';
  document.getElementById('profile-email').textContent = data.email || '';

  const stat = await api('/stats');
  
  const grid = document.getElementById('profile-stats');
  if (grid) grid.innerHTML = \`
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--study-hi)">\${stat?.total_records || 0}</div><div class="stat-tile-label">Total Logs</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--exer-hi)">\${stat?.total_minutes ? formatDuration(stat.total_minutes) : '0m'}</div><div class="stat-tile-label">Total Time</div></div>
  \`;

  let userAge = '';
  if (data.dob) {
    const dob = new Date(data.dob);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms); 
    userAge = Math.abs(age_dt.getUTCFullYear() - 1970);
  }

  const scheduleMap = { regular:'Regular 9–5', shift:'Shift Work', flexible:'Flexible', student:'Student' };
  const exerMap = { daily:'Every day', few_times_week:'4–5x/week', weekly:'2–3x/week', rarely:'Rarely', never:'Never' };

  const info = document.getElementById('profile-info');
  if (info) info.innerHTML = [
    data.dob ? \`<div class="profile-row"><span class="profile-row-label">Age</span><span class="profile-row-val">\${userAge}</span></div>\` : '',
    data.gender ? \`<div class="profile-row"><span class="profile-row-label">Gender</span><span class="profile-row-val">\${capitalize(data.gender)}</span></div>\` : '',
    \`<div class="profile-row"><span class="profile-row-label">Sleep goal</span><span class="profile-row-val">\${data.sleep_goal_hours || 8}h / night</span></div>\`,
    data.occupation ? \`<div class="profile-row"><span class="profile-row-label">Occupation</span><span class="profile-row-val">\${data.occupation}</span></div>\` : '',
    data.work_schedule ? \`<div class="profile-row"><span class="profile-row-label">Schedule</span><span class="profile-row-val">\${scheduleMap[data.work_schedule] || data.work_schedule}</span></div>\` : '',
    data.exercise_frequency ? \`<div class="profile-row"><span class="profile-row-label">Exercise</span><span class="profile-row-val">\${exerMap[data.exercise_frequency] || data.exercise_frequency}</span></div>\` : ''
  ].join('');
}

function setTheme(theme) {
  if (!['light', 'dark', 'system'].includes(theme)) theme = 'dark';
  localStorage.setItem('sleeplogs_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeMetaColor();
  updateThemePickerUI();
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

function switchView(name) {
  document.querySelectorAll('#app-container .view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));

  if (name === 'home') updateGreeting();
  if (name === 'log') loadUnifiedLog();
  if (name === 'charts' && typeof loadCharts === 'function') loadCharts();
  if (name === 'profile') { loadProfile(); updateThemePickerUI(); }
}

function formatDuration(min) {
  if (!min && min !== 0) return '—';
  if (min < 1) return '< 1m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? \`\${h}h \${m}m\` : \`\${m}m\`;
}

function pad(n) { return String(n).padStart(2, '0'); }

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
