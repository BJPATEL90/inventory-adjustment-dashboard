// ============================================================
// variance.js — Variance Tracker Module
// ============================================================

var _varianceState = {
  allRows: [],
  filtered: [],
  showAll: false,
  filters: { fromDate:'', toDate:'', facility:'', username:'', search:'' },
  facilityList: [],
  userList: [],
};

function renderVariance() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="variance-root"></div>';
  var root = document.getElementById('variance-root');
  var month = APP.currentMonth || '';

  root.innerHTML =
    '<div class="page-header"><h2>Variance Tracker</h2><p>All inventory adjustment records — filter to drill down</p></div>' +
    '<div class="card section-row" id="variance-card">' +
      '<div class="filters-bar" id="variance-filters">' +
        '<div class="filter-group"><label>From</label><input type="date" class="filter-input" id="vf-from" style="width:130px;" oninput="applyVarianceFilters()"/></div>' +
        '<div class="filter-group"><label>To</label><input type="date" class="filter-input" id="vf-to" style="width:130px;" oninput="applyVarianceFilters()"/></div>' +
        '<div class="filter-group"><label>Facility</label><select class="filter-select" id="vf-facility" onchange="applyVarianceFilters()"><option value="">All Facilities</option></select></div>' +
        '<div class="filter-group"><label>User</label><select class="filter-select" id="vf-user" onchange="applyVarianceFilters()"><option value="">All Users</option></select></div>' +
        '<div class="toggle-wrap">' +
          '<span class="toggle-label">Variance Only</span>' +
          '<label class="toggle"><input type="checkbox" id="vf-variance-only" onchange="toggleVarianceOnly()" checked/><span class="toggle-slider"></span></label>' +
          '<span class="toggle-label" id="vf-toggle-label">ON</span>' +
        '</div>' +
        '<div class="search-wrap"><div class="search-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' +
        '<input type="text" class="search-input" id="vf-search" placeholder="Search SKU, item, user..." oninput="applyVarianceFilters()"/></div>' +
      '</div>' +
      '<div class="table-wrap"><table id="variance-table"><thead><tr>' +
        '<th>Date</th><th>Facility</th><th>Brand</th><th>Username</th>' +
        '<th>SKU</th><th>Item Name</th><th>Added</th><th>Removed</th><th>Variance</th><th>Status</th>' +
        '<th>Source Remark</th><th>User Remark</th>' +
      '</tr></thead><tbody id="variance-tbody">'+skeletonRows(7,10)+'</tbody></table></div>' +
      '<div class="result-count" id="variance-count">Loading...</div>' +
    '</div>';

  _loadVarianceData(month);
  _loadVarianceFilters(month);
}

function _loadVarianceData(month) {
  var params = { month: month || '' };
  apiGetVarianceData(params).then(function(data) {
    _varianceState.allRows = data.rows || [];
    applyVarianceFilters();
  }).catch(function(e) {
    document.getElementById('variance-tbody').innerHTML = '<tr><td colspan="12">'+emptyState('Error loading data', e.message||'Please try refreshing.')+'</td></tr>';
  });
}

function _loadVarianceFilters(month) {
  apiGetFacilityList().then(function(data) {
    _varianceState.facilityList = data.facilities || [];
    var sel = document.getElementById('vf-facility');
    _varianceState.facilityList.forEach(function(f) {
      var opt = document.createElement('option'); opt.value = f; opt.textContent = f; sel.appendChild(opt);
    });
  }).catch(function(){});

  apiGetUserList({ month: month||'' }).then(function(data) {
    _varianceState.userList = data.users || [];
    var sel = document.getElementById('vf-user');
    _varianceState.userList.forEach(function(u) {
      var opt = document.createElement('option'); opt.value = u; opt.textContent = u; sel.appendChild(opt);
    });
  }).catch(function(){});
}

function applyVarianceFilters() {
  var fromDate  = (document.getElementById('vf-from')     || {}).value || '';
  var toDate    = (document.getElementById('vf-to')       || {}).value || '';
  var facility  = (document.getElementById('vf-facility') || {}).value || '';
  var username  = (document.getElementById('vf-user')     || {}).value || '';
  var search    = ((document.getElementById('vf-search')  || {}).value || '').toLowerCase();
  var varOnly   = document.getElementById('vf-variance-only') && document.getElementById('vf-variance-only').checked;

  var filtered = _varianceState.allRows.filter(function(row) {
    if (fromDate && row.date < fromDate) return false;
    if (toDate   && row.date > toDate)   return false;
    if (facility && row.facility !== facility) return false;
    if (username && row.username !== username) return false;
    if (varOnly  && row.varianceQty === 0)    return false;
    if (search) {
      var haystack = [row.sku,row.itemName,row.username,row.facility,row.brand,row.sourceRemark,row.userRemark].join(' ').toLowerCase();
      if (haystack.indexOf(search) < 0) return false;
    }
    return true;
  });

  _varianceState.filtered = filtered;
  _renderVarianceTable(filtered);
  document.getElementById('variance-count').textContent = 'Showing ' + filtered.length + ' of ' + _varianceState.allRows.length + ' records';
}

function toggleVarianceOnly() {
  var checked = document.getElementById('vf-variance-only').checked;
  document.getElementById('vf-toggle-label').textContent = checked ? 'ON' : 'OFF';
  applyVarianceFilters();
}

function _renderVarianceTable(rows) {
  var tbody = document.getElementById('variance-tbody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="12">'+emptyState('No records found','Try adjusting the filters or toggling "Variance Only".')+'</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(function(row) {
    var remarkCell;
    if (row.userRemark) {
      remarkCell = '<span class="remark-locked"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> ' + _esc(row.userRemark) + '</span>';
    } else {
      remarkCell = '<button class="add-remark-btn" onclick="openRemarkModal(\''+_esc(row.remarkKey)+'\',\''+_esc(row.dateFormatted)+'\',\''+_esc(row.facility)+'\',\''+_esc(row.username)+'\',\''+_esc(row.sku)+'\',\''+_esc(row.itemName)+'\')">' +
        '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add</button>';
    }
    return '<tr>' +
      '<td>'+row.dateFormatted+'</td>' +
      '<td><strong>'+row.facility+'</strong></td>' +
      '<td><span class="badge badge-blue">'+row.brand+'</span></td>' +
      '<td>'+row.username+'</td>' +
      '<td><code style="font-size:11px;background:var(--canvas);padding:2px 6px;border-radius:4px;">'+row.sku+'</code></td>' +
      '<td class="wrap">'+row.itemName+'</td>' +
      '<td style="color:var(--green);font-weight:600;">'+fmtNum(row.addedQty)+'</td>' +
      '<td style="color:var(--orange);font-weight:600;">'+fmtNum(row.removedQty)+'</td>' +
      '<td>'+fmtVar(row.varianceQty)+'</td>' +
      '<td>'+statusBadge(row.status)+'</td>' +
      '<td class="wrap remark-text-cell">'+_esc(row.sourceRemark||'—')+'</td>' +
      '<td>'+remarkCell+'</td>' +
      '</tr>';
  }).join('');
}

function _esc(s) { return String(s||'').replace(/'/g,"&#39;").replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
