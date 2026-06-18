// expiry-tracker.js — V4.1
// Fixes: date format normalisation (ISO + Date objects)
// Added: Facility Type filter, Excel export

function renderExpiry() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="expiry-root"></div>';
  var root = document.getElementById('expiry-root');
  var now = new Date();
  var defaultMonth = now.getFullYear() + '-' + (now.getMonth()+1<10?'0':'') + (now.getMonth()+1);

  root.innerHTML =
    '<div class="page-header"><div class="page-header-row">' +
      '<div><h2>Expiry Tracker</h2><p>Batch swaps where shelf life was lost or gained</p></div>' +
      '<div class="page-header-controls" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
        _buildMonthSelect('expiry-month-picker', defaultMonth, '_expiryMonthChange') +
        '<select id="expiry-factype-filter" class="month-select" onchange="_expiryFacTypeChange(this.value)">' +
          '<option value="">All Facility Types</option>' +
        '</select>' +
        '<div class="expiry-filter-group">' +
          '<button class="expiry-filter-btn active" id="ef-all"  onclick="_expiryFilter(\'all\')">All</button>' +
          '<button class="expiry-filter-btn" id="ef-loss" onclick="_expiryFilter(\'Loss\')">Loss Only</button>' +
          '<button class="expiry-filter-btn" id="ef-gain" onclick="_expiryFilter(\'Gain\')">Gain Only</button>' +
        '</div>' +
        '<button class="btn-icon" onclick="_expiryExportExcel()" title="Export to Excel" style="display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid var(--border);color:var(--text-secondary);background:var(--surface);cursor:pointer;">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          'Excel' +
        '</button>' +
      '</div>' +
    '</div></div>' +
    '<div class="kpi-strip" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">' +
      '<div class="kpi-card" style="--kpi-color:#DC2626;--kpi-bg:#FEE2E2"><div class="kpi-label">Expiry Loss Cases</div><div class="kpi-value accent" id="expiry-loss-count">—</div><div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div></div>' +
      '<div class="kpi-card" style="--kpi-color:#059669;--kpi-bg:#D1FAE5"><div class="kpi-label">Expiry Gain Cases</div><div class="kpi-value accent" id="expiry-gain-count">—</div><div class="kpi-icon"><svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/></svg></div></div>' +
      '<div class="kpi-card" style="--kpi-color:#D97706;--kpi-bg:#FEF3C7"><div class="kpi-label">Worst Loss (days)</div><div class="kpi-value accent" id="expiry-worst-days">—</div><div class="kpi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div>' +
    '</div>' +
    '<div class="card section-row"><div id="expiry-table-container"><div style="padding:32px;text-align:center;color:var(--text-muted)">Loading…</div></div></div>';

  _expiryCurrentMonth  = defaultMonth;
  _expiryCurrentFilter = 'all';
  _expiryCurrentFacType = '';
  _expiryLoad(defaultMonth);
}

var _expiryCurrentMonth   = '';
var _expiryCurrentFilter  = 'all';
var _expiryCurrentFacType = '';
var _expiryAllRecords     = [];

function _expiryMonthChange(m) { _expiryCurrentMonth = m; _expiryLoad(m); }

function _expiryFacTypeChange(ft) {
  _expiryCurrentFacType = ft;
  _expiryRender();
}

function _expiryFilter(f) {
  _expiryCurrentFilter = f;
  ['all','loss','gain'].forEach(function(k) {
    var btn = document.getElementById('ef-' + k);
    if (btn) btn.classList.toggle('active', k === f.toLowerCase());
  });
  _expiryRender();
}

function _expiryLoad(month) {
  var c = document.getElementById('expiry-table-container');
  if (c) c.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Loading…</div>';
  _expiryUpdateCards(null);
  apiCall('getBatchExpiry', { month: month }, function(records) {
    _expiryAllRecords = Array.isArray(records) ? records : [];
    // Populate facility type filter
    _expiryPopulateFacTypeFilter();
    _expiryRender();
  });
}

