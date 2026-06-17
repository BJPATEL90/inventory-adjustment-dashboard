// app.js — V4
// localStorage cache, keep-alive ping, status bar, download CSV

var APP = {
  currentModule: 'daily',
  currentMonth: '',
  latestDate: null,
  archiveMonths: [],
  _downloadRows: [],  // holds current table rows for CSV export
};

var SHEET_LINKS = {
  processedData: 'https://docs.google.com/spreadsheets/d/1DIVGIpyvfsPVL9f80c6fnQO9fHyyDdhhgK8BRZF9U6s/edit?gid=1917601641',
  remarks: 'https://docs.google.com/spreadsheets/d/1DIVGIpyvfsPVL9f80c6fnQO9fHyyDdhhgK8BRZF9U6s/edit?gid=126229950',
};

// ── Cache helpers ──────────────────────────────────────────────
function lsGet(key) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch(e) { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}
function lsClear(key) {
  try { localStorage.removeItem(key); } catch(e) {}
}

// ── Keep-alive ─────────────────────────────────────────────────
function startKeepAlive() {
  setInterval(function() {
    var cb = 'ka_' + Date.now();
    var s = document.createElement('script');
    var t = setTimeout(function() { delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); }, 8000);
    window[cb] = function() { clearTimeout(t); delete window[cb]; if (s.parentNode) s.parentNode.removeChild(s); };
    s.src = API.BASE_URL + '?action=ping&callback=' + cb;
    document.head.appendChild(s);
  }, 4 * 60 * 1000);
}

// ── Init ───────────────────────────────────────────────────────
function initApp() {
  _loadArchiveMonths();
  startKeepAlive();
  navigate('daily');
}

// ── Navigation ─────────────────────────────────────────────────
function navigate(module) {
  APP.currentModule = module;
  document.querySelectorAll('.nav-item[data-module]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.module === module);
  });
  var labels = {
    daily: 'Daily Tracker', mtd: 'MTD Tracker',
    variance: 'Variance Tracker', expiry: 'Expiry Tracker', remarks: 'Remarks'
  };
  document.getElementById('topbar-module').textContent = labels[module] || module;
  var showMonth = module !== 'daily';
  document.getElementById('month-selector-wrap').style.display = showMonth ? 'flex' : 'none';
  var showDownload = (module === 'daily' || module === 'mtd' || module === 'variance');
  document.getElementById('btn-download').style.display = showDownload ? 'flex' : 'none';
  APP._downloadRows = [];
  destroyCharts();
  document.getElementById('page-content').innerHTML = '';
  switch (module) {
    case 'daily':    renderDaily();    break;
    case 'mtd':      renderMTD();      break;
    case 'variance': renderVariance(); break;
    case 'expiry':   renderExpiry();   break;
    case 'remarks':  renderRemarks();  break;
  }
}

function onMonthChange() {
  APP.currentMonth = document.getElementById('month-select').value;
  clearAPICache();
  navigate(APP.currentModule);
}

// ── Refresh ────────────────────────────────────────────────────
function refreshData() {
  var icon = document.getElementById('refresh-icon');
  icon.classList.add('spinning');
  lsClear('iamd_' + APP.currentModule);
  clearAPICache();
  navigate(APP.currentModule);
  setTimeout(function() { icon.classList.remove('spinning'); }, 1200);
}

// ── Status bar ─────────────────────────────────────────────────
function setSyncStatus(state, text) {
  var dot = document.getElementById('sync-dot');
  var txt = document.getElementById('sync-text');
  dot.className = 'sync-dot sync-' + state;
  if (txt) txt.textContent = text;
}

function setSyncLive(dateStr) {
  var now = new Date();
  var t = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  var label = dateStr ? 'Data: ' + dateStr + ' · ' + t : 'Synced ' + t;
  setSyncStatus('live', label);
}

function setSyncError() { setSyncStatus('error', 'Sync failed'); }
function setSyncIdle()  { setSyncStatus('idle', 'Loading…'); }

// ── Archive months ─────────────────────────────────────────────
function _loadArchiveMonths() {
  apiGetArchiveMonths().then(function(data) {
    APP.archiveMonths = data.months || [];
    var sel = document.getElementById('month-select');
    sel.innerHTML = '<option value="">Current Month</option>';
    APP.archiveMonths.forEach(function(m) {
      var o = document.createElement('option');
      o.value = m.key; o.textContent = m.display; sel.appendChild(o);
    });
  }).catch(function(){});
}

// ── Toggle sidebar ─────────────────────────────────────────────
function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768) { sb.classList.toggle('mobile-open'); }
  else { sb.classList.toggle('collapsed'); }
}

// ── Destroy charts ─────────────────────────────────────────────
function destroyCharts() {
  try { Object.values(Chart.instances || {}).forEach(function(c){ c.destroy(); }); } catch(e) {}
}

