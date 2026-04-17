const studyState = {
  isStudying: false,
  currentSession: null,
  timerInterval: null
};

async function initStudy() {
  const data = await api('/study/status');
  if (!data) return;
  studyState.isStudying = data.is_studying;
  studyState.currentSession = data.current_session;
  updateStudyUI();
  if (studyState.isStudying) {
    startStudyTimer();
    const subj = studyState.currentSession?.subject || 'Study';
    showSessionNotification('study-session', `Studying — ${subj}`, 'Tap Stop to end the session');
  }
}

function updateStudyUI() {
  const dot = document.getElementById('study-dot');
  const statusText = document.getElementById('study-status-text');
  const btn = document.getElementById('study-action-btn');
  const quickBtn = document.getElementById('study-quick-btn');
  const quickLabel = document.getElementById('study-quick-label');
  const statusCard = document.getElementById('study-status-card');

  if (studyState.isStudying) {
    const subj = studyState.currentSession?.subject || 'Study';
    dot?.classList.add('active-study');
    if (statusText) statusText.textContent = `Studying: ${subj}`;
    if (btn) { btn.textContent = 'Stop Study'; btn.classList.add('active-btn'); }
    if (quickBtn) quickBtn.classList.add('active-study');
    if (quickLabel) quickLabel.textContent = `Stop Study`;
    if (statusCard) statusCard.style.display = 'block';
  } else {
    dot?.classList.remove('active-study');
    if (statusText) statusText.textContent = 'Not studying';
    if (btn) { btn.textContent = 'Start Study'; btn.classList.remove('active-btn'); }
    if (quickBtn) quickBtn.classList.remove('active-study');
    if (quickLabel) quickLabel.textContent = 'Start Study';
    const tEl = document.getElementById('study-timer');
    if (tEl) tEl.textContent = '';
    if (statusCard) statusCard.style.display = 'none';
    clearInterval(studyState.timerInterval);
  }
}

function startStudyTimer() {
  if (!studyState.currentSession) return;
  updateStudyTimerDisplay();
  studyState.timerInterval = setInterval(updateStudyTimerDisplay, 1000);
}

function updateStudyTimerDisplay() {
  if (!studyState.currentSession) return;
  const start = new Date(studyState.currentSession.session_start + 'Z').getTime();
  const elapsed = Date.now() - start;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  const el = document.getElementById('study-timer');
  if (el) el.textContent = h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
}

async function toggleStudy() {
  if (navigator.vibrate) navigator.vibrate(40);

  if (studyState.isStudying) {
    const data = await api('/study/stop', { method: 'POST' });
    if (!data) return;
    studyState.isStudying = false;
    studyState.currentSession = null;
    clearInterval(studyState.timerInterval);
    updateStudyUI();
    loadUnifiedLog();
    updateTodayStrip();
    closeSessionNotification('study-session');
  } else {
    const subject = document.getElementById('study-subject')?.value || 'General';
    const data = await api('/study/start', { method: 'POST', body: { subject } });
    if (!data || data.error) return;
    studyState.isStudying = true;
    studyState.currentSession = { session_start: data.session_start, subject: data.subject };
    updateStudyUI();
    startStudyTimer();
    showSessionNotification('study-session', `Studying — ${studyState.currentSession.subject}`, 'Tap Stop to end the session');
  }
}

// Called from home quick button
async function handleStudyQuick() {
  await toggleStudy();
}

async function deleteStudyRecord(id) {
  if (!confirm('Delete this study session?')) return;
  await api('/study/' + id, { method: 'DELETE' });
  loadUnifiedLog();
  updateTodayStrip();
}

function subjectIcon(subject) {
  const map = {
    'Math': '&#10133;', 'Science': '&#9874;', 'Programming': '&#128187;',
    'Language': '&#128172;', 'History': '&#128218;', 'Reading': '&#128214;',
    'Work': '&#128188;', 'General': '&#128218;', 'Other': '&#128209;'
  };
  return map[subject] || '&#128218;';
}

function pad(n) { return String(n).padStart(2, '0'); }
