'use strict';

// Called by ingest.js after each poll completes
async function onIngestComplete(dateStr) {
  await renderOverview(dateStr);
}

async function renderOverview(dateStr) {
  const el = document.getElementById('overview-content');
  if (!el) return;

  try {
    const [summary, ingestStatus, recentEvents] = await Promise.all([
      window.idms.db.getDaySummary({ date: dateStr }),
      window.idms.db.getIngestionStatus({ date: dateStr }),
      window.idms.db.getRecentEvents({ limit: 5 })
    ]);

    el.innerHTML = buildOverviewHTML(summary, ingestStatus, recentEvents, dateStr);
  } catch (err) {
    el.innerHTML = '<div class="placeholder-msg">Error loading overview: ' + err.message + '</div>';
  }
}

function buildOverviewHTML(summary, ingestStatus, recentEvents, dateStr) {
  const downtimeLabel = fmtSeconds(summary.downtimeSeconds);
  const activeUsers   = summary.activeUsers
    ? summary.activeUsers.split(',').filter(Boolean).join(', ')
    : 'none';

  const lastSyncLabel = summary.lastIngestedAt
    ? timeSince(new Date(summary.lastIngestedAt))
    : '—';

  return `
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">Events today</div>
        <div class="stat-value">${summary.eventCount}</div>
        <div class="stat-sub">${dateStr}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total downtime</div>
        <div class="stat-value">${downtimeLabel}</div>
        <div class="stat-sub">all departments</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active timers</div>
        <div class="stat-value">${summary.activeCount}</div>
        <div class="stat-sub">${activeUsers}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Last ingested</div>
        <div class="stat-value" style="font-size:18px;padding-top:2px">${lastSyncLabel}</div>
        <div class="stat-sub" id="ingest-next">calculating…</div>
      </div>
    </div>

    <div class="section-head">OneDrive ingestion status</div>
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-head">
        <span class="panel-title">User log files — ${dateStr}</span>
        <span class="panel-meta" id="ingest-next-header">polling every 2 min</span>
      </div>
      <div class="table-row header ingest-row">
        <div></div>
        <div>User</div>
        <div>Department</div>
        <div>Events</div>
        <div style="text-align:right">Last synced</div>
      </div>
      ${buildIngestRows(ingestStatus)}
    </div>

    <div class="two-col">
      <div>
        <div class="section-head">Recent events</div>
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">All departments · today</span>
          </div>
          <div class="panel-body">
            ${buildEventRows(recentEvents)}
          </div>
        </div>
      </div>
      <div>
        <div class="section-head">System alerts</div>
        <div class="panel">
          <div class="panel-head">
            <span class="panel-title">Alerts</span>
            <span class="panel-meta" id="alert-count">—</span>
          </div>
          <div class="panel-body" id="alerts-body">
            ${buildAlerts(ingestStatus)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildIngestRows(rows) {
  if (!rows.length) {
    return '<div class="table-row"><div></div><div colspan="4" style="color:var(--text-3)">No log files found for today.</div></div>';
  }

  return rows.map(r => {
    const age      = r.ingested_at ? Math.floor((Date.now() - new Date(r.ingested_at)) / 60000) : null;
    const isStale  = age !== null && age > 60;
    const dotClass = isStale ? 'dot-stale' : 'dot-ok';
    const timeLabel = r.ingested_at
      ? (isStale ? age + 'm ago' : new Date(r.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      : '—';
    const timeColor = isStale ? 'color:var(--warning)' : 'color:var(--text-3)';

    return `
      <div class="table-row ingest-row">
        <div class="status-dot ${dotClass}"></div>
        <div style="font-weight:500">${r.username}</div>
        <div style="color:var(--text-2)">${r.department}</div>
        <div style="color:var(--text-2)">${r.event_count} event${r.event_count !== 1 ? 's' : ''}</div>
        <div style="text-align:right;${timeColor}">${timeLabel}</div>
      </div>
    `;
  }).join('');
}

function buildEventRows(events) {
  if (!events.length) {
    return '<div style="padding:14px;color:var(--text-3);font-size:12px">No events recorded today.</div>';
  }

  return events.map(e => `
    <div class="table-row" style="grid-template-columns:1fr auto">
      <div>
        <div class="event-equip">${e.equipment}</div>
        <div class="event-cat">${e.category}</div>
      </div>
      <div>
        <div class="event-dur">${fmtSeconds(e.duration_seconds)}</div>
        <div class="event-user">${e.username} · ${e.end_time ? new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'active'}</div>
      </div>
    </div>
  `).join('');
}

function buildAlerts(ingestStatus) {
  const alerts = [];

  ingestStatus.forEach(r => {
    if (r.ingested_at) {
      const age = Math.floor((Date.now() - new Date(r.ingested_at)) / 60000);
      if (age > 60) {
        alerts.push({
          color: 'var(--warning)',
          text:  r.username + ' log file stale — last seen ' + age + ' min ago',
          time:  new Date(r.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    }
  });

  setTimeout(() => {
    const el = document.getElementById('alert-count');
    if (el) el.textContent = alerts.length + ' active';
  }, 0);

  if (!alerts.length) {
    return '<div style="padding:14px;color:var(--text-3);font-size:12px">No alerts.</div>';
  }

  return alerts.map(a => `
    <div class="alert-row">
      <div class="alert-indicator" style="background:${a.color}"></div>
      <div>
        <div class="alert-text">${a.text}</div>
        <div class="alert-time">${a.time}</div>
      </div>
    </div>
  `).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeSince(date) {
  const secs = Math.floor((Date.now() - date) / 1000);
  if (secs < 60)  return secs + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  return Math.floor(secs / 3600) + 'h ago';
}