function _expiryPopulateFacTypeFilter() {
  var sel = document.getElementById('expiry-factype-filter');
  if (!sel) return;
  var types = {};
  _expiryAllRecords.forEach(function(r) {
    var ft = _eVal(r, 'Facility_Type');
    if (ft) types[ft] = true;
  });
  var current = sel.value;
  sel.innerHTML = '<option value="">All Facility Types</option>';
  Object.keys(types).sort().forEach(function(ft) {
    var opt = document.createElement('option');
    opt.value = ft; opt.textContent = ft;
    if (ft === current) opt.selected = true;
    sel.appendChild(opt);
  });
}

function _expiryRender() {
  var filtered = _expiryAllRecords.filter(function(r) {
    if (_expiryCurrentFilter !== 'all' && _eVal(r,'Expiry_Status') !== _expiryCurrentFilter) return false;
    if (_expiryCurrentFacType && _eVal(r,'Facility_Type') !== _expiryCurrentFacType) return false;
    return true;
  });
  filtered.sort(function(a,b) {
    return (parseFloat(_eVal(b,'Expiry_Diff_Days'))||0) - (parseFloat(_eVal(a,'Expiry_Diff_Days'))||0);
  });
  _expiryUpdateCards(filtered);
  _expiryRenderTable(filtered);
}

// Read field value regardless of key casing
function _eVal(r, key) {
  if (r[key] !== undefined) return String(r[key] || '');
  var lk = key.toLowerCase().replace(/_/g,'');
  for (var k in r) {
    if (k.toLowerCase().replace(/_/g,'') === lk) return String(r[k] || '');
  }
  return '';
}

// Normalise any date value to YYYY-MM-DD
function _expiryNormaliseDate(v) {
  if (!v || v === 'undefined' || v === 'null') return '—';
  var s = String(v).trim();
  if (!s) return '—';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // ISO with time: 2027-11-29T18:30:00.000Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.substring(0, 10);
  // Try parsing anything else (e.g. "Fri Feb 28 2031 ...")
  try {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var mo = d.getMonth()+1; var dy = d.getDate();
      return d.getFullYear()+'-'+(mo<10?'0'+mo:''+mo)+'-'+(dy<10?'0'+dy:''+dy);
    }
  } catch(e) {}
  return s.substring(0, 10);
}

function _expiryUpdateCards(records) {
  var lossCount=0, gainCount=0, worstLoss=0;
  if (records) {
    records.forEach(function(r) {
      var d=parseFloat(_eVal(r,'Expiry_Diff_Days'))||0, st=_eVal(r,'Expiry_Status');
      if (st==='Loss'){lossCount++;if(d>worstLoss)worstLoss=d;}
      if (st==='Gain') gainCount++;
    });
  }
  var lc=document.getElementById('expiry-loss-count');
  var gc=document.getElementById('expiry-gain-count');
  var wc=document.getElementById('expiry-worst-days');
  if(lc)lc.textContent=records!==null?lossCount:'—';
  if(gc)gc.textContent=records!==null?gainCount:'—';
  if(wc)wc.textContent=records!==null?(worstLoss>0?worstLoss+'d':'—'):'—';
}

