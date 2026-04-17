const auth = {
  token: localStorage.getItem('sleeplogs_token'),
  user: null,
  googleClientId: null
};

async function initAuth() {
  const res = await fetch('/api/auth/client-id');
  const data = await res.json();
  auth.googleClientId = data.clientId;

  if (auth.token) {
    const valid = await fetchMe();
    if (valid) {
      if (!auth.user.onboarding_complete) {
        showOnboarding();
      } else {
        showApp();
      }
      return;
    }
    localStorage.removeItem('sleeplogs_token');
    auth.token = null;
  }
  showLogin();
}

async function fetchMe() {
  try {
    const res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + auth.token } });
    if (!res.ok) return false;
    auth.user = await res.json();
    return true;
  } catch { return false; }
}

function showLogin() {
  document.getElementById('view-login').classList.add('active');
  document.getElementById('view-onboarding').classList.remove('active');
  document.getElementById('app-container').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'none';

  if (auth.googleClientId && window.google) {
    google.accounts.id.initialize({
      client_id: auth.googleClientId,
      callback: handleGoogleSignIn,
      auto_select: false
    });
    google.accounts.id.renderButton(
      document.getElementById('google-btn-container'),
      { theme: 'filled_black', size: 'large', width: 300, text: 'signin_with', shape: 'pill' }
    );
  } else {
    document.getElementById('google-btn-container').innerHTML =
      `<p style="color:var(--poor);text-align:center;font-size:.85rem;padding:12px 0">
        Google Client ID not configured.<br>Set <code>GOOGLE_CLIENT_ID</code> env var.
      </p>`;
  }
}

async function handleGoogleSignIn(response) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    if (!res.ok) { const e = await res.json(); alert('Sign in failed: ' + e.error); return; }
    const data = await res.json();
    auth.token = data.token;
    auth.user = data.user;
    localStorage.setItem('sleeplogs_token', auth.token);
    if (!auth.user.onboarding_complete) showOnboarding();
    else showApp();
  } catch { alert('Sign in failed. Please try again.'); }
}

function showApp() {
  document.getElementById('view-login').classList.remove('active');
  document.getElementById('view-onboarding').classList.remove('active');
  document.getElementById('app-container').style.display = 'block';
  document.querySelector('.bottom-nav').style.display = 'flex';

  // Set header avatar
  const avatar = document.getElementById('user-avatar');
  const fallback = document.getElementById('avatar-fallback');
  if (auth.user?.picture && avatar) {
    avatar.src = auth.user.picture;
    avatar.style.display = 'block';
    if (fallback) fallback.style.display = 'none';
  } else if (fallback) {
    const name = auth.user?.display_name || auth.user?.name || '?';
    fallback.textContent = name.charAt(0).toUpperCase();
  }

  switchView('home');
  init();
}

function logout() {
  localStorage.removeItem('sleeplogs_token');
  auth.token = null;
  auth.user = null;
  document.getElementById('app-container').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'none';
  showLogin();
}

// ═══════════ ONBOARDING ═══════════
let onboardingStep = 1;
const TOTAL_STEPS = 5;
const onboardingData = {};

function showOnboarding() {
  document.getElementById('view-login').classList.remove('active');
  document.getElementById('view-onboarding').classList.add('active');
  document.getElementById('app-container').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'none';
  onboardingStep = 1;
  const nameInput = document.getElementById('ob-name');
  if (nameInput && auth.user) nameInput.value = auth.user.display_name || auth.user.name || '';
  showOnboardingStep(1);
}

function showOnboardingStep(step) {
  onboardingStep = step;
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-step-' + step)?.classList.add('active');

  const pct = (step / TOTAL_STEPS) * 100;
  document.getElementById('ob-progress-fill').style.width = pct + '%';
  document.getElementById('ob-step-label').textContent = `Step ${step} of ${TOTAL_STEPS}`;
  document.getElementById('ob-back-btn').style.visibility = step > 1 ? 'visible' : 'hidden';

  const nextLabel = document.getElementById('ob-next-label');
  if (nextLabel) nextLabel.textContent = step === TOTAL_STEPS ? 'Get Started' : 'Continue';
}

function obNext() {
  if (onboardingStep === 1) {
    const name = document.getElementById('ob-name').value.trim();
    if (!name) { shakeInput('ob-name'); return; }
    onboardingData.display_name = name;
  } else if (onboardingStep === 2) {
    onboardingData.dob = document.getElementById('ob-dob').value || null;
    onboardingData.gender = document.querySelector('.ob-option.selected[data-field="gender"]')?.dataset.value || null;
  } else if (onboardingStep === 3) {
    onboardingData.sleep_goal_hours = parseFloat(document.getElementById('ob-sleep-goal').value);
  } else if (onboardingStep === 4) {
    onboardingData.occupation = document.getElementById('ob-occupation').value.trim() || null;
    onboardingData.work_schedule = document.querySelector('.ob-option.selected[data-field="schedule"]')?.dataset.value || null;
  } else if (onboardingStep === 5) {
    onboardingData.exercise_frequency = document.querySelector('.ob-option.selected[data-field="exercise"]')?.dataset.value || null;
    completeOnboarding();
    return;
  }
  showOnboardingStep(onboardingStep + 1);
}

function obBack() {
  if (onboardingStep > 1) showOnboardingStep(onboardingStep - 1);
}

async function completeOnboarding() {
  onboardingData.onboarding_complete = 1;
  await fetch('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth.token },
    body: JSON.stringify(onboardingData)
  });
  auth.user = { ...auth.user, ...onboardingData, onboarding_complete: true };
  showApp();
}

function setupObOptions() {
  document.querySelectorAll('.ob-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const field = opt.dataset.field;
      document.querySelectorAll(`.ob-option[data-field="${field}"]`).forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  const slider = document.getElementById('ob-sleep-goal');
  const display = document.getElementById('ob-sleep-goal-display');
  const tip = document.getElementById('sleep-goal-tip');
  if (slider && display) {
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      display.textContent = v + ' hours';
      if (tip) {
        if (v < 6) tip.textContent = '⚠️ This is below the recommended minimum. Consider aiming higher.';
        else if (v <= 9) tip.textContent = '✅ The recommended amount for adults is 7–9 hours.';
        else tip.textContent = '💤 More than 9 hours may suit some people, especially teenagers.';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupObOptions();
  initAuth();
});
