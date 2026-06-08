// ============================================================
// daily.js — Daily Tracker Module
// ============================================================

function renderDaily() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="daily-root"></div>';
  var root = document.getElementById('daily-root');

  root.innerHTML =
    '<div class="page-header">' +
      '<div class="page-header-row">' +
        '<div><h2>Daily Tracker</h2><p id="daily-date-sub">Loading last available date...</p></div>' +
      '</div>' +
    '</div>' +
    '<div class="kpi-grid" id="daily-kpi-grid">' + _kpiSkeletons(8) + '</div>' +
    '<div class="two-col">' +
      '<div class="card section-row" id="daily-top-skus"><div class="card-header"><span class="card-title">Top Variance SKUs</span></div><div class="card-body"><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Item</th><th>Added</th><th>Removed</th><th>Variance</th></tr></thead><tbody>' + skeletonRows(5,5) + '</tbody></table></div></div></div>' +
      '<div class="card section-row" id="daily-facility"><div class="card-header"><span class="card-title">Facility Summary</span></div><div class="card-body"><div class="table-wrap"><table><thead><tr><th>Facility</th><th>Added</th><th>Removed</th><th>Variance</th><th>Events</th></tr></thead><tbody>' + skeletonRows(5,5) + '</tbody></table></div></div></div>' +
    '</div>' +
    '<div class="card section-row" id="daily-users"><div class="card-header"><span class="card-title">User Summary</span></div><div class="card-body"><div class="table-wrap"><table><thead><tr><th>Username</th><th>Added Qty</th><th>Removed Qty</th><th>Variance</th><th>Events</th></tr></thead><tbody>' + skeletonRows(5,5) + '</tbody></table></div></div></div>';

  var month = APP.currentMonth || '';

  Promise.all([
    apiGetDailyKPI({ month: month }),
    apiGetFacilitySummary({ scope: 'DAILY', month: month }),
    apiGetUserSummary({ scope: 'DAILY', month: month }),
    apiGetTopVarianceSKUs({ scope: 'DAILY', month: month }),
  ]).then(function(results) {
    var kpiData = results[0]; var facData = results[1];
    var usrData = results[2]; var skuData = results[3];

    _renderDailyKPIs(kpiData);
    _renderTopSKUs(skuData);
    _renderFacilitySummary(facData);
    _renderUserSummary(usrData);

    if (kpiData && kpiData.date) {
      document.getElementById('daily-date-sub').textContent = 'Showing data for ' + (kpiData.dateFormatted || kpiData.date);
    }
    var varCount = kpiData && kpiData.kpi ? kpiData.kpi.varianceSKUs : 0;
    var badge = document.getElementById('badge-variance');
    if (varCount > 0) { badge.textContent = varCount; badge.style.display = 'flex'; }

  }).catch(function(e) {
    document.getElementById('daily-kpi-grid').innerHTML = emptyState('No data available', 'Run a manual processing cycle or wait for the 8 AM trigger.');
    console.error('Daily tracker error:', e);
  });
}

function _renderDailyKPIs(data) {
  var grid = document.getElementById('daily-kpi-grid');
  if (!data || !data.kpi) {
    grid.innerHTML = emptyState('No data', 'No daily KPI data found for this period.');
    return;
  }
  var k = data.kpi;
  var netV = parseInt(k.netVarianceQty) || 0;
  var netColor = netV === 0 ? '#059669' : (netV > 0 ? '#D97706' : '#DC2626');
  var netBg    = netV === 0 ? '#D1FAE5' : (netV > 0 ? '#FEF3C7' : '#FEE2E2');
  var netStr   = (netV >= 0 ? '+' : '') + fmtNum(netV);

  grid.innerHTML =
    kpiCard('Total Events',       fmtNum(k.totalEvents),        '#2E86C1', '#DBEAFE', 'activity') +
    kpiCard('Total Added Qty',    fmtNum(k.totalAddedQty),      '#059669', '#D1FAE5', 'plus-circle') +
    kpiCard('Total Removed Qty',  fmtNum(k.totalRemovedQty),    '#D97706', '#FEF3C7', 'minus-circle') +
    kpiCard('Net Variance',       netStr,                        netColor,  netBg,    'trending-up', true) +
    kpiCard('Balanced SKUs',      fmtNum(k.balancedSKUs),       '#059669', '#D1FAE5', 'check-circle') +
    kpiCard('Variance SKUs',      fmtNum(k.varianceSKUs),       '#DC2626', '#FEE2E2', 'alert-triangle') +
    kpiCard('Facilities Impacted',fmtNum(k.facilitiesImpacted), '#0F2035', '#E0E7EF', 'map-pin') +
    kpiCard('Users Impacted',     fmtNum(k.usersImpacted),      '#6C3483', '#EDE9F8', 'users');
}

