# IDMS Schema Specification
**Version 1.2 — F/V Araho**
*This document is the authoritative reference for all config, log, and data file structures used by IDMS. Both the field PWA and the desktop console must conform to these schemas. Any structural change requires a version increment and update to this document.*

---

## Table of Contents
1. [File Location Map](#1-file-location-map)
2. [Version Checking](#2-version-checking)
3. [userconfig.json](#3-userconfigjson)
4. [Department Config Files](#4-department-config-files)
5. [Department Shell Files](#5-department-shell-files)
6. [consoleconfig.json](#6-consoleconfigjson)
7. [vesselconfig.json](#7-vesselconfigjson)
8. [Log File (per-user, per-date)](#8-log-file-per-user-per-date)
9. [Aggregate Report File](#9-aggregate-report-file)
10. [Console Lock File](#10-console-lock-file)
11. [Permission Tiers](#11-permission-tiers)
12. [Migration Notes](#12-migration-notes)
13. [Azure App Registration](#13-azure-app-registration)
14. [Console Application](#14-console-application)

---

## 1. File Location Map

All paths are relative to the OneDrive root of the authenticating user (i.e., `me/drive/root:/`). The base folder is `Documents/IDMS/`.

```
Documents/IDMS/
│
├── config/
│   ├── userconfig.json             ← Vessel identity, users, permission tiers
│   ├── consoleconfig.json          ← Console-specific vessel & operational settings
│   ├── vesselconfig.json           ← Vessel particulars, tank definitions, machinery
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
│   │   ├── logs/                   ← report-{date}-{username}.json
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

Increment this value (to `2`, `3`, etc.) whenever a field is added, removed, or renamed in any schema defined in this document. Document the change in a `"changelog"` array within the affected file.

---

## 3. userconfig.json

**Location:** `Documents/IDMS/config/userconfig.json`
**Edited by:** Admin (via console Users screen)
**Read by:** Field PWA on every login; Console on startup

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "departments": ["Factory", "Engine Room", "Deck"],

  "users": [
    {
      "user_id":         "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "username":        "tploch",
      "password":        "araho24",
      "name":            "Tyler Ploch",
      "role":            "Chief Engineer",
      "permission_tier": "admin",
      "status":          "active",
      "departments":     ["Factory", "Engine Room"],
      "email":           "tploch@example.com",
      "phone":           "+1 907 555 0100",
      "location":        "Anchorage, AK"
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-04-20", "note": "Initial schema definition." },
    { "version": 2, "date": "2026-04-21", "note": "Added user_id, name, permission_tier, status, email, phone, location fields." }
  ]
}
```

### User object fields

| Field             | Type     | Required | Notes                                                                         |
|-------------------|----------|----------|-------------------------------------------------------------------------------|
| `user_id`         | string   | yes      | UUID v4. Generated on first console save. Never changes. Used for historic continuity. |
| `username`        | string   | yes      | Lowercase, no spaces. Used in log filenames. Editable except for `admin` account. |
| `password`        | string   | yes      | Plaintext for now. Deferred to security phase.                                |
| `name`            | string   | yes      | Full display name. E.g. `"Tyler Ploch"`.                                     |
| `role`            | string   | yes      | Job title for display only. E.g. `"Chief Engineer"`.                         |
| `permission_tier` | string   | yes      | One of `"admin"`, `"standard"`, `"observer"`. See §11.                       |
| `status`          | string   | yes      | One of `"active"`, `"retired"`. Retired users cannot log into the field PWA. |
| `departments`     | string[] | yes      | Must match entries in the top-level `departments` array.                     |
| `email`           | string   | no       | Contact email. May be empty string.                                           |
| `phone`           | string   | no       | Contact phone. May be empty string.                                           |
| `location`        | string   | no       | Home location. May be empty string.                                           |

### Admin account rules

The `admin` account is a special system account. The console enforces the following restrictions:
- `username` and `name` fields are locked — cannot be changed via the UI
- Only `password` is editable
- Cannot be retired or deleted

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
**Edited by:** Operator / Admin
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
    "filename_pattern": "report-{date}-{username}.json",
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

**Note on permissions:** Permission arrays reference `permission_tier` values (`"admin"`, `"standard"`, `"observer"`), not role strings.

---

## 6. consoleconfig.json

**Location:** `Documents/IDMS/config/consoleconfig.json`
**Edited by:** Admin / Developer (via console settings panel)
**Read by:** Console only

Operational settings and console behaviour. Not present on the field PWA.

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
    "daily_report_cutoff_time": "06:00",
    "trip_start_date": null
  },

  "display": {
    "units_fuel": "USG",
    "units_distance": "nm",
    "units_speed": "kts",
    "units_temperature": "celsius"
  },

  "changelog": [
    { "version": 1, "date": "2026-04-20", "note": "Initial schema definition." }
  ]
}
```

**Note:** Vessel identification, dimensions, and tank definitions have moved to `vesselconfig.json` (§7). The `fuel_tanks`, `ballast_tanks`, and `stability_reference_gm` fields previously stubbed here are superseded by the tank array in `vesselconfig.json`.

---

## 7. vesselconfig.json

**Location:** `Documents/IDMS/config/vesselconfig.json`
**Edited by:** Admin (via console Vessel Setup screen)
**Read by:** Console (Vessel Setup, Reports, future Stability and Fuel modules)

This is a **static definition / reference file**. It defines vessel identity, physical particulars, and the canonical list of tanks and their properties. It is never written to by operational processes — active levels, soundings, and transfer records reference tank IDs from this file but are stored separately.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",

  "info": {
    "vessel_name":     "ARAHO",
    "official_number": "1250884",
    "hull_id":         "N/A",
    "mfr_hull_number": "175",
    "imo_number":      "9731963",
    "flag_state":      "UNITED STATES",
    "call_sign":       "WDH7704"
  },

  "particulars": {
    "service_type":  "Commercial Fishing Vessel",
    "length_ft":     171.00,
    "breadth_ft":    49.00,
    "depth_ft":      28.20,
    "build_year":    2016,
    "gross_tonnage": 2448,
    "net_tonnage":   755,
    "alternate_vins": "N/A"
  },

  "tanks": [
    {
      "tank_id":         "a1b2c3d4-0001-4000-8000-000000000001",
      "category":        "fuel",
      "name":            "Fuel Double Bottom Tank 2 P",
      "abbreviation":    "F.O. 2P",
      "contents":        "Diesel No. 2",
      "capacity":        9288,
      "units":           "USG",
      "max_fill_pct":    95,
      "specific_gravity": 0.850
    }
  ],

  "machinery": [],

  "compartments": [],

  "changelog": [
    { "version": 1, "date": "2026-04-21", "note": "Initial vessel configuration." }
  ]
}
```

### info object fields

| Field             | Type   | Required | Notes                                    |
|-------------------|--------|----------|------------------------------------------|
| `vessel_name`     | string | yes      | Official registered name, uppercase.     |
| `official_number` | string | yes      | U.S. Official Number or equivalent.      |
| `hull_id`         | string | no       | Hull identification number.              |
| `mfr_hull_number` | string | no       | Manufacturer's hull number.              |
| `imo_number`      | string | yes      | IMO number.                              |
| `flag_state`      | string | yes      | Country of registration, uppercase.      |
| `call_sign`       | string | yes      | Radio call sign.                         |

### particulars object fields

| Field           | Type    | Required | Notes                                              |
|-----------------|---------|----------|----------------------------------------------------|
| `service_type`  | string  | yes      | E.g. `"Commercial Fishing Vessel"`.               |
| `length_ft`     | number  | yes      | Length overall, feet.                              |
| `breadth_ft`    | number  | yes      | Moulded breadth, feet.                             |
| `depth_ft`      | number  | yes      | Moulded depth, feet.                               |
| `build_year`    | integer | yes      | Year of build.                                     |
| `gross_tonnage` | number  | yes      | Gross tonnage (GT).                                |
| `net_tonnage`   | number  | yes      | Net tonnage (NT).                                  |
| `alternate_vins`| string  | no       | Any alternate vessel identification numbers.       |

### Tank object fields

| Field              | Type    | Required | Notes                                                                      |
|--------------------|---------|----------|----------------------------------------------------------------------------|
| `tank_id`          | string  | yes      | UUID v4. Generated once, never changes. Used as foreign key by fuel module.|
| `category`         | string  | yes      | One of `"fuel"`, `"lube_oil"`, `"waste_oil"`, `"water"`, `"sewage"`.     |
| `name`             | string  | yes      | Full tank name.                                                            |
| `abbreviation`     | string  | yes      | Short label used in reports and fuel tracking displays.                    |
| `contents`         | string  | no       | Fluid type. E.g. `"Diesel No. 2"`, `"Mobilgard 410 NC"`.                 |
| `capacity`         | number  | yes      | Total tank capacity in the specified units.                                |
| `units`            | string  | yes      | One of `"USG"`, `"LTR"`, `"M3"`, `"BBL"`.                               |
| `max_fill_pct`     | integer | yes      | Maximum safe fill percentage. E.g. `95`.                                  |
| `specific_gravity` | number  | yes      | Fluid specific gravity. Used for weight calculations. Defaults: fuel `0.850`, lube oil `0.900`, waste oil `0.900`, water `1.000`, sewage `1.025`. |

### Tank categories

| Key         | Description                                      |
|-------------|--------------------------------------------------|
| `fuel`      | Fuel and diesel oil tanks                        |
| `lube_oil`  | Lubricating oil and hydraulic oil tanks          |
| `waste_oil` | Bilge, sludge, dirty oil, and incinerator tanks  |
| `water`     | Potable, ballast, technical, and fresh water     |
| `sewage`    | Sewage holding tanks                             |

**Note on future sections:** `machinery` and `compartments` are reserved arrays for Phase 5 (machinery tracking) and the stability module respectively. They are present in the file as empty arrays and must not be removed.

---

## 8. Log File (per-user, per-date)

**Location:** `Documents/IDMS/data/{deptKey}/logs/report-{date}-{username}.json`
**Written by:** Field PWA (on resolve and on 5-minute autosave)
**Read by:** Field PWA (own file only); Console (all files, during ingestion)

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "department": "Engine Room",
  "user": "tploch",
  "user_id": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "displayName": "Tyler Ploch",
  "role": "Chief Engineer",
  "date": "2026-04-20",
  "generated": "2026-04-20T14:32:00.000Z",

  "active": [],

  "resolved": [
    {
      "id": 1713620000000,
      "equipment": "Main Engine",
      "category": "Mechanical fault",
      "startTime": "2026-04-20T12:15:00.000Z",
      "endTime": "2026-04-20T12:44:00.000Z",
      "duration": 1740,
      "durationLabel": "29m 00s",
      "notes": "Investigated oil pressure alarm. Topped up lube oil, alarm cleared.",
      "user": "tploch",
      "displayName": "Tyler Ploch"
    }
  ]
}
```

### Resolved incident object fields

| Field           | Type    | Notes                                                             |
|-----------------|---------|-------------------------------------------------------------------|
| `id`            | integer | Unix timestamp ms at creation. Unique within a user-session.     |
| `equipment`     | string  | Must match an item in the department config at time of logging.  |
| `category`      | string  | Must match a category in the department config at time of logging.|
| `startTime`     | string  | ISO 8601 UTC. (camelCase — written by PWA)                       |
| `endTime`       | string  | ISO 8601 UTC. (camelCase — written by PWA)                       |
| `duration`      | integer | `endTime - startTime` in whole seconds.                          |
| `durationLabel` | string  | Human-readable. E.g. `"1h 04m"`.                                |
| `notes`         | string  | Free text. May be empty string.                                  |
| `user`          | string  | Username of the logging user.                                    |
| `displayName`   | string  | Display name at time of logging.                                 |

**Note on field naming:** Production log files use camelCase (`startTime`, `endTime`, `duration`, `durationLabel`, `displayName`). The console ingestion layer normalises both camelCase and snake_case forms — both are accepted. New tooling should write camelCase to remain consistent with the PWA.

**Note on `user_id`:** The `user_id` field is written into log payloads by the PWA once the console has saved `userconfig.json` with UUID fields and the user logs in again. Older log files without `user_id` are ingested normally — the field is nullable in SQLite.

---

## 9. Aggregate Report File

**Location:** `Documents/IDMS/data/{deptKey}/reports/report-{deptKey}-{YYYY-MM-DD}.json`
**Written by:** Console only (via Reports screen → Save to OneDrive)
**Read by:** Console

The PWA never writes to the `reports/` folder. Aggregate reports are generated exclusively by the console from ingested SQLite data.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "department": "Engine Room",
  "date": "2026-04-20",
  "generated": "2026-04-20T22:00:00.000Z",
  "generated_by": "console",
  "source_files": [],

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

The `incidents` array uses the same resolved incident object schema as §8.

---

## 10. Console Lock File

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

**Note:** The lock file heartbeat is not yet implemented in the console application. It is defined here for Phase 4 implementation.

---

## 11. Permission Tiers

Three tiers are defined. The `permission_tier` field on each user object determines their tier. Tiers are enforced by the console; the field PWA uses shell file permission arrays for its own UI decisions.

| Tier       | Field PWA                             | Console                                           |
|------------|---------------------------------------|---------------------------------------------------|
| `admin`    | Full access to own dept(s)            | Full read/write: users, config, all logs, reports |
| `standard` | Log events, view own events           | View logs and reports; cannot edit config or users|
| `observer` | View-only (read own logs, no logging) | Read-only dashboard; no data entry or config      |

Permission arrays in shell files reference these tier strings, not role strings:
```json
"permissions": {
  "can_delete_events": ["admin"],
  "can_edit_events":   ["admin"],
  "can_view_all_logs": ["admin", "standard"],
  "can_export_report": ["admin", "standard"]
}
```

**Retired users** (`status: "retired"`) are blocked from PWA login regardless of permission tier. Their records and event history are preserved in the console database.

---

## 12. Migration Notes

### Phase 3 — GitHub → OneDrive ✅ Complete

- Field PWA `CONFIG_URL` updated from GitHub raw URL to Graph API fetch against `Documents/IDMS/config/userconfig.json`.
- Client ID updated from `2b812782...` to `5f7c6099...`.
- `schema_version` added to all config files.
- Shell file `permissions` arrays updated from role strings to tier strings.
- OneDrive folder structure confirmed correct.

### Phase 4 — Schema migrations ✅ Complete

- `userconfig.json`: added `user_id`, `name`, `permission_tier`, `status`, `email`, `phone`, `location` per user. Console Users screen performs this migration automatically on first save.
- `vesselconfig.json`: new file created. Supersedes vessel identity fields previously stubbed in `consoleconfig.json`.
- Log file `user_id` field: the PWA writes `user_id` into payloads after the user's config entry has been saved with a UUID by the console. Older files without `user_id` are handled gracefully by the ingestion layer (nullable field).
- Log file field naming: production files use camelCase. Console ingestion normalises both forms. No mandatory migration of existing files required.

### Pending

- `console.lock` heartbeat implementation (Phase 4 remaining).
- PWA schema version check against `SCHEMA_VERSION` constant to be verified after user config migration.
- Security phase: password hashing (currently plaintext).

---

## 13. Azure App Registration

**Application name:** IDMS
**Client ID:** `5f7c6099-c379-4cfa-ab6a-92bf33b812aa`
**Tenant ID:** `816c3d02-39d9-4940-9b6f-08b4cf0321ce`
**Authority:** `https://login.microsoftonline.com/816c3d02-39d9-4940-9b6f-08b4cf0321ce`
**Supported account types:** My organization only (O'Hara Corporation)
**Redirect URIs:** `http://localhost:42069` (desktop/public client)
**Allow public client flows:** Enabled
**Required scopes:** `User.Read`, `Files.ReadWrite`

Both the field PWA and the desktop console use this single app registration.

**CSP note:** The console `index.html` Content Security Policy must include `https://*.sharepoint.com` in `connect-src`. OneDrive for Business file content fetches redirect to SharePoint CDN URLs which are blocked without this entry.

---

## 14. Console Application

**Repository:** `ARA-Chief/IDMS-Console` (private)
**Runtime:** Electron 29 + Node.js
**Local database:** SQLite via `better-sqlite3`, stored at `%APPDATA%\idms-console\idms.db`
**Auth:** MSAL Node (`@azure/msal-node`) with PKCE flow
**Branch strategy:** `main` = stable, `dev` = active development

### SQLite schema

```sql
CREATE TABLE log_files (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL,
  user_id      TEXT,
  department   TEXT NOT NULL,
  date         TEXT NOT NULL,
  file_path    TEXT NOT NULL UNIQUE,
  ingested_at  TEXT NOT NULL,
  event_count  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE events (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file      TEXT NOT NULL,
  event_id         TEXT NOT NULL,
  vessel           TEXT,
  department       TEXT NOT NULL,
  username         TEXT NOT NULL,
  user_id          TEXT,
  display_name     TEXT,
  equipment        TEXT NOT NULL,
  category         TEXT NOT NULL,
  start_time       TEXT,
  end_time         TEXT,
  duration_seconds INTEGER,
  duration_label   TEXT,
  notes            TEXT,
  is_active        INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_file, event_id)
);

CREATE TABLE ingest_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  TEXT NOT NULL,
  file_path  TEXT NOT NULL,
  status     TEXT NOT NULL,
  message    TEXT
);
```

`user_id` columns were added via `ALTER TABLE` migration in Phase 4 and are nullable to support pre-UUID log files.

### Console renderer modules

| File           | Screen         | Status      |
|----------------|----------------|-------------|
| `app.js`       | Navigation     | ✅ Complete  |
| `auth.js`      | Sign-in        | ✅ Complete  |
| `graph.js`     | OneDrive API   | ✅ Complete  |
| `ingest.js`    | Polling engine | ✅ Complete  |
| `overview.js`  | Overview       | ✅ Complete  |
| `eventlogs.js` | Event logs     | ✅ Complete  |
| `reports.js`   | Reports        | ✅ Complete  |
| `users.js`     | Users          | ✅ Complete  |
| `vessel.js`    | Vessel setup   | ✅ Complete  |
| `settings.js`  | Settings       | ✅ Complete  |

### Phase 4 status: Complete

All core oversight screens are functional. Ingestion, event log browsing, report generation, user management, and vessel configuration are operational.

### Phase 5 — Pending

- `console.lock` heartbeat (write/read on startup, 60s interval, clean delete on shutdown)
- Live timers screen (active event monitoring across all users)
- Fuel & transfers module (reads tank definitions from `vesselconfig.json` by `tank_id`)
- Navigation calculations
- Stability module (reads tank SG and capacity from `vesselconfig.json`)
- Analytics screen
