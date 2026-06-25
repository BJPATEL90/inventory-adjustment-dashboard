// mtd.js — V4 PATCHED
// Changes:
//   - Top 10 Users: replaced horizontal bar chart with Username | Variance table
//   - Added Brandwise Breakdown + Facility Summary tables below charts
//   - Both tables have same Brand/Facility Type toggle as Daily Tracker

var _mtdCharts = {};
var _mtdFtData  = null;
var _mtdFacData = null;
var _mtdBreakdownMode = 'brand';
var _mtdFacView = 'type';

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

    // Trend chart — full width
    '<div class="card section-row">' +
      '<div class="card-header"><span class="card-title">Daily Trend — Added / Removed / Variance</span></div>' +
      '<div class="chart-wrap"><div class="chart-canvas" style="height:220px;"><canvas id="chart-trend"></canvas></div></div>' +
    '</div>' +

    // Charts row: Facility Type chart (left) | Top 10 Users TABLE (right)
    '<div class="chart-grid">' +
      '<div class="card">' +
        '<div class="card-header"><span class="card-title">Facility Type</span></div>' +
        '<div class="chart-wrap"><div class="chart-canvas" style="height:200px;"><canvas id="chart-facility"></canvas></div></div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header"><span class="card-title">Top 10 Users by Variance</span></div>' +
        '<div class="table-wrap" id="mtd-user-table-wrap">' +
          '<table><thead><tr>' +
            '<th>Username</th>' +
            '<th style="text-align:right">Variance Qty</th>' +
          '</tr></thead>' +
          '<tbody id="mtd-user-tbody">' + skeletonRows(2, 8) + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── NEW: Brandwise Breakdown + Facility Summary tables ──
    '<div class="two-col section-row">' +
      // Brandwise Breakdown
      '<div class="card" id="mtd-card-breakdown">' +
        '<div class="card-header">' +
          '<span class="card-title">Brandwise Breakdown</span>' +
          '<div class="view-toggle-group">' +
            '<button class="view-toggle-btn active" id="mtd-bt-brand" onclick="_mtdSwitchBreakdown(\'brand\')">Brand</button>' +
            '<button class="view-toggle-btn" id="mtd-bt-bu" onclick="_mtdSwitchBreakdown(\'bu\')">Facility Type</button>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrap"><table><thead><tr>' +
          '<th id="mtd-breakdown-col-hdr">Brand</th>' +
          '<th style="text-align:right">Added</th>' +
          '<th style="text-align:right">Removed</th>' +
          '<th style="text-align:right">Net</th>' +
        '</tr></thead><tbody id="mtd-breakdown-tbody">' + skeletonRows(4, 4) + '</tbody></table></div>' +
      '</div>' +
      // Facility Summary
      '<div class="card" id="mtd-card-facility">' +
        '<div class="card-header">' +
          '<span class="card-title">Facility Summary</span>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span class="card-badge" id="mtd-facility-count">—</span>' +
            '<div class="view-toggle-group">' +
              '<button class="view-toggle-btn active" id="mtd-fac-bt-type" onclick="_mtdFacToggle(\'type\')">By Type</button>' +
              '<button class="view-toggle-btn" id="mtd-fac-bt-detail" onclick="_mtdFacToggle(\'detail\')">Detail</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrap" id="mtd-facility-table-wrap">' +
          '<table><tbody>' + skeletonRows(5, 6) + '</tbody></table>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // MTD Top SKUs — full width
    '<div class="card section-row">' +
      '<div class="card-header">' +
        '<span class="card-title">MTD Top SKUs by Variance</span>' +
        '<span class="card-badge">Top 20</span>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table><thead><tr>' +
            '<th style="width:30%">SKU / Item</th>' +
            '<th style="text-align:right">Added</th>' +
            '<th style="text-align:right">Removed</th>' +
            '<th style="text-align:right">Variance</th>'
        '</tr></thead>' +
        '<tbody id="mtd-sku-tbody">' + skeletonRows(5, 8) + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';

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
    apiGetFacilitySummary({ scope: 'MTD', month: month }),
  ]).then(function(res) {
    var data = {
      mtd: res[0], trend: res[1], ft: res[2],
      users: res[3], skus: res[4], fac: res[5]
    };
    lsSet(cacheKey, { ts: Date.now(), data: data });
    _renderMTDAll(data);
    setSyncLive(data.mtd && data.mtd.month);
  }).catch(function(e) {
    lsClear(cacheKey);
    if (!silent) {
      document.getElementById('mtd-root').innerHTML =
        '<div style="padding:32px;text-align:center;">' +
        '<p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Loading took too long</p>' +
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Apps Script is warming up. Click to retry.</p>' +
        '<button class="btn-primary" onclick="lsClear(\'iamd_mtd_current\');clearAPICache();navigate(\'mtd\');" style="cursor:pointer;">' +
        'Try Again</button></div>';
      setSyncError();
    }
    console.error('MTD error:', e);
  });
}

