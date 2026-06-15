// app.js — V2: Sidebar sheet links, kpiCard helper shared

var APP = { currentModule:'daily', currentMonth:'', latestDate:null, archiveMonths:[] };

// Sheet GIDs
var SHEET_LINKS = {
  rawData:       'https://docs.google.com/spreadsheets/d/1DIVGIpyvfsPVL9f80c6fnQO9fHyyDdhhgK8BRZF9U6s/edit?gid=1508207944#gid=1508207944',
  processedData: 'https://docs.google.com/spreadsheets/d/1DIVGIpyvfsPVL9f80c6fnQO9fHyyDdhhgK8BRZF9U6s/edit?gid=1917601641#gid=1917601641',
  remarks:       'https://docs.google.com/spreadsheets/d/1DIVGIpyvfsPVL9f80c6fnQO9fHyyDdhhgK8BRZF9U6s/edit?gid=126229950#gid=126229950',
};

function initApp() {
  _loadArchiveMonths();
  _loadLatestDate();
  _injectSidebarLinks();
  navigate('daily');
}

function navigate(module) {
  APP.currentModule = module;
  document.querySelectorAll('.nav-item[data-module]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.module === module);
  });
  var labels = { daily:'Daily Tracker', mtd:'MTD Tracker', variance:'Variance Tracker', expiry:'Expiry Tracker', remarks:'Remarks Tracker' };
  document.getElementById('topbar-module').textContent = labels[module]||module;
  document.getElementById('month-selector-wrap').style.display = module==='daily'?'none':'flex';
  document.getElementById('page-content').innerHTML = '';
  switch (module) {
    case 'daily': renderDaily(); break;
    case 'mtd': renderMTD(); break;
    case 'variance': renderVariance(); break;
    case 'expiry': renderExpiry(); break;
    case 'remarks': renderRemarks(); break;
    }
}

function onMonthChange() {
  APP.currentMonth = document.getElementById('month-select').value;
  clearAPICache();
  navigate(APP.currentModule);
}

function refreshData() {
  clearAPICache(); APP.latestDate = null;
  var icon = document.getElementById('refresh-icon');
  icon.classList.add('spinning');
  apiGetLatestDate().then(function(data) {
    if (data&&data.date) { APP.latestDate=data.date; document.getElementById('last-updated-text').textContent='Last: '+data.dateFormatted; }
  }).catch(function(){}).finally(function() {
    icon.classList.remove('spinning');
    navigate(APP.currentModule);
    showToast('Data refreshed','success');
  });
}

function _loadArchiveMonths() {
  apiGetArchiveMonths().then(function(data) {
    APP.archiveMonths = data.months||[];
    var sel = document.getElementById('month-select');
    sel.innerHTML = '<option value="">Current Month</option>';
    APP.archiveMonths.forEach(function(m) {
      var o=document.createElement('option'); o.value=m.key; o.textContent=m.display; sel.appendChild(o);
    });
  }).catch(function(){});
}

function _loadLatestDate() {
  apiGetLatestDate().then(function(data) {
    if (data&&data.date) { APP.latestDate=data.date; document.getElementById('last-updated-text').textContent='Last: '+data.dateFormatted; }
    else document.getElementById('last-updated-text').textContent='No data yet';
  }).catch(function() { document.getElementById('last-updated-text').textContent='Unable to fetch'; });
}

function _injectSidebarLinks() {
  var nav = document.querySelector('.sidebar-nav');
  if (!nav) return;
  var section = document.createElement('div');
  section.innerHTML =
    '<p class="nav-label" style="margin-top:20px;">Data</p>' +
    '<a class="nav-item" href="'+SHEET_LINKS.rawData+'" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
      '<span>Raw Data</span>' +
      '<svg viewBox="0 0 24 24" style="width:11px;height:11px;margin-left:auto;opacity:0.4;"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
    '</a>' +
    '<a class="nav-item" href="'+SHEET_LINKS.processedData+'" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' +
      '<span>Processed Data</span>' +
      '<svg viewBox="0 0 24 24" style="width:11px;height:11px;margin-left:auto;opacity:0.4;"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
    '</a>' +
    '<a class="nav-item" href="'+SHEET_LINKS.remarks+'" target="_blank" rel="noopener">' +
      '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
      '<span>Remarks Sheet</span>' +
      '<svg viewBox="0 0 24 24" style="width:11px;height:11px;margin-left:auto;opacity:0.4;"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
    '</a>';
  nav.appendChild(section);
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) { sidebar.classList.toggle('mobile-open'); }
  else { sidebar.classList.toggle('collapsed'); }
}

