// daily.js — V2: REPLACE alert banner, facility type bucketing, DM Sans KPI font

function renderDaily() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="daily-root"></div>';
  var root = document.getElementById('daily-root');
  var month = APP.currentMonth || '';

  root.innerHTML =
    '<div class="page-header"><div class="page-header-row"><div>' +
    '<h2>Daily Tracker</h2><p id="daily-date-sub">Loading last available date...</p></div></div></div>' +
    '<div id="replace-alert-wrap"></div>' +
    '<div class="kpi-grid" id="daily-kpi-grid">'+_skels(8)+'</div>' +
    '<div class="two-col section-row">' +
      '<div class="card" id="daily-top-skus"><div class="card-header"><span class="card-title">Top Variance SKUs</span></div><div class="card-body"><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Item</th><th>Added</th><th>Removed</th><th>Variance</th></tr></thead><tbody>'+skeletonRows(5,5)+'</tbody></table></div></div></div>' +
      '<div class="card" id="daily-facility"><div class="card-header"><span class="card-title">Facility Summary</span><span id="fac-toggle-btns"></span></div><div class="card-body" id="facility-body"></div></div>' +
    '</div>' +
    '<div class="card section-row" id="daily-users"><div class="card-header"><span class="card-title">User Summary</span></div><div class="card-body"><div class="table-wrap"><table><thead><tr><th>Username</th><th>Added Qty</th><th>Removed Qty</th><th>Variance</th><th>Events</th></tr></thead><tbody>'+skeletonRows(5,5)+'</tbody></table></div></div></div>';

  Promise.all([
    apiGetDailyKPI({ month: month }),
    apiGetReplaceAlerts({ scope: 'DAILY', month: month }),
    apiGetTopVarianceSKUs({ scope: 'DAILY', month: month }),
    apiGetFacilityTypeSummary({ scope: 'DAILY', month: month }),
    apiGetFacilitySummary({ scope: 'DAILY', month: month }),
    apiGetUserSummary({ scope: 'DAILY', month: month }),
  ]).then(function(res) {
    var kpiData=res[0]; var replData=res[1]; var skuData=res[2];
    var ftData=res[3];  var facData=res[4]; var usrData=res[5];

    if (kpiData&&kpiData.date) document.getElementById('daily-date-sub').textContent='Showing data for '+(kpiData.dateFormatted||kpiData.date);
    _renderDailyKPIs(kpiData);
    _renderReplaceAlert(replData);
    _renderTopSKUs(skuData);
    _renderFacilitySection(ftData, facData);
    _renderUserSummary(usrData);

    var varCount = kpiData&&kpiData.kpi ? kpiData.kpi.varianceSKUs : 0;
    var badge = document.getElementById('badge-variance');
    if (badge && varCount > 0) { badge.textContent = varCount; badge.style.display = 'flex'; }
  }).catch(function(e) {
    document.getElementById('daily-kpi-grid').innerHTML = emptyState('No data available','Run reprocessFromGmailToday() in Apps Script.');
    console.error('Daily error:', e);
  });
}

function _skels(n) {
  var h=''; for(var i=0;i<n;i++) h+='<div class="kpi-card"><div class="skeleton" style="height:11px;width:60%;margin-bottom:12px;"></div><div class="skeleton" style="height:28px;width:75%;"></div></div>'; return h;
}

function _renderDailyKPIs(data) {
  var grid = document.getElementById('daily-kpi-grid');
  if (!data||!data.kpi) { grid.innerHTML=emptyState('No data','No KPI data found.'); return; }
  var k = data.kpi;
  var netV=parseInt(k.netVarianceQty)||0;
  var netColor=netV===0?'#059669':(netV>0?'#D97706':'#DC2626');
  var netBg   =netV===0?'#D1FAE5':(netV>0?'#FEF3C7':'#FEE2E2');
  grid.innerHTML =
    kpiCard('Total Events',      fmtNum(k.totalEvents),       '#2E86C1','#DBEAFE','activity') +
    kpiCard('Total Added Qty',   fmtNum(k.totalAddedQty),     '#059669','#D1FAE5','plus-circle') +
    kpiCard('Total Removed Qty', fmtNum(k.totalRemovedQty),   '#D97706','#FEF3C7','minus-circle') +
    kpiCard('Net Variance',      (netV>=0?'+':'')+fmtNum(netV), netColor, netBg,'trending-up', true) +
    kpiCard('Balanced SKUs',     fmtNum(k.balancedSKUs),      '#059669','#D1FAE5','check-circle') +
    kpiCard('Variance SKUs',     fmtNum(k.varianceSKUs),      '#DC2626','#FEE2E2','alert-triangle') +
    kpiCard('Facilities',        fmtNum(k.facilitiesImpacted),'#0F2035','#E0E7EF','map-pin') +
    kpiCard('Users Impacted',    fmtNum(k.usersImpacted),     '#6C3483','#EDE9F8','users');
}

