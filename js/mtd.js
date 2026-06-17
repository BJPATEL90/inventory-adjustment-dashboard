// mtd.js — V4
// Fixes: itemName key, chart date labels, KPI strip layout, MTD facility/user charts

var _mtdCharts = {};

function renderMTD() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="mtd-root"></div>';
  var root = document.getElementById('mtd-root');
  var month = APP.currentMonth || '';

  root.innerHTML =
    '<div class="page-header">' +
      '<h2>MTD Tracker</h2>' +
      '<p id="mtd-period-sub">Loading…</p>' +
    '</div>' +
    '<div class="kpi-strip" id="mtd-kpi-row1">' + _kpiSkels(4) + '</div>' +
    '<div class="kpi-strip-2" id="mtd-kpi-row2">' + _kpiSkels(4, true) + '</div>' +
    '<div class="card section-row">' +
      '<div class="card-header"><span class="card-title">Daily Trend — Added / Removed / Variance</span></div>' +
      '<div class="chart-wrap"><div class="chart-canvas" style="height:220px;"><canvas id="chart-trend"></canvas></div></div>' +
    '</div>' +
    '<div class="chart-grid">' +
      '<div class="card">' +
        '<div class="card-header"><span class="card-title">Facility Type</span></div>' +
        '<div class="chart-wrap"><div class="chart-canvas" style="height:200px;"><canvas id="chart-facility"></canvas></div></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header"><span class="card-title">Top 10 Users by Variance</span></div>' +
        '<div class="chart-wrap"><div class="chart-canvas" style="height:200px;"><canvas id="chart-user"></canvas></div></div>' +
      '</div>' +
    '</div>' +
    '<div class="card section-row">' +
      '<div class="card-header">' +
        '<span class="card-title">MTD Top SKUs by Variance</span>' +
        '<span class="card-badge">Top 20</span>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table><thead><tr>' +
          '<th>SKU</th><th>Item Name</th>' +
          '<th style="text-align:right">Added</th>' +
          '<th style="text-align:right">Removed</th>' +
          '<th style="text-align:right">Variance</th>' +
        '</tr></thead>' +
        '<tbody id="mtd-sku-tbody">' + skeletonRows(5, 8) + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';

  // Try localStorage cache first
  var cacheKey = 'iamd_mtd_' + (month || 'current');
  var cached = lsGet(cacheKey);
  if (cached && cached.ts && (Date.now() - cached.ts) < 5 * 60 * 1000) {
    _renderMTDAll(cached.data);
    setSyncLive(cached.data.mtd && cached.data.mtd.month);
    _fetchMTDData(month, cacheKey, true);
    return;
  }

  setSyncIdle();
  _fetchMTDData(month, cacheKey, false);
}

function _kpiSkels(n, small) {
  var h = '';
  for (var i = 0; i < n; i++) {
    h += '<div class="kpi-card' + (small ? ' kpi-sm' : '') + '">' +
      '<div class="skeleton" style="height:10px;width:55%;margin-bottom:10px;"></div>' +
      '<div class="skeleton" style="height:' + (small ? '20' : '26') + 'px;width:70%;"></div>' +
      '</div>';
  }
  return h;
}

function _fetchMTDData(month, cacheKey, silent) {
  Promise.all([
    apiGetMTDKPI({ month: month }),
    apiGetDailyTrend({ month: month }),
    apiGetFacilityTypeSummary({ scope: 'MTD', month: month }),
    apiGetUserSummary({ scope: 'MTD', month: month }),
    apiGetMTDTopSKUs({ month: month }),
  ]).then(function(res) {
    var data = { mtd: res[0], trend: res[1], ft: res[2], users: res[3], skus: res[4] };
    lsSet(cacheKey, { ts: Date.now(), data: data });
    _renderMTDAll(data);
    setSyncLive(data.mtd && data.mtd.month);
  }).catch(function(e) {
    if (!silent) {
      document.getElementById('mtd-root').innerHTML = emptyState('No MTD data', 'Run processing first or check connection.');
      setSyncError();
    }
    console.error('MTD error:', e);
  });
}

