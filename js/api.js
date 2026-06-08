// ============================================================
// api.js — Central API Client
// Uses JSONP to call Apps Script Web App from GitHub Pages.
// Standard fetch() is blocked by CORS on Apps Script URLs.
// JSONP bypasses this cleanly — Apps Script supports it natively.
// ============================================================

var API = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbzVgwXZywWhX2l2rR24Ntt5lsfjwn8EWfKPYsnqZqirdzXsvSUpaFndJUk4I4udy5lo/exec',
  _cache: {},
  _cacheTTL: 5 * 60 * 1000, // 5 minutes
  _callbackCounter: 0,
};

// ── JSONP Fetch ───────────────────────────────────────────────
// Apps Script Web Apps support ?callback=fnName for JSONP.
// This bypasses the browser CORS restriction entirely.
function apiFetch(action, params, skipCache) {
  var cacheKey = action + JSON.stringify(params || {});

  if (!skipCache && API._cache[cacheKey]) {
    var cached = API._cache[cacheKey];
    if (Date.now() - cached.ts < API._cacheTTL) {
      return Promise.resolve(cached.data);
    }
  }

  return new Promise(function(resolve, reject) {
    var cbName = '__iamd_cb_' + (++API._callbackCounter) + '_' + Date.now();
    var timeoutId;

    // Cleanup function
    function cleanup() {
      clearTimeout(timeoutId);
      try { delete window[cbName]; } catch(e) {}
      var script = document.getElementById(cbName);
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    // Timeout after 15 seconds
    timeoutId = setTimeout(function() {
      cleanup();
      reject(new Error('API timeout for action: ' + action));
    }, 15000);

    // Define the callback function
    window[cbName] = function(json) {
      cleanup();
      if (!json || !json.success) {
        reject(new Error(json && json.error ? json.error : 'API error'));
        return;
      }
      if (!skipCache) {
        API._cache[cacheKey] = { ts: Date.now(), data: json.data };
      }
      resolve(json.data);
    };

    // Build query string
    var qs = Object.assign({ action: action, callback: cbName }, params || {});
    var queryString = Object.keys(qs).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(qs[k] !== null && qs[k] !== undefined ? qs[k] : '');
    }).join('&');

    // Inject script tag
    var script = document.createElement('script');
    script.id  = cbName;
    script.src = API.BASE_URL + '?' + queryString;
    script.onerror = function() {
      cleanup();
      reject(new Error('Script load error for action: ' + action));
    };
    document.head.appendChild(script);
  });
}

// POST via hidden form + JSONP (for addRemark)
function apiPost(action, body) {
  // Convert POST to GET with JSONP for Apps Script compatibility
  return apiFetch(action, body, true);
}

function clearAPICache() { API._cache = {}; }

// ── API Methods ───────────────────────────────────────────────
function apiGetDailyKPI(params)       { return apiFetch('getDailyKPI',       params); }
function apiGetMTDKPI(params)         { return apiFetch('getMTDKPI',         params); }
function apiGetDailyTrend(params)     { return apiFetch('getDailyTrend',     params); }
function apiGetVarianceData(params)   { return apiFetch('getVarianceData',   params, true); }
function apiGetFacilitySummary(p)     { return apiFetch('getFacilitySummary',p); }
function apiGetUserSummary(p)         { return apiFetch('getUserSummary',    p); }
function apiGetTopVarianceSKUs(p)     { return apiFetch('getTopVarianceSKUs',p); }
function apiGetRemarks(params)        { return apiFetch('getRemarks',        params, true); }
function apiGetArchiveMonths()        { return apiFetch('getArchiveMonths',  {}); }
function apiGetFacilityList()         { return apiFetch('getFacilityList',   {}); }
function apiGetUserList(params)       { return apiFetch('getUserList',       params); }
function apiGetLatestDate()           { return apiFetch('getLatestDate',     {}, true); }

function apiAddRemark(body) {
  return apiFetch('addRemark', Object.assign({
    submitterName:  getCurrentUserName(),
    submitterEmail: getCurrentUserEmail(),
  }, body), true);
}
