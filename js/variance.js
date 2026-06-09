// variance.js — V3
// Changes: compact columns, facility type column, username trim,
// SKU+Item combined, two-level facility filter (Type → Facility)

var _varianceState = {
  allRows: [], filtered: [], facilityList: [], userList: [],
  facilityTypeList: [], selectedType: '', selectedFacility: '',
};

function renderVariance() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="variance-root"></div>';
  var root = document.getElementById('variance-root');
  var month = APP.currentMonth || '';

  root.innerHTML =
    '<div class="page-header"><h2>Variance Tracker</h2>' +
    '<p>All inventory adjustment records — filter to drill down</p></div>' +
    '<div class="card section-row">' +
      '<div class="filters-bar" id="variance-filters">' +
        '<div class="filter-group"><label>From</label>' +
        '<input type="date" class="filter-input" id="vf-from" style="width:128px;" oninput="applyVarianceFilters()"/></div>' +
        '<div class="filter-group"><label>To</label>' +
        '<input type="date" class="filter-input" id="vf-to" style="width:128px;" oninput="applyVarianceFilters()"/></div>' +
        '<div class="filter-group"><label>Type</label>' +
        '<select class="filter-select" id="vf-factype" onchange="onFacTypeChange()"><option value="">All Types</option></select></div>' +
        '<div class="filter-group"><label>Facility</label>' +
        '<select class="filter-select" id="vf-facility" onchange="applyVarianceFilters()"><option value="">All Facilities</option></select></div>' +
        '<div class="filter-group"><label>User</label>' +
        '<select class="filter-select" id="vf-user" onchange="applyVarianceFilters()"><option value="">All Users</option></select></div>' +
        '<div class="toggle-wrap">' +
          '<span class="toggle-label">Variance Only</span>' +
          '<label class="toggle"><input type="checkbox" id="vf-variance-only" onchange="toggleVarianceOnly()" checked/>' +
          '<span class="toggle-slider"></span></label>' +
          '<span class="toggle-label" id="vf-toggle-label">ON</span>' +
        '</div>' +
        '<div class="search-wrap">' +
        '<div class="search-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/>' +
        '<line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' +
        '<input type="text" class="search-input" id="vf-search" ' +
        'placeholder="Search SKU, item, user..." oninput="applyVarianceFilters()"/></div>' +
      '</div>' +
      '<div class="table-wrap vt-table-wrap">' +
        '<table class="vt-table"><thead><tr>' +
          '<th style="width:80px;">Date</th>' +
          '<th style="width:100px;">Facility</th>' +
          '<th style="width:80px;">Fac. Type</th>' +
          '<th style="width:120px;">Username</th>' +
          '<th style="width:160px;">SKU / Item</th>' +
          '<th style="width:60px;">Added</th>' +
          '<th style="width:60px;">Removed</th>' +
          '<th style="width:60px;">Variance</th>' +
          '<th style="width:90px;">Status</th>' +
          '<th style="width:120px;">Source Remark</th>' +
          '<th style="width:120px;">User Remark</th>' +
        '</tr></thead>' +
        '<tbody id="variance-tbody">'+skeletonRows(6,8)+'</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="result-count" id="variance-count">Loading...</div>' +
    '</div>';

  _loadVarianceData(month);
  _loadVarianceFilters(month);
}

function _loadVarianceData(month) {
  apiGetVarianceData({ month: month||'' }).then(function(data) {
    _varianceState.allRows = data.rows || [];
    applyVarianceFilters();
  }).catch(function(e) {
    document.getElementById('variance-tbody').innerHTML =
      '<tr><td colspan="11">'+emptyState('Error loading data', e.message||'Please refresh.')+'</td></tr>';
  });
}

function _loadVarianceFilters(month) {
  // Load facility types from unique values in data
  apiGetFacilityTypeSummary({ scope: 'DAILY', month: month||'' }).then(function(data) {
    var types = (data.facilityTypes||[]).map(function(f){ return f.name; }).filter(Boolean).sort();
    _varianceState.facilityTypeList = types;
    var sel = document.getElementById('vf-factype');
    if (!sel) return;
    types.forEach(function(t) {
      var o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o);
    });
  }).catch(function(){});

  // Load all facilities
  apiGetFacilityList().then(function(data) {
    _varianceState.facilityList = data.facilities||[];
    _populateFacilityDropdown('');
  }).catch(function(){});

  // Load users
  apiGetUserList({ month: month||'' }).then(function(data) {
    _varianceState.userList = data.users||[];
    var sel = document.getElementById('vf-user');
    if (!sel) return;
    _varianceState.userList.forEach(function(u) {
      var o = document.createElement('option'); o.value = u; o.textContent = _trimUser(u); sel.appendChild(o);
    });
  }).catch(function(){});
}