function _renderTopSKUs(data) {
  var card = document.getElementById('daily-top-skus');
  var tbody = card.querySelector('tbody');
  var skus = data && data.skus ? data.skus : [];
  if (!skus.length) { tbody.innerHTML = '<tr><td colspan="5">' + emptyState('No variance SKUs','All SKUs balanced today.') + '</td></tr>'; return; }
  tbody.innerHTML = skus.map(function(s) {
    return '<tr><td><strong>'+s.sku+'</strong></td><td class="wrap">'+s.itemName+'</td>' +
      '<td style="color:var(--green);font-weight:600;">'+fmtNum(s.added)+'</td>' +
      '<td style="color:var(--orange);font-weight:600;">'+fmtNum(s.removed)+'</td>' +
      '<td>'+fmtVar(s.variance)+'</td></tr>';
  }).join('');
  card.querySelector('.card-title').innerHTML = 'Top Variance SKUs <span class="card-badge">'+skus.length+'</span>';
}

function _renderFacilitySummary(data) {
  var card = document.getElementById('daily-facility');
  var tbody = card.querySelector('tbody');
  var rows = data && data.facilities ? data.facilities : [];
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5">'+emptyState('No data','No facility data available.')+'</td></tr>'; return; }
  tbody.innerHTML = rows.map(function(f) {
    return '<tr><td><strong>'+f.name+'</strong></td>' +
      '<td style="color:var(--green);">'+fmtNum(f.added)+'</td>' +
      '<td style="color:var(--orange);">'+fmtNum(f.removed)+'</td>' +
      '<td>'+fmtVar(f.variance)+'</td>' +
      '<td>'+fmtNum(f.events)+'</td></tr>';
  }).join('');
}

function _renderUserSummary(data) {
  var card = document.getElementById('daily-users');
  var tbody = card.querySelector('tbody');
  var rows = data && data.users ? data.users : [];
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5">'+emptyState('No data','No user data available.')+'</td></tr>'; return; }
  tbody.innerHTML = rows.slice(0,20).map(function(u) {
    return '<tr><td><strong>'+u.name+'</strong></td>' +
      '<td style="color:var(--green);">'+fmtNum(u.added)+'</td>' +
      '<td style="color:var(--orange);">'+fmtNum(u.removed)+'</td>' +
      '<td>'+fmtVar(u.variance)+'</td>' +
      '<td>'+fmtNum(u.events)+'</td></tr>';
  }).join('');
}

function _kpiSkeletons(n) {
  var html = '';
  for (var i = 0; i < n; i++) {
    html += '<div class="kpi-card"><div class="skeleton" style="height:11px;width:60%;margin-bottom:12px;"></div><div class="skeleton" style="height:28px;width:80%;"></div></div>';
  }
  return html;
}

function kpiCard(label, value, color, bg, icon, accent) {
  var icons = {
    'activity':       '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    'plus-circle':    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    'minus-circle':   '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
    'trending-up':    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    'check-circle':   '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'map-pin':        '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
    'users':          '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  };
  return '<div class="kpi-card" style="--kpi-color:'+color+';--kpi-bg:'+bg+'">' +
    '<div class="kpi-label">'+label+'</div>' +
    '<div class="kpi-value'+(accent?' accent':'')+'">'+value+'</div>' +
    '<div class="kpi-icon"><svg viewBox="0 0 24 24">'+(icons[icon]||'')+'</svg></div>' +
    '</div>';
}
