// daily.js — V4 PATCHED
// Changes:
//   - Layout: [Brandwise Breakdown | Facility Summary] top row
//             [Top Variance SKUs] full width below
//   - REPLACE alert table: added Net Impact header, SKU shows code + item name
//   - Header renamed: "Breakdown" → "Brandwise Breakdown"

var _dailySortCol = '';
var _dailySortAsc = true;
var _dailyFacRows = [];
var _dailyFacView = 'type';

function renderDaily() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="daily-root"></div>';
  var root = document.getElementById('daily-root');
  var month = APP.currentMonth || '';

  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var yStr = yesterday.getFullYear() + '-' +
    String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
    String(yesterday.getDate()).padStart(2, '0');

  root.innerHTML =
    '<div class="page-header">' +
      '<div class="page-header-row">' +
        '<div><h2>Daily Tracker</h2><p id="daily-sub">Loading data for ' + yStr + '…</p></div>' +
      '</div>' +
    '</div>' +
    '<div id="replace-alert-wrap"></div>' +
    '<div class="kpi-strip" id="daily-kpi-row1">' + _kpiSkels(4) + '</div>' +
    '<div class="kpi-strip-2" id="daily-kpi-row2">' + _kpiSkels(4, true) + '</div>' +

    // TOP ROW: Brandwise Breakdown (left) | Facility Summary (right)
    '<div class="two-col">' +
      '<div class="card" id="card-breakdown">' +
        '<div class="card-header">' +
          '<span class="card-title">Brandwise Breakdown</span>' +
          '<div class="view-toggle-group">' +
            '<button class="view-toggle-btn active" id="bt-brand" onclick="_dailySwitchBreakdown(\'brand\')">Brand</button>' +
            '<button class="view-toggle-btn" id="bt-bu" onclick="_dailySwitchBreakdown(\'bu\')">Facility Type</button>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrap"><table><thead><tr>' +
          '<th id="breakdown-col-hdr">Brand</th>' +
          '<th style="text-align:right">Added</th><th style="text-align:right">Removed</th><th style="text-align:right">Net</th>' +
        '</tr></thead><tbody id="breakdown-tbody">' + skeletonRows(4, 4) + '</tbody></table></div>' +
      '</div>' +

      // Facility Summary (right side of top row)
      '<div class="card" id="card-facility">' +
        '<div class="card-header">' +
          '<span class="card-title">Facility Summary</span>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span class="card-badge" id="facility-count">—</span>' +
            '<div class="view-toggle-group">' +
              '<button class="view-toggle-btn active" id="fac-bt-type" onclick="_dailyFacToggle(\'type\')">By Type</button>' +
              '<button class="view-toggle-btn" id="fac-bt-detail" onclick="_dailyFacToggle(\'detail\')">Detail</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="table-wrap" id="facility-table-wrap"><table><tbody>' + skeletonRows(5, 6) + '</tbody></table></div>' +
      '</div>' +
    '</div>' +

    // BOTTOM ROW: Top Variance SKUs full width
    '<div class="card section-row" id="card-top-skus">' +
      '<div class="card-header"><span class="card-title">Top Variance SKUs</span><span class="card-badge" id="top-sku-badge">—</span></div>' +
      '<div class="table-wrap"><table><thead><tr>' +
        '<th style="width:45%">SKU / Item</th><th style="text-align:right">Added</th><th style="text-align:right">Removed</th><th style="text-align:right">Variance</th>' +
      '</tr></thead><tbody id="top-sku-tbody">' + skeletonRows(4, 6) + '</tbody></table></div>' +
    '</div>';

  var cacheKey = 'iamd_daily_' + (month || 'current');
  var cached = lsGet(cacheKey);
  var cacheValid = cached && cached.ts &&
    (Date.now() - cached.ts) < 5 * 60 * 1000 &&
    cached.data && cached.data.kpi && cached.data.kpi.date &&
    cached.data.skus && Array.isArray(cached.data.skus.skus) && cached.data.skus.skus.length > 0;

  if (cacheValid) {
    var cd = cached.data;
    document.getElementById('daily-sub').textContent = 'Showing adjustments for ' + (cd.kpi.dateFormatted || cd.kpi.date);
    _renderDailyKPIs(cd.kpi, cd.replace);
    _renderReplaceAlert(cd.replace);
    _renderBreakdown(cd.ft, 'brand');
    _renderTopSKUs(cd.skus);
    window._dailyFtData  = cd.ft;
    window._dailyFacData = cd.fac;
    _dailyFacView = 'type';
    _renderFacilityTable();
    APP._downloadRows = _buildDownloadRows(cd.kpi, cd.fac, cd.skus);
    setSyncLive(cd.kpi.date);
    _fetchDailyData(month, cacheKey, true);
    return;
  }
  if (cached) lsClear(cacheKey);
  setSyncIdle();
  _fetchDailyData(month, cacheKey, false);
}