function _renderMTDAll(data) {
  _renderMTDKPIs(data.mtd);
  _renderTrendChart(data.trend);
  _renderFacilityTypeChart(data.ft);
  _renderUserChart(data.users);
  _renderMTDSKUTable(data.skus);
  if (data.mtd && data.mtd.monthDisplay) {
    var el = document.getElementById('mtd-period-sub');
    if (el) el.textContent = 'Month-to-Date — ' + data.mtd.monthDisplay;
  }
  // Store for CSV
  APP._downloadRows = _buildMTDDownload(data.skus);
}

function _renderMTDKPIs(data) {
  var row1 = document.getElementById('mtd-kpi-row1');
  var row2 = document.getElementById('mtd-kpi-row2');
  if (!data || !data.kpi) {
    if (row1) row1.innerHTML = emptyState('No MTD data', 'No data for this month.');
    if (row2) row2.innerHTML = '';
    return;
  }
  var k = data.kpi;
  var netV = parseInt(k.netVarianceQty) || 0;
  var netColor = netV === 0 ? '#059669' : (netV > 0 ? '#D97706' : '#DC2626');
  var netBg    = netV === 0 ? '#D1FAE5' : (netV > 0 ? '#FEF3C7' : '#FEE2E2');

  if (row1) row1.innerHTML =
    kpiCard('MTD Events',      fmtNum(k.totalEvents),    '#2E86C1', '#DBEAFE', 'activity') +
    kpiCard('Total Added',     fmtNum(k.totalAddedQty),  '#059669', '#D1FAE5', 'plus-circle') +
    kpiCard('Total Removed',   fmtNum(k.totalRemovedQty),'#D97706', '#FEF3C7', 'minus-circle') +
    kpiCard('Net Variance',    (netV >= 0 ? '+' : '') + fmtNum(netV), netColor, netBg, 'trending-up', true);

  if (row2) row2.innerHTML =
    kpiCard('Balanced SKUs',   fmtNum(k.balancedSKUs),      '#059669', '#D1FAE5', 'check-circle',    false, true) +
    kpiCard('Variance SKUs',   fmtNum(k.varianceSKUs),      '#DC2626', '#FEE2E2', 'alert-triangle',   false, true) +
    kpiCard('Facilities',      fmtNum(k.facilitiesImpacted), '#0F2035', '#E0E7EF', 'map-pin',         false, true) +
    kpiCard('Users Impacted',  fmtNum(k.usersImpacted),     '#6C3483', '#EDE9F8', 'users',            false, true);
}

function _renderTrendChart(data) {
  var canvas = document.getElementById('chart-trend');
  if (!canvas) return;
  var trend = (data && data.trend) ? data.trend : [];
  if (!trend.length) {
    canvas.parentElement.innerHTML = emptyState('No trend data', 'No daily data available.');
    return;
  }
  if (_mtdCharts.trend) { _mtdCharts.trend.destroy(); _mtdCharts.trend = null; }

  // Clean date labels — strip timezone, just show "5 Jun"
  var labels = trend.map(function(d) {
    var lbl = d.dateLabel || d.date || '';
    // If it still has timezone info, parse and reformat
    if (lbl.length > 10) {
      try {
        var dt = new Date(lbl);
        if (!isNaN(dt.getTime())) {
          var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          lbl = dt.getDate() + ' ' + months[dt.getMonth()];
        }
      } catch(e) { lbl = lbl.substring(0, 10); }
    }
    return lbl;
  });

  _mtdCharts.trend = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Added',    data: trend.map(function(d){ return d.added   || 0; }), borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.07)',  tension: 0.35, fill: true,  pointRadius: 3, borderWidth: 2 },
        { label: 'Removed',  data: trend.map(function(d){ return d.removed || 0; }), borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.05)',   tension: 0.35, fill: true,  pointRadius: 3, borderWidth: 2 },
        { label: 'Variance', data: trend.map(function(d){ return d.variance|| 0; }), borderColor: '#2E86C1', backgroundColor: 'rgba(46,134,193,0.05)',  tension: 0.35, fill: false, pointRadius: 3, borderWidth: 2, borderDash: [4,3] },
      ]
    },
    options: _chartOpts()
  });
}

