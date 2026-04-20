'use strict';

// ── Navigation ────────────────────────────────────────────────────────────────
const SCREENS = {
  overview:  { el: 'screen-overview',  title: 'Overview',      onEnter: () => renderOverview(toDateStr(new Date())) },
  eventlogs: { el: 'screen-eventlogs', title: 'Event logs',    onEnter: null },
  reports:   { el: 'screen-reports',   title: 'Reports',       onEnter: null },
  users:     { el: 'screen-users',     title: 'Users',         onEnter: null },
  vessel:    { el: 'screen-vessel',    title: 'Vessel setup',  onEnter: null },
  settings:  { el: 'screen-settings',  title: 'Settings',      onEnter: renderSettings }
};

function navigate(key) {
  if (!SCREENS[key]) return;

  // Deactivate all screens
  Object.values(SCREENS).forEach(s => {
    const el = document.getElementById(s.el);
    if (el) el.classList.remove('active');
  });

  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  // Activate target
  const screen = SCREENS[key];
  const screenEl = document.getElementById(screen.el);
  if (screenEl) screenEl.classList.add('active');

  const navBtn = document.querySelector('[data-screen="' + key + '"]');
  if (navBtn) navBtn.classList.add('active');

  // Update topbar title
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = screen.title;

  // Run screen-specific setup
  if (typeof screen.onEnter === 'function') screen.onEnter();
}

// Wire up sidebar nav clicks
document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('disabled')) {
      navigate(btn.dataset.screen);
    }
  });
});

// ── Titlebar badges ───────────────────────────────────────────────────────────
function renderTitlebarBadges() {
  const container = document.getElementById('tb-badges');
  if (!container) return;
  container.innerHTML = `
    <span class="tb-badge badge-warn" id="badge-onedrive">Connecting…</span>
    <span class="tb-badge badge-ok"   id="badge-console">Active console</span>
  `;
}

// ── App startup ───────────────────────────────────────────────────────────────
async function onAppReady() {
  renderTitlebarBadges();
  navigate('overview');

  // Show connecting state
  const overviewEl = document.getElementById('overview-content');
  if (overviewEl) {
    overviewEl.innerHTML = '<div class="loading-msg">Connecting to OneDrive and loading config…</div>';
  }

  try {
    // Load configs
    const [userConfig, consoleConfig] = await Promise.all([
      loadUserConfig(),
      loadConsoleConfig()
    ]);

    // Update sidebar vessel info
    if (userConfig) {
      const vn = document.getElementById('sidebar-vessel');
      if (vn) vn.textContent = userConfig.vessel || 'F/V Araho';
    }

    // Start ingestion poller
    startIngestionPoller();

  } catch (err) {
    console.error('[App] Startup error:', err);
    const overviewEl = document.getElementById('overview-content');
    if (overviewEl) {
      overviewEl.innerHTML = '<div class="placeholder-msg">Could not connect to OneDrive. Check your connection and try reloading.</div>';
    }
    updateIngestStatusBadge('offline');
  }
}

// ── MSAL init on load ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initMsal();
});

// ── Utility ───────────────────────────────────────────────────────────────────
function toDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
