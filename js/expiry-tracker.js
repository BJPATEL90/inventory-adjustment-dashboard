// ============================================================
// expiry-tracker.js — V3 NEW
// Uses renderExpiry() pattern matching existing app.js
// Shows batch-level expiry loss/gain cases
// ============================================================

function renderExpiry() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="expiry-root"></div>';
  var root = document.getElementById('expiry-root');

  var now = new Date();
  var defaultMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  root.innerHTML =
    '<div class="page-header">' +
      '<div class="page-header-row">' +
        '<div><h2>Expiry Tracker</h2><p>Batch swap events where shelf life was lost or gained</p></div>' +
        '<div class="page-header-controls" style="display:flex;gap:8px;align-items:center;">' +
          '<input type="month" id="expiry-month-picker" class="month-select" value="' + defaultMonth + '" onchange="_expiryMonthChange(this.value)" />' +
          '<div style="display:flex;gap:4px;">' +
            '<button class="view-toggle-btn active" id="expiry-filter-all"  onclick="_expirySetFilter(\'all\')" >All</button>' +
            '<button class="view-toggle-btn" id="expiry-filter-loss" onclick="_expirySetFilter(\'Loss\')">Loss Only</button>' +
            '<button class="view-toggle-btn" id="expiry-filter-gain" onclick="_expirySetFilter(\'Gain\')">Gain Only</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px;" id="expiry-kpi-row">' +
      '<div class="kpi-card" style="--kpi-color:#DC2626;--kpi-bg:#FEE2E2"><div class="kpi-label">Expiry Loss Cases</div><div class="kpi-value" id="expiry-loss-count">—</div></div>' +
      '<div class="kpi-card" style="--kpi-color:#059669;--kpi-bg:#D1FAE5"><div class="kpi-label">Expiry Gain Cases</div><div class="kpi-value" id="expiry-gain-count">—</div></div>' +
      '<div class="kpi-card" style="--kpi-color:#D97706;--kpi-bg:#FEF3C7"><div class="kpi-label">Worst Loss (days)</div><div class="kpi-value" id="expiry-worst-days">—</div></div>' +
    '</div>' +
    '<div class="card section-row"><div id="expiry-table-container"><div class="loading-msg">Loading expiry data…</div></div></div>';

  _expiryCurrentMonth = defaultMonth;
  _expiryCurrentFilter = 'all';
  _expiryLoad(defaultMonth);
}

var _expiryCurrentMonth = '';
var _expiryCurrentFilter = 'all';
var _expiryAllRecords = [];

function _expiryMonthChange(month) {
  _expiryCurrentMonth = month;
  _expiryLoad(month);
}

function _expirySetFilter(filter) {
  _expiryCurrentFilter = filter;
  ['all','loss','gain'].forEach(function(f) {
    var btn = document.getElementById('expiry-filter-' + f);
    if (btn) btn.classList.toggle('active', f === filter.toLowerCase());
  });
  _expiryRender();
}

function _expiryLoad(month) {
  var container = document.getElementById('expiry-table-container');
  if (container) container.innerHTML = '<div class="loading-msg">Loading expiry data…</div>';
  _expiryUpdateCards(null);

  apiCall('getBatchExpiry', { month: month }, function(records) {
    _expiryAllRecords = records || [];
    _expiryRender();
  });
}

function _expiryRender() {
  var filtered = _expiryAllRecords.filter(function(r) {
    if (_expiryCurrentFilter === 'all') return true;
    return r['Expiry_Status'] === _expiryCurrentFilter;
  });

  filtered.sort(function(a, b) {
    return (parseFloat(b['Expiry_Diff_Days']) || 0) - (parseFloat(a['Expiry_Diff_Days']) || 0);
  });

  _expiryUpdateCards(filtered);
  _expiryRenderTable(filtered);
}

