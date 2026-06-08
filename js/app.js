// ============================================================
// app.js — Main Entry Point, Navigation, Shared UI
// ============================================================

var APP = {
  currentModule: 'daily',
  currentMonth: '',
  latestDate: null,
  archiveMonths: [],
};

// ── Init ──────────────────────────────────────────────────────
function initApp() {
  _loadArchiveMonths();
  _loadLatestDate();
  navigate('daily');
}

// ── Navigation ────────────────────────────────────────────────
function navigate(module) {
  APP.currentModule = module;

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.module === module);
  });

  // Update topbar title
  var labels = { daily: 'Daily Tracker', mtd: 'MTD Tracker', variance: 'Variance Tracker', remarks: 'Remarks Tracker' };
  document.getElementById('topbar-module').textContent = labels[module] || module;

  // Show/hide month selector (hide for daily)
  document.getElementById('month-selector-wrap').style.display = module === 'daily' ? 'none' : 'flex';

  // Render module
  var content = document.getElementById('page-content');
  content.innerHTML = '';

  switch (module) {
    case 'daily':    renderDaily();    break;
    case 'mtd':      renderMTD();      break;
    case 'variance': renderVariance(); break;
    case 'remarks':  renderRemarks();  break;
  }
}

function onMonthChange() {
  APP.currentMonth = document.getElementById('month-select').value;
  clearAPICache();
  navigate(APP.currentModule);
}

// ── Refresh ───────────────────────────────────────────────────
function refreshData() {
  clearAPICache();
  APP.latestDate = null;
  var icon = document.getElementById('refresh-icon');
  icon.classList.add('spinning');
  apiGetLatestDate().then(function(data) {
    if (data && data.date) {
      APP.latestDate = data.date;
      document.getElementById('last-updated-text').textContent = data.dateFormatted;
    }
  }).catch(function(){}).finally(function() {
    icon.classList.remove('spinning');
    navigate(APP.currentModule);
    showToast('Data refreshed', 'success');
  });
}

// ── Month Loading ─────────────────────────────────────────────
function _loadArchiveMonths() {
  apiGetArchiveMonths().then(function(data) {
    APP.archiveMonths = data.months || [];
    var sel = document.getElementById('month-select');
    sel.innerHTML = '<option value="">Current Month</option>';
    APP.archiveMonths.forEach(function(m) {
      var opt = document.createElement('option');
      opt.value = m.key; opt.textContent = m.display;
      sel.appendChild(opt);
    });
  }).catch(function() {});
}

function _loadLatestDate() {
  apiGetLatestDate().then(function(data) {
    if (data && data.date) {
      APP.latestDate = data.date;
      document.getElementById('last-updated-text').textContent = 'Last: ' + data.dateFormatted;
    } else {
      document.getElementById('last-updated-text').textContent = 'No data yet';
    }
  }).catch(function() {
    document.getElementById('last-updated-text').textContent = 'Unable to fetch';
  });
}

// ── Toggle Sidebar ────────────────────────────────────────────
function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// ── Toast Notifications ───────────────────────────────────────
function showToast(message, type) {
  type = type || 'info';
  var icons = {
    success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = (icons[type] || icons.info) + '<span>' + message + '</span>';
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(function() {
    toast.style.animation = 'toast-in 0.3s ease reverse both';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3500);
}

// ── Loading Overlay ───────────────────────────────────────────
function showLoading(msg) {
  var el = document.getElementById('loading-overlay');
  var txt = el.querySelector('.spinner-text');
  if (txt) txt.textContent = msg || 'Loading data...';
  el.style.display = 'flex';
}
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }

// ── Helpers ───────────────────────────────────────────────────
function fmtNum(n) {
  n = parseInt(n) || 0;
  return n.toLocaleString('en-IN');
}
function fmtVar(n) {
  n = parseInt(n) || 0;
  var s = (n >= 0 ? '+' : '') + n.toLocaleString('en-IN');
  var cls = n === 0 ? 'variance-zero' : (n > 0 ? 'variance-pos' : 'variance-neg');
  return '<span class="' + cls + '">' + s + '</span>';
}
function statusBadge(status) {
  var map = {
    'Balanced':          'badge badge-green',
    'Added Not Removed': 'badge badge-orange',
    'Removed Not Added': 'badge badge-red',
  };
  return '<span class="' + (map[status] || 'badge badge-gray') + '">' + (status || '—') + '</span>';
}
function emptyState(title, msg) {
  return '<div class="empty-state"><div class="empty-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h3>'+title+'</h3><p>'+msg+'</p></div>';
}
function skeletonRows(cols, rows) {
  var r = rows || 5; var c = cols || 6;
  var html = '';
  for (var i = 0; i < r; i++) {
    html += '<tr>';
    for (var j = 0; j < c; j++) html += '<td><div class="skeleton" style="height:14px;width:'+(60+Math.random()*30)+'%"></div></td>';
    html += '</tr>';
  }
  return html;
}

// ── Remark Modal State ────────────────────────────────────────
var _remarkPending = null;

function openRemarkModal(remarkKey, dateFormatted, facility, username, sku, itemName) {
  _remarkPending = { remarkKey: remarkKey, date: dateFormatted, facility: facility, username: username, sku: sku };
  document.getElementById('modal-title').textContent = sku + ' — ' + dateFormatted;
  document.getElementById('modal-meta').innerHTML =
    '<div class="meta-item"><span class="meta-label">Facility</span><span class="meta-value">'+facility+'</span></div>' +
    '<div class="meta-item"><span class="meta-label">User</span><span class="meta-value">'+username+'</span></div>' +
    '<div class="meta-item"><span class="meta-label">Item</span><span class="meta-value">'+(itemName||'—')+'</span></div>';
  document.getElementById('remark-input').value = '';
  document.getElementById('char-count').textContent = '0';
  document.getElementById('remark-modal').style.display = 'flex';
  setTimeout(function() { document.getElementById('remark-input').focus(); }, 100);
}

function closeRemarkModal() {
  document.getElementById('remark-modal').style.display = 'none';
  _remarkPending = null;
}

function modalOverlayClick(e) {
  if (e.target === document.getElementById('remark-modal')) closeRemarkModal();
}

function updateCharCount() {
  var val = document.getElementById('remark-input').value;
  document.getElementById('char-count').textContent = val.length;
}

function submitRemark() {
  if (!_remarkPending) return;
  var text = document.getElementById('remark-input').value.trim();
  if (!text) { showToast('Please enter a remark before saving.', 'error'); return; }

  var btn = document.getElementById('submit-remark-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  apiAddRemark({
    remarkKey:    _remarkPending.remarkKey,
    date:         _remarkPending.date,
    facility:     _remarkPending.facility,
    username:     _remarkPending.username,
    sku:          _remarkPending.sku,
    remarkText:   text,
  }).then(function() {
    closeRemarkModal();
    clearAPICache();
    showToast('Remark saved and locked successfully.', 'success');
    navigate(APP.currentModule);
  }).catch(function(e) {
    showToast(e.message || 'Failed to save remark.', 'error');
  }).finally(function() {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> Save & Lock';
  });
}

function destroyCharts() {
  Chart.helpers && Chart.helpers.each && Chart.helpers.each(Chart.instances, function(c) { c.destroy(); });
}