function _fetchDailyData(month, cacheKey, silent) {
  Promise.all([
    apiGetDailyKPI({ month: month }),
    apiGetReplaceAlerts({ scope: 'DAILY', month: month }),
  ]).then(function(res1) {
    var data = { kpi: res1[0], replace: res1[1], skus: [], ft: {}, fac: {}, users: {} };
    _renderDailyKPIs(data.kpi, data.replace);
    _renderReplaceAlert(data.replace);
    if (data.kpi && data.kpi.date) {
      document.getElementById('daily-sub').textContent = 'Showing adjustments for ' + (data.kpi.dateFormatted || data.kpi.date);
    }
    setSyncLive(data.kpi && data.kpi.date);

    Promise.all([
      apiGetTopVarianceSKUs({ scope: 'DAILY', month: month }),
      apiGetFacilityTypeSummary({ scope: 'DAILY', month: month }),
      apiGetFacilitySummary({ scope: 'DAILY', month: month }),
      apiGetUserSummary({ scope: 'DAILY', month: month }),
    ]).then(function(res2) {
      data.skus  = res2[0];
      data.ft    = res2[1];
      data.fac   = res2[2];
      data.users = res2[3];
      if (data.kpi && data.skus && data.skus.skus && data.skus.skus.length > 0) {
        lsSet(cacheKey, { ts: Date.now(), data: data });
      }
      _renderBreakdown(data.ft, 'brand');
      _renderTopSKUs(data.skus);
      window._dailyFtData  = data.ft;
      window._dailyFacData = data.fac;
      _dailyFacView = 'type';
      _renderFacilityTable();
      APP._downloadRows = _buildDownloadRows(data.kpi, data.fac, data.skus);
    }).catch(function(e2) {
      console.error('Daily batch 2 error:', e2);
    });

  }).catch(function(e) {
    lsClear(cacheKey);
    if (!silent) {
      document.getElementById('daily-kpi-row1').innerHTML =
        '<div style="padding:32px;text-align:center;">' +
        '<p style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">Loading took too long</p>' +
        '<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">Apps Script is warming up. Usually resolves in a few seconds.</p>' +
        '<button class="btn-primary" onclick="lsClear(\'iamd_daily_current\');clearAPICache();navigate(\'daily\');" style="cursor:pointer;">' +
        'Try Again</button></div>';
      setSyncError();
    }
    console.error('Daily error:', e);
  });
}

function _kpiSkels(n, small) {
  var h = '';
  for (var i = 0; i < n; i++) {
    h += '<div class="kpi-card' + (small ? ' kpi-sm' : '') + '">' +
      '<div class="skeleton" style="height:10px;width:55%;margin-bottom:10px;"></div>' +
      '<div class="skeleton" style="height:26px;width:70%;"></div>' +
      '</div>';
  }
  return h;
}

function _renderDailyKPIs(data, replData) {
  var row1 = document.getElementById('daily-kpi-row1');
  var row2 = document.getElementById('daily-kpi-row2');
  if (!data || !data.kpi) {
    row1.innerHTML = emptyState('No KPI data', 'No data found for this date.');
    row2.innerHTML = '';
    return;
  }
  var k = data.kpi;
  var netV = parseInt(k.netVarianceQty) || 0;
  var netColor = netV === 0 ? '#059669' : (netV > 0 ? '#D97706' : '#DC2626');
  var netBg    = netV === 0 ? '#D1FAE5' : (netV > 0 ? '#FEF3C7' : '#FEE2E2');
  var replCount  = (replData && replData.count) ? replData.count : 0;
  var replNetQty = (replData && replData.items)
    ? replData.items.reduce(function(s, r) { return s + (r.replaceNetQty || 0); }, 0)
    : 0;

  row1.innerHTML =
    kpiCard('Total Events',    fmtNum(k.totalEvents),    '#2E86C1', '#DBEAFE', 'activity') +
    kpiCard('Total Added Qty', fmtNum(k.totalAddedQty),  '#059669', '#D1FAE5', 'plus-circle') +
    kpiCard('Total Removed',   fmtNum(k.totalRemovedQty),'#D97706', '#FEF3C7', 'minus-circle') +
    kpiCard('Net Variance',    (netV >= 0 ? '+' : '') + fmtNum(netV), netColor, netBg, 'trending-up', true);

  row2.innerHTML =
    kpiCard('Balanced SKUs',   fmtNum(k.balancedSKUs),   '#059669', '#D1FAE5', 'check-circle',   false, true) +
    kpiCard('Variance SKUs',   fmtNum(k.varianceSKUs),   '#DC2626', '#FEE2E2', 'alert-triangle',  false, true) +
    kpiCard('Facilities',      fmtNum(k.facilitiesImpacted), '#0F2035', '#E0E7EF', 'map-pin',     false, true) +
    kpiCard('REPLACE Net Impact',
      replNetQty !== 0 ? (replNetQty > 0 ? '+' : '') + fmtNum(replNetQty) : replCount + ' events',
      replCount > 0 ? '#DC2626' : '#059669',
      replCount > 0 ? '#FEE2E2' : '#D1FAE5',
      'alert-octagon', replNetQty !== 0, true);

  var badge = document.getElementById('badge-replace');
  if (badge) { badge.textContent = replCount; badge.style.display = replCount > 0 ? 'flex' : 'none'; }
}

