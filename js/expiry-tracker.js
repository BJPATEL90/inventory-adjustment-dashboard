// expiry-tracker.js — V4
// Fixed: data key reading (handles both capitalised and flat keys), KPI card layout

function renderExpiry() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="expiry-root"></div>';
  var root = document.getElementById('expiry-root');
  var now = new Date();
  var defaultMonth = now.getFullYear() + '-' + (now.getMonth()+1<10?'0':'') + (now.getMonth()+1);

  root.innerHTML =
    '<div class="page-header"><div class="page-header-row">' +
      '<div><h2>Expiry Tracker</h2><p>Batch swaps where shelf life was lost or gained</p></div>' +
      '<div class="page-header-controls">' +
        '<input type="month" id="expiry-month-picker" class="month-select" value="' + defaultMonth + '" onchange="_expiryMonthChange(this.value)"/>' +
        '<div class="expiry-filter-group">' +
          '<button class="expiry-filter-btn active" id="ef-all"  onclick="_expiryFilter(\'all\')">All</button>' +
          '<button class="expiry-filter-btn" id="ef-loss" onclick="_expiryFilter(\'Loss\')">Loss Only</button>' +
          '<button class="expiry-filter-btn" id="ef-gain" onclick="_expiryFilter(\'Gain\')">Gain Only</button>' +
        '</div>' +
      '</div>' +
    '</div></div>' +
    '<div class="kpi-strip" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px;">' +
      '<div class="kpi-card" style="--kpi-color:#DC2626;--kpi-bg:#FEE2E2"><div class="kpi-label">Expiry Loss Cases</div><div class="kpi-value accent" id="expiry-loss-count">—</div><div class="kpi-icon"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div></div>' +
      '<div class="kpi-card" style="--kpi-color:#059669;--kpi-bg:#D1FAE5"><div class="kpi-label">Expiry Gain Cases</div><div class="kpi-value accent" id="expiry-gain-count">—</div><div class="kpi-icon"><svg viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/></svg></div></div>' +
      '<div class="kpi-card" style="--kpi-color:#D97706;--kpi-bg:#FEF3C7"><div class="kpi-label">Worst Loss (days)</div><div class="kpi-value accent" id="expiry-worst-days">—</div><div class="kpi-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div></div>' +
    '</div>' +
    '<div class="card section-row"><div id="expiry-table-container"><div style="padding:32px;text-align:center;color:var(--text-muted)">Loading…</div></div></div>';

  _expiryCurrentMonth = defaultMonth;
  _expiryCurrentFilter = 'all';
  _expiryLoad(defaultMonth);
}

var _expiryCurrentMonth = '';
var _expiryCurrentFilter = 'all';
var _expiryAllRecords = [];

function _expiryMonthChange(m) { _expiryCurrentMonth = m; _expiryLoad(m); }

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
    _expiryRender();
  });
}

function _expiryRender() {
  var filtered = _expiryAllRecords.filter(function(r) {
    if (_expiryCurrentFilter === 'all') return true;
    return _eVal(r, 'Expiry_Status') === _expiryCurrentFilter;
  });
  filtered.sort(function(a, b) {
    return (parseFloat(_eVal(b,'Expiry_Diff_Days'))||0) - (parseFloat(_eVal(a,'Expiry_Diff_Days'))||0);
  });
  _expiryUpdateCards(filtered);
  _expiryRenderTable(filtered);
}

// Read field regardless of case or format
function _eVal(r, key) {
  if (r[key] !== undefined) return String(r[key] || '');
  // try camelCase fallback
  var lk = key.toLowerCase().replace(/_/g,'');
  for (var k in r) {
    if (k.toLowerCase().replace(/_/g,'') === lk) return String(r[k] || '');
  }
  return '';
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
      'No batch swap events with expiry difference recorded. Run manualRunProcessing() if Batch_Expiry sheet is empty.');
    return;
  }
  var rows = records.map(function(r) {
    var diff   = parseFloat(_eVal(r,'Expiry_Diff_Days'))||0;
    var status = _eVal(r,'Expiry_Status');
    var user   = _eVal(r,'Username'); user = user.indexOf('@')>=0?user.split('@')[0]:user;
    var diffTxt = diff>0?'<span class="expiry-diff-loss">▼ '+diff+'d lost</span>'
                 :diff<0?'<span class="expiry-diff-gain">▲ '+Math.abs(diff)+'d gained</span>'
                 :'<span style="color:var(--text-muted)">0d</span>';
    var stCls = status==='Loss'?'badge-red':status==='Gain'?'badge-green':'badge-gray';
    return '<tr>' +
      '<td style="font-size:12px;color:var(--text-secondary)">'+_eEsc(_eVal(r,'Process_Date'))+'</td>'+
      '<td><div style="font-weight:600;font-size:12.5px;">'+_eEsc(_eVal(r,'Facility_Display')||_eVal(r,'Facility_Raw'))+'</div>'+
        (_eVal(r,'Facility_Type')?'<span class="fac-type-pill">'+_eEsc(_eVal(r,'Facility_Type'))+'</span>':'')+'</td>'+
      '<td><div class="sku-code">'+_eEsc(_eVal(r,'SKU_Code'))+'</div><div class="sku-name">'+_eEsc(_eVal(r,'Item_Name'))+'</div></td>'+
      '<td><div class="expiry-batch-detail">Batch: '+_eEsc(_eVal(r,'ADD_Batch'))+'</div>'+
        '<div class="expiry-batch-expiry">'+_eEsc(_eVal(r,'ADD_Expiry'))+'</div>'+
        '<div class="expiry-batch-detail">Qty: '+_eEsc(_eVal(r,'ADD_Qty'))+'</div></td>'+
      '<td><div class="expiry-batch-detail">Batch: '+_eEsc(_eVal(r,'REMOVE_Batch'))+'</div>'+
        '<div class="expiry-batch-expiry">'+_eEsc(_eVal(r,'REMOVE_Expiry'))+'</div>'+
        '<div class="expiry-batch-detail">Qty: '+_eEsc(_eVal(r,'REMOVE_Qty'))+'</div></td>'+
      '<td>'+diffTxt+'</td>'+
      '<td><span class="badge '+stCls+'">'+_eEsc(status)+'</span></td>'+
      '<td style="font-size:12px">'+_eEsc(user)+'</td>'+
    '</tr>';
  }).join('');

  container.innerHTML =
    '<div class="table-wrap"><table>' +
    '<thead><tr><th>Date</th><th>Facility</th><th>SKU / Item</th><th>ADD Batch</th><th>REMOVE Batch</th><th>Days</th><th>Status</th><th>User</th></tr></thead>' +
    '<tbody>'+rows+'</tbody></table></div>';
}

function _eEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