function _expiryRenderTable(records) {
  var container = document.getElementById('expiry-table-container');
  if (!container) return;
  if (!records || !records.length) {
    container.innerHTML = emptyState('No expiry cases found',
      'No batch swap events matching the current filters.');
    return;
  }
  var rows = records.map(function(r) {
    var diff    = parseFloat(_eVal(r,'Expiry_Diff_Days'))||0;
    var status  = _eVal(r,'Expiry_Status');
    var addExp  = _expiryNormaliseDate(_eVal(r,'ADD_Expiry'));
    var remExp  = _expiryNormaliseDate(_eVal(r,'REMOVE_Expiry'));
    var date    = _expiryNormaliseDate(_eVal(r,'Process_Date'));
    var user    = _eVal(r,'Username'); user = user.indexOf('@')>=0?user.split('@')[0]:user;
    var diffTxt = diff>0
      ? '<span class="expiry-diff-loss">▼ '+diff+'d lost</span>'
      : diff<0
        ? '<span class="expiry-diff-gain">▲ '+Math.abs(diff)+'d gained</span>'
        : '<span style="color:var(--text-muted)">0d</span>';
    var stCls = status==='Loss'?'badge-red':status==='Gain'?'badge-green':'badge-gray';
    return '<tr>' +
      '<td style="font-size:12px;color:var(--text-secondary)">'+_eEsc(date)+'</td>'+
      '<td><div style="font-weight:600;font-size:12.5px;">'+_eEsc(_eVal(r,'Facility_Display')||_eVal(r,'Facility_Raw'))+'</div>'+
        (_eVal(r,'Facility_Type')?'<span class="fac-type-pill">'+_eEsc(_eVal(r,'Facility_Type'))+'</span>':'')+'</td>'+
      '<td><div class="sku-code">'+_eEsc(_eVal(r,'SKU_Code'))+'</div><div class="sku-name">'+_eEsc(_eVal(r,'Item_Name'))+'</div></td>'+
      '<td><div class="expiry-batch-detail">Batch: '+_eEsc(_eVal(r,'ADD_Batch'))+'</div>'+
        '<div class="expiry-batch-expiry">'+_eEsc(addExp)+'</div>'+
        '<div class="expiry-batch-detail">Qty: '+_eEsc(_eVal(r,'ADD_Qty'))+'</div></td>'+
      '<td><div class="expiry-batch-detail">Batch: '+_eEsc(_eVal(r,'REMOVE_Batch'))+'</div>'+
        '<div class="expiry-batch-expiry">'+_eEsc(remExp)+'</div>'+
        '<div class="expiry-batch-detail">Qty: '+_eEsc(_eVal(r,'REMOVE_Qty'))+'</div></td>'+
      '<td>'+diffTxt+'</td>'+
      '<td><span class="badge '+stCls+'">'+_eEsc(status)+'</span></td>'+
      '<td style="font-size:12px">'+_eEsc(user)+'</td>'+
    '</tr>';
  }).join('');

  container.innerHTML =
    '<div class="table-wrap"><table>' +
    '<thead><tr><th>Date</th><th>Facility</th><th>SKU / Item</th>'+
    '<th>ADD Batch</th><th>REMOVE Batch</th>'+
    '<th>Days</th><th>Status</th><th>User</th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table></div>' +
    '<div class="result-count">'+records.length+' records</div>';
}

// ── Excel Export ──────────────────────────────────────────────
function _expiryExportExcel() {
  var records = _expiryAllRecords.filter(function(r) {
    if (_expiryCurrentFilter !== 'all' && _eVal(r,'Expiry_Status') !== _expiryCurrentFilter) return false;
    if (_expiryCurrentFacType && _eVal(r,'Facility_Type') !== _expiryCurrentFacType) return false;
    return true;
  });

  if (!records.length) { showToast('No data to export', 'info'); return; }

  var headers = ['Date','Facility','Facility Type','SKU Code','Item Name',
    'ADD Batch','ADD Expiry','ADD Qty','REMOVE Batch','REMOVE Expiry','REMOVE Qty',
    'Days Lost/Gained','Status','Username'];

  var rows = records.map(function(r) {
    return [
      _expiryNormaliseDate(_eVal(r,'Process_Date')),
      _eVal(r,'Facility_Display') || _eVal(r,'Facility_Raw'),
      _eVal(r,'Facility_Type'),
      _eVal(r,'SKU_Code'),
      _eVal(r,'Item_Name'),
      _eVal(r,'ADD_Batch'),
      _expiryNormaliseDate(_eVal(r,'ADD_Expiry')),
      _eVal(r,'ADD_Qty'),
      _eVal(r,'REMOVE_Batch'),
      _expiryNormaliseDate(_eVal(r,'REMOVE_Expiry')),
      _eVal(r,'REMOVE_Qty'),
      _eVal(r,'Expiry_Diff_Days'),
      _eVal(r,'Expiry_Status'),
      _eVal(r,'Username'),
    ];
  });

  // Build CSV with BOM for Excel UTF-8 compatibility
  var csv = '\uFEFF' + [headers].concat(rows).map(function(row) {
    return row.map(function(cell) {
      return '"' + String(cell || '').replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n');

  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'expiry_tracker_' + _expiryCurrentMonth + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported ' + records.length + ' records', 'success');
}

function _eEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
