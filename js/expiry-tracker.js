// ============================================================
// variance-tracker.js — V3
// Uses renderVariance() pattern matching existing app.js
// 2-level navigation: Facility cards → filtered SKU table
// Expiry Loss/Gain rows shown with distinct styling
// ============================================================

function renderVariance() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="variance-root"></div>';
  var root = document.getElementById('variance-root');

  var now = new Date();
  var defaultMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  root.innerHTML =
    '<div class="page-header">' +
      '<div class="page-header-row">' +
        '<div><h2>Variance Tracker</h2><p>MTD variance by facility — click a facility to drill down</p></div>' +
        '<div class="page-header-controls">' +
          _buildMonthSelect('variance-month-picker', defaultMonth, '_varianceMonthChange') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="variance-level1"><div id="variance-facility-cards"><div class="loading-msg">Loading facilities…</div></div></div>' +
    '<div id="variance-level2" style="display:none">' +
      '<div class="l2-header" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
        '<button class="btn btn-ghost" onclick="_varianceBack()" style="display:flex;align-items:center;gap:6px;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>' +
          'All Facilities' +
        '</button>' +
        '<h3 id="variance-l2-title" style="margin:0;font-size:18px;font-weight:700;"></h3>' +
      '</div>' +
      '<div class="card"><div id="variance-table-container"><div class="loading-msg">Loading…</div></div></div>' +
    '</div>';

  _varianceLoadFacilities(defaultMonth);
}

var _varianceCurrentMonth = '';

function _varianceMonthChange(month) {
  _varianceCurrentMonth = month;
  document.getElementById('variance-level2').style.display = 'none';
  document.getElementById('variance-level1').style.display = '';
  _varianceLoadFacilities(month);
}

function _varianceBack() {
  document.getElementById('variance-level2').style.display = 'none';
  document.getElementById('variance-level1').style.display = '';
}

function _varianceLoadFacilities(month) {
  _varianceCurrentMonth = month;
  var container = document.getElementById('variance-facility-cards');
  container.innerHTML = '<div class="loading-msg">Loading facilities…</div>';

  apiCall('getVarianceFacilities', { month: month }, function(facilities) {
    _varianceRenderCards(facilities || []);
  });
}

