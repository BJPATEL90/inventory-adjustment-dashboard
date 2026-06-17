// api.js — V4
// JSONP with localStorage cache, supports {success:true} and {status:'ok'} responses

var API = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbzVgwXZywWhX2l2rR24Ntt5lsfjwn8EWfKPYsnqZqirdzXsvSUpaFndJUk4I4udy5lo/exec',
  _cache: {},
  _cacheTTL: 5 * 60 * 1000,
  _n: 0,
};

function apiFetch(action, params, skipCache) {
  var key = action + JSON.stringify(params || {});
  if (!skipCache && API._cache[key]) {
    var c = API._cache[key];
    if (Date.now() - c.ts < API._cacheTTL) return Promise.resolve(c.data);
  }
  return new Promise(function(resolve, reject) {
    var cb = '__cb_' + (++API._n) + '_' + Date.now();
    var timeoutId;
    function cleanup() {
      clearTimeout(timeoutId);
      try { delete window[cb]; } catch(e) {}
      var s = document.getElementById(cb);
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
    timeoutId = setTimeout(function() { cleanup(); reject(new Error('API timeout: ' + action)); }, 18000);
    window[cb] = function(json) {
      cleanup();
      // Support both {success:true} and {status:'ok'}
      var ok = (json && json.success) || (json && json.status === 'ok');
      if (!ok) {
        reject(new Error(json && (json.error || json.message) ? (json.error || json.message) : 'API error: ' + action));
        return;
      }
      if (!skipCache) API._cache[key] = { ts: Date.now(), data: json.data };
      resolve(json.data);
    };
    var qs = Object.assign({ action: action, callback: cb }, params || {});
    var qstr = Object.keys(qs).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(qs[k] != null ? qs[k] : '');
    }).join('&');
    var s = document.createElement('script');
    s.id = cb;
    s.src = API.BASE_URL + '?' + qstr;
    s.onerror = function() { cleanup(); reject(new Error('Network error: ' + action)); };
    document.head.appendChild(s);
  });
}

// Callback-style wrapper for variance/expiry modules
function apiCall(action, params, callback) {
  apiFetch(action, params, true)
    .then(function(data) { callback(Array.isArray(data) ? data : (data || [])); })
    .catch(function(e) { console.error('apiCall', action, e); callback([]); });
}

function clearAPICache() { API._cache = {}; }

// ── Existing endpoints ─────────────────────────────────────────
function apiGetDailyKPI(p)            { return apiFetch('getDailyKPI', p); }
function apiGetMTDKPI(p)              { return apiFetch('getMTDKPI', p); }
function apiGetDailyTrend(p)          { return apiFetch('getDailyTrend', p); }
function apiGetVarianceData(p)        { return apiFetch('getVarianceData', p, true); }
function apiGetFacilitySummary(p)     { return apiFetch('getFacilitySummary', p); }
function apiGetFacilityTypeSummary(p) { return apiFetch('getFacilityTypeSummary', p); }
function apiGetUserSummary(p)         { return apiFetch('getUserSummary', p); }
function apiGetTopVarianceSKUs(p)     { return apiFetch('getTopVarianceSKUs', p); }
function apiGetMTDTopSKUs(p)          { return apiFetch('getMTDTopSKUs', p); }
function apiGetReplaceAlerts(p)       { return apiFetch('getReplaceAlerts', p, true); }
function apiGetRemarks(p)             { return apiFetch('getRemarks', p, true); }
function apiGetArchiveMonths()        { return apiFetch('getArchiveMonths', {}); }
function apiGetFacilityList()         { return apiFetch('getFacilityList', {}); }
function apiGetUserList(p)            { return apiFetch('getUserList', p); }
function apiGetLatestDate()           { return apiFetch('getLatestDate', {}, true); }
function apiAddRemark(body)           { return apiFetch('addRemark', Object.assign({ submitterName: getCurrentUserName(), submitterEmail: getCurrentUserEmail() }, body), true); }

// ── V3/V4 new endpoints ────────────────────────────────────────
function apiGetVarianceFacilities(p)  { return apiFetch('getVarianceFacilities', p, true); }
function apiGetVariance(p)            { return apiFetch('getVariance', p, true); }
function apiGetBatchExpiry(p)         { return apiFetch('getBatchExpiry', p, true); }
