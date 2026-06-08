// ============================================================
// auth.js — Google Identity Services Authentication
// ============================================================
var AUTH = {
  ALLOWED_DOMAIN: 'mosaicwellness.in',
  CLIENT_ID: '1021762366002-eo3dlrklvk7jpagp99g6ip28gfjm5ie5.apps.googleusercontent.com',
  currentUser: null,
  token: null,
};

function handleGoogleLogin() {
  var btn = document.getElementById('google-login-btn');
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    google.accounts.id.initialize({
      client_id: AUTH.CLIENT_ID,
      callback: _handleCredentialResponse,
      auto_select: false,
    });
    google.accounts.oauth2.initTokenClient({
      client_id: AUTH.CLIENT_ID,
      scope: 'email profile',
      callback: function(tokenResponse) {
        if (tokenResponse.error) { _loginError('Authentication failed. Please try again.'); return; }
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': 'Bearer ' + tokenResponse.access_token }
        }).then(function(r){return r.json();}).then(function(profile){
          AUTH.token = tokenResponse.access_token;
          _validateAndLogin(profile.name, profile.email, profile.picture||null, tokenResponse.access_token);
        }).catch(function(){ _loginError('Failed to retrieve profile. Please try again.'); });
      },
    }).requestAccessToken();
  } catch(e) { _loginError('Google Sign-In not ready. Please reload and try again.'); }
}

function _handleCredentialResponse(response) {
  try {
    var parts = response.credential.split('.');
    var payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    _validateAndLogin(payload.name, payload.email, payload.picture||null, response.credential);
  } catch(e) { _loginError('Failed to parse login response.'); }
}

function _validateAndLogin(name, email, picture, token) {
  var domain = email ? email.split('@')[1] : '';
  if (domain !== AUTH.ALLOWED_DOMAIN) {
    _loginError('Access denied. Only @'+AUTH.ALLOWED_DOMAIN+' accounts are permitted.');
    _resetLoginBtn(); return;
  }
  AUTH.currentUser = { name: name, email: email, picture: picture, token: token };
  try { sessionStorage.setItem('iamd_user', JSON.stringify({name:name,email:email})); } catch(e) {}
  _onLoginSuccess();
}

function _loginError(msg) {
  var el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
  _resetLoginBtn();
}

function _resetLoginBtn() {
  var btn = document.getElementById('google-login-btn');
  btn.disabled = false;
  btn.innerHTML = '<svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Sign in with Google';
}

function _onLoginSuccess() {
  var user = AUTH.currentUser;
  var initials = user.name ? user.name.split(' ').map(function(n){return n[0];}).slice(0,2).join('').toUpperCase() : '??';
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent   = user.name || 'User';
  document.getElementById('user-email').textContent  = user.email || '';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'flex';
  if (typeof initApp === 'function') initApp();
}

function handleLogout() {
  AUTH.currentUser = null; AUTH.token = null;
  try { sessionStorage.removeItem('iamd_user'); } catch(e) {}
  if (typeof destroyCharts === 'function') destroyCharts();
  document.getElementById('app-shell').style.display    = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-error').style.display  = 'none';
  _resetLoginBtn();
  try { google.accounts.id.disableAutoSelect(); } catch(e) {}
}

function getCurrentUserName()  { return AUTH.currentUser ? AUTH.currentUser.name  : ''; }
function getCurrentUserEmail() { return AUTH.currentUser ? AUTH.currentUser.email : ''; }
function isLoggedIn()          { return !!AUTH.currentUser; }