function _varianceRenderCards(facilities) {
  var container = document.getElementById('variance-facility-cards');
  if (!facilities.length) {
    container.innerHTML = emptyState('No variance recorded', 'No facilities had variance this period.');
    return;
  }

  var html = '<div class="facility-cards-grid">';
  facilities.forEach(function(f) {
    var netV     = parseFloat(f.netVariance) || 0;
    var netSign  = netV > 0 ? '+' : '';
    var netColor = netV !== 0 ? 'color:#DC2626;' : 'color:#059669;';
    var expiryBadge = f.expiryLoss > 0
      ? '<div style="margin-top:8px;"><span style="background:#FEE2E2;color:#991B1B;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;">⏱ ' + f.expiryLoss + ' expiry loss</span></div>'
      : '';

    html +=
      '<div class="facility-card" onclick="_varianceDrilldown(' + JSON.stringify(f.facility) + ')" style="cursor:pointer;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">' +
          '<span style="font-weight:700;font-size:14px;">' + _vEsc(f.facility) + '</span>' +
          (f.facilityType ? '<span class="badge badge-blue" style="font-size:11px;">' + _vEsc(f.facilityType) + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:24px;">' +
          '<div><div style="font-size:22px;font-weight:700;">' + (f.varianceSKUs || 0) + '</div><div style="font-size:11px;color:var(--text-muted);">Variance SKUs</div></div>' +
          '<div><div style="font-size:22px;font-weight:700;' + netColor + '">' + netSign + (netV || 0) + '</div><div style="font-size:11px;color:var(--text-muted);">Net Qty</div></div>' +
        '</div>' +
        expiryBadge +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function _varianceDrilldown(facility) {
  document.getElementById('variance-level1').style.display = 'none';
  document.getElementById('variance-level2').style.display = '';
  document.getElementById('variance-l2-title').textContent = facility;
  document.getElementById('variance-table-container').innerHTML = '<div class="loading-msg">Loading variance data…</div>';

  apiCall('getVariance', { month: _varianceCurrentMonth, facility: facility }, function(records) {
    _varianceRenderTable(records || []);
  });
}

function _varianceRenderTable(records) {
  var container = document.getElementById('variance-table-container');
  if (!records.length) {
    container.innerHTML = emptyState('No variance records', 'No records found for this facility.');
    return;
  }

  // Group by date newest first
  var byDate = {};
  records.forEach(function(r) {
    var d = r['Process_Date'] || '';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });

  var html = '<div class="table-wrap"><table><thead><tr>' +
    '<th>Type</th><th>SKU / Item</th><th>User</th>' +
    '<th>Added</th><th>Removed</th><th>Variance</th>' +
    '<th>Status</th><th>Expiry Impact</th><th></th>' +
    '</tr></thead><tbody>';

  Object.keys(byDate).sort().reverse().forEach(function(date) {
    var recs = byDate[date];
    html += '<tr style="background:var(--canvas);"><td colspan="9" style="font-weight:700;font-size:12px;color:var(--text-muted);padding:6px 12px;border-top:2px solid var(--border);">' +
      date + ' <span style="font-weight:400;">(' + recs.length + ' records)</span></td></tr>';

    recs.forEach(function(r) {
      var vQty    = parseFloat(r['Variance_Qty']) || 0;
      var expSt   = r['Expiry_Status'] || '';
      var diffDays = parseFloat(r['Expiry_Diff_Days']) || 0;

      var rowStyle = '';
      if (expSt === 'Loss')      rowStyle = 'background:#fff5f5;';
      else if (expSt === 'Gain') rowStyle = 'background:#f0fff4;';
      else if (vQty > 0)         rowStyle = 'background:#ebf8ff;';
      else if (vQty < 0)         rowStyle = 'background:#fffaf0;';

      var statusHtml = statusBadge(r['Status'] || '');
      if (r['Has_Replace'] === 'YES') statusHtml += ' <span class="badge badge-red" style="font-size:10px;">REPLACE</span>';

      var expiryHtml = '';
      if (expSt === 'Loss' || expSt === 'Gain') {
        var dText = diffDays > 0
          ? '<span style="color:#DC2626;font-weight:700;">▼ ' + diffDays + 'd lost</span>'
          : '<span style="color:#059669;font-weight:700;">▲ ' + Math.abs(diffDays) + 'd gained</span>';
        expiryHtml = dText +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">ADD: ' + _vEsc(r['ADD_Earliest_Expiry'] || '—') + '<br>REM: ' + _vEsc(r['REMOVE_Latest_Expiry'] || '—') + '</div>';
      } else {
        expiryHtml = '<span style="color:var(--text-muted);">—</span>';
      }

      html +=
        '<tr style="' + rowStyle + '">' +
        '<td><span class="badge badge-blue" style="font-size:10px;">' + _vEsc(r['Facility_Type'] || '') + '</span></td>' +
        '<td><div style="font-size:12px;font-weight:600;font-family:monospace;">' + _vEsc(r['SKU_Code'] || '') + '</div><div style="font-size:11px;color:var(--text-muted);">' + _vEsc(r['Item_Name'] || '') + '</div></td>' +
        '<td style="font-size:12px;">' + _vEsc((r['Username'] || '').split('@')[0]) + '</td>' +
        '<td style="color:var(--green);font-weight:600;text-align:right;">' + (r['Added_Qty'] || 0) + '</td>' +
        '<td style="color:var(--orange);font-weight:600;text-align:right;">' + (r['Removed_Qty'] || 0) + '</td>' +
        '<td style="text-align:right;">' + fmtVar(vQty) + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td>' + expiryHtml + '</td>' +
        '<td>' + _vRemarkCell(r) + '</td>' +
        '</tr>';
    });
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function _vEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Backward compat alias
var Variance = { init: function(){}, render: renderVariance };

// Show existing remark text if available, otherwise show Add button
function _vRemarkCell(r) {
  var existingRemark = String(r['User_Remark'] || r['Source_Remark'] || '').trim();
  var date     = String(r['Process_Date']    || '');
  var facility = String(r['Facility_Display']|| r['Facility_Raw'] || '');
  var sku      = String(r['SKU_Code']        || '');
  var username = String(r['Username']        || '').split('@')[0];
  var item     = String(r['Item_Name']       || '');
  var key      = date + '_' + facility + '_' + sku;

  if (existingRemark && existingRemark !== '') {
    return '<div style="font-size:11.5px;color:var(--text-secondary);font-style:italic;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + _vEsc(existingRemark) + '">' +
      '<svg viewBox="0 0 24 24" width="11" height="11" style="margin-right:3px;vertical-align:middle;color:var(--green)"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      _vEsc(existingRemark.length > 40 ? existingRemark.substring(0,40) + '...' : existingRemark) +
    '</div>';
  }
  return '<button class="btn-remark" onclick="openRemarkModal(' +
    JSON.stringify(key) + ',' +
    JSON.stringify(date) + ',' +
    JSON.stringify(facility) + ',' +
    JSON.stringify(username) + ',' +
    JSON.stringify(sku) + ',' +
    JSON.stringify(item) +
    ')">+ Remark</button>';
}
