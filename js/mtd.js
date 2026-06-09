// mtd.js — V2: MTD Top SKU table, facility type chart, DM Sans fonts

var _mtdCharts = {};

function renderMTD() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="mtd-root"></div>';
  var root = document.getElementById('mtd-root');
  var month = APP.currentMonth || '';

  root.innerHTML =
    '<div class="page-header"><h2>MTD Tracker</h2><p id="mtd-period-sub">Loading...</p></div>' +
    '<div class="kpi-grid" id="mtd-kpi-grid">'+_skels(8)+'</div>' +
    '<div class="card chart-full section-row"><div class="card-header"><span class="card-title">Daily Trend — Added / Removed / Variance</span></div><div class="chart-container"><div class="chart-canvas-wrap"><canvas id="chart-trend"></canvas></div></div></div>' +
    '<div class="chart-grid">' +
      '<div class="card"><div class="card-header"><span class="card-title">Facility Type Trend</span></div><div class="chart-container"><div class="chart-canvas-wrap"><canvas id="chart-facility"></canvas></div></div></div>' +
      '<div class="card"><div class="card-header"><span class="card-title">User Trend (Top 10)</span></div><div class="chart-container"><div class="chart-canvas-wrap"><canvas id="chart-user"></canvas></div></div></div>' +
    '</div>' +
    '<div class="card section-row"><div class="card-header"><span class="card-title">MTD Top SKUs by Variance</span><span class="card-badge">Top 20</span></div>' +
    '<div class="card-body"><div class="table-wrap"><table id="mtd-sku-table"><thead><tr>' +
    '<th>SKU</th><th>Item Name</th><th>Added Qty</th><th>Removed Qty</th><th>Variance</th></tr></thead>' +
    '<tbody id="mtd-sku-tbody">'+skeletonRows(5,8)+'</tbody></table></div></div></div>';

  Promise.all([
    apiGetMTDKPI({ month: month }),
    apiGetDailyTrend({ month: month }),
    apiGetFacilityTypeSummary({ scope: 'MTD', month: month }),
    apiGetUserSummary({ scope: 'MTD', month: month }),
    apiGetMTDTopSKUs({ month: month }),
  ]).then(function(res) {
    var mtd=res[0]; var trend=res[1]; var ft=res[2]; var usr=res[3]; var skus=res[4];
    if (mtd&&mtd.monthDisplay) document.getElementById('mtd-period-sub').textContent='Month-to-Date — '+mtd.monthDisplay;
    _renderMTDKPIs(mtd);
    _renderTrendChart(trend);
    _renderFacilityTypeChart(ft);
    _renderUserChart(usr);
    _renderMTDSKUTable(skus);
  }).catch(function(e) {
    document.getElementById('mtd-root').innerHTML = emptyState('No MTD data','Run processing first.');
    console.error('MTD error:', e);
  });
}

function _skels(n) {
  var h=''; for(var i=0;i<n;i++) h+='<div class="kpi-card"><div class="skeleton" style="height:11px;width:60%;margin-bottom:12px;"></div><div class="skeleton" style="height:28px;width:75%;"></div></div>'; return h;
}

function _renderMTDKPIs(data) {
  var grid = document.getElementById('mtd-kpi-grid');
  if (!data||!data.kpi) { grid.innerHTML=emptyState('No MTD data','No data for this month.'); return; }
  var k=data.kpi;
  var netV=parseInt(k.netVarianceQty)||0;
  var netColor=netV===0?'#059669':(netV>0?'#D97706':'#DC2626');
  var netBg   =netV===0?'#D1FAE5':(netV>0?'#FEF3C7':'#FEE2E2');
  grid.innerHTML =
    kpiCard('MTD Events',         fmtNum(k.totalEvents),       '#2E86C1','#DBEAFE','activity') +
    kpiCard('MTD Added Qty',      fmtNum(k.totalAddedQty),     '#059669','#D1FAE5','plus-circle') +
    kpiCard('MTD Removed Qty',    fmtNum(k.totalRemovedQty),   '#D97706','#FEF3C7','minus-circle') +
    kpiCard('MTD Net Variance',   (netV>=0?'+':'')+fmtNum(netV), netColor, netBg,'trending-up',true) +
    kpiCard('Balanced SKUs',      fmtNum(k.balancedSKUs),      '#059669','#D1FAE5','check-circle') +
    kpiCard('Variance SKUs',      fmtNum(k.varianceSKUs),      '#DC2626','#FEE2E2','alert-triangle') +
    kpiCard('Facilities Impacted',fmtNum(k.facilitiesImpacted),'#0F2035','#E0E7EF','map-pin') +
    kpiCard('Users Impacted',     fmtNum(k.usersImpacted),     '#6C3483','#EDE9F8','users');
}

