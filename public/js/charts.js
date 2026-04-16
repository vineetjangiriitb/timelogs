let durationChart = null;
let qualityChart = null;

Chart.defaults.color = '#8888aa';
Chart.defaults.borderColor = '#2a2a45';

async function loadCharts(days = 7) {
  // Update active tab
  document.querySelectorAll('.chart-tab').forEach(t => {
    t.classList.toggle('active', parseInt(t.textContent) === days);
  });

  const data = await api('/stats?days=' + days);
  renderStats(data);
  renderDurationChart(data.daily);
  renderQualityChart(data.daily);
}

function renderStats(data) {
  const el = document.getElementById('stats-summary');
  el.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${formatDuration(data.avg_duration_minutes)}</div>
      <div class="stat-label">Average</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.current_streak} day${data.current_streak !== 1 ? 's' : ''}</div>
      <div class="stat-label">Streak</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatDuration(data.max_duration_minutes)}</div>
      <div class="stat-label">Best Night</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatDuration(data.min_duration_minutes)}</div>
      <div class="stat-label">Worst Night</div>
    </div>
  `;
}

function renderDurationChart(daily) {
  const ctx = document.getElementById('duration-chart');

  if (durationChart) durationChart.destroy();

  const labels = daily.map(d => {
    const date = new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });

  const values = daily.map(d => +(d.duration_minutes / 60).toFixed(1));

  const colors = values.map(v => {
    if (v >= 7) return '#4ade80';
    if (v >= 6) return '#fbbf24';
    return '#f87171';
  });

  durationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Hours',
        data: values,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => c.raw + ' hours'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 12,
          ticks: { callback: v => v + 'h' },
          grid: { color: '#1a1a2e' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderQualityChart(daily) {
  const ctx = document.getElementById('quality-chart');

  if (qualityChart) qualityChart.destroy();

  const withQuality = daily.filter(d => d.quality != null);

  if (withQuality.length === 0) {
    qualityChart = new Chart(ctx, {
      type: 'line',
      data: { labels: ['No data'], datasets: [{ data: [0] }] },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Rate your sleep to see trends', color: '#8888aa' }
        },
        scales: { y: { display: false }, x: { display: false } }
      }
    });
    return;
  }

  const labels = withQuality.map(d => {
    const date = new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });

  const values = withQuality.map(d => +d.quality.toFixed(1));

  qualityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Quality',
        data: values,
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#fbbf24',
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, callback: v => '\u2605'.repeat(v) },
          grid: { color: '#1a1a2e' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}
