# IDMS Schema Specification
**Version 1.0 — F/V Araho**
*This document is the authoritative reference for all config, log, and data file structures used by IDMS. Both the field PWA and the desktop console must conform to these schemas. Any structural change requires a version increment and update to this document.*

---

## Table of Contents
1. [File Location Map](#1-file-location-map)
2. [Version Checking](#2-version-checking)
3. [userconfig.json](#3-userconfigjson)
4. [Department Config Files](#4-department-config-files)
5. [Department Shell Files](#5-department-shell-files)
6. [consoleconfig.json](#6-consoleconfigjson)
7. [Log File (per-user, per-date)](#7-log-file-per-user-per-date)
8. [Aggregate Report File](#8-aggregate-report-file)
9. [Console Lock File](#9-console-lock-file)
10. [Permission Tiers](#10-permission-tiers)
11. [Migration Notes — GitHub → OneDrive](#11-migration-notes--github--onedrive)

---

## 1. File Location Map

All paths are relative to the OneDrive root of the authenticating user (i.e., `me/drive/root:/`). The base folder is `Documents/IDMS/`.

```
Documents/IDMS/
│
├── config/
│   ├── userconfig.json             ← Vessel identity, users, permission tiers
│   ├── consoleconfig.json          ← Console-specific vessel & operational settings
│   ├── factoryconfig.json          ← Factory equipment & categories
│   ├── engineconfig.json           ← Engine Room equipment & categories
│   ├── deckconfig.json             ← Deck equipment & categories
│   └── shells/
│       ├── factoryshell.json       ← Factory module behaviour
│       ├── engineshell.json        ← Engine Room module behaviour
│       └── deckshell.json          ← Deck module behaviour
│
├── data/
│   ├── factory/
│   │   ├── logs/                   ← report-{username}-{YYYY-MM-DD}.json
│   │   └── reports/                ← report-factory-{YYYY-MM-DD}.json
│   ├── engine/
│   │   ├── logs/
│   │   └── reports/
│   └── deck/
│       ├── logs/
│       └── reports/
│
└── console.lock                    ← Active console heartbeat file
```

**Department key mapping** (used in folder paths and file names):

| Department display name | Key used in paths |
|-------------------------|-------------------|
| Factory                 | `factory`         |
| Engine Room             | `engine`          |
| Deck                    | `deck`            |

---

## 2. Version Checking

Every config file carries a `"schema_version"` integer field. This is distinct from content version labels like `"1.0"` — it is an integer that increments only when the *structure* of the file changes in a way that would break older clients.

The field PWA reads `schema_version` from `userconfig.json` on every login and compares it against its own `SCHEMA_VERSION` constant. If the config version is higher than the app's known version, the app displays a warning: *"Configuration has been updated. Please reload to get the latest version."*

**Current schema version: `1`**

Increment this value (to `2`, `3`, etc.) whenever a field is added, removed, or renamed in any schema defined in this document. Document the change in a `"changelog"` array within the affected file (see userconfig example below).

---

## 3. userconfig.json

**Location:** `Documents/IDMS/config/userconfig.json`
**Edited by:** Admin (via console in Phase 4+, or manually for now)
**Read by:** Field PWA on every login; Console on startup

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "departments": ["Factory", "Engine Room", "Deck"],

  "users": [
    {
      "username": "tploch",
      "password": "araho24",
      "name": "T. Ploch",
      "role": "Chief Engineer",
      "permission_tier": "admin",
      "departments": ["Factory", "Engine Room"]
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-04-20", "note": "Initial schema definition." }
  ]
}
```

### User object fields

| Field             | Type     | Required | Notes                                                     |
|-------------------|----------|----------|-----------------------------------------------------------|
| `username`        | string   | yes      | Lowercase, no spaces. Used in filenames.                  |
| `password`        | string   | yes      | Plaintext for now. Deferred to security phase.            |
| `name`            | string   | yes      | Display name. E.g. `"T. Ploch"`.                         |
| `role`            | string   | yes      | Job title for display only. E.g. `"Chief Engineer"`.     |
| `permission_tier` | string   | yes      | One of `"admin"`, `"standard"`, `"observer"`. See §10.   |
| `departments`     | string[] | yes      | Must match entries in the top-level `departments` array.  |

### Permission tier defaults by role

These are defaults only. Any user's `permission_tier` can be overridden directly in their user object via the console.

| Role                  | Default tier |
|-----------------------|--------------|
| Admin                 | `admin`      |
| Chief Engineer        | `admin`      |
| 1st Engineer          | `admin`      |
| Captain               | `observer`   |
| Factory Manager       | `observer`   |
| All other roles       | `standard`   |

---

## 4. Department Config Files

**Location:** `Documents/IDMS/config/{dept}config.json`
**Edited by:** Operator / Admin (via console in Phase 4+)
**Read by:** Field PWA on department entry; Console for display and editing

One file per department. All three share an identical structure.

```json
{
  "schema_version": 1,
  "department": "Engine Room",
  "note": "OPERATOR CONFIG — edit equipment and categories here.",

  "presets_default": [
    { "equipment": "Main Engine",  "category": "Mechanical fault", "label": "MAIN ENGINE" }
  ],

  "equipment": [
    {
      "group": "Propulsion",
      "items": [
        "Main Engine",
        "Gearbox",
        "Shaft & Propeller",
        "Bow Thruster"
      ]
    }
  ],

  "categories": [
    "Mechanical fault",
    "Electrical fault",
    "Fuel / fluid leak",
    "Overheating",
    "Sensor / alarm",
    "Scheduled maintenance",
    "Operator error",
    "Unknown / investigating"
  ]
}
```

### Preset object fields

| Field       | Type   | Required | Notes                                  |
|-------------|--------|----------|----------------------------------------|
| `equipment` | string | yes      | Must match an item in `equipment`.     |
| `category`  | string | yes      | Must match an entry in `categories`.  |
| `label`     | string | yes      | Short uppercase label for the button. |

### Equipment group object fields

| Field   | Type     | Required | Notes                          |
|---------|----------|----------|--------------------------------|
| `group` | string   | yes      | Display name for the group.   |
| `items` | string[] | yes      | Equipment item display names. |

---

## 5. Department Shell Files

**Location:** `Documents/IDMS/config/shells/{dept}shell.json`
**Edited by:** Developer only
**Read by:** Field PWA on department entry; Console for display

Controls module behaviour. One file per department. All three share an identical structure.

```json
{
  "schema_version": 1,
  "department": "Engine Room",
  "note": "DEVELOPER CONFIG — controls module behaviour.",

  "timers": {
    "warning_threshold_seconds": 1800,
    "warning_repeat_seconds": 1800,
    "max_concurrent_timers": 5
  },

  "session": {
    "autosave_interval_seconds": 300,
    "report_output_path": "data/engine/logs/",
    "aggregate_report_path": "data/engine/reports/",
    "aggregate_period_hours": 24,
    "aggregate_reset_time": "06:00"
  },

  "export": {
    "format": "json",
    "filename_pattern": "report-{username}-{date}.json",
    "aggregate_filename_pattern": "report-engine-{date}.json",
    "date_format": "YYYY-MM-DD",
    "include_fields": [
      "id", "equipment", "category",
      "startTime", "endTime", "duration",
      "notes", "user", "department", "vessel"
    ]
  },

  "permissions": {
    "can_delete_events": ["admin"],
    "can_edit_events":   ["admin"],
    "can_view_all_logs": ["admin", "standard"],
    "can_export_report": ["admin", "standard"]
  }
}
```

**Note on permissions in shell files:** Permission arrays now reference `permission_tier` values (`"admin"`, `"standard"`, `"observer"`), not role strings. This decouples access control from job titles and allows console-level overrides per user without touching shell files.

---

## 6. consoleconfig.json

**Location:** `Documents/IDMS/config/consoleconfig.json`
**Edited by:** Admin / Developer (via console settings panel)
**Read by:** Console only

Vessel-specific operational settings and console behaviour. This file does not exist on the field PWA.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "vessel_type": "Factory Trawler",
  "call_sign": "",
  "imo_number": "",
  "flag_state": "USA",
  "home_port": "Seattle, WA",

  "console": {
    "lock_heartbeat_seconds": 60,
    "lock_stale_threshold_seconds": 180,
    "ingest_poll_interval_seconds": 120,
    "db_path": "idms.db",
    "timezone": "America/Anchorage"
  },

  "operational": {
    "fuel_capacity_liters": 0,
    "fuel_tanks": [],
    "ballast_tanks": [],
    "stability_reference_gm": null,
    "daily_report_cutoff_time": "06:00",
    "trip_start_date": null
  },

  "display": {
    "units_fuel": "liters",
    "units_distance": "nm",
    "units_speed": "kts",
    "units_temperature": "celsius"
  },

  "changelog": [
    { "version": 1, "date": "2026-04-20", "note": "Initial schema definition." }
  ]
}
```

### Field notes

- `fuel_tanks` and `ballast_tanks` are empty arrays for now, to be populated when the fuel tracking module is built (Phase 5).
- `stability_reference_gm` is null until the stability module is defined.
- `trip_start_date` is set by the console at the start of each trip and used to scope aggregate reports.
- `timezone` drives all display timestamps on the console. Field devices use local device time.
- `db_path` is relative to the console application directory.

---

## 7. Log File (per-user, per-date)

**Location:** `Documents/IDMS/data/{deptKey}/logs/report-{username}-{YYYY-MM-DD}.json`
**Written by:** Field PWA (on resolve and on 5-minute autosave)
**Read by:** Field PWA (own file only); Console (all files, during ingestion)

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "department": "Engine Room",
  "user": "tploch",
  "display_name": "T. Ploch",
  "role": "Chief Engineer",
  "date": "2026-04-20",
  "generated": "2026-04-20T14:32:00.000Z",

  "active": [],

  "resolved": [
    {
      "id": 1713620000000,
      "equipment": "Main Engine",
      "category": "Mechanical fault",
      "start_time": "2026-04-20T12:15:00.000Z",
      "start_label": "12:15",
      "end_time": "2026-04-20T12:44:00.000Z",
      "end_label": "12:44",
      "duration_seconds": 1740,
      "duration_label": "29m 00s",
      "notes": "Investigated oil pressure alarm. Topped up lube oil, alarm cleared.",
      "user": "tploch",
      "display_name": "T. Ploch"
    }
  ]
}
```

### Resolved incident object fields

| Field              | Type    | Notes                                                             |
|--------------------|---------|-------------------------------------------------------------------|
| `id`               | integer | Unix timestamp ms at creation. Unique within a user-session.     |
| `equipment`        | string  | Must match an item in the department config at time of logging.  |
| `category`         | string  | Must match a category in the department config at time of logging.|
| `start_time`       | string  | ISO 8601 UTC.                                                     |
| `start_label`      | string  | Local time string for display. `"HH:MM"`.                        |
| `end_time`         | string  | ISO 8601 UTC.                                                     |
| `end_label`        | string  | Local time string for display. `"HH:MM"`.                        |
| `duration_seconds` | integer | `end_time - start_time` in whole seconds.                         |
| `duration_label`   | string  | Human-readable. E.g. `"1h 04m"`.                                 |
| `notes`            | string  | Free text. May be empty string.                                   |
| `user`             | string  | Username of the logging user.                                     |
| `display_name`     | string  | Display name at time of logging.                                  |

**Note on field naming:** Existing production files use camelCase (`startTime`, `endTime`, `durationLabel`). New files written after this schema is adopted use snake_case as specified above. The console ingestion layer must handle both forms during the transition period. A migration note is included in §11.

---

## 8. Aggregate Report File

**Location:** `Documents/IDMS/data/{deptKey}/reports/report-{deptKey}-{YYYY-MM-DD}.json`
**Written by:** Console (Phase 4+). Currently written by field PWA (Option A). Will move to console-only.
**Read by:** Console

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "department": "Engine Room",
  "date": "2026-04-20",
  "generated": "2026-04-20T22:00:00.000Z",
  "generated_by": "console",
  "source_files": [
    "report-tploch-2026-04-20.json",
    "report-spotchik-2026-04-20.json"
  ],

  "summary": {
    "total_incidents": 4,
    "total_downtime_seconds": 7320,
    "contributing_users": ["tploch", "spotchik"],
    "top_equipment": "Main Engine",
    "top_category": "Mechanical fault"
  },

  "incidents": []
}
```

The `incidents` array uses the same resolved incident object schema as §7, with one addition: a `"contributors"` array listing all usernames whose source files contained this incident (relevant when the console merges overlapping records).

---

## 9. Console Lock File

**Location:** `Documents/IDMS/console.lock`
**Written by:** Active console (heartbeat every 60 seconds)
**Read by:** Any connecting console instance

```json
{
  "console_id": "ARAHO-CONSOLE-01",
  "hostname": "ARAHO-DESKTOP",
  "locked_at": "2026-04-20T08:00:00.000Z",
  "heartbeat": "2026-04-20T14:31:45.000Z"
}
```

**Lock logic:**
- On startup, a console reads this file.
- If `heartbeat` is within the last 180 seconds → enter viewer mode.
- If `heartbeat` is older than 180 seconds (stale) or file is absent → claim active mode, write lock file.
- Active console writes heartbeat every 60 seconds while running.
- On clean shutdown, active console deletes the lock file.

---

## 10. Permission Tiers

Three tiers are defined. The `permission_tier` field on each user object determines their tier. Tiers are enforced by the console; the field PWA uses shell file permission arrays for its own UI decisions.

| Tier       | Field PWA                             | Console                                          |
|------------|---------------------------------------|--------------------------------------------------|
| `admin`    | Full access to own dept(s)            | Full read/write: users, config, all logs, reports |
| `standard` | Log events, view own events           | View logs and reports; cannot edit config or users |
| `observer` | View-only (read own logs, no logging) | Read-only dashboard; no data entry or config     |

Permission arrays in shell files reference these tier strings, not role strings:
```json
"permissions": {
  "can_delete_events": ["admin"],
  "can_edit_events":   ["admin"],
  "can_view_all_logs": ["admin", "standard"],
  "can_export_report": ["admin", "standard"]
}
```

---

## 11. Migration Notes — GitHub → OneDrive

When Phase 3 work begins, the following changes are required:

**Field PWA changes:**
- Replace the `CONFIG_URL` GitHub raw URL with a Graph API fetch to `Documents/IDMS/config/userconfig.json`.
- Replace `configURL(path)` helper (which builds GitHub raw URLs) with a Graph API fetch helper pointing to `Documents/IDMS/config/`.
- The fallback-to-localStorage-cache behaviour is retained unchanged.

**Config file changes:**
- Add `"schema_version": 1` to all config files.
- Add `"name"` field to all user objects in `userconfig.json` (currently absent).
- Add `"permission_tier"` field to all user objects in `userconfig.json`.
- Update shell file `permissions` arrays from role strings to tier strings.

**Log file changes:**
- Field name casing: production files currently use camelCase (`startTime`, `endTime`, `durationLabel`, `displayName`). New schema uses snake_case.
- Console ingestion must accept both forms. A one-time migration utility should be run against existing log files if consistent querying is required.

**No changes to:**
- OneDrive folder structure or file path patterns (already correct).
- Log file write logic in the field PWA (paths and payload are already compliant).
- Department key mapping.

---

## 12. Azure App Registration

**Application name:** IDMS
**Client ID:** `5f7c6099-c379-4cfa-ab6a-92bf33b812aa`
**Tenant ID:** `816c3d02-39d9-4940-9b6f-08b4cf0321ce`
**Authority:** `https://login.microsoftonline.com/816c3d02-39d9-4940-9b6f-08b4cf0321ce`
**Supported account types:** My organization only (O'Hara Corporation)
**Redirect URIs:** `http://localhost:42069` (desktop/public client)
**Allow public client flows:** Enabled
**Required scopes:** `User.Read`, `Files.ReadWrite`

Both the field PWA and the desktop console use this single app registration. The field PWA previously used a different client ID (`2b812782...`) — this must be updated to `5f7c6099...` in Phase 3.

---

## 13. Console Application

**Repository:** `ARA-Chief/IDMS-Console` (private)
**Runtime:** Electron 29 + Node.js
**Local database:** SQLite via `better-sqlite3`, stored at `%APPDATA%\idms-console\idms.db`
**Auth:** MSAL Node (`@azure/msal-node`) with PKCE flow
**Branch strategy:** `main` = stable, `dev` = active development

**Phase 2 status:** Complete. Console shell running, authenticated against O'Hara Corporation tenant, OneDrive connection confirmed, SQLite database initialised, ingestion poller wired up.

**Pending before Phase 3:**
- Update field PWA client ID from `2b812782...` to `5f7c6099...`
- Add `.vs/` to `.gitignore` in IDMS-Console repo
