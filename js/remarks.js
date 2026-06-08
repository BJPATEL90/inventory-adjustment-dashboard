// ============================================================
// remarks.js — Remarks Tracker Module
// ============================================================

function renderRemarks() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="remarks-root"></div>';
  var root = document.getElementById('remarks-root');
  var month = APP.currentMonth || '';

  root.innerHTML =
    '<div class="page-header"><h2>Remarks Tracker</h2><p>All remarks added by dashboard users against variance records</p></div>' +
    '<div class="card section-row">' +
      '<div class="filters-bar">' +
        '<div class="filter-group"><label>From</label><input type="date" class="filter-input" id="rf-from" style="width:130px;" oninput="applyRemarksFilters()"/></div>' +
        '<div class="filter-group"><label>To</label><input type="date" class="filter-input" id="rf-to" style="width:130px;" oninput="applyRemarksFilters()"/></div>' +
        '<div class="filter-group"><label>Facility</label><select class="filter-select" id="rf-facility" onchange="applyRemarksFilters()"><option value="">All Facilities</option></select></div>' +
        '<div class="filter-group"><label>User</label><select class="filter-select" id="rf-user" onchange="applyRemarksFilters()"><option value="">All Users</option></select></div>' +
        '<div class="search-wrap"><div class="search-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' +
        '<input type="text" class="search-input" id="rf-search" placeholder="Search remark, SKU, user..." oninput="applyRemarksFilters()"/></div>' +
      '</div>' +
      '<div class="table-wrap"><table id="remarks-table"><thead><tr>' +
        '<th>Date</th><th>Facility</th><th>Username</th><th>SKU</th>' +
        '<th>Remark</th><th>Submitted By</th><th>Submitted At</th>' +
      '</tr></thead><tbody id="remarks-tbody">'+skeletonRows(6,8)+'</tbody></table></div>' +
      '<div class="result-count" id="remarks-count">Loading...</div>' +
    '</div>';

  _loadRemarks(month);
  _loadRemarksFilters();
}

var _allRemarks = [];

function _loadRemarks(month) {
  apiGetRemarks({ month: month||'' }).then(function(data) {
    _allRemarks = data.remarks || [];
    applyRemarksFilters();
  }).catch(function(e) {
    document.getElementById('remarks-tbody').innerHTML = '<tr><td colspan="7">'+emptyState('Error loading remarks', e.message||'Please try refreshing.')+'</td></tr>';
  });
}

function _loadRemarksFilters() {
  apiGetFacilityList().then(function(data) {
    var sel = document.getElementById('rf-facility');
    if (!sel) return;
    (data.facilities||[]).forEach(function(f) {
      var opt = document.createElement('option'); opt.value = f; opt.textContent = f; sel.appendChild(opt);
    });
  }).catch(function(){});

  apiGetUserList({}).then(function(data) {
    var sel = document.getElementById('rf-user');
    if (!sel) return;
    (data.users||[]).forEach(function(u) {
      var opt = document.createElement('option'); opt.value = u; opt.textContent = u; sel.appendChild(opt);
    });
  }).catch(function(){});
}

function applyRemarksFilters() {
  var fromDate = (document.getElementById('rf-from')     ||{}).value||'';
  var toDate   = (document.getElementById('rf-to')       ||{}).value||'';
  var facility = (document.getElementById('rf-facility') ||{}).value||'';
  var username = (document.getElementById('rf-user')     ||{}).value||'';
  var search   = ((document.getElementById('rf-search')  ||{}).value||'').toLowerCase();

  var filtered = _allRemarks.filter(function(r) {
    if (fromDate && r.date < fromDate) return false;
    if (toDate   && r.date > toDate)   return false;
    if (facility && r.facility !== facility) return false;
    if (username && r.username !== username) return false;
    if (search) {
      var hay = [r.sku,r.remarkText,r.username,r.facility,r.submittedByName].join(' ').toLowerCase();
      if (hay.indexOf(search) < 0) return false;
    }
    return true;
  });

  _renderRemarksTable(filtered);
  document.getElementById('remarks-count').textContent = 'Showing ' + filtered.length + ' of ' + _allRemarks.length + ' remarks';
}

function _renderRemarksTable(rows) {
  var tbody = document.getElementById('remarks-tbody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7">'+emptyState('No remarks found','No remarks match the current filters.')+'</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(r) {
    var submittedAt = r.submittedAt ? new Date(r.submittedAt).toLocaleString('en-IN', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
    return '<tr>' +
      '<td>'+r.dateFormatted+'</td>' +
      '<td><strong>'+r.facility+'</strong></td>' +
      '<td>'+r.username+'</td>' +
      '<td><code style="font-size:11px;background:var(--canvas);padding:2px 6px;border-radius:4px;">'+r.sku+'</code></td>' +
      '<td class="wrap" style="max-width:260px;font-size:13px;">'+_esc(r.remarkText)+'</td>' +
      '<td><div class="submitter-info"><span class="submitter-name">'+r.submittedByName+'</span><span class="submitter-time">'+r.submittedByEmail+'</span></div></td>' +
      '<td style="color:var(--text-muted);font-size:12px;">'+submittedAt+'</td>' +
      '</tr>';
  }).join('');
}

function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
