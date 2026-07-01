// ============================================================
// variance-tracker.js — V5 FINAL
// Changes:
//   - Date filter fixed (backend DashboardAPI patch required too)
//   - Duplicate dates deduped in dropdown
//   - Transaction Detail section below facility cards
//     (shows full facility-grouped breakdown when date selected)
//   - Drill-down: ADD_Batch and REMOVE_Batch shown per row
//   - Remark button uses data-attributes (no quoting issues)
// ============================================================

var _varianceCurrentMonth = '';
var _varianceCurrentDate  = '';

function renderVariance() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="variance-root"></div>';
  var root = document.getElementById('variance-root');

  var now = new Date();
  var m1  = now.getMonth()+1;
  var defaultMonth = now.getFullYear() + '-' + (m1<10?'0'+m1:''+m1);

  root.innerHTML =
    '<div class="page-header">' +
      '<div class="page-header-row">' +
        '<div><h2>Variance Tracker</h2><p id="variance-sub">MTD variance by facility — click a facility to drill down</p></div>' +
        '<div class="page-header-controls" style="display:flex;align-items:center;gap:10px;">' +
          _buildMonthSelect('variance-month-picker', defaultMonth, '_varianceMonthChange') +
          '<select id="variance-date-picker" class="month-select" onchange="_varianceDateChange(this.value)" style="min-width:140px;">' +
            '<option value="">All Dates</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Level 1: Facility cards
    '<div id="variance-level1">' +
      '<div id="variance-facility-cards"><div class="loading-msg">Loading facilities…</div></div>' +
      // Transaction detail section — shown below cards when date selected
      '<div id="variance-transactions" style="display:none;margin-top:24px;"></div>' +
    '</div>' +

    // Level 2: Facility drill-down
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

  _varianceCurrentMonth = defaultMonth;
  _varianceCurrentDate  = '';
  _varianceLoadDates(defaultMonth);
  _varianceLoadFacilities(defaultMonth, '');
}

// ── Date normalisation ────────────────────────────────────────
function _vNormDate(raw) {
  if (!raw) return '';
  if (raw instanceof Date) {
    var mo=raw.getMonth()+1; var dy=raw.getDate();
    return raw.getFullYear()+'-'+(mo<10?'0'+mo:''+mo)+'-'+(dy<10?'0'+dy:''+dy);
  }
  var s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.length > 10) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var mo2=d.getMonth()+1; var dy2=d.getDate();
      return d.getFullYear()+'-'+(mo2<10?'0'+mo2:''+mo2)+'-'+(dy2<10?'0'+dy2:''+dy2);
    }
  }
  return s.substring(0,10);
}

// ── Date dropdown — populated from getDailyTrend ──────────────
function _varianceLoadDates(month) {
  apiFetch('getDailyTrend', { month: month }, true).then(function(data) {
    var trend = (data && data.trend) ? data.trend : [];
    var sel = document.getElementById('variance-date-picker');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Dates</option>';
    var seen = {};  // dedupe
    trend.forEach(function(d) {
      var dateStr = String(d.date || '').substring(0, 10);
      if (!dateStr || seen[dateStr]) return;
      seen[dateStr] = true;
      var opt = document.createElement('option');
      opt.value = dateStr;
      var parts = dateStr.split('-');
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      opt.textContent = parseInt(parts[2]) + ' ' + months[parseInt(parts[1])-1] + ' ' + parts[0];
      sel.appendChild(opt);
    });
  }).catch(function(){});
}

// ── Month / date change handlers ──────────────────────────────
function _varianceMonthChange(month) {
  _varianceCurrentMonth = month;
  _varianceCurrentDate  = '';
  var dateSel = document.getElementById('variance-date-picker');
  if (dateSel) dateSel.value = '';
  document.getElementById('variance-level2').style.display = 'none';
  document.getElementById('variance-level1').style.display = '';
  _varianceLoadDates(month);
  _varianceLoadFacilities(month, '');
}

function _varianceDateChange(date) {
  _varianceCurrentDate = date;
  document.getElementById('variance-level2').style.display = 'none';
  document.getElementById('variance-level1').style.display = '';
  var sub = document.getElementById('variance-sub');
  if (sub) sub.textContent = date
    ? 'Variance for ' + date + ' — click a facility to drill down'
    : 'MTD variance by facility — click a facility to drill down';
  _varianceLoadFacilities(_varianceCurrentMonth, date);
}

function _varianceBack() {
  document.getElementById('variance-level2').style.display = 'none';
  document.getElementById('variance-level1').style.display = '';
}