function _renderFacilityTypeChart(data) {
  var canvas = document.getElementById('chart-facility');
  if (!canvas) return;
  var rows = (data && data.facilityTypes) ? data.facilityTypes : [];
  if (!rows.length) {
    canvas.parentElement.innerHTML = emptyState('No facility type data', 'No MTD facility data found.');
    return;
  }
  if (_mtdCharts.facility) { _mtdCharts.facility.destroy(); _mtdCharts.facility = null; }
  _mtdCharts.facility = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map(function(f){ return f.name || f.facilityType || ''; }),
      datasets: [
        { label: 'Added',   data: rows.map(function(f){ return f.added   || 0; }), backgroundColor: 'rgba(5,150,105,0.75)',  borderRadius: 4 },
        { label: 'Removed', data: rows.map(function(f){ return f.removed || 0; }), backgroundColor: 'rgba(217,119,6,0.75)',  borderRadius: 4 },
      ]
    },
    options: _chartOpts()
  });
}

function _renderUserChart(data) {
  var canvas = document.getElementById('chart-user');
  if (!canvas) return;
  var rows = (data && data.users) ? data.users.slice(0, 10) : [];
  if (!rows.length) {
    canvas.parentElement.innerHTML = emptyState('No user data', 'No MTD user data found.');
    return;
  }
  if (_mtdCharts.user) { _mtdCharts.user.destroy(); _mtdCharts.user = null; }
  _mtdCharts.user = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: rows.map(function(u){ return u.name || ''; }),
      datasets: [{ label: '|Variance|', data: rows.map(function(u){ return Math.abs(u.variance || 0); }), backgroundColor: 'rgba(46,134,193,0.75)', borderRadius: 4 }]
    },
    options: Object.assign({}, _chartOpts(), { indexAxis: 'y' })
  });
}

function _renderMTDSKUTable(data) {
  var tbody = document.getElementById('mtd-sku-tbody');
  if (!tbody) return;
  var skus = (data && data.skus) ? data.skus : [];
  if (!skus.length) {
    tbody.innerHTML = '<tr><td colspan="5">' + emptyState('No SKU data', 'No MTD SKU data available.') + '</td></tr>';
    return;
  }
  tbody.innerHTML = skus.map(function(s) {
    // Backend may return 'item' or 'itemName' — handle both
    var itemName = s.itemName || s.item || '—';
    return '<tr>' +
      '<td><div class="sku-code">' + _esc(s.sku || '') + '</div></td>' +
      '<td class="wrap" style="max-width:200px;">' + _esc(itemName) + '</td>' +
      '<td class="num" style="color:var(--green)">+' + fmtNum(s.added) + '</td>' +
      '<td class="num" style="color:var(--orange)">' + fmtNum(s.removed) + '</td>' +
      '<td class="num">' + fmtVar(s.variance) + '</td>' +
      '</tr>';
  }).join('');
}

function _buildMTDDownload(data) {
  if (!data || !data.skus) return [];
  return data.skus.map(function(s) {
    return { SKU: s.sku, Item_Name: s.itemName || s.item || '', Added: s.added, Removed: s.removed, Variance: s.variance };
  });
}

function _chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { family: "'Inter',sans-serif", size: 11 }, boxWidth: 10, padding: 12, color: '#4B5563' } },
      tooltip: { backgroundColor: '#0F2035', titleFont: { family: "'Inter',sans-serif", size: 12 }, bodyFont: { family: "'Inter',sans-serif", size: 11 }, padding: 10, cornerRadius: 8 }
    },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: "'Inter',sans-serif", size: 10 }, color: '#9CA3AF', maxRotation: 0, maxTicksLimit: 12 } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: "'Inter',sans-serif", size: 10 }, color: '#9CA3AF' } }
    }
  };
}

function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