function _renderTrendChart(data) {
  var canvas = document.getElementById('chart-trend'); if (!canvas) return;
  var trend = data&&data.trend ? data.trend : [];
  if (!trend.length) { canvas.parentElement.innerHTML=emptyState('No trend data','No daily data for this month.'); return; }
  if (_mtdCharts.trend) _mtdCharts.trend.destroy();
  _mtdCharts.trend = new Chart(canvas.getContext('2d'), {
    type:'line',
    data:{ labels:trend.map(function(d){return d.dateLabel||d.date;}),
      datasets:[
        {label:'Added Qty',  data:trend.map(function(d){return d.added||0;}),  borderColor:'#059669',backgroundColor:'rgba(5,150,105,0.08)',tension:0.35,fill:true,pointRadius:3},
        {label:'Removed Qty',data:trend.map(function(d){return d.removed||0;}),borderColor:'#D97706',backgroundColor:'rgba(217,119,6,0.06)', tension:0.35,fill:true,pointRadius:3},
        {label:'Variance',   data:trend.map(function(d){return d.variance||0;}),borderColor:'#2E86C1',backgroundColor:'rgba(46,134,193,0.06)',tension:0.35,fill:false,pointRadius:3,borderDash:[4,3]},
      ]},
    options:_chartOpts()
  });
}

function _renderFacilityTypeChart(data) {
  var canvas = document.getElementById('chart-facility'); if (!canvas) return;
  var rows = data&&data.facilityTypes ? data.facilityTypes : [];
  if (!rows.length) { canvas.parentElement.innerHTML=emptyState('No facility type data',''); return; }
  if (_mtdCharts.facility) _mtdCharts.facility.destroy();
  _mtdCharts.facility = new Chart(canvas.getContext('2d'), {
    type:'bar',
    data:{ labels:rows.map(function(f){return f.name;}),
      datasets:[
        {label:'Added',  data:rows.map(function(f){return f.added||0;}),  backgroundColor:'rgba(5,150,105,0.75)',borderRadius:4},
        {label:'Removed',data:rows.map(function(f){return f.removed||0;}),backgroundColor:'rgba(217,119,6,0.75)', borderRadius:4},
      ]},
    options:_chartOpts()
  });
}

function _renderUserChart(data) {
  var canvas = document.getElementById('chart-user'); if (!canvas) return;
  var rows = data&&data.users ? data.users.slice(0,10) : [];
  if (!rows.length) { canvas.parentElement.innerHTML=emptyState('No user data',''); return; }
  if (_mtdCharts.user) _mtdCharts.user.destroy();
  _mtdCharts.user = new Chart(canvas.getContext('2d'), {
    type:'bar',
    data:{ labels:rows.map(function(u){return u.name;}),
      datasets:[{label:'|Variance|',data:rows.map(function(u){return Math.abs(u.variance||0);}),backgroundColor:'rgba(46,134,193,0.75)',borderRadius:4}]},
    options:Object.assign({},_chartOpts(),{indexAxis:'y'})
  });
}

function _renderMTDSKUTable(data) {
  var tbody = document.getElementById('mtd-sku-tbody'); if (!tbody) return;
  var skus = data&&data.skus ? data.skus : [];
  if (!skus.length) { tbody.innerHTML='<tr><td colspan="5">'+emptyState('No SKU data','No MTD SKU data available.')+'</td></tr>'; return; }
  tbody.innerHTML = skus.map(function(s) {
    return '<tr><td><code style="font-size:11px;background:var(--canvas);padding:2px 6px;border-radius:4px;">'+s.sku+'</code></td>' +
      '<td class="wrap">'+s.itemName+'</td>' +
      '<td style="color:var(--green);font-weight:600;">'+fmtNum(s.added)+'</td>' +
      '<td style="color:var(--orange);font-weight:600;">'+fmtNum(s.removed)+'</td>' +
      '<td>'+fmtVar(s.variance)+'</td></tr>';
  }).join('');
}

function _chartOpts() {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:{position:'top',labels:{font:{family:"'DM Sans',sans-serif",size:11},boxWidth:10,padding:12,color:'#4B5563'}},
      tooltip:{backgroundColor:'#0F2035',titleFont:{family:"'DM Sans',sans-serif",size:12},bodyFont:{family:"'DM Sans',sans-serif",size:11},padding:10,cornerRadius:8}
    },
    scales:{
      x:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{family:"'DM Sans',sans-serif",size:10},color:'#9CA3AF',maxRotation:45}},
      y:{grid:{color:'rgba(0,0,0,0.04)'},ticks:{font:{family:"'DM Sans',sans-serif",size:10},color:'#9CA3AF'}}
    }
  };
}
