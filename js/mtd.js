// ============================================================
// mtd.js — MTD Tracker Module with Chart.js charts
// ============================================================

var _mtdCharts = {};

function renderMTD() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="mtd-root"></div>';
  var root = document.getElementById('mtd-root');
  var month = APP.currentMonth || '';

  root.innerHTML =
    '<div class="page-header"><h2>MTD Tracker</h2><p id="mtd-period-sub">Loading...</p></div>' +
    '<div class="kpi-grid" id="mtd-kpi-grid">'+_kpiSkeletons(8)+'</div>' +
    '<div class="card chart-full section-row"><div class="card-header"><span class="card-title">Daily Trend — Added / Removed / Variance</span></div><div class="chart-container"><div class="chart-canvas-wrap"><canvas id="chart-trend"></canvas></div></div></div>' +
    '<div class="chart-grid">' +
      '<div class="card"><div class="card-header"><span class="card-title">Facility Trend</span></div><div class="chart-container"><div class="chart-canvas-wrap"><canvas id="chart-facility"></canvas></div></div></div>' +
      '<div class="card"><div class="card-header"><span class="card-title">User Trend (Top 10)</span></div><div class="chart-container"><div class="chart-canvas-wrap"><canvas id="chart-user"></canvas></div></div></div>' +
    '</div>';

  Promise.all([
    apiGetMTDKPI({ month: month }),
    apiGetDailyTrend({ month: month }),
    apiGetFacilitySummary({ scope: 'MTD', month: month }),
    apiGetUserSummary({ scope: 'MTD', month: month }),
  ]).then(function(results) {
    var mtd = results[0]; var trend = results[1];
    var fac = results[2]; var usr   = results[3];

    if (mtd && mtd.monthDisplay) {
      document.getElementById('mtd-period-sub').textContent = 'Month-to-Date — ' + mtd.monthDisplay;
    }

    _renderMTDKPIs(mtd);
    _renderTrendChart(trend);
    _renderFacilityChart(fac);
    _renderUserChart(usr);

  }).catch(function(e) {
    document.getElementById('mtd-root').innerHTML = emptyState('No MTD data available', 'Ensure the 8 AM processing trigger has run at least once this month.');
    console.error('MTD error:', e);
  });
}

function _kpiSkeletons(n) {
  var html = '';
  for (var i=0;i<n;i++) html += '<div class="kpi-card"><div class="skeleton" style="height:11px;width:60%;margin-bottom:12px;"></div><div class="skeleton" style="height:28px;width:80%;"></div></div>';
  return html;
}

function _renderMTDKPIs(data) {
  var grid = document.getElementById('mtd-kpi-grid');
  if (!data || !data.kpi) { grid.innerHTML = emptyState('No MTD data','No data for this month.'); return; }
  var k = data.kpi;
  var netV = parseInt(k.netVarianceQty)||0;
  var netColor = netV===0?'#059669':(netV>0?'#D97706':'#DC2626');
  var netBg    = netV===0?'#D1FAE5':(netV>0?'#FEF3C7':'#FEE2E2');
  grid.innerHTML =
    kpiCard('MTD Events',         fmtNum(k.totalEvents),        '#2E86C1','#DBEAFE','activity') +
    kpiCard('MTD Added Qty',      fmtNum(k.totalAddedQty),      '#059669','#D1FAE5','plus-circle') +
    kpiCard('MTD Removed Qty',    fmtNum(k.totalRemovedQty),    '#D97706','#FEF3C7','minus-circle') +
    kpiCard('MTD Net Variance',   (netV>=0?'+':'')+fmtNum(netV),netColor, netBg,   'trending-up',true) +
    kpiCard('Balanced SKUs',      fmtNum(k.balancedSKUs),       '#059669','#D1FAE5','check-circle') +
    kpiCard('Variance SKUs',      fmtNum(k.varianceSKUs),       '#DC2626','#FEE2E2','alert-triangle') +
    kpiCard('Facilities Impacted',fmtNum(k.facilitiesImpacted), '#0F2035','#E0E7EF','map-pin') +
    kpiCard('Users Impacted',     fmtNum(k.usersImpacted),      '#6C3483','#EDE9F8','users');
}

