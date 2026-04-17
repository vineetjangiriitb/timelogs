const exerciseState = {
  isExercising: false,
  currentSession: null,
  timerInterval: null
};

let selectedExType = null;

async function initExercise() {
  const data = await api('/exercise/status');
  if (!data) return;
  exerciseState.isExercising = data.is_exercising;
  exerciseState.currentSession = data.current_session;
  updateExerciseUI();
  if (exerciseState.isExercising) {
    startExerciseTimer();
    const type = exerciseState.currentSession?.exercise_type || 'Exercise';
    showSessionNotification('exercise-session', `Exercising — ${type}`, 'Tap Stop to end the session');
  }
}

function updateExerciseUI() {
  const dot = document.getElementById('exer-dot');
  const statusText = document.getElementById('exer-status-text');
  const quickBtn = document.getElementById('exer-quick-btn');
  const quickLabel = document.getElementById('exer-quick-label');
  const statusCard = document.getElementById('exer-status-card');

  if (exerciseState.isExercising) {
    const type = exerciseState.currentSession?.exercise_type || 'Exercise';
    dot?.classList.add('active-exer');
    if (statusText) statusText.textContent = `Exercising: ${type}`;
    if (quickBtn) quickBtn.classList.add('active-exer');
    if (quickLabel) quickLabel.textContent = `Stop Workout`;
    if (statusCard) statusCard.style.display = 'block';
  } else {
    dot?.classList.remove('active-exer');
    if (statusText) statusText.textContent = 'Not exercising';
    if (quickBtn) quickBtn.classList.remove('active-exer');
    if (quickLabel) quickLabel.textContent = 'Log Workout';
    const tEl = document.getElementById('exer-timer');
    if (tEl) tEl.textContent = '';
    if (statusCard) statusCard.style.display = 'none';
    clearInterval(exerciseState.timerInterval);
  }
}

function startExerciseTimer() {
  if (!exerciseState.currentSession) return;
  updateExerciseTimerDisplay();
  exerciseState.timerInterval = setInterval(updateExerciseTimerDisplay, 1000);
}

function updateExerciseTimerDisplay() {
  if (!exerciseState.currentSession) return;
  const start = new Date(exerciseState.currentSession.session_start + 'Z').getTime();
  const elapsed = Date.now() - start;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  const el = document.getElementById('exer-timer');
  if (el) el.textContent = h > 0 ? `${h}h ${pad(m)}m ${pad(s)}s` : `${pad(m)}m ${pad(s)}s`;
}

function openExerciseModal() {
  if (exerciseState.isExercising) {
    // If active, just stop it
    stopExercise();
    return;
  }
  selectedExType = null;
  document.querySelectorAll('.ex-type-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('exercise-modal').style.display = 'flex';
}

function closeExerciseModal() {
  document.getElementById('exercise-modal').style.display = 'none';
}

function setupExerciseModal() {
  document.querySelectorAll('.ex-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ex-type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedExType = btn.dataset.type;
    });
  });
}

async function startExercise() {
  if (!selectedExType) {
    const grid = document.getElementById('exercise-type-grid');
    grid.style.animation = 'none';
    void grid.offsetHeight;
    grid.style.animation = 'shake .4s';
    return;
  }

  const data = await api('/exercise/start', {
    method: 'POST',
    body: { exercise_type: selectedExType }
  });

  if (data && !data.error) {
    exerciseState.isExercising = true;
    exerciseState.currentSession = { session_start: data.session_start, exercise_type: data.exercise_type };
    closeExerciseModal();
    updateExerciseUI();
    startExerciseTimer();
    showSessionNotification('exercise-session', `Exercising — ${data.exercise_type}`, 'Tap Stop to end the session');
  }
}

async function stopExercise() {
  if (navigator.vibrate) navigator.vibrate(40);
  const data = await api('/exercise/stop', { method: 'POST' });
  if (!data) return;
  exerciseState.isExercising = false;
  exerciseState.currentSession = null;
  clearInterval(exerciseState.timerInterval);
  updateExerciseUI();
  loadUnifiedLog();
  updateTodayStrip();
  closeSessionNotification('exercise-session');
}

async function deleteExerciseRecord(id) {
  if (!confirm('Delete this workout?')) return;
  await api('/exercise/' + id, { method: 'DELETE' });
  loadUnifiedLog();
  updateTodayStrip();
}

function exerciseIcon(type) {
  const map = {
    'Running': '&#127939;', 'Walking': '&#128694;', 'Cycling': '&#128690;',
    'Swimming': '&#127946;', 'Gym': '&#127947;', 'Yoga': '&#129340;',
    'Sports': '&#9917;', 'Other': '&#128310;'
  };
  return map[type] || '&#127947;';
}

document.addEventListener('DOMContentLoaded', setupExerciseModal);