// ── Toast ──────────────────────────────────────────────────────
function showToast(message, type) {
  type = type || 'info';
  var icons = {
    success: '<svg viewBox="0 0 24 24" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  var t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML = (icons[type] || icons.info) + '<span>' + _esc(message) + '</span>';
  document.getElementById('toast-container').appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0'; t.style.transform = 'translateX(16px)'; t.style.transition = '0.3s';
    setTimeout(function(){ t.remove(); }, 300);
  }, 3500);
}

// ── Download CSV ───────────────────────────────────────────────
function downloadCSV() {
  var rows = APP._downloadRows;
  if (!rows || !rows.length) { showToast('No data to download', 'info'); return; }
  var headers = Object.keys(rows[0]);
  var csv = [headers.join(',')].concat(rows.map(function(r) {
    return headers.map(function(h) {
      return '"' + String(r[h] || '').replace(/"/g, '""') + '"';
    }).join(',');
  })).join('\n');
  var a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'inventory_' + APP.currentModule + '_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

// ── Remark modal ───────────────────────────────────────────────
var _remarkPending = null;
function openRemarkModal(remarkKey, dateFormatted, facility, username, sku, itemName) {
  _remarkPending = { remarkKey: remarkKey, date: dateFormatted, facility: facility, username: username, sku: sku };
  document.getElementById('modal-title').textContent = sku + ' — ' + dateFormatted;
  document.getElementById('modal-meta').innerHTML =
    _metaItem('Facility', facility) + _metaItem('User', username) + _metaItem('Item', itemName || '—');
  document.getElementById('remark-input').value = '';
  document.getElementById('char-count').textContent = '0';
  document.getElementById('remark-modal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('remark-input').focus(); }, 100);
}
function _metaItem(label, value) {
  return '<div class="meta-item"><span class="meta-label">' + label + '</span><span class="meta-value">' + _esc(value) + '</span></div>';
}
function closeRemarkModal() { document.getElementById('remark-modal').style.display = 'none'; _remarkPending = null; }
function modalOverlayClick(e) { if (e.target === document.getElementById('remark-modal')) closeRemarkModal(); }
function updateCharCount() { document.getElementById('char-count').textContent = document.getElementById('remark-input').value.length; }

function submitRemark() {
  if (!_remarkPending) return;
  var text = document.getElementById('remark-input').value.trim();
  if (!text) { showToast('Please enter a remark', 'error'); return; }
  var btn = document.getElementById('submit-remark-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  apiAddRemark({ remarkKey: _remarkPending.remarkKey, date: _remarkPending.date, facility: _remarkPending.facility, username: _remarkPending.username, sku: _remarkPending.sku, remarkText: text })
    .then(function() {
      closeRemarkModal(); clearAPICache();
      showToast('Remark saved', 'success');
    })
    .catch(function(e) { showToast(e.message || 'Failed to save', 'error'); })
    .finally(function() {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Save & Lock';
    });
}

// ── Shared helpers ─────────────────────────────────────────────
function fmtNum(n) { n = parseInt(n) || 0; return n.toLocaleString('en-IN'); }
function fmtVar(n) {
  n = parseInt(n) || 0;
  var s = (n >= 0 ? '+' : '') + n.toLocaleString('en-IN');
  var cls = n === 0 ? 'variance-zero' : (n > 0 ? 'variance-pos' : 'variance-neg');
  return '<span class="' + cls + '">' + s + '</span>';
}
function statusBadge(status) {
  var map = { 'Balanced': 'badge-green', 'Added Not Removed': 'badge-orange', 'Removed Not Added': 'badge-red' };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + _esc(status || '—') + '</span>';
}
function emptyState(title, msg) {
  return '<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h3>' + _esc(title) + '</h3><p>' + _esc(msg) + '</p></div>';
}
function skeletonRows(cols, rows) {
  var h = '';
  for (var i = 0; i < rows; i++) {
    h += '<tr>';
    for (var j = 0; j < cols; j++) h += '<td><div class="skeleton" style="height:13px;width:' + (45 + Math.random() * 40) + '%"></div></td>';
    h += '</tr>';
  }
  return h;
}
function kpiCard(label, value, color, bg, icon, accent, small) {
  var icons = {
    'activity':       '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    'plus-circle':    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    'minus-circle':   '<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>',
    'trending-up':    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    'check-circle':   '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'map-pin':        '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
    'users':          '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
    'alert-octagon':  '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'refresh-cw':     '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  };
  var cls = 'kpi-card' + (small ? ' kpi-sm' : '');
  return '<div class="' + cls + '" style="--kpi-color:' + color + ';--kpi-bg:' + bg + '">' +
    '<div class="kpi-label">' + label + '</div>' +
    '<div class="kpi-value' + (accent ? ' accent' : '') + '">' + value + '</div>' +
    '<div class="kpi-icon"><svg viewBox="0 0 24 24">' + (icons[icon] || '') + '</svg></div>' +
    '</div>';
}
function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showLoading(msg) {
  var el = document.getElementById('loading-overlay');
  var t = el.querySelector('.spinner-text'); if (t) t.textContent = msg || 'Loading…';
  el.style.display = 'flex';
}
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }
