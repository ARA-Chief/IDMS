'use strict';

async function renderSettings() {
  const el = document.getElementById('settings-content');
  if (!el) return;

  const token = await window.idms.store.get('msal_token');
  const account = token ? token.account : null;

  el.innerHTML = `
    <div class="section-head" style="margin-bottom:8px">Account</div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-body">
        <div class="settings-row">
          <span class="settings-label">Signed in as</span>
          <span class="settings-value">${account ? account.name : '—'}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Microsoft account</span>
          <span class="settings-value" style="color:var(--text-2)">${account ? account.username : '—'}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Token expires</span>
          <span class="settings-value" style="color:var(--text-2)">${token ? new Date(token.expiresAt).toLocaleTimeString() : '—'}</span>
        </div>
      </div>
    </div>

    <div class="section-head" style="margin-bottom:8px">Console</div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-body">
        <div class="settings-row">
          <span class="settings-label">OneDrive base path</span>
          <span class="settings-value" style="font-family:var(--font-mono);font-size:11px">Documents/IDMS</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Poll interval</span>
          <span class="settings-value">2 minutes</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Stale file threshold</span>
          <span class="settings-value">60 minutes</span>
        </div>
      </div>
    </div>

    <div class="section-head" style="margin-bottom:8px">Actions</div>
    <div class="panel">
      <div class="panel-body">
        <div class="settings-row">
          <span class="settings-label">Run full historical ingest</span>
          <button class="btn-secondary" onclick="runFullIngest().then(() => alert('Full ingest complete.'))">Run now</button>
        </div>
        <div class="settings-row">
          <span class="settings-label">Sign out</span>
          <button class="btn-secondary" onclick="signOut()">Sign out</button>
        </div>
      </div>
    </div>
  `;
}

async function signOut() {
  await window.idms.store.delete('msal_token');
  graphToken = null;
  showAuthScreen('Signed out. Please sign in again.');
}
