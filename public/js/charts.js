Chart.defaults.color = '#8090b0';
Chart.defaults.borderColor = '#1e293b';

let chartPeriod = 7;

function setChartPeriod(days) {
  chartPeriod = days;
  document.querySelectorAll('.period-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('onclick').includes(days));
  });
  loadCharts(chartPeriod);
}

async function loadCharts(days = chartPeriod) {
  chartPeriod = days;
  const [sleepData, studyData, exerData] = await Promise.all([
    api('/stats?days=' + days),
    api('/study/stats?days=' + days),
    api('/exercise/stats?days=' + days)
  ]);

  if (!sleepData || !studyData || !exerData) return;

  // Aggregate stats
  const totalSleepHours = (sleepData.avg_duration_minutes * days) / 60 || 0;
  const totalStudyHours = studyData.total_duration_minutes / 60 || 0;
  const totalExerHours = exerData.total_duration_minutes / 60 || 0;
  const totalTrackedHours = totalSleepHours + totalStudyHours + totalExerHours;

  renderStatsGrid('unified-stats-grid', [
    { val: Math.round(totalTrackedHours) + 'h', label: 'Tracked', color: 'var(--text)' },
    { val: Math.round(totalSleepHours) + 'h', label: 'Sleep', color: '#8b5cf6' },
    { val: Math.round(totalStudyHours) + 'h', label: 'Study', color: '#10b981' },
    { val: Math.round(totalExerHours) + 'h', label: 'Exercise', color: '#0ea5e9' }
  ]);

  // Aggregate daily data
  const dateMap = {};
  
  // Fill dateMap with last `days` dates to ensure zero-filling
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    dateMap[dStr] = { sleep: 0, study: 0, exercise: 0 };
  }

  if (sleepData.daily) sleepData.daily.forEach(d => { if(dateMap[d.date]) dateMap[d.date].sleep += d.duration_minutes / 60; });
  if (studyData.daily) studyData.daily.forEach(d => { if(dateMap[d.date]) dateMap[d.date].study += d.duration_minutes / 60; });
  if (exerData.daily) exerData.daily.forEach(d => { if(dateMap[d.date]) dateMap[d.date].exercise += d.duration_minutes / 60; });

  const labels = Object.keys(dateMap).map(shortDate);
  const sleepArr = Object.values(dateMap).map(v => v.sleep);
  const studyArr = Object.values(dateMap).map(v => v.study);
  const exerArr = Object.values(dateMap).map(v => v.exercise);

  destroyAndCreate('unified-main-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Sleep', data: sleepArr, backgroundColor: '#8b5cf6', borderRadius: 4, stack: 'Stack 0' },
        { label: 'Study', data: studyArr, backgroundColor: '#10b981', borderRadius: 4, stack: 'Stack 0' },
        { label: 'Exercise', data: exerArr, backgroundColor: '#0ea5e9', borderRadius: 4, stack: 'Stack 0' }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: c => ` ${c.dataset.label}: ${c.raw.toFixed(1)}h`
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { 
          stacked: true, 
          max: 24, 
          ticks: { stepSize: 4, callback: v => v + 'h' },
          grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#e2e8f0' }
        }
      }
    }
  });

  // Render unified pie chart
  destroyAndCreate('unified-pie-chart', {
    type: 'doughnut',
    data: {
      labels: ['Sleep', 'Study', 'Exercise'],
      datasets: [{
        data: [Math.round(totalSleepHours), Math.round(totalStudyHours), Math.round(totalExerHours)],
        backgroundColor: ['#8b5cf6', '#10b981', '#0ea5e9'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 16 } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw}h` } }
      }
    }
  });
}

function renderStatsGrid(gridId, tiles) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = tiles.map(t => `
    <div class="stat-tile">
      <div class="stat-tile-val" style="color:${t.color}">${t.val}</div>
      <div class="stat-tile-label">${t.label}</div>
    </div>`).join('');
}

function destroyAndCreate(canvasId, config) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const existing = Chart.getChart(ctx);
  if (existing) existing.destroy();
  new Chart(ctx, config);
}

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