function _renderTrendChart(data) {
  var canvas = document.getElementById('chart-trend');
  if (!canvas) return;
  var trend = data && data.trend ? data.trend : [];
  if (!trend.length) { canvas.parentElement.innerHTML = emptyState('No trend data','No daily data available for this month.'); return; }

  var labels   = trend.map(function(d){ return d.dateLabel || d.date; });
  var added    = trend.map(function(d){ return d.added||0; });
  var removed  = trend.map(function(d){ return d.removed||0; });
  var variance = trend.map(function(d){ return d.variance||0; });

  if (_mtdCharts.trend) { _mtdCharts.trend.destroy(); }
  _mtdCharts.trend = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label:'Added Qty',    data:added,    borderColor:'#059669', backgroundColor:'rgba(5,150,105,0.08)',  tension:0.35, fill:true, pointRadius:3 },
        { label:'Removed Qty', data:removed,  borderColor:'#D97706', backgroundColor:'rgba(217,119,6,0.06)',  tension:0.35, fill:true, pointRadius:3 },
        { label:'Variance',    data:variance, borderColor:'#2E86C1', backgroundColor:'rgba(46,134,193,0.06)', tension:0.35, fill:false,pointRadius:3, borderDash:[4,3] },
      ]
    },
    options: _chartOptions('line')
  });
}

function _renderFacilityChart(data) {
  var canvas = document.getElementById('chart-facility');
  if (!canvas) return;
  var rows = data && data.facilities ? data.facilities.slice(0,10) : [];
  if (!rows.length) { canvas.parentElement.innerHTML = emptyState('No facility data',''); return; }

  var labels   = rows.map(function(f){ return f.name; });
  var added    = rows.map(function(f){ return f.added||0; });
  var removed  = rows.map(function(f){ return f.removed||0; });

  if (_mtdCharts.facility) _mtdCharts.facility.destroy();
  _mtdCharts.facility = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label:'Added',   data:added,   backgroundColor:'rgba(5,150,105,0.75)',  borderRadius:4 },
        { label:'Removed', data:removed, backgroundColor:'rgba(217,119,6,0.75)',  borderRadius:4 },
      ]
    },
    options: _chartOptions('bar')
  });
}

function _renderUserChart(data) {
  var canvas = document.getElementById('chart-user');
  if (!canvas) return;
  var rows = data && data.users ? data.users.slice(0,10) : [];
  if (!rows.length) { canvas.parentElement.innerHTML = emptyState('No user data',''); return; }

  var labels  = rows.map(function(u){ return u.name; });
  var variance= rows.map(function(u){ return Math.abs(u.variance||0); });

  if (_mtdCharts.user) _mtdCharts.user.destroy();
  _mtdCharts.user = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label:'|Variance|', data:variance, backgroundColor:'rgba(46,134,193,0.75)', borderRadius:4 }]
    },
    options: Object.assign({}, _chartOptions('bar'), { indexAxis:'y' })
  });
}

function _chartOptions(type) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position:'top', labels: { font:{family:"'DM Sans',sans-serif",size:11}, boxWidth:10, padding:12, color:'#4B5563' }},
      tooltip: { backgroundColor:'#0F2035', titleFont:{family:"'Syne',sans-serif",size:12}, bodyFont:{family:"'DM Sans',sans-serif",size:11}, padding:10, cornerRadius:8 }
    },
    scales: {
      x: { grid:{color:'rgba(0,0,0,0.04)'}, ticks:{font:{family:"'DM Sans',sans-serif",size:10},color:'#9CA3AF',maxRotation:45} },
      y: { grid:{color:'rgba(0,0,0,0.04)'}, ticks:{font:{family:"'DM Sans',sans-serif",size:10},color:'#9CA3AF'} }
    }
  };
}