function _expiryUpdateCards(records) {
  var lossCount = 0, gainCount = 0, worstLoss = 0;
  if (records) {
    records.forEach(function(r) {
      var d = parseFloat(r['Expiry_Diff_Days']) || 0;
      if (r['Expiry_Status'] === 'Loss') { lossCount++; if (d > worstLoss) worstLoss = d; }
      if (r['Expiry_Status'] === 'Gain') gainCount++;
    });
  }
  var lossEl  = document.getElementById('expiry-loss-count');
  var gainEl  = document.getElementById('expiry-gain-count');
  var worstEl = document.getElementById('expiry-worst-days');
  if (lossEl)  lossEl.textContent  = records !== null ? lossCount : '—';
  if (gainEl)  gainEl.textContent  = records !== null ? gainCount : '—';
  if (worstEl) worstEl.textContent = records !== null ? (worstLoss > 0 ? worstLoss + 'd' : '—') : '—';
}

function _expiryRenderTable(records) {
  var container = document.getElementById('expiry-table-container');
  if (!container) return;

  if (!records || !records.length) {
    container.innerHTML = emptyState('No expiry cases found', 'No batch swap events with expiry loss or gain for this period.');
    return;
  }

  var rows = records.map(function(r) {
    var diff    = parseFloat(r['Expiry_Diff_Days']) || 0;
    var status  = r['Expiry_Status'] || '';
    var diffText = diff > 0 ? '<span style="color:#DC2626;font-weight:700;">+' + diff + 'd lost</span>'
                 : diff < 0 ? '<span style="color:#059669;font-weight:700;">▲' + Math.abs(diff) + 'd gained</span>'
                 : '0d';
    var statusStyle = status === 'Loss' ? 'background:#FEE2E2;color:#991B1B;'
                    : status === 'Gain' ? 'background:#D1FAE5;color:#065F46;'
                    : 'background:#E5E7EB;color:#374151;';

    return '<tr>' +
      '<td>' + _eEsc(r['Process_Date'] || '') + '</td>' +
      '<td><div style="font-weight:600;">' + _eEsc(r['Facility_Display'] || r['Facility_Raw'] || '') + '</div>' +
        (r['Facility_Type'] ? '<span class="badge badge-blue" style="font-size:10px;">' + _eEsc(r['Facility_Type']) + '</span>' : '') +
      '</td>' +
      '<td><div style="font-size:12px;font-weight:600;font-family:monospace;">' + _eEsc(r['SKU_Code'] || '') + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">' + _eEsc(r['Item_Name'] || '') + '</div>' +
      '</td>' +
      '<td><div style="font-size:11px;color:var(--text-muted);">Batch: ' + _eEsc(r['ADD_Batch'] || '—') + '</div>' +
        '<div style="font-weight:600;">' + _eEsc(r['ADD_Expiry'] || '—') + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">Qty: ' + _eEsc(r['ADD_Qty'] || '') + '</div>' +
      '</td>' +
      '<td><div style="font-size:11px;color:var(--text-muted);">Batch: ' + _eEsc(r['REMOVE_Batch'] || '—') + '</div>' +
        '<div style="font-weight:600;">' + _eEsc(r['REMOVE_Expiry'] || '—') + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">Qty: ' + _eEsc(r['REMOVE_Qty'] || '') + '</div>' +
      '</td>' +
      '<td>' + diffText + '</td>' +
      '<td><span style="' + statusStyle + 'font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;">' + status + '</span></td>' +
      '<td style="font-size:12px;">' + _eEsc((r['Username'] || '').split('@')[0]) + '</td>' +
    '</tr>';
  }).join('');

  container.innerHTML =
    '<div class="table-wrap"><table>' +
      '<thead><tr>' +
        '<th>Date</th><th>Facility</th><th>SKU / Item</th>' +
        '<th>ADD Batch</th><th>REMOVE Batch</th>' +
        '<th>Days</th><th>Status</th><th>User</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>';
}

function _eEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
