let charts = {};

async function loadCharts(days = 7) {
  document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(\`.period-tab[onclick="setChartPeriod(\${days})"]\`)?.classList.add('active');

  const res = await fetch('/api/stats?days=' + days, { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sleeplogs_token') } });
  if (!res.ok) return;
  const data = await res.json();

  const grid = document.getElementById('unified-stats-grid');
  if (grid) {
    grid.innerHTML = \`
      <div class="stat-tile"><div class="stat-tile-val" style="color:var(--study-hi)">\${data.total_records || 0}</div><div class="stat-tile-label">Sessions</div></div>
      <div class="stat-tile"><div class="stat-tile-val" style="color:var(--exer-hi)">\${formatDuration(data.total_minutes)}</div><div class="stat-tile-label">Logged time</div></div>
    \`;
  }

  const ctxMain = document.getElementById('unified-main-chart');
  if (ctxMain) {
    if (charts.main) charts.main.destroy();
    
    const labels = data.daily.map(d => formatDate(d.date));
    const vals = data.daily.map(d => Math.round(d.duration_minutes));
    
    charts.main = new Chart(ctxMain, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Minutes', data: vals, backgroundColor: '#0ea5e9', borderRadius: 6 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid') } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

window.setChartPeriod = function(days) {
  loadCharts(days);
};