function _formatAlertDate(d) {
  if (!d) return '';
  var s = String(d);
  if (s.length > 10) {
    try {
      var dt = new Date(s);
      if (!isNaN(dt.getTime())) {
        var mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return dt.getDate() + ' ' + mn[dt.getMonth()] + ' ' + dt.getFullYear();
      }
    } catch(e) {}
  }
  return s.substring(0, 10);
}

function _renderReplaceAlert(data) {
  var wrap = document.getElementById('replace-alert-wrap');
  if (!wrap) return;
  if (!data || !data.count || data.count === 0) { wrap.innerHTML = ''; return; }
  var rows = (data.items || []).map(function(r) {
    var netQty = r.replaceNetQty || 0;
    var netColor = netQty < 0 ? 'var(--red)' : 'var(--green)';
    return '<tr>' +
      '<td style="font-size:12px">' + _formatAlertDate(r.date) + '</td>' +
      '<td><strong>' + _esc(r.facility || '') + '</strong></td>' +
      '<td>' + _esc(r.username || '') + '</td>' +
      // SKU: code on top line, item name on second line
      '<td>' +
        '<code style="font-size:11px;background:var(--red-light);padding:1px 5px;border-radius:3px;color:var(--red-text);display:block;margin-bottom:2px;">' + _esc(r.sku || '') + '</code>' +
        '<span style="font-size:11px;color:var(--text-muted);">' + _esc(r.itemName || '') + '</span>' +
      '</td>' +
      '<td class="num" style="color:var(--green)">+' + fmtNum(r.addedQty) + '</td>' +
      '<td class="num" style="color:var(--orange)">' + fmtNum(r.removedQty) + '</td>' +
      '<td class="num" style="color:' + netColor + ';font-weight:700;">' +
        (netQty > 0 ? '+' : '') + fmtNum(netQty) +
      '</td>' +
      '</tr>';
  }).join('');

  wrap.innerHTML =
    '<div class="replace-alert">' +
      '<div class="replace-alert-header">' +
        '<div class="replace-alert-icon"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>' +
        '<div>' +
          '<p class="replace-alert-title">REPLACE Events Detected — Immediate Review Required</p>' +
          '<p class="replace-alert-sub">' + data.count + ' REPLACE adjustment' + (data.count > 1 ? 's' : '') + ' found. These require ops team review.</p>' +
        '</div>' +
      '</div>' +
      '<div class="replace-alert-table table-wrap" style="margin-top:10px;">' +
        '<table><thead><tr>' +
          '<th>Date</th>' +
          '<th>Facility</th>' +
          '<th>User</th>' +
          '<th>SKU / Item</th>' +
          '<th style="text-align:right">Added</th>' +
          '<th style="text-align:right">Removed</th>' +
          '<th style="text-align:right">Net Impact</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '</div>' +
    '</div>';
}

var _currentBreakdown = 'brand';
function _dailySwitchBreakdown(mode) {
  _currentBreakdown = mode;
  document.getElementById('bt-brand').classList.toggle('active', mode === 'brand');
  document.getElementById('bt-bu').classList.toggle('active', mode === 'bu');
  document.getElementById('breakdown-col-hdr').textContent = mode === 'brand' ? 'Brand' : 'Facility Type';
  _renderBreakdown(window._dailyFtData, mode);
}