function _renderReplaceAlert(data) {
  var wrap = document.getElementById('replace-alert-wrap');
  if (!data||!data.count||data.count===0) { wrap.innerHTML=''; return; }
  var rows = (data.items||[]).map(function(r) {
    return '<tr><td>'+r.date+'</td><td><strong>'+r.facility+'</strong></td><td>'+r.username+'</td>' +
      '<td><code style="font-size:11px;background:#FEE2E2;padding:2px 6px;border-radius:4px;color:#991B1B;">'+r.sku+'</code></td>' +
      '<td class="wrap">'+r.itemName+'</td>' +
      '<td style="color:var(--green);font-weight:600;">'+fmtNum(r.addedQty)+'</td>' +
      '<td style="color:var(--orange);font-weight:600;">'+fmtNum(r.removedQty)+'</td></tr>';
  }).join('');
  wrap.innerHTML =
    '<div class="replace-alert-banner">' +
      '<div class="replace-alert-header">' +
        '<svg viewBox="0 0 24 24" style="width:20px;height:20px;color:#991B1B;flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<div>' +
          '<p class="replace-alert-title">⚠️ REPLACE Events Detected — Immediate Attention Required</p>' +
          '<p class="replace-alert-sub">'+data.count+' REPLACE adjustment'+(data.count>1?'s':'')+' found today. These should not happen under normal operations.</p>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap" style="margin-top:12px;">' +
        '<table><thead><tr><th>Date</th><th>Facility</th><th>Username</th><th>SKU</th><th>Item</th><th>Added</th><th>Removed</th></tr></thead>' +
        '<tbody>'+rows+'</tbody></table>' +
      '</div>' +
    '</div>';
}

function _renderTopSKUs(data) {
  var card = document.getElementById('daily-top-skus');
  var tbody = card.querySelector('tbody');
  var skus = data&&data.skus ? data.skus : [];
  if (!skus.length) { tbody.innerHTML='<tr><td colspan="5">'+emptyState('No variance SKUs','All SKUs balanced today.')+'</td></tr>'; return; }
  tbody.innerHTML = skus.map(function(s) {
    return '<tr><td><code style="font-size:11px;background:var(--canvas);padding:2px 6px;border-radius:4px;">'+s.sku+'</code></td>' +
      '<td class="wrap">'+s.itemName+'</td>' +
      '<td style="color:var(--green);font-weight:600;">'+fmtNum(s.added)+'</td>' +
      '<td style="color:var(--orange);font-weight:600;">'+fmtNum(s.removed)+'</td>' +
      '<td>'+fmtVar(s.variance)+'</td></tr>';
  }).join('');
  card.querySelector('.card-title').innerHTML='Top Variance SKUs <span class="card-badge">'+skus.length+'</span>';
}

// Facility section: bucketed + detailed with toggle
var _facView = 'type'; // 'type' or 'detail'
function _renderFacilitySection(ftData, facData) {
  var body = document.getElementById('facility-body');
  var toggleBtns = document.getElementById('fac-toggle-btns');
  toggleBtns.innerHTML =
    '<div class="view-toggle-group">' +
    '<button class="view-toggle-btn'+ (_facView==='type'?' active':'') +'" onclick="switchFacView(\'type\')">By Type</button>' +
    '<button class="view-toggle-btn'+ (_facView==='detail'?' active':'') +'" onclick="switchFacView(\'detail\')">Detail</button>' +
    '</div>';

  window._ftData  = ftData;
  window._facData = facData;
  _renderActiveFacView(body);
}

function switchFacView(view) {
  _facView = view;
  var body = document.getElementById('facility-body');
  var btns = document.querySelectorAll('.view-toggle-btn');
  btns.forEach(function(b) { b.classList.toggle('active', b.textContent.toLowerCase().indexOf(view) >= 0); });
  _renderActiveFacView(body);
}

function _renderActiveFacView(body) {
  var rows;
  if (_facView === 'type') {
    var data = window._ftData && window._ftData.facilityTypes ? window._ftData.facilityTypes : [];
    if (!data.length) { body.innerHTML = emptyState('No data','No facility type data.'); return; }
    rows = data.map(function(f) {
      return '<tr><td><span class="badge badge-blue">'+f.name+'</span></td>' +
        '<td style="color:var(--green);font-weight:600;">'+fmtNum(f.added)+'</td>' +
        '<td style="color:var(--orange);font-weight:600;">'+fmtNum(f.removed)+'</td>' +
        '<td>'+fmtVar(f.variance)+'</td><td>'+fmtNum(f.events)+'</td></tr>';
    }).join('');
  } else {
    var data2 = window._facData && window._facData.facilities ? window._facData.facilities : [];
    if (!data2.length) { body.innerHTML = emptyState('No data','No facility data.'); return; }
    rows = data2.map(function(f) {
      return '<tr><td><strong>'+f.name+'</strong>' +
        (f.facilityType?'<br><span style="font-size:10px;color:var(--text-muted);">'+f.facilityType+'</span>':'') +
        '</td><td style="color:var(--green);font-weight:600;">'+fmtNum(f.added)+'</td>' +
        '<td style="color:var(--orange);font-weight:600;">'+fmtNum(f.removed)+'</td>' +
        '<td>'+fmtVar(f.variance)+'</td><td>'+fmtNum(f.events)+'</td></tr>';
    }).join('');
  }
  body.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Facility</th><th>Added</th><th>Removed</th><th>Variance</th><th>Events</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

function _renderUserSummary(data) {
  var card = document.getElementById('daily-users');
  var tbody = card.querySelector('tbody');
  var rows = data&&data.users ? data.users : [];
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="5">'+emptyState('No data','No user data.')+'</td></tr>'; return; }
  tbody.innerHTML = rows.slice(0,20).map(function(u) {
    return '<tr><td><strong>'+u.name+'</strong></td>' +
      '<td style="color:var(--green);">'+fmtNum(u.added)+'</td>' +
      '<td style="color:var(--orange);">'+fmtNum(u.removed)+'</td>' +
      '<td>'+fmtVar(u.variance)+'</td><td>'+fmtNum(u.events)+'</td></tr>';
  }).join('');
}
