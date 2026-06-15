// ============================================================
// expiry-tracker.js — V3 NEW
// Expiry Tracker tab: shows batch-level expiry loss/gain cases
// ============================================================

var ExpiryTracker = (function() {

  var _currentMonth = '';
  var _allRecords   = [];
  var _filter       = 'all';  // 'all' | 'Loss' | 'Gain'

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    var now = new Date();
    _currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    var monthPicker = document.getElementById('expiry-month-picker');
    if (monthPicker) {
      monthPicker.value = _currentMonth;
      monthPicker.addEventListener('change', function() {
        _currentMonth = this.value;
        load();
      });
    }

    var filterBtns = document.querySelectorAll('.expiry-filter-btn');
    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        filterBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _filter = btn.dataset.filter;
        _render();
      });
    });

    load();
  }

  // ── Load data ──────────────────────────────────────────────────────────────

  function load() {
    var container = document.getElementById('expiry-table-container');
    if (container) container.innerHTML = '<p class="loading-msg">Loading expiry data…</p>';
    _updateSummaryCards(null);

    API.call('getBatchExpiry', { month: _currentMonth }, function(records) {
      _allRecords = records || [];
      _render();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function _render() {
    var filtered = _allRecords.filter(function(r) {
      if (_filter === 'all')  return true;
      return r['Expiry_Status'] === _filter;
    });

    // Sort by Expiry_Diff_Days descending (worst loss first)
    filtered.sort(function(a, b) {
      return (parseFloat(b['Expiry_Diff_Days']) || 0) - (parseFloat(a['Expiry_Diff_Days']) || 0);
    });

    _updateSummaryCards(filtered);
    _renderTable(filtered);
  }

  function _updateSummaryCards(records) {
    var lossCount  = 0;
    var gainCount  = 0;
    var worstLoss  = 0;

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

    if (lossEl)  lossEl.textContent  = records ? lossCount : '—';
    if (gainEl)  gainEl.textContent  = records ? gainCount : '—';
    if (worstEl) worstEl.textContent = records ? (worstLoss > 0 ? worstLoss + 'd' : '—') : '—';
  }

  function _renderTable(records) {
    var container = document.getElementById('expiry-table-container');
    if (!container) return;

    if (!records || !records.length) {
      container.innerHTML = '<p class="empty-msg">No expiry loss / gain cases found for this period.</p>';
      return;
    }

    var rows = records.map(function(r) {
      var diff     = parseFloat(r['Expiry_Diff_Days']) || 0;
      var status   = r['Expiry_Status'] || '';
      var pillCls  = status === 'Loss' ? 'pill pill-loss' : status === 'Gain' ? 'pill pill-gain' : 'pill pill-neutral';
      var diffText = diff > 0 ? '+' + diff + 'd lost' : diff < 0 ? Math.abs(diff) + 'd gained' : '0d';
      var diffCls  = diff > 0 ? 'expiry-diff loss' : diff < 0 ? 'expiry-diff gain' : 'expiry-diff';

      return '<tr>' +
        '<td>' + _esc(r['Process_Date'] || '') + '</td>' +
        '<td>' +
          '<div class="facility-name">' + _esc(r['Facility_Display'] || r['Facility_Raw'] || '') + '</div>' +
          '<span class="pill pill-type">' + _esc(r['Facility_Type'] || '') + '</span>' +
        '</td>' +
        '<td>' +
          '<div class="sku-code">' + _esc(r['SKU_Code'] || '') + '</div>' +
          '<div class="sku-name">' + _esc(r['Item_Name'] || '') + '</div>' +
        '</td>' +
        '<td>' +
          '<div class="batch-detail">' +
            '<span class="batch-label">Batch:</span> ' + _esc(r['ADD_Batch'] || '—') +
          '</div>' +
          '<div class="expiry-date">' + _esc(r['ADD_Expiry'] || '—') + '</div>' +
          '<div class="qty-tag">Qty: ' + _esc(r['ADD_Qty'] || '') + '</div>' +
        '</td>' +
        '<td>' +
          '<div class="batch-detail">' +
            '<span class="batch-label">Batch:</span> ' + _esc(r['REMOVE_Batch'] || '—') +
          '</div>' +
          '<div class="expiry-date">' + _esc(r['REMOVE_Expiry'] || '—') + '</div>' +
          '<div class="qty-tag">Qty: ' + _esc(r['REMOVE_Qty'] || '') + '</div>' +
        '</td>' +
        '<td><span class="' + diffCls + '">' + diffText + '</span></td>' +
        '<td><span class="' + pillCls + '">' + status + '</span></td>' +
        '<td>' + _esc((r['Username'] || '').split('@')[0]) + '</td>' +
      '</tr>';
    }).join('');

    container.innerHTML =
      '<div class="table-scroll">' +
      '<table class="data-table expiry-table">' +
        '<thead><tr>' +
          '<th>Date</th>' +
          '<th>Facility</th>' +
          '<th>SKU / Item</th>' +
          '<th>ADD Batch</th>' +
          '<th>REMOVE Batch</th>' +
          '<th>Days</th>' +
          '<th>Status</th>' +
          '<th>User</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>';
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init: init, load: load };

})();