// ── Level 1: Load facility cards ─────────────────────────────
function _varianceLoadFacilities(month, date) {
  _varianceCurrentMonth = month;
  var cardsContainer = document.getElementById('variance-facility-cards');
  var txnContainer   = document.getElementById('variance-transactions');
  cardsContainer.innerHTML = '<div class="loading-msg">Loading facilities…</div>';
  if (txnContainer) { txnContainer.style.display = 'none'; txnContainer.innerHTML = ''; }

  var params = { month: month };
  if (date) params.date = date;

  apiCall('getVarianceFacilities', params, function(facilities) {
    _varianceRenderCards(facilities || []);
    _variancePopulateDownload(month, date);

    // If date selected, load transaction detail section
    if (date) {
      _varianceLoadTransactions(month, date);
    }
  });
}

// ── Populate CSV download rows ────────────────────────────────
function _variancePopulateDownload(month, date) {
  var params = { month: month };
  if (date) params.date = date;
  apiFetch('getVariance', params, true).then(function(records) {
    var cols = [
      'Process_Date','Facility_Raw','Facility_Display','Facility_Type','Brand',
      'Username','SKU_Code','Item_Name','Added_Qty','Removed_Qty',
      'Variance_Qty','Status','Has_Replace','Replace_Qty','Source_Remark',
      'ADD_Batch','REMOVE_Batch'
    ];
    APP._downloadRows = (records || []).map(function(r) {
      var row = {};
      cols.forEach(function(c) {
        row[c] = c === 'Process_Date' ? _vNormDate(r[c])
               : c === 'Username'     ? String(r[c]||'').split('@')[0]
               : String(r[c]||'');
      });
      return row;
    });
  }).catch(function(){});
}

// ── Render facility cards ─────────────────────────────────────
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
      '<div class="facility-card" data-fac="' + _vEsc(f.facility) + '" style="cursor:pointer;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">' +
          '<span style="font-weight:700;font-size:14px;">' + _vEsc(f.facility) + '</span>' +
          (f.facilityType ? '<span class="badge badge-blue" style="font-size:11px;">' + _vEsc(f.facilityType) + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:24px;">' +
          '<div><div style="font-size:22px;font-weight:700;">' + (f.varianceSKUs||0) + '</div><div style="font-size:11px;color:var(--text-muted);">Variance SKUs</div></div>' +
          '<div><div style="font-size:22px;font-weight:700;' + netColor + '">' + netSign + (netV||0) + '</div><div style="font-size:11px;color:var(--text-muted);">Net Qty</div></div>' +
        '</div>' +
        expiryBadge +
      '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
  container.querySelectorAll('.facility-card').forEach(function(card) {
    card.addEventListener('click', function() {
      _varianceDrilldown(card.getAttribute('data-fac'));
    });
  });
}

// ── Transaction Detail Section ────────────────────────────────
// Shown below facility cards when a date is selected.
// Groups all transactions for that date by facility.

function _varianceLoadTransactions(month, date) {
  var container = document.getElementById('variance-transactions');
  if (!container) return;
  container.style.display = '';
  container.innerHTML =
    '<div class="card" style="margin-bottom:0;">' +
      '<div class="card-header">' +
        '<span class="card-title">Transaction Detail — ' + date + '</span>' +
        '<span class="card-badge">Full Day</span>' +
      '</div>' +
      '<div id="variance-txn-body"><div class="loading-msg">Loading transactions…</div></div>' +
    '</div>';

  apiFetch('getVariance', { month: month, date: date }, true).then(function(records) {
    _varianceRenderTransactions(records || []);
  }).catch(function() {
    var b = document.getElementById('variance-txn-body');
    if (b) b.innerHTML = emptyState('Failed to load', 'Could not fetch transaction data.');
  });
}

