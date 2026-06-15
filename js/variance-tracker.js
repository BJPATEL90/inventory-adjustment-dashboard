// ============================================================
// variance-tracker.js — V3
// Changes from V2:
//   - 2-level navigation: Facility cards (MTD) → filtered table
//   - Level 1: facility cards loaded from getVarianceFacilities
//   - Level 2: current table pre-filtered to selected facility
//   - Expiry Loss/Gain rows shown with distinct styling
// ============================================================

var VarianceTracker = (function() {
// NOTE: also aliased as 'Variance' at bottom for backward compatibility with app.js

  var _currentMonth    = '';
  var _selectedFacility = null;
  var _allVariance     = [];

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    var now = new Date();
    _currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    var monthPicker = document.getElementById('variance-month-picker');
    if (monthPicker) {
      monthPicker.value = _currentMonth;
      monthPicker.addEventListener('change', function() {
        _currentMonth  = this.value;
        _selectedFacility = null;
        _showLevel1();
      });
    }

    _showLevel1();
  }

  // ── Level 1: Facility Cards ────────────────────────────────────────────────

  function _showLevel1() {
    var l1 = document.getElementById('variance-level1');
    var l2 = document.getElementById('variance-level2');
    if (l1) l1.style.display = '';
    if (l2) l2.style.display = 'none';

    var container = document.getElementById('variance-facility-cards');
    if (container) container.innerHTML = '<p class="loading-msg">Loading facilities…</p>';

    API.call('getVarianceFacilities', { month: _currentMonth }, function(facilities) {
      _renderFacilityCards(facilities || []);
    });
  }

  function _renderFacilityCards(facilities) {
    var container = document.getElementById('variance-facility-cards');
    if (!container) return;

    if (!facilities.length) {
      container.innerHTML = '<p class="empty-msg">No variance recorded for this period.</p>';
      return;
    }

    var cards = facilities.map(function(f) {
      var netV      = parseFloat(f.netVariance) || 0;
      var netSign   = netV > 0 ? '+' : '';
      var expiryBadge = f.expiryLoss > 0
        ? '<span class="pill pill-loss expiry-badge">' + f.expiryLoss + ' expiry loss</span>'
        : '';

      return '<div class="facility-card" data-facility="' + _esc(f.facility) + '">' +
        '<div class="facility-card-header">' +
          '<span class="facility-card-name">' + _esc(f.facility) + '</span>' +
          '<span class="pill pill-type">' + _esc(f.facilityType || '') + '</span>' +
        '</div>' +
        '<div class="facility-card-stats">' +
          '<div class="stat-item">' +
            '<span class="stat-value">' + f.varianceSKUs + '</span>' +
            '<span class="stat-label">Variance SKUs</span>' +
          '</div>' +
          '<div class="stat-item">' +
            '<span class="stat-value ' + (netV !== 0 ? 'variance-nonzero' : '') + '">' +
              netSign + netV +
            '</span>' +
            '<span class="stat-label">Net Qty</span>' +
          '</div>' +
        '</div>' +
        expiryBadge +
      '</div>';
    }).join('');

    container.innerHTML = '<div class="facility-cards-grid">' + cards + '</div>';

    // Attach click handlers
    container.querySelectorAll('.facility-card').forEach(function(card) {
      card.addEventListener('click', function() {
        _selectedFacility = card.dataset.facility;
        _showLevel2(_selectedFacility);
      });
    });
  }

  // ── Level 2: Filtered Table ────────────────────────────────────────────────

  function _showLevel2(facility) {
    var l1 = document.getElementById('variance-level1');
    var l2 = document.getElementById('variance-level2');
    if (l1) l1.style.display = 'none';
    if (l2) l2.style.display = '';

    var titleEl = document.getElementById('variance-l2-title');
    if (titleEl) titleEl.textContent = facility;

    var backBtn = document.getElementById('variance-back-btn');
    if (backBtn) {
      backBtn.onclick = function() {
        _selectedFacility = null;
        _showLevel1();
      };
    }

    var container = document.getElementById('variance-table-container');
    if (container) container.innerHTML = '<p class="loading-msg">Loading variance data…</p>';

    // Fetch ALL variance for the month (no date filter), pre-filtered by facility
    API.call('getVariance', { month: _currentMonth, facility: facility }, function(records) {
      _allVariance = records || [];
      _renderVarianceTable(_allVariance);
    });
  }

  // ── Render Variance Table ──────────────────────────────────────────────────

  function _renderVarianceTable(records) {
    var container = document.getElementById('variance-table-container');
    if (!container) return;

    if (!records.length) {
      container.innerHTML = '<p class="empty-msg">No variance records found.</p>';
      return;
    }

    // Group by date for better readability
    var byDate = {};
    records.forEach(function(r) {
      var d = r['Process_Date'] || '';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(r);
    });

    var dates   = Object.keys(byDate).sort().reverse();  // newest first
    var html    = '';

    dates.forEach(function(date) {
      var recs = byDate[date];
      html += '<tr class="date-group-header"><td colspan="9">' + date +
              ' <span class="date-count">(' + recs.length + ' records)</span></td></tr>';

      recs.forEach(function(r) {
        var vQty     = parseFloat(r['Variance_Qty']) || 0;
        var expSt    = r['Expiry_Status'] || '';
        var diffDays = parseFloat(r['Expiry_Diff_Days']) || 0;

        // Row class
        var rowCls = '';
        if (expSt === 'Loss')       rowCls = 'row-expiry-loss';
        else if (expSt === 'Gain')  rowCls = 'row-expiry-gain';
        else if (vQty > 0)          rowCls = 'row-add';
        else if (vQty < 0)          rowCls = 'row-remove';

        var statusPill = '<span class="pill ' + _statusPillCls(r['Status']) + '">' +
                         _statusShort(r['Status']) + '</span>';

        var expiryCell = '';
        if (expSt === 'Loss' || expSt === 'Gain') {
          var dText = diffDays > 0
            ? '<span class="expiry-diff loss">▼ ' + diffDays + 'd lost</span>'
            : '<span class="expiry-diff gain">▲ ' + Math.abs(diffDays) + 'd gained</span>';
          expiryCell = dText +
            '<div class="expiry-mini">' +
              'ADD: ' + _esc(r['ADD_Earliest_Expiry'] || '—') + '<br>' +
              'REM: ' + _esc(r['REMOVE_Latest_Expiry'] || '—') +
            '</div>';
        } else {
          expiryCell = '<span class="muted">—</span>';
        }

        var hasReplace = r['Has_Replace'] === 'YES'
          ? '<span class="pill pill-replace">REPLACE</span>' : '';

        html += '<tr class="' + rowCls + '">' +
          '<td><span class="pill pill-type">' + _esc(r['Facility_Type'] || '') + '</span></td>' +
          '<td>' +
            '<div class="sku-code">' + _esc(r['SKU_Code'] || '') + '</div>' +
            '<div class="sku-name">' + _esc(r['Item_Name'] || '') + '</div>' +
          '</td>' +
          '<td>' + _esc((r['Username'] || '').split('@')[0]) + '</td>' +
          '<td class="qty-cell">' + (r['Added_Qty']   || 0) + '</td>' +
          '<td class="qty-cell">' + (r['Removed_Qty'] || 0) + '</td>' +
          '<td class="qty-cell ' + (vQty !== 0 ? 'variance-nonzero' : '') + '">' +
            (vQty > 0 ? '+' : '') + vQty +
          '</td>' +
          '<td>' + statusPill + hasReplace + '</td>' +
          '<td>' + expiryCell + '</td>' +
          '<td>' +
            '<button class="btn-remark" onclick="VarianceTracker.openRemark(' +
              JSON.stringify(r['Process_Date']) + ',' +
              JSON.stringify(r['Facility_Display'] || r['Facility_Raw']) + ',' +
              JSON.stringify(r['SKU_Code']) +
            ')">+ Remark</button>' +
          '</td>' +
        '</tr>';
      });
    });

    container.innerHTML =
      '<div class="table-scroll">' +
      '<table class="data-table variance-table">' +
        '<thead><tr>' +
          '<th>Type</th>' +
          '<th>SKU / Item</th>' +
          '<th>User</th>' +
          '<th>Added</th>' +
          '<th>Removed</th>' +
          '<th>Variance</th>' +
          '<th>Status</th>' +
          '<th>Expiry Impact</th>' +
          '<th></th>' +
        '</tr></thead>' +
        '<tbody>' + html + '</tbody>' +
      '</table>' +
      '</div>';
  }

  // ── Remark Modal ───────────────────────────────────────────────────────────

  function openRemark(date, facility, sku) {
    if (typeof RemarkModal !== 'undefined') {
      RemarkModal.open({ date: date, facility: facility, sku: sku });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _statusPillCls(status) {
    if (status === 'Balanced')          return 'pill-balanced';
    if (status === 'Added Not Removed') return 'pill-added';
    if (status === 'Removed Not Added') return 'pill-removed';
    return '';
  }

  function _statusShort(status) {
    if (status === 'Balanced')          return 'Balanced';
    if (status === 'Added Not Removed') return 'Add Only';
    if (status === 'Removed Not Added') return 'Remove Only';
    return status || '';
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return {
    init:       init,
    openRemark: openRemark,
  };

})();

// Backward-compatibility alias — app.js may call Variance.init()
var Variance = VarianceTracker;
