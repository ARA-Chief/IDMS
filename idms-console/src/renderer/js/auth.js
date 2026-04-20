'use strict';

// ── MSAL config — must match field PWA tenant ─────────────────────────────────
const MSAL_CONFIG = {
  clientId:  '2b812782-fe38-4606-99b7-10e748cdd1a2',
  authority: 'https://login.microsoftonline.com/816c3d02-39d9-4940-9b6f-08b4cf0321ce',
  scopes:    ['User.Read', 'Files.ReadWrite']
};

// In Electron we use the implicit/token flow via a popup or redirect.
// For simplicity we use a manual device-code-style redirect through a
// hidden BrowserWindow in main, but here we do the lightweight version:
// store the token from MSAL JS running in the renderer via a script tag.
//
// NOTE: Full MSAL-browser integration is wired up below. The tenant IDs
// above come from the field PWA and must remain in sync.

var _msalInstance = null;
var _msalAccount  = null;
var graphToken    = null;

async function initMsal() {
  // MSAL browser library is loaded from the local node_modules copy
  // bundled into assets by the build step. For dev we load from CDN path
  // configured in CSP. For now we import dynamically.
  try {
    // Use sessionStorage-based cache so token survives page reload within session
    const msalConfig = {
      auth: {
        clientId:    MSAL_CONFIG.clientId,
        authority:   MSAL_CONFIG.authority,
        redirectUri: 'https://login.microsoftonline.com/common/oauth2/nativeclient'
      },
      cache: { cacheLocation: 'sessionStorage' }
    };

    // Check persisted token from electron-store
    const stored = await window.idms.store.get('msal_token');
    if (stored && stored.expiresAt > Date.now()) {
      graphToken = stored.accessToken;
      _msalAccount = stored.account;
      onAuthSuccess();
      return;
    }

    showAuthScreen('Sign in with your Microsoft account to access the console.');
  } catch (err) {
    console.error('[Auth] Init failed:', err);
    showAuthScreen('Authentication error. Please try again.');
  }
}

async function startAuth() {
  const btn = document.getElementById('auth-btn');
  const errEl = document.getElementById('auth-error');
  btn.textContent = 'Opening sign-in…';
  btn.disabled = true;
  errEl.style.display = 'none';

  try {
    // Electron: use system browser OAuth2 flow
    // We request the token using a simplified fetch-based device flow
    // pointing at the Microsoft identity platform.
    // For full MSAL-browser support, load @azure/msal-browser via CDN
    // once network access is confirmed during initial setup.
    //
    // Temporary: prompt user to paste token from field app session for testing.
    // This will be replaced with proper MSAL Electron integration in the
    // next iteration.
    const token = prompt(
      'Paste your OneDrive access token (from field app dev tools > Application > sessionStorage > msal.*accesstoken) to test connectivity.\n\nThis prompt will be replaced with proper Microsoft login in the next build.'
    );

    if (!token || !token.trim()) {
      throw new Error('No token provided.');
    }

    graphToken = token.trim();

    // Verify token works
    const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: 'Bearer ' + graphToken }
    });

    if (!resp.ok) throw new Error('Token invalid or expired (status ' + resp.status + ')');

    const user = await resp.json();
    _msalAccount = { name: user.displayName, username: user.userPrincipalName };

    await window.idms.store.set('msal_token', {
      accessToken: graphToken,
      account:     _msalAccount,
      expiresAt:   Date.now() + (55 * 60 * 1000)  // 55 min
    });

    onAuthSuccess();
  } catch (err) {
    btn.textContent = 'Sign in with Microsoft';
    btn.disabled = false;
    errEl.textContent = err.message || 'Sign-in failed. Please try again.';
    errEl.style.display = 'block';
  }
}

function onAuthSuccess() {
  document.getElementById('screen-auth').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  if (typeof onAppReady === 'function') onAppReady();
}

function showAuthScreen(msg) {
  document.getElementById('screen-auth').classList.add('active');
  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('auth-btn').textContent = 'Sign in with Microsoft';
  document.getElementById('auth-btn').disabled = false;
  const p = document.querySelector('.auth-prompt');
  if (p) p.textContent = msg;
}

async function refreshGraphToken() {
  const stored = await window.idms.store.get('msal_token');
  if (stored && stored.expiresAt > Date.now() + 60000) {
    graphToken = stored.accessToken;
    return;
  }
  // Token expired — return to auth screen
  await window.idms.store.delete('msal_token');
  showAuthScreen('Session expired. Please sign in again.');
  throw new Error('Token expired');
}