function _renderBreakdown(ftData, mode) {
  var tbody = document.getElementById('breakdown-tbody');
  if (!tbody) return;
  var rows = [];
  if (mode === 'bu') {
    rows = (ftData && ftData.facilityTypes) ? ftData.facilityTypes : [];
  } else {
    rows = (ftData && ftData.brands) ? ftData.brands : [];
    if (!rows.length && ftData && ftData.facilityTypes) rows = ftData.facilityTypes;
  }
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4">' + emptyState('No data', '') + '</td></tr>'; return; }
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

function _renderTopSKUs(data) {
  var tbody = document.getElementById('top-sku-tbody');
  var badge = document.getElementById('top-sku-badge');
  if (!tbody) return;
  var skus = (data && data.skus) ? data.skus : [];
  if (badge) badge.textContent = skus.length + ' SKUs';
  if (!skus.length) {
    tbody.innerHTML = '<tr><td colspan="4">' + emptyState('No variance SKUs', 'All SKUs balanced today.') + '</td></tr>';
    return;
  }
  tbody.innerHTML = skus.map(function(s) {
    return '<tr>' +
      '<td style="max-width:320px">' +
        '<div class="sku-code">' + _esc(s.sku || '') + '</div>' +
        '<div class="sku-name" style="white-space:normal;line-height:1.3;">' + _esc(s.itemName || s.item || '') + '</div>' +
      '</td>' +
      '<td class="num" style="color:var(--green)">+' + fmtNum(s.added) + '</td>' +
      '<td class="num" style="color:var(--orange)">' + fmtNum(s.removed) + '</td>' +
      '<td class="num">' + fmtVar(s.variance) + '</td>' +
      '</tr>';
  }).join('');
}

function _dailyFacToggle(view) {
  _dailyFacView = view;
  document.getElementById('fac-bt-type').classList.toggle('active', view === 'type');
  document.getElementById('fac-bt-detail').classList.toggle('active', view === 'detail');
  _renderFacilityTable();
}

function _renderFacilityTable() {
  var wrap    = document.getElementById('facility-table-wrap');
  var countEl = document.getElementById('facility-count');
  if (!wrap) return;

  var rows;
  if (_dailyFacView === 'type') {
    rows = (window._dailyFtData && window._dailyFtData.facilityTypes) ? window._dailyFtData.facilityTypes : [];
  } else {
    rows = (window._dailyFacData && window._dailyFacData.facilities) ? window._dailyFacData.facilities : [];
  }

  _dailyFacRows = rows;
  if (countEl) countEl.textContent = rows.length + ' facilities';
  if (!rows.length) { wrap.innerHTML = emptyState('No facility data', ''); return; }

  var hdr = _dailyFacView === 'type'
    ? '<th onclick="_sortFacility(\'name\')">Type</th>'
    : '<th onclick="_sortFacility(\'name\')">Facility</th>';

  var tbody = rows.map(function(f) {
    var net = f.variance !== undefined ? f.variance : (f.added || 0) - (f.removed || 0);
    var netCls = net > 0 ? 'variance-pos' : net < 0 ? 'variance-neg' : 'variance-zero';
    return '<tr>' +
      '<td>' +
        '<div>' + _esc(f.name || f.facilityType || '') + '</div>' +
        (_dailyFacView === 'detail' && f.facilityType
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
    '<th onclick="_sortFacility(\'added\')" style="text-align:right">Added</th>' +
    '<th onclick="_sortFacility(\'removed\')" style="text-align:right">Removed</th>' +
    '<th onclick="_sortFacility(\'variance\')" style="text-align:right">Net</th>' +
    '<th onclick="_sortFacility(\'events\')" style="text-align:right">Events</th>' +
    '</tr></thead><tbody>' + tbody + '</tbody></table>';
}

function _sortFacility(col) {
  if (_dailySortCol === col) { _dailySortAsc = !_dailySortAsc; }
  else { _dailySortCol = col; _dailySortAsc = false; }
  var sign = _dailySortAsc ? 1 : -1;
  var rows = _dailyFacView === 'type'
    ? ((window._dailyFtData && window._dailyFtData.facilityTypes) || [])
    : ((window._dailyFacData && window._dailyFacData.facilities) || []);
  rows.sort(function(a, b) {
    var va = a[col] || a.name || 0;
    var vb = b[col] || b.name || 0;
    if (typeof va === 'string') return sign * va.localeCompare(vb);
    return sign * ((parseFloat(va) || 0) - (parseFloat(vb) || 0));
  });
  if (_dailyFacView === 'type') { if (window._dailyFtData) window._dailyFtData.facilityTypes = rows; }
  else { if (window._dailyFacData) window._dailyFacData.facilities = rows; }
  _renderFacilityTable();
}

function _buildDownloadRows(kpiData, facData, skuData) {
  var rows = [];
  if (facData && facData.facilities) {
    facData.facilities.forEach(function(f) {
      rows.push({
        Facility: f.name, Type: f.facilityType || '',
        Added: f.added || 0, Removed: f.removed || 0,
        Variance: f.variance || 0, Events: f.events || 0
      });
    });
  }
  return rows;
}