function _renderMTDAll(data) {
  _renderMTDKPIs(data.mtd);
  _renderTrendChart(data.trend);
  _renderFacilityTypeChart(data.ft);
  _renderUserTable(data.users);        // table instead of chart
  _renderMTDBreakdown(data.ft, 'brand');
  _mtdFtData  = data.ft;
  _mtdFacData = data.fac;
  _mtdFacView = 'type';
  _mtdBreakdownMode = 'brand';
  _renderMTDFacilityTable();
  _renderMTDSKUTable(data.skus);

  if (data.mtd && data.mtd.monthDisplay) {
    var el = document.getElementById('mtd-period-sub');
    if (el) el.textContent = 'Month-to-Date — ' + data.mtd.monthDisplay;
  }
  APP._downloadRows = _buildMTDDownload(data.ft, data.users, data.skus);
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
    kpiCard('MTD Events',    fmtNum(k.totalEvents),    '#2E86C1', '#DBEAFE', 'activity') +
    kpiCard('Total Added',   fmtNum(k.totalAddedQty),  '#059669', '#D1FAE5', 'plus-circle') +
    kpiCard('Total Removed', fmtNum(k.totalRemovedQty),'#D97706', '#FEF3C7', 'minus-circle') +
    kpiCard('Net Variance',  (netV >= 0 ? '+' : '') + fmtNum(netV), netColor, netBg, 'trending-up', true);

  var replCount  = k.replaceCount  || 0;
  var replNetQty = k.replaceNetQty || 0;
  if (row2) row2.innerHTML =
    kpiCard('Balanced SKUs',  fmtNum(k.balancedSKUs),       '#059669', '#D1FAE5', 'check-circle',  false, true) +
    kpiCard('Variance SKUs',  fmtNum(k.varianceSKUs),       '#DC2626', '#FEE2E2', 'alert-triangle', false, true) +
    kpiCard('Facilities',     fmtNum(k.facilitiesImpacted), '#0F2035', '#E0E7EF', 'map-pin',        false, true) +
    kpiCard('REPLACE Net Impact',
      replCount > 0 ? (replNetQty !== 0 ? (replNetQty>0?'+':'') + fmtNum(replNetQty) : replCount + ' events') : '0',
      replCount > 0 ? '#DC2626' : '#059669',
      replCount > 0 ? '#FEE2E2' : '#D1FAE5',
      'alert-octagon', replNetQty !== 0, true);
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

  var labels = trend.map(function(d) {
    var lbl = d.dateLabel || d.date || '';
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

// ── Top 10 Users: TABLE instead of chart ─────────────────────
function _renderUserTable(data) {
  var tbody = document.getElementById('mtd-user-tbody');
  if (!tbody) return;
  var users = (data && data.users) ? data.users.slice(0, 10) : [];
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="2">' + emptyState('No user data', '') + '</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(function(u, idx) {
    var name = u.name || '';
    // Trim email — show only part before @
    var atIdx = name.indexOf('@');
    if (atIdx > 0) name = name.substring(0, atIdx);
    var vQty = parseInt(u.variance) || 0;
    var vStr = (vQty >= 0 ? '+' : '') + fmtNum(Math.abs(vQty));
    var vColor = vQty > 0 ? 'var(--orange)' : vQty < 0 ? 'var(--red, #DC2626)' : 'var(--text-muted)';
    return '<tr>' +
      '<td style="font-size:13px;">' +
        '<span style="color:var(--text-muted);font-size:11px;margin-right:6px;">' + (idx + 1) + '</span>' +
        _esc(name) +
      '</td>' +
      '<td style="text-align:right;font-weight:600;color:' + vColor + ';">' + vStr + '</td>' +
      '</tr>';
  }).join('');
}

// ── Brandwise Breakdown table ─────────────────────────────────
function _mtdSwitchBreakdown(mode) {
  _mtdBreakdownMode = mode;
  var brandBtn = document.getElementById('mtd-bt-brand');
  var buBtn    = document.getElementById('mtd-bt-bu');
  var hdr      = document.getElementById('mtd-breakdown-col-hdr');
  if (brandBtn) brandBtn.classList.toggle('active', mode === 'brand');
  if (buBtn)    buBtn.classList.toggle('active', mode === 'bu');
  if (hdr)      hdr.textContent = mode === 'brand' ? 'Brand' : 'Facility Type';
  _renderMTDBreakdown(_mtdFtData, mode);
}

function _renderMTDBreakdown(ftData, mode) {
  var tbody = document.getElementById('mtd-breakdown-tbody');
  if (!tbody) return;
  var rows = [];
  if (mode === 'bu') {
    rows = (ftData && ftData.facilityTypes) ? ftData.facilityTypes : [];
  } else {
    rows = (ftData && ftData.brands) ? ftData.brands : [];
    if (!rows.length && ftData && ftData.facilityTypes) rows = ftData.facilityTypes;
  }
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4">' + emptyState('No data', '') + '</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(r) {
    var net = (r.added || 0) - (r.removed || 0);
    var cls = net > 0 ? 'variance-pos' : net < 0 ? 'variance-neg' : 'variance-zero';
    return '<tr>' +
      '<td><span class="badge badge-blue">' + _esc(r.name || r.brand || r.facilityType || '—') + '</span></td>' +
      '<td class="num" style="color:var(--green)">+' + fmtNum(r.added) + '</td>' +
      '<td class="num" style="color:var(--orange)">' + fmtNum(r.removed) + '</td>' +
      '<td class="num"><span class="' + cls + '">' + (net >= 0 ? '+' : '') + fmtNum(net) + '</span></td>' +
      '</tr>';
  }).join('');
}

// ── Facility Summary table ─────────────────────────────────────
function _mtdFacToggle(view) {
  _mtdFacView = view;
  var typeBtn   = document.getElementById('mtd-fac-bt-type');
  var detailBtn = document.getElementById('mtd-fac-bt-detail');
  if (typeBtn)   typeBtn.classList.toggle('active', view === 'type');
  if (detailBtn) detailBtn.classList.toggle('active', view === 'detail');
  _renderMTDFacilityTable();
}

function _renderMTDFacilityTable() {
  var wrap    = document.getElementById('mtd-facility-table-wrap');
  var countEl = document.getElementById('mtd-facility-count');
  if (!wrap) return;

  var rows;
  if (_mtdFacView === 'type') {
    rows = (_mtdFtData && _mtdFtData.facilityTypes) ? _mtdFtData.facilityTypes : [];
  } else {
    rows = (_mtdFacData && _mtdFacData.facilities) ? _mtdFacData.facilities : [];
  }

  if (countEl) countEl.textContent = rows.length + ' facilities';
  if (!rows.length) { wrap.innerHTML = emptyState('No facility data', ''); return; }

  var hdr = _mtdFacView === 'type' ? '<th>Type</th>' : '<th>Facility</th>';
  var tbody = rows.map(function(f) {
    var net = f.variance !== undefined ? f.variance : (f.added || 0) - (f.removed || 0);
    var netCls = net > 0 ? 'variance-pos' : net < 0 ? 'variance-neg' : 'variance-zero';
    return '<tr>' +
      '<td>' +
        '<div>' + _esc(f.name || f.facilityType || '') + '</div>' +
        (_mtdFacView === 'detail' && f.facilityType
          ? '<span class="fac-type-pill">' + _esc(f.facilityType) + '</span>' : '') +
      '</td>' +
      '<td class="num" style="color:var(--green)">+' + fmtNum(f.added) + '</td>' +
      '<td class="num" style="color:var(--orange)">' + fmtNum(f.removed) + '</td>' +
      '<td class="num"><span class="' + netCls + '">' + (net >= 0 ? '+' : '') + fmtNum(net) + '</span></td>' +
      '<td class="num">' + fmtNum(f.events) + '</td>' +
      '</tr>';
  }).join('');

  wrap.innerHTML =
    '<table><thead><tr>' + hdr +
    '<th style="text-align:right">Added</th>' +
    '<th style="text-align:right">Removed</th>' +
    '<th style="text-align:right">Net</th>' +
    '<th style="text-align:right">Events</th>' +
    '</tr></thead><tbody>' + tbody + '</tbody></table>';
}

// ── MTD Top SKUs ──────────────────────────────────────────────
function _renderMTDSKUTable(data) {
  var tbody = document.getElementById('mtd-sku-tbody');
  if (!tbody) return;
  var skus = (data && data.skus) ? data.skus : [];
  if (!skus.length) {
    tbody.innerHTML = '<tr><td colspan="5">' + emptyState('No SKU data', 'No MTD SKU data available.') + '</td></tr>';
    return;
  }
  tbody.innerHTML = skus.map(function(s) {
    var itemName = s.itemName || s.item || '—';
    return '<tr>' +
        '<td style="max-width:280px">' +
          '<div class="sku-code">' + _esc(s.sku || '') + '</div>' +
          '<div class="sku-name" style="white-space:normal;line-height:1.3;">' + _esc(itemName) + '</div>' +
        '</td>' +
      '<td class="num" style="color:var(--green)">+' + fmtNum(s.added) + '</td>' +
      '<td class="num" style="color:var(--orange)">' + fmtNum(s.removed) + '</td>' +
      '<td class="num">' + fmtVar(s.variance) + '</td>' +
      '</tr>';
  }).join('');
}

function _buildMTDDownload(ftData, usrData, skuData) {
  var sections = [];
  if (ftData && ftData.facilityTypes && ftData.facilityTypes.length) {
    sections.push({
      title: 'Facility Type Summary (MTD)',
      rows: ftData.facilityTypes.map(function(f) {
        return { Facility_Type: f.name || '', Added: f.added || 0, Removed: f.removed || 0, Variance: f.variance || 0, Events: f.events || 0 };
      })
    });
  }
  if (usrData && usrData.users && usrData.users.length) {
    sections.push({
      title: 'User Summary (MTD)',
      rows: usrData.users.map(function(u) {
        var name = u.name || '';
        var at = name.indexOf('@');
        if (at > 0) name = name.substring(0, at);
        return { Username: name, Variance_Qty: u.variance || 0, Events: u.events || 0 };
      })
    });
  }
  if (skuData && skuData.skus && skuData.skus.length) {
    sections.push({
      title: 'MTD Top SKUs by Variance',
      rows: skuData.skus.map(function(s) {
        return { SKU: s.sku, Item_Name: s.itemName || s.item || '', Added: s.added, Removed: s.removed, Variance: s.variance };
      })
    });
  }
  return sections;
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