function _varianceRenderTransactions(records) {
  var body = document.getElementById('variance-txn-body');
  if (!body) return;
  if (!records.length) {
    body.innerHTML = emptyState('No transactions', 'No records found for this date.');
    return;
  }

  // Group by facility
  var byFac = {};
  var facOrder = [];
  records.forEach(function(r) {
    var fac = String(r['Facility_Display'] || r['Facility_Raw'] || '');
    if (!byFac[fac]) { byFac[fac] = []; facOrder.push(fac); }
    byFac[fac].push(r);
  });

  var html = '';
  facOrder.forEach(function(fac) {
    var recs = byFac[fac];
    var facType = recs[0]['Facility_Type'] || '';
    var facAdded = 0; var facRemoved = 0; var facNet = 0;
    recs.forEach(function(r) {
      facAdded   += parseFloat(r['Added_Qty'])   || 0;
      facRemoved += parseFloat(r['Removed_Qty'])  || 0;
      facNet     += parseFloat(r['Variance_Qty']) || 0;
    });

    html += '<div style="margin-bottom:20px;">' +
      // Facility header bar
      '<div style="display:flex;justify-content:space-between;align-items:center;' +
        'background:var(--canvas);padding:10px 16px;border-radius:8px;margin-bottom:8px;' +
        'border-left:4px solid var(--brand);">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span style="font-weight:700;font-size:14px;">' + _vEsc(fac) + '</span>' +
          (facType ? '<span class="badge badge-blue" style="font-size:11px;">' + _vEsc(facType) + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:20px;font-size:12px;">' +
          '<span style="color:var(--green);font-weight:600;">+' + fmtNum(facAdded) + ' added</span>' +
          '<span style="color:var(--orange);font-weight:600;">' + fmtNum(facRemoved) + ' removed</span>' +
          '<span style="font-weight:700;color:' + (facNet>0?'var(--orange)':facNet<0?'var(--red, #DC2626)':'var(--green)') + ';">' +
            (facNet>=0?'+':'') + fmtNum(facNet) + ' net</span>' +
        '</div>' +
      '</div>' +
      // Transaction rows table
      '<div class="table-wrap" style="margin-bottom:4px;">' +
        '<table><thead><tr>' +
          '<th>User</th><th>SKU / Item</th>' +
          '<th style="text-align:right">Added</th>' +
          '<th style="text-align:right">Removed</th>' +
          '<th style="text-align:right">Net</th>' +
          '<th>Status</th>' +
        '</tr></thead><tbody>';

    recs.forEach(function(r) {
      var vQty = parseFloat(r['Variance_Qty']) || 0;
      var vCls = vQty > 0 ? 'variance-pos' : vQty < 0 ? 'variance-neg' : 'variance-zero';
      var user = String(r['Username']||'').split('@')[0];
      var hasReplace = r['Has_Replace'] === 'YES';
      html +=
        '<tr>' +
        '<td style="font-size:12px;white-space:nowrap;">' + _vEsc(user) + '</td>' +
        '<td>' +
          '<div style="font-size:11px;font-weight:600;font-family:monospace;">' + _vEsc(r['SKU_Code']||'') + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);">' + _vEsc(r['Item_Name']||'') + '</div>' +
        '</td>' +
        '<td class="num" style="color:var(--green);">+' + fmtNum(r['Added_Qty']||0) + '</td>' +
        '<td class="num" style="color:var(--orange);">' + fmtNum(r['Removed_Qty']||0) + '</td>' +
        '<td class="num"><span class="' + vCls + '">' + (vQty>=0?'+':'') + fmtNum(vQty) + '</span></td>' +
        '<td>' +
          statusBadge(r['Status']||'') +
          (hasReplace ? ' <span class="badge badge-red" style="font-size:10px;">REPLACE</span>' : '') +
        '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';
  });

  body.innerHTML = html;
}

// ── Level 2: Facility drill-down ──────────────────────────────
function _varianceDrilldown(facility) {
  document.getElementById('variance-level1').style.display = 'none';
  document.getElementById('variance-level2').style.display = '';
  document.getElementById('variance-l2-title').textContent = facility;
  document.getElementById('variance-table-container').innerHTML = '<div class="loading-msg">Loading…</div>';

  var params = { month: _varianceCurrentMonth, facility: facility };
  if (_varianceCurrentDate) params.date = _varianceCurrentDate;

  apiCall('getVariance', params, function(records) {
    _varianceRenderTable(records || []);
  });
}

function _varianceRenderTable(records) {
  var container = document.getElementById('variance-table-container');
  if (!records.length) {
    container.innerHTML = emptyState('No variance records', 'No records found for this facility.');
    return;
  }

  var byDate = {};
  records.forEach(function(r) {
    var d = _vNormDate(r['Process_Date']);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });

  var html = '<div class="table-wrap"><table><thead><tr>' +
    '<th>Type</th><th>SKU / Item</th><th>User</th>' +
    '<th style="text-align:right">Added</th>' +
    '<th style="text-align:right">Removed</th>' +
    '<th style="text-align:right">Variance</th>' +
    '<th>Status</th><th>Expiry / Batch</th><th></th>' +
    '</tr></thead><tbody>';

  Object.keys(byDate).sort().reverse().forEach(function(date) {
    var recs = byDate[date];
    html += '<tr style="background:var(--canvas);">' +
      '<td colspan="9" style="font-weight:700;font-size:12px;color:var(--text-muted);' +
        'padding:6px 12px;border-top:2px solid var(--border);">' +
      date + ' <span style="font-weight:400;">(' + recs.length + ' records)</span></td></tr>';

    recs.forEach(function(r) {
      var vQty     = parseFloat(r['Variance_Qty'])  || 0;
      var expSt    = String(r['Expiry_Status'] || '').trim().toLowerCase();
      var diffDays = parseFloat(r['Expiry_Diff_Days']) || 0;
      var addBatch = String(r['ADD_Batch']    || '').trim();
      var remBatch = String(r['REMOVE_Batch'] || '').trim();

      var rowStyle = '';
      if      (expSt === 'loss') rowStyle = 'background:#fff5f5;';
      else if (expSt === 'gain') rowStyle = 'background:#f0fff4;';
      else if (vQty > 0)         rowStyle = 'background:#ebf8ff;';
      else if (vQty < 0)         rowStyle = 'background:#fffaf0;';

      var statusHtml = statusBadge(r['Status']||'');
      if (r['Has_Replace'] === 'YES') statusHtml += ' <span class="badge badge-red" style="font-size:10px;">REPLACE</span>';

      // Expiry + Batch combined cell
      var expiryBatchHtml = '';
      if (expSt === 'loss' || expSt === 'gain') {
        var dText = diffDays > 0
          ? '<span style="color:#DC2626;font-weight:700;">▼ ' + diffDays + 'd lost</span>'
          : '<span style="color:#059669;font-weight:700;">▲ ' + Math.abs(diffDays) + 'd gained</span>';
        expiryBatchHtml += dText +
          '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' +
            'ADD exp: ' + _vEsc(r['ADD_Earliest_Expiry']||'—') + '<br>' +
            'REM exp: ' + _vEsc(r['REMOVE_Latest_Expiry']||'—') +
          '</div>';
      }
      // Batch info
      if (addBatch || remBatch) {
        expiryBatchHtml +=
          '<div style="margin-top:4px;font-size:10px;line-height:1.6;">' +
          (addBatch ? '<div style="color:var(--green);"><strong>ADD</strong> ' + _vEsc(addBatch) + '</div>' : '') +
          (remBatch ? '<div style="color:var(--orange);"><strong>REM</strong> ' + _vEsc(remBatch) + '</div>' : '') +
          '</div>';
      }
      if (!expiryBatchHtml) expiryBatchHtml = '<span style="color:var(--text-muted);">—</span>';

      html +=
        '<tr style="' + rowStyle + '">' +
        '<td><span class="badge badge-blue" style="font-size:10px;">' + _vEsc(r['Facility_Type']||'') + '</span></td>' +
        '<td>' +
          '<div style="font-size:12px;font-weight:600;font-family:monospace;">' + _vEsc(r['SKU_Code']||'') + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);">' + _vEsc(r['Item_Name']||'') + '</div>' +
        '</td>' +
        '<td style="font-size:12px;">' + _vEsc(String(r['Username']||'').split('@')[0]) + '</td>' +
        '<td class="num" style="color:var(--green);font-weight:600;">' + (r['Added_Qty']||0) + '</td>' +
        '<td class="num" style="color:var(--orange);font-weight:600;">' + (r['Removed_Qty']||0) + '</td>' +
        '<td class="num">' + fmtVar(vQty) + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td style="min-width:140px;">' + expiryBatchHtml + '</td>' +
        '<td>' + _vRemarkCell(r) + '</td>' +
        '</tr>';
    });
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// ── Helpers ───────────────────────────────────────────────────
function _vEsc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

var Variance = { init: function(){}, render: renderVariance };

function _vRemarkCell(r) {
  var existingRemark = String(r['User_Remark'] || r['Source_Remark'] || '').trim();
  var date     = _vNormDate(r['Process_Date']);
  var facility = String(r['Facility_Display'] || r['Facility_Raw'] || '');
  var sku      = String(r['SKU_Code']  || '');
  var username = String(r['Username']  || '').split('@')[0];
  var item     = String(r['Item_Name'] || '');
  var key      = date + '_' + facility + '_' + sku;

  if (existingRemark) {
    return '<div style="font-size:11.5px;color:var(--text-secondary);font-style:italic;' +
      'max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + _vEsc(existingRemark) + '">' +
      '<svg viewBox="0 0 24 24" width="11" height="11" style="margin-right:3px;vertical-align:middle;color:var(--green)">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      _vEsc(existingRemark.length > 40 ? existingRemark.substring(0,40)+'...' : existingRemark) +
    '</div>';
  }

  return '<button class="btn-remark" ' +
    'data-key="'      + _vEsc(key)      + '" ' +
    'data-date="'     + _vEsc(date)     + '" ' +
    'data-facility="' + _vEsc(facility) + '" ' +
    'data-username="' + _vEsc(username) + '" ' +
    'data-sku="'      + _vEsc(sku)      + '" ' +
    'data-item="'     + _vEsc(item)     + '" ' +
    'onclick="_vOpenRemark(this)">+ Remark</button>';
}

function _vOpenRemark(btn) {
  openRemarkModal(
    btn.getAttribute('data-key'),
    btn.getAttribute('data-date'),
    btn.getAttribute('data-facility'),
    btn.getAttribute('data-username'),
    btn.getAttribute('data-sku'),
    btn.getAttribute('data-item')
  );
}