function showToast(message, type) {
  type = type||'info';
  var icons = {
    success:'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    error:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  var toast = document.createElement('div');
  toast.className = 'toast toast-'+type;
  toast.innerHTML = (icons[type]||icons.info)+'<span>'+message+'</span>';
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(function() { toast.style.animation='toast-in 0.3s ease reverse both'; setTimeout(function(){toast.remove();},300); }, 3500);
}

function showLoading(msg) {
  var el=document.getElementById('loading-overlay');
  var t=el.querySelector('.spinner-text'); if(t) t.textContent=msg||'Loading...';
  el.style.display='flex';
}
function hideLoading() { document.getElementById('loading-overlay').style.display='none'; }

// ── Shared helpers ────────────────────────────────────────────
function fmtNum(n) { n=parseInt(n)||0; return n.toLocaleString('en-IN'); }
function fmtVar(n) {
  n=parseInt(n)||0;
  var s=(n>=0?'+':'')+n.toLocaleString('en-IN');
  var cls=n===0?'variance-zero':(n>0?'variance-pos':'variance-neg');
  return '<span class="'+cls+'">'+s+'</span>';
}
function statusBadge(status) {
  var map={'Balanced':'badge badge-green','Added Not Removed':'badge badge-orange','Removed Not Added':'badge badge-red'};
  return '<span class="'+(map[status]||'badge badge-gray')+'">'+( status||'—')+'</span>';
}
function emptyState(title, msg) {
  return '<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h3>'+title+'</h3><p>'+msg+'</p></div>';
}
function skeletonRows(cols, rows) {
  var h='';
  for(var i=0;i<rows;i++){
    h+='<tr>';
    for(var j=0;j<cols;j++) h+='<td><div class="skeleton" style="height:14px;width:'+(50+Math.random()*40)+'%"></div></td>';
    h+='</tr>';
  }
  return h;
}

var _remarkPending = null;
function openRemarkModal(remarkKey, dateFormatted, facility, username, sku, itemName) {
  _remarkPending = { remarkKey:remarkKey, date:dateFormatted, facility:facility, username:username, sku:sku };
  document.getElementById('modal-title').textContent = sku+' — '+dateFormatted;
  document.getElementById('modal-meta').innerHTML =
    '<div class="meta-item"><span class="meta-label">Facility</span><span class="meta-value">'+facility+'</span></div>' +
    '<div class="meta-item"><span class="meta-label">User</span><span class="meta-value">'+username+'</span></div>' +
    '<div class="meta-item"><span class="meta-label">Item</span><span class="meta-value">'+(itemName||'—')+'</span></div>';
  document.getElementById('remark-input').value='';
  document.getElementById('char-count').textContent='0';
  document.getElementById('remark-modal').style.display='flex';
  setTimeout(function(){document.getElementById('remark-input').focus();},100);
}
function closeRemarkModal() { document.getElementById('remark-modal').style.display='none'; _remarkPending=null; }
function modalOverlayClick(e) { if(e.target===document.getElementById('remark-modal')) closeRemarkModal(); }
function updateCharCount() { document.getElementById('char-count').textContent=document.getElementById('remark-input').value.length; }

function submitRemark() {
  if (!_remarkPending) return;
  var text = document.getElementById('remark-input').value.trim();
  if (!text) { showToast('Please enter a remark.','error'); return; }
  var btn = document.getElementById('submit-remark-btn');
  btn.disabled=true; btn.textContent='Saving...';
  apiAddRemark({ remarkKey:_remarkPending.remarkKey, date:_remarkPending.date, facility:_remarkPending.facility, username:_remarkPending.username, sku:_remarkPending.sku, remarkText:text })
    .then(function() { closeRemarkModal(); clearAPICache(); showToast('Remark saved and locked.','success'); navigate(APP.currentModule); })
    .catch(function(e) { showToast(e.message||'Failed to save remark.','error'); })
    .finally(function() { btn.disabled=false; btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Save & Lock'; });
}

function destroyCharts() {
  try { Object.values(Chart.instances||{}).forEach(function(c){c.destroy();}); } catch(e){}
}

// kpiCard shared helper used by daily.js and mtd.js
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
