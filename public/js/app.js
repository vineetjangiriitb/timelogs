const state = {
  tasks: [],
  records: [],
  expandedGroups: new Set(),
  logTaskId: null
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
  setInterval(() => { if (document.getElementById('view-home')?.classList.contains('active')) updateGreeting(); }, 60000);

  document.querySelectorAll('#task-color-grid .color-opt[data-color]').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('#task-color-grid .color-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });
  document.querySelectorAll('#task-icon-grid .icon-opt[data-icon]').forEach(opt => {
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
      <button class="task-btn"
              style="border-left-color: ${t.color}; --task-color: ${t.color}; --task-color-alpha: ${t.color}80;"
              onclick="openLogModal(${t.id})"
              oncontextmenu="handleTaskLongPress(event, ${t.id})"
              ontouchstart="taskTouchStart(event, ${t.id})"
              ontouchend="taskTouchEnd(event)">
        <span class="task-icon">${t.icon}</span>
        <span class="task-name">${t.name}</span>
      </button>
      <button id="delete-task-${t.id}" class="task-delete-btn" onclick="deleteTask(${t.id})">Delete</button>
    </div>
  `).join('');
}

let touchTimer;
function taskTouchStart(e, id) {
  touchTimer = setTimeout(() => showTaskDelete(id), 600);
}
function taskTouchEnd() { clearTimeout(touchTimer); }
function handleTaskLongPress(e, id) { e.preventDefault(); showTaskDelete(id); }
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

// ═══════════ LOG ACTIVITY MODAL ═══════════
function openLogModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  state.logTaskId = taskId;
  document.getElementById('log-modal-icon').textContent = task.icon;
  document.getElementById('log-modal-title').textContent = 'Log ' + task.name;

  const now = new Date();
  const defaultEnd = toLocalInputValue(now);
  const defaultStart = toLocalInputValue(new Date(now.getTime() - 30 * 60000));
  document.getElementById('log-start').value = defaultStart;
  document.getElementById('log-end').value = defaultEnd;
  document.getElementById('log-notes').value = '';
  document.getElementById('log-modal').style.display = 'flex';
}

function toLocalInputValue(d) {
  const pad2 = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

async function saveLog() {
  const start = document.getElementById('log-start').value;
  const end = document.getElementById('log-end').value;
  const notes = document.getElementById('log-notes').value.trim();
  if (!start || !end) { alert('Please provide start and end time'); return; }
  if (new Date(end) <= new Date(start)) { alert('End time must be after start time'); return; }

  const data = await api('/tasks/' + state.logTaskId + '/log', {
    method: 'POST',
    body: { start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString(), notes }
  });
  if (data?.error) { alert(data.error); return; }
  document.getElementById('log-modal').style.display = 'none';
  if (document.getElementById('view-log')?.classList.contains('active')) loadUnifiedLog();
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

// ═══════════ UNIFIED LOG (grouped by day → task) ═══════════
async function loadUnifiedLog() {
  const list = document.getElementById('unified-log');
  if (!list) return;

  const data = await api('/records?days=90');
  if (!data || !data.records || data.records.length === 0) {
    list.innerHTML = '<p class="empty-msg">No logs yet. Tap a task on Home to log activity.</p>';
    return;
  }

  state.records = data.records;
  renderUnifiedLog();
}

function renderUnifiedLog() {
  const list = document.getElementById('unified-log');
  const items = [...state.records].sort((a, b) => b.start_time.localeCompare(a.start_time));

  const byDate = {};
  items.forEach(it => {
    const date = it.start_time.split(' ')[0];
    (byDate[date] = byDate[date] || []).push(it);
  });

  let html = '';
  for (const [date, dayItems] of Object.entries(byDate)) {
    const byTask = {};
    dayItems.forEach(it => {
      const key = it.task_id;
      if (!byTask[key]) byTask[key] = { task_id: it.task_id, task_name: it.task_name, color: it.color, icon: it.icon, total: 0, sessions: [] };
      byTask[key].total += (it.duration_minutes || 0);
      byTask[key].sessions.push(it);
    });

    const taskGroups = Object.values(byTask).sort((a, b) => b.total - a.total);

    html += `<div class="history-date-group">
      <div class="history-date">${formatDate(date)}</div>
      ${taskGroups.map(g => {
        const key = `${date}::${g.task_id}`;
        const expanded = state.expandedGroups.has(key);
        return `
          <div class="activity-item task-group" style="border-left-color:${g.color}; flex-direction:column; align-items:stretch; padding:0;">
            <button class="task-group-header" onclick="toggleGroup('${key}')"
                    style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:transparent; color:var(--text); text-align:left; width:100%;">
              <span class="ai-icon">${g.icon}</span>
              <div class="ai-info">
                <div class="ai-title">${escapeHtml(g.task_name)}</div>
                <div class="ai-sub">${g.sessions.length} session${g.sessions.length>1?'s':''}</div>
              </div>
              <div class="ai-dur" style="color:${g.color}">${formatDuration(g.total)}</div>
              <span class="chev" style="margin-left:6px; color:var(--text-3); transition:transform .2s; ${expanded?'transform:rotate(90deg);':''}">▸</span>
            </button>
            ${expanded ? `
              <div class="session-list" style="border-top:1px solid var(--border); padding:6px 16px 12px;">
                ${g.sessions.map(s => `
                  <div class="session-row" style="display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid var(--border);">
                    <div style="flex:1; min-width:0;">
                      <div style="font-size:.88rem; font-weight:600;">${formatTime(s.start_time)} → ${formatTime(s.end_time)}</div>
                      <div style="font-size:.78rem; color:var(--text-2); margin-top:2px;">${formatDuration(s.duration_minutes)}</div>
                      ${s.notes ? `<div style="font-size:.82rem; color:var(--text-2); margin-top:6px; white-space:pre-wrap;">${escapeHtml(s.notes)}</div>` : ''}
                    </div>
                    <button class="history-delete" onclick="deleteRecord(${s.id})">&times;</button>
                  </div>
                `).join('')}
              </div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
  }
  list.innerHTML = html;
}

function toggleGroup(key) {
  if (state.expandedGroups.has(key)) state.expandedGroups.delete(key);
  else state.expandedGroups.add(key);
  renderUnifiedLog();
}

async function deleteRecord(id) {
  if (!confirm('Delete this log?')) return;
  await api('/records/' + id, { method: 'DELETE' });
  loadUnifiedLog();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadProfile() {
  const data = await api('/auth/me');
  if (!data) return;

  document.getElementById('profile-avatar').src = data.picture || '';
  document.getElementById('profile-name').textContent = data.display_name || data.name || '';
  document.getElementById('profile-email').textContent = data.email || '';

  const stat = await api('/stats');

  const grid = document.getElementById('profile-stats');
  if (grid) grid.innerHTML = `
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--study-hi)">${stat?.total_records || 0}</div><div class="stat-tile-label">Total Logs</div></div>
    <div class="stat-tile"><div class="stat-tile-val" style="color:var(--exer-hi)">${stat?.total_minutes ? formatDuration(stat.total_minutes) : '0m'}</div><div class="stat-tile-label">Total Time</div></div>
  `;

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
    data.dob ? `<div class="profile-row"><span class="profile-row-label">Age</span><span class="profile-row-val">${userAge}</span></div>` : '',
    data.gender ? `<div class="profile-row"><span class="profile-row-label">Gender</span><span class="profile-row-val">${capitalize(data.gender)}</span></div>` : '',
    `<div class="profile-row"><span class="profile-row-label">Sleep goal</span><span class="profile-row-val">${data.sleep_goal_hours || 8}h / night</span></div>`,
    data.occupation ? `<div class="profile-row"><span class="profile-row-label">Occupation</span><span class="profile-row-val">${data.occupation}</span></div>` : '',
    data.work_schedule ? `<div class="profile-row"><span class="profile-row-label">Schedule</span><span class="profile-row-val">${scheduleMap[data.work_schedule] || data.work_schedule}</span></div>` : '',
    data.exercise_frequency ? `<div class="profile-row"><span class="profile-row-label">Exercise</span><span class="profile-row-val">${exerMap[data.exercise_frequency] || data.exercise_frequency}</span></div>` : ''
  ].join('');
}

function setTheme(theme) {
  if (!['light', 'dark', 'system'].includes(theme)) theme = 'dark';
  localStorage.setItem('timelog_theme', theme);
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
  const current = localStorage.getItem('timelog_theme') || 'dark';
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
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
  if (!isoStr) return '—';
  return new Date(isoStr + 'Z').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : ''; }

function shakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

// ═══════════ CUSTOM COLOR ═══════════
function openCustomColor() {
  const input = document.getElementById('custom-color-input');
  input.click();
}

function setCustomColor(val) {
  document.querySelectorAll('#task-color-grid .color-opt').forEach(o => o.classList.remove('active'));
  const btn = document.getElementById('custom-color-btn');
  btn.style.background = val;
  btn.style.border = '2px solid #fff';
  btn.textContent = '';
  btn.dataset.color = val;
  btn.classList.add('active');
}

// ═══════════ EMOJI PICKER ═══════════
let emojiPickerMounted = false;
function openEmojiPicker() {
  const mount = document.getElementById('emoji-picker-mount');
  if (!emojiPickerMounted) {
    const picker = document.createElement('emoji-picker');
    picker.style.width = '100%';
    picker.style.maxWidth = '320px';
    picker.addEventListener('emoji-click', (e) => {
      const unicode = e.detail.unicode;
      selectCustomIcon(unicode);
      closeEmojiPicker();
    });
    mount.appendChild(picker);
    emojiPickerMounted = true;
  }
  document.getElementById('emoji-modal').style.display = 'flex';
}

function closeEmojiPicker() {
  document.getElementById('emoji-modal').style.display = 'none';
}

function selectCustomIcon(emoji) {
  document.querySelectorAll('#task-icon-grid .icon-opt').forEach(o => o.classList.remove('active'));
  const btn = document.getElementById('custom-icon-btn');
  btn.textContent = emoji;
  btn.style.border = '2px solid var(--study)';
  btn.dataset.icon = emoji;
  btn.classList.add('active');
}