function _populateFacilityDropdown(selectedType) {
  var sel = document.getElementById('vf-facility');
  if (!sel) return;
  var current = sel.value;
  sel.innerHTML = '<option value="">All Facilities</option>';

  var facilities = _varianceState.facilityList;
  if (selectedType) {
    // Filter facilities that belong to this type
    facilities = _varianceState.allRows
      .filter(function(r) { return r.facilityType === selectedType; })
      .map(function(r) { return r.facility; });
    facilities = facilities.filter(function(v,i,a){ return v && a.indexOf(v)===i; }).sort();
  }

  facilities.forEach(function(f) {
    var o = document.createElement('option'); o.value = f; o.textContent = f; sel.appendChild(o);
  });

  // Restore previous selection if still valid
  if (current && facilities.indexOf(current) >= 0) sel.value = current;
}

function onFacTypeChange() {
  var type = (document.getElementById('vf-factype')||{}).value || '';
  _varianceState.selectedType = type;
  _populateFacilityDropdown(type);
  applyVarianceFilters();
}

function applyVarianceFilters() {
  var fromDate = (document.getElementById('vf-from')||{}).value||'';
  var toDate   = (document.getElementById('vf-to')||{}).value||'';
  var facType  = (document.getElementById('vf-factype')||{}).value||'';
  var facility = (document.getElementById('vf-facility')||{}).value||'';
  var username = (document.getElementById('vf-user')||{}).value||'';
  var search   = ((document.getElementById('vf-search')||{}).value||'').toLowerCase();
  var varOnly  = document.getElementById('vf-variance-only') &&
                 document.getElementById('vf-variance-only').checked;

  var filtered = _varianceState.allRows.filter(function(row) {
    if (fromDate && row.date < fromDate) return false;
    if (toDate   && row.date > toDate)   return false;
    if (facType  && row.facilityType !== facType) return false;
    if (facility && row.facility !== facility) return false;
    if (username && row.username !== username) return false;
    if (varOnly  && row.varianceQty === 0 && !row.hasReplace) return false;
    if (search) {
      var hay = [row.sku, row.itemName, row.username, row.facility,
                 row.facilityType, row.sourceRemark, row.userRemark].join(' ').toLowerCase();
      if (hay.indexOf(search) < 0) return false;
    }
    return true;
  });

  _varianceState.filtered = filtered;
  _renderVarianceTable(filtered);
  var countEl = document.getElementById('variance-count');
  if (countEl) countEl.textContent =
    'Showing ' + filtered.length + ' of ' + _varianceState.allRows.length + ' records';
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
    tbody.innerHTML = '<tr><td colspan="11">' +
      emptyState('No records found','Try adjusting filters or toggling Variance Only.') +
      '</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(function(row) {
    // Username: show only part before @
    var uname = _trimUser(row.username);

    // SKU + Item Name combined cell
    var skuCell = '<div class="sku-code">'+_esc(row.sku)+'</div>' +
                  '<div class="sku-name">'+_esc(row.itemName)+'</div>';

    // Status / Replace badge
    var statusCell = row.hasReplace
      ? '<span class="badge badge-replace">⚠ REPLACE</span>'
      : statusBadge(row.status);

    // Remark cell
    var remarkCell = row.userRemark
      ? '<span class="remark-locked">' +
        '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
        '<path d="M7 11V7a5 5 0 0110 0v4"/></svg> ' +
        _esc(row.userRemark) + '</span>'
      : '<button class="add-remark-btn" onclick="openRemarkModal(\'' +
        _esc(row.remarkKey)+'\',\''+_esc(row.dateFormatted)+'\',\''+
        _esc(row.facility)+'\',\''+_esc(row.username)+'\',\''+
        _esc(row.sku)+'\',\''+_esc(row.itemName)+'\')">' +
        '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/>' +
        '<line x1="5" y1="12" x2="19" y2="12"/></svg> Add</button>';

    return '<tr' + (row.hasReplace ? ' class="replace-row"' : '') + '>' +
      '<td class="vt-date">'+row.dateFormatted+'</td>' +
      '<td class="vt-facility"><strong>'+_esc(row.facility)+'</strong></td>' +
      '<td><span class="fac-type-pill">'+_esc(row.facilityType||'—')+'</span></td>' +
      '<td class="vt-user" title="'+_esc(row.username)+'">'+_esc(uname)+'</td>' +
      '<td class="vt-sku">'+skuCell+'</td>' +
      '<td class="vt-num green">'+fmtNum(row.addedQty)+'</td>' +
      '<td class="vt-num orange">'+fmtNum(row.removedQty)+'</td>' +
      '<td class="vt-num">'+fmtVar(row.varianceQty)+'</td>' +
      '<td>'+statusCell+'</td>' +
      '<td class="vt-remark wrap">'+_esc(row.sourceRemark||'—')+'</td>' +
      '<td class="vt-user-remark">'+remarkCell+'</td>' +
      '</tr>';
  }).join('');
}

function _trimUser(u) {
  if (!u) return '—';
  var at = u.indexOf('@');
  return at > 0 ? u.substring(0, at) : u;
}

function _esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/'/g,"&#39;")
    .replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
