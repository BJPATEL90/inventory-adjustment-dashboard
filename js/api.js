// ============================================================
// api.js — Central API Client
// All fetch() calls to Apps Script Web App endpoint.
// ============================================================

var API = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbzVgwXZywWhX2l2rR24Ntt5lsfjwn8EWfKPYsnqZqirdzXsvSUpaFndJUk4I4udy5lo/exec'
  _cache: {},
  _cacheTTL: 5 * 60 * 1000, // 5 minutes
};

// ── Core Fetch ────────────────────────────────────────────────
function apiFetch(action, params, skipCache) {
  var cacheKey = action + JSON.stringify(params || {});
  if (!skipCache && API._cache[cacheKey]) {
    var cached = API._cache[cacheKey];
    if (Date.now() - cached.ts < API._cacheTTL) return Promise.resolve(cached.data);
  }

  var qs = Object.assign({ action: action }, params || {});
  var queryString = Object.keys(qs).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(qs[k] || '');
  }).join('&');

  var url = API.BASE_URL + '?' + queryString;

  return fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(json) {
      if (!json.success) throw new Error(json.error || 'API error');
      if (!skipCache) API._cache[cacheKey] = { ts: Date.now(), data: json.data };
      return json.data;
    });
}

function apiPost(action, body) {
  return fetch(API.BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ action: action }, body))
  })
  .then(function(r) { return r.json(); })
  .then(function(json) {
    if (!json.success) throw new Error(json.error || 'API error');
    return json.data;
  });
}

function clearAPICache() { API._cache = {}; }

// ── API Methods ────────────────────────────────────────────────
function apiGetDailyKPI(params)       { return apiFetch('getDailyKPI',       params); }
function apiGetMTDKPI(params)         { return apiFetch('getMTDKPI',         params); }
function apiGetDailyTrend(params)     { return apiFetch('getDailyTrend',     params); }
function apiGetVarianceData(params)   { return apiFetch('getVarianceData',   params, true); }
function apiGetFacilitySummary(p)     { return apiFetch('getFacilitySummary',p); }
function apiGetUserSummary(p)         { return apiFetch('getUserSummary',    p); }
function apiGetTopVarianceSKUs(p)     { return apiFetch('getTopVarianceSKUs',p); }
function apiGetRemarks(params)        { return apiFetch('getRemarks',        params, true); }
function apiGetArchiveMonths()        { return apiFetch('getArchiveMonths',  {}, false); }
function apiGetFacilityList()         { return apiFetch('getFacilityList',   {}); }
function apiGetUserList(params)       { return apiFetch('getUserList',       params); }
function apiGetLatestDate()           { return apiFetch('getLatestDate',     {}, true); }

function apiAddRemark(body) {
  return apiPost('addRemark', Object.assign({
    submitterName:  getCurrentUserName(),
    submitterEmail: getCurrentUserEmail(),
  }, body));
}
