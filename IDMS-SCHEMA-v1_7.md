# IDMS Schema Specification
**Version 1.8 — F/V Araho**
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
8. [bootstrap.json](#8-bootstrapjson)
9. [assets.csv](#9-assetscsv)
10. [equipmentconfig.json](#10-equipmentconfigjson)
11. [Log File (per-user, per-date)](#11-log-file-per-user-per-date)
12. [Aggregate Report File](#12-aggregate-report-file)
13. [Console Lock File](#13-console-lock-file)
14. [Permission Tiers](#14-permission-tiers)
15. [Department Resource Registry](#15-department-resource-registry)
16. [Migration Notes](#16-migration-notes)
17. [Azure App Registration](#17-azure-app-registration)
18. [Console Application](#18-console-application)
19. [tankconfig.json](#19-tankconfigjson)
20. [roundsconfig.json](#20-roundsconfigjson)
21. [Rounds Log File (per-date)](#21-rounds-log-file-per-date)
22. [fuelstate.json](#22-fuelstatejson)
23. [Trip Planner](#23-trip-planner)

---

## 1. File Location Map

All paths are relative to the OneDrive root of the authenticating user (i.e., `me/drive/root:/`). The base folder is `Documents/IDMS/`.

```
Documents/IDMS/
│
├── config/
│   ├── userconfig.json             ← Vessel identity, users, permission tiers
│   ├── consoleconfig.json          ← Console-specific operational settings & connection paths
│   ├── vesselconfig.json           ← Vessel particulars, tank definitions, machinery
│   ├── equipmentconfig.json        ← Department code-range assignments
│   ├── assets.csv                  ← Vessel asset register (TM-Master export, read-only)
│   ├── roundsconfig.json           ← Vessel-level rounds schedule and section definitions
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
│   ├── deck/
│   │   ├── logs/
│   │   └── reports/
│   └── rounds/
│       ├── logs/                   ← rounds-{YYYY-MM-DD}.json
│       └── reports/                ← rounds-report-{YYYY-MM-DD}.json (future)
│
└── console.lock                    ← Active console heartbeat file
```

**Local machine files** (not on OneDrive):

```
%APPDATA%\idms-console\
├── idms.db           ← SQLite database
└── bootstrap.json    ← Bootstrap credentials and OneDrive base path (see §8)
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
      "location":        "Anchorage, AK",
      "resources":       ["engine/event_log", "engine/fuel_transfer", "engine/maintenance"]
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-04-20", "note": "Initial schema definition." },
    { "version": 2, "date": "2026-04-21", "note": "Added user_id, name, permission_tier, status, email, phone, location fields." },
    { "version": 3, "date": "2026-04-21", "note": "Added resources field per user for module-level access grants." }
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
| `permission_tier` | string   | yes      | One of `"admin"`, `"standard"`, `"observer"`. See §14.                       |
| `status`          | string   | yes      | One of `"active"`, `"retired"`. Retired users cannot log into the field PWA. |
| `departments`     | string[] | yes      | Must match entries in the top-level `departments` array.                     |
| `email`           | string   | no       | Contact email. May be empty string.                                           |
| `phone`           | string   | no       | Contact phone. May be empty string.                                           |
| `location`        | string   | no       | Home location. May be empty string.                                           |
| `resources`       | string[] | yes      | Granted module keys. Format: `"{dept}/{module}"`. See §15 for valid values.  |

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
**Edited by:** Admin (via console Settings screen)
**Read by:** Console only

Operational settings, console behaviour, and OneDrive path configuration. Not present on the field PWA.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "vessel_type": "Factory Trawler",
  "call_sign": "WDH7704",
  "imo_number": "9731963",
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
    "trip_start_date": null,
    "active_trip_number": null
  },

  "display": {
    "units_fuel": "USG",
    "units_distance": "nm",
    "units_speed": "kts",
    "units_temperature": "celsius"
  },

  "connections": {
    "config": {
      "userconfig":    "config/userconfig.json",
      "consoleconfig": "config/consoleconfig.json",
      "vesselconfig":  "config/vesselconfig.json",
      "factoryconfig": "config/factoryconfig.json",
      "engineconfig":  "config/engineconfig.json",
      "deckconfig":    "config/deckconfig.json",
      "factoryshell":  "config/shells/factoryshell.json",
      "engineshell":   "config/shells/engineshell.json",
      "deckshell":     "config/shells/deckshell.json",
      "roundsconfig":  "config/roundsconfig.json",
      "tankconfig":    "config/tankconfig.json"
    },
    "data": {
      "factory_logs":    "data/factory/logs/",
      "factory_reports": "data/factory/reports/",
      "engine_logs":     "data/engine/logs/",
      "engine_reports":  "data/engine/reports/",
      "deck_logs":       "data/deck/logs/",
      "deck_reports":    "data/deck/reports/",
      "rounds_logs":     "data/rounds/logs/",
      "rounds_reports":  "data/rounds/reports/",
      "trips_log":       "data/trips/trips.json",
      "trips_daily":     "data/trips/daily/",
      "icms_production": "data/icms/production/"
    },
    "lock_file": "console.lock"
  },

  "changelog": [
    { "version": 1, "date": "2026-04-20", "note": "Initial schema definition." },
    { "version": 2, "date": "2026-04-21", "note": "Added connections block (config paths, data paths, lock file)." },
    { "version": 3, "date": "2026-04-22", "note": "Added roundsconfig to connections.config; rounds_logs and rounds_reports to connections.data." },
    { "version": 4, "date": "2026-04-23", "note": "Added tankconfig to connections.config." },
    { "version": 5, "date": "2026-04-26", "note": "Added active_trip_number to operational; trips_log, trips_daily, icms_production to connections.data." }
  ]
}
```

### connections block

All paths in `connections` are relative to the OneDrive base path defined in `bootstrap.json` (§8). They are editable via the Settings screen (admin only) and are the canonical source of truth for where the console looks for every file on OneDrive.

The `connections` block is intentionally stored on OneDrive rather than locally so that path changes made by an administrator are visible to all console instances on the next restart.

**Note:** Bootstrap values (authentication IDs, OneDrive base path) are stored separately in `bootstrap.json` on the local machine because they are required before OneDrive can be reached. See §8.

**Note:** Vessel identification fields (`vessel_type`, `call_sign`, etc.) remain in this file for convenience but vessel particulars and tank definitions live in `vesselconfig.json` (§7).

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
    "service_type":   "Commercial Fishing Vessel",
    "length_ft":      171.00,
    "breadth_ft":     49.00,
    "depth_ft":       28.20,
    "build_year":     2016,
    "gross_tonnage":  2448,
    "net_tonnage":    755,
    "alternate_vins": "N/A"
  },

  "tanks": [
    {
      "tank_id":          "a1b2c3d4-0001-4000-8000-000000000001",
      "category":         "fuel",
      "name":             "Fuel Double Bottom Tank 2 P",
      "abbreviation":     "F.O. 2P",
      "contents":         "Diesel No. 2",
      "capacity":         9288,
      "units":            "USG",
      "max_fill_pct":     95,
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

| Field            | Type    | Required | Notes                                        |
|------------------|---------|----------|----------------------------------------------|
| `service_type`   | string  | yes      | E.g. `"Commercial Fishing Vessel"`.         |
| `length_ft`      | number  | yes      | Length overall, feet.                        |
| `breadth_ft`     | number  | yes      | Moulded breadth, feet.                       |
| `depth_ft`       | number  | yes      | Moulded depth, feet.                         |
| `build_year`     | integer | yes      | Year of build.                               |
| `gross_tonnage`  | number  | yes      | Gross tonnage (GT).                          |
| `net_tonnage`    | number  | yes      | Net tonnage (NT).                            |
| `alternate_vins` | string  | no       | Any alternate vessel identification numbers. |

### Tank object fields

| Field              | Type    | Required | Notes                                                                      |
|--------------------|---------|----------|----------------------------------------------------------------------------|
| `tank_id`          | string  | yes      | UUID v4. Generated once, never changes. Used as foreign key by fuel module.|
| `category`         | string  | yes      | One of `"fuel"`, `"lube_oil"`, `"waste_oil"`, `"water"`, `"sewage"`.     |
| `name`             | string  | yes      | Full tank name.                                                            |
| `abbreviation`     | string  | yes      | Short label used in reports and fuel tracking displays.                    |
| `tank_setup_id`    | string  | no       | Tank ID from `tankconfig.json` (e.g. `"TK01C"`), or `null` if not linked. When set, `capacity` and `specific_gravity` are derived automatically from the tank's 100% fill row and locked in the Vessel Setup UI. |
| `contents`         | string  | no       | Fluid type. E.g. `"Diesel No. 2"`, `"Mobilgard 410 NC"`.                 |
| `capacity`         | number  | yes      | Total tank capacity in the specified units. Auto-derived from `tankconfig.json` when `tank_setup_id` is set; unit conversion applied at that time. |
| `units`            | string  | yes      | One of `"USG"`, `"LTR"`, `"M3"`, `"BBL"`.                               |
| `max_fill_pct`     | integer | yes      | Maximum safe fill percentage. E.g. `95`.                                  |
| `specific_gravity` | number  | yes      | Fluid specific gravity. Auto-derived as `weight_t / net_vol_m3` at 100% fill from `tankconfig.json` when `tank_setup_id` is set. Manual entry otherwise. |

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

## 8. bootstrap.json

**Location:** `%APPDATA%\idms-console\bootstrap.json`
**Edited by:** Admin (via console Settings screen → Advanced — Connections & Paths → Bootstrap section)
**Read by:** Console only, on startup before any network calls are made

This file holds the values the console needs to authenticate and locate OneDrive before it can fetch any remote config. Because these values must be available before OneDrive is reachable, they are stored locally on the machine rather than on OneDrive.

If the file is absent on startup, the console writes it from hardcoded defaults. It is safe to delete — the console will recreate it with defaults on the next launch.

```json
{
  "client_id":     "5f7c6099-c379-4cfa-ab6a-92bf33b812aa",
  "tenant_id":     "816c3d02-39d9-4940-9b6f-08b4cf0321ce",
  "authority":     "https://login.microsoftonline.com/816c3d02-39d9-4940-9b6f-08b4cf0321ce",
  "redirect_uri":  "http://localhost:42069",
  "scopes":        "User.Read Files.ReadWrite",
  "onedrive_base": "Documents/IDMS"
}
```

### Fields

| Field           | Type   | Notes                                                                                  |
|-----------------|--------|----------------------------------------------------------------------------------------|
| `client_id`     | string | Azure app registration client ID. See §17.                                             |
| `tenant_id`     | string | Azure AD tenant ID. See §17.                                                           |
| `authority`     | string | Full MSAL authority URL. Normally derived from `tenant_id`.                            |
| `redirect_uri`  | string | Must match the redirect URI registered in Azure. Default: `http://localhost:42069`.    |
| `scopes`        | string | Space-separated list of required Graph API scopes.                                     |
| `onedrive_base` | string | Root folder for all IDMS files on OneDrive. Default: `Documents/IDMS`. No trailing slash. |

### Settings panel display

The Settings screen surfaces all bootstrap fields in a collapsible **Advanced — Connections & Paths** section, visible to all users but editable by admins only. The section is collapsed by default to reduce accidental edits. Changes require a console restart to take effect.

The panel also displays a read-only computed field showing the full Graph API root URL derived from `onedrive_base`, and flags any live-vs-saved discrepancy (i.e. if the file on disk was edited directly without restarting).

### Two-tier storage rationale

| Value type | Stored in | Reason |
|---|---|---|
| Auth IDs, OneDrive base path | `bootstrap.json` (local) | Needed before OneDrive is reachable — chicken-and-egg if stored remotely |
| Config file paths, data paths | `consoleconfig.json` (OneDrive) | Can be fetched once authenticated; changes propagate to all console instances |

### Future: storage provider abstraction

The current implementation is hardwired to Microsoft Graph API (OneDrive for Business). A planned future refactor will introduce a storage provider abstraction layer:

```
storage.js              ← provider interface: get(), put(), list(), listFolder()
providers/
  onedrive.js           ← current graph.js logic
  dropbox.js            ← stub
  local.js              ← stub (useful for offline testing)
```

When implemented, `bootstrap.json` will gain a `storage_provider` field (default: `"onedrive"`) and the Settings panel will expose a provider selector. All screen modules already call named loader functions (`loadUserConfig()`, `graphPut()`, etc.) and will not require changes — only `graph.js` and the bootstrap layer need to be updated. This is deferred to a future phase.

---

## 9. assets.csv

**Location:** `Documents/IDMS/config/assets.csv`
**Edited by:** External (TM-Master export). Replace the file on OneDrive when the asset register changes.
**Read by:** Console only — ingested into the SQLite `assets` table on manual refresh from the Equipment Setup screen. Never read by the field PWA directly.

This file is the vessel's complete equipment and asset register, exported from TM-Master. IDMS treats it as **read-only** — it is never written to by the console or the field PWA. When the register changes, the operator replaces the file on OneDrive and triggers a refresh.

### Column reference

| Column | Type | Notes |
|---|---|---|
| `Code` | string | Dotted-decimal asset code. Primary key. E.g. `601.001.027.016`. |
| `Unit name` | string | Vessel name. Always `Araho`. |
| `Unit code` | string | Vessel code. Always `ARA`. |
| `Name` | string | Human-readable asset name. Used for display and autocomplete. |
| `SerialNo` | string | Manufacturer serial number. May be empty. |
| `Maker` | string | Manufacturer name. May be empty. |
| `MakersType` | string | Manufacturer model/type designation. May be empty. |
| `Parent Component` | string | Parent asset in `{code}-{name}` format, or `No Parent`. |
| `Installation Date` | string | Date installed. May be empty. |
| `Installation Details` | string | Free-text installation notes. May be empty. |

Remaining columns are preserved during ingest but not actively used by IDMS in the current phase.

### Notes

- The `Code` field is the stable identifier used for all equipment references across IDMS. It never changes for a given physical asset.
- Codes follow a dotted-decimal hierarchy. Range comparison is performed at the top-level integer segment only (e.g. `601` covers `601`, `601.001`, `601.001.027`, and all descendants).
- The file uses a UTF-8 BOM header (`\xef\xbb\xbf`). The ingestion layer strips this before parsing.
- Assets whose `Code` top-level segment falls within an Ignore range in `equipmentconfig.json` are stored with `department = 'ignore'` and never surfaced in autocomplete.

---

## 10. equipmentconfig.json

**Location:** `Documents/IDMS/config/equipmentconfig.json`
**Edited by:** Admin (via console Equipment Setup screen)
**Read by:** Console (at ingest time, to compute `department` column in `assets` table); Field PWA (future — to filter autocomplete by department)

Defines which asset code ranges belong to which department, and which ranges are excluded entirely. This is the sole source of truth for department assignment. Assignment is computed at ingest time and stored in the `assets.department` SQLite column.

```json
{
  "schema_version": 1,
  "departments": {
    "engine": {
      "ranges": [
        { "from": "600", "to": "650" },
        { "from": "700", "to": "760" },
        { "from": "790", "to": "793" }
      ]
    },
    "factory": {
      "ranges": [
        { "from": "310", "to": "320" },
        { "from": "360", "to": "362" },
        { "from": "491", "to": "492" }
      ]
    },
    "deck": {
      "ranges": [
        { "from": "400", "to": "440" },
        { "from": "464", "to": "464" }
      ]
    }
  },
  "ignore": {
    "ranges": [
      { "from": "100", "to": "199" },
      { "from": "991", "to": "999" }
    ]
  },
  "changelog": [
    { "version": 1, "date": "2026-04-21", "note": "Initial department range assignment." }
  ]
}
```

### Range object fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `from` | string | yes | Starting code, inclusive. Top-level segment only (e.g. `"600"`). All children included automatically. |
| `to` | string | yes | Ending code, inclusive. Top-level segment only. |

### Assignment rules

1. Range boundaries are evaluated at the top-level integer segment only. `{ "from": "600", "to": "650" }` includes all assets whose first code segment is between 600 and 650 inclusive.
2. An asset may match ranges for multiple departments — it is assigned all matching keys as a comma-separated string (e.g. `"engine,factory"`).
3. **Ignore takes precedence.** If an asset matches any Ignore range, it receives `department = 'ignore'` regardless of any department match.
4. Assets matching no range receive `department = NULL` (unassigned). They appear in full-register autocomplete searches.

### Ingest process

On every ingest triggered by Refresh or Save:
1. `assets.csv` and `equipmentconfig.json` are fetched from OneDrive in the renderer process (Graph API token lives there).
2. Both are passed to the `db:ingestAssets` IPC handler in the main process.
3. The `equipment_assignments` table is fully rebuilt from the config.
4. All assets are upserted in a single SQLite transaction with computed `department` values.
5. `db:getAssetRangeCounts` queries the `assets` table post-ingest to return exact counts per range for the Equipment Setup screen badges.

---

## 11. Log File (per-user, per-date)

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

## 12. Aggregate Report File

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

The `incidents` array uses the same resolved incident object schema as §11.

---

## 13. Console Lock File

**Location:** `Documents/IDMS/console.lock`
**Written by:** Active console (heartbeat every 60 seconds)
**Read by:** Any connecting console instance

```json
{
  "console_id": "ARAHO-CONSOLE-01",
  "hostname":   "ARAHO-DESKTOP",
  "locked_at":  "2026-04-20T08:00:00.000Z",
  "heartbeat":  "2026-04-20T14:31:45.000Z"
}
```

**Lock logic:**
- On startup, a console reads this file.
- If `heartbeat` is within the last 180 seconds → enter viewer mode.
- If `heartbeat` is older than 180 seconds (stale) or file is absent → claim active mode, write lock file.
- Active console writes heartbeat every 60 seconds while running.
- On clean shutdown, active console deletes the lock file.

**Note:** The lock file heartbeat is not yet implemented in the console application. It is defined here for Phase 5 implementation.

---

## 14. Permission Tiers

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

## 15. Department Resource Registry

**Defined in:** `users.js` (`DEPT_RESOURCES` constant)
**Controlled by:** Developer only — not editable via the console UI
**Used by:** Console Users screen (to render resource checkboxes); console sidebar (to determine which nav items to show for the logged-in user)

This registry defines the available modules per department. Each entry has a `key` (stored in `user.resources[]`) and a `label` (displayed in the UI and sidebar).

```javascript
const DEPT_RESOURCES = {
  'Factory': [
    { key: 'factory/event_log',    label: 'Event Log' },
    { key: 'factory/reports',      label: 'Reports' },
    { key: 'factory/rounds',       label: 'Rounds' },
    { key: 'factory/tasks',        label: 'Tasks' }
  ],
  'Engine Room': [
    { key: 'engine/event_log',     label: 'Event Log' },
    { key: 'engine/reports',       label: 'Reports' },
    { key: 'engine/fuel_transfer', label: 'Fuel & Transfers' },
    { key: 'engine/maintenance',   label: 'Maintenance' },
    { key: 'engine/rounds',        label: 'Rounds' },
    { key: 'engine/tasks',         label: 'Tasks' }
  ],
  'Deck': [
    { key: 'deck/event_log',       label: 'Event Log' },
    { key: 'deck/reports',         label: 'Reports' },
    { key: 'deck/rounds',          label: 'Rounds' },
    { key: 'deck/tasks',           label: 'Tasks' }
  ]
};
```

### Resource key format

`"{department_key}/{module_key}"` — lowercase, no spaces, underscore-separated.

| Department  | Dept key  |
|-------------|-----------|
| Factory     | `factory` |
| Engine Room | `engine`  |
| Deck        | `deck`    |

### Access model

- A user must be **assigned to a department** before any of that department's resources can be granted.
- Resources are granted **per individual user** — not per role. Roles carry no implicit resource grants.
- The console Users screen renders resource checkboxes grouped by assigned department. Checking/unchecking a department live-updates the resource list below it; any resources already granted for a removed department are preserved in the array but become dormant until the department is reassigned.
- The console sidebar renders only the resources granted to the currently logged-in IDMS user, grouped by department. Overview is always visible regardless of grants.
- **Admin account** (`username: "admin"`) has its resource checkboxes locked in the UI. Its `resources` array is not enforced by the sidebar — the admin account has full access to all screens.

### Rounds resource access model

Rounds is a vessel-level module, but resource access is gated per department for user permission purposes. A user assigned to Engine Room with `engine/rounds` granted can complete the Engine Room sections of a rounds sheet. Access to all sections (required for generating and submitting a full sheet) should be granted to admin-tier users via all three department rounds keys.

### Adding new modules

To add a new module to a department, add an entry to `DEPT_RESOURCES` in `users.js`. No schema migration is required — existing users simply won't have the new key in their `resources` array until an admin grants it.

---

## 16. Migration Notes

### Phase 3 — GitHub → OneDrive ✅ Complete

- Field PWA `CONFIG_URL` updated from GitHub raw URL to Graph API fetch against `Documents/IDMS/config/userconfig.json`.
- Client ID updated from `2b812782...` to `5f7c6099...`.
- `schema_version` added to all config files.
- Shell file `permissions` arrays updated from role strings to tier strings.
- OneDrive folder structure confirmed correct.

### Phase 4 — Console oversight screens ✅ Complete

- `userconfig.json`: added `user_id`, `name`, `permission_tier`, `status`, `email`, `phone`, `location` per user. Console Users screen performs this migration automatically on first save.
- `vesselconfig.json`: new file created. Supersedes vessel identity fields previously stubbed in `consoleconfig.json`.
- Log file `user_id` field: the PWA writes `user_id` into payloads after the user's config entry has been saved with a UUID by the console. Older files without `user_id` are handled gracefully by the ingestion layer (nullable field).
- Log file field naming: production files use camelCase. Console ingestion normalises both forms. No mandatory migration of existing files required.
- `consoleconfig.json`: added `connections` block containing all OneDrive file and folder paths. Editable via Settings screen.
- `bootstrap.json`: new local file. Holds MSAL credentials and OneDrive base path. Written from hardcoded defaults on first launch if absent.
- Settings screen: added collapsible Advanced — Connections & Paths panel (admin only). Surfaces all bootstrap and path values in one place for sanity-checking and future provider changes.
- `userconfig.json`: added `resources` string array per user for module-level access grants.
- Console Users screen: Department Access section added. Departments and module resources are now individually assignable per user. Resource checkboxes update live when department assignments change.
- Console auth flow: two-stage login implemented. MSAL authenticates the Microsoft identity; IDMS login (username + password against `userconfig.json`) determines the operating user, their permissions, and their resource grants. MSAL token is cached across restarts; IDMS session is in-memory only and cleared on console close.
- Console sidebar: logged-in user displayed with initials avatar, name, role, and sign-out button. Vessel info sits below the user block.
- `window.idmsCurrentUser`: renderer-side session object set on IDMS login, cleared on sign-out. Not stored on `window.idms` (contextBridge proxy is sealed); stored directly on `window`.

### Phase 5 (partial) — Asset register & equipment setup ✅ Complete

- `assets.csv` — TM-Master export uploaded to `Documents/IDMS/config/`. Read-only from IDMS; replaced manually when the register changes.
- `equipmentconfig.json` — new file at `Documents/IDMS/config/`. Created manually or via Equipment Setup screen. Scaffolded automatically by console if absent.
- `equipment.js` renderer module — Equipment Setup screen added under Administration. Department range assignment, add/remove ranges, save to OneDrive, and Refresh from OneDrive all operational.
- `assets` and `equipment_assignments` SQLite tables — created via `CREATE TABLE IF NOT EXISTS` on startup (safe migration, no manual intervention required).
- Asset ingest architecture — CSV fetch and config load run in renderer (Graph API token); all parsing and SQLite writes run in main process via `db:ingestAssets` IPC handler. Full transaction upsert of ~2,800 rows.
- IPC handlers added: `db:ingestAssets`, `db:getAssetStats`, `db:getAssetRangeCounts`, `db:getAssetByCode`, `db:searchAssets`.
- Equipment Setup badge counts are exact SQLite counts (not estimates), computed post-ingest via `db:getAssetRangeCounts`. Badges show `—` while there are unsaved range changes.

### Phase 5 (partial continued) — Rounds module ✅ Complete

- `roundsconfig.json` — new file at `Documents/IDMS/config/`. Console scaffolds a minimal valid file (zero sections, 4 rounds at 00/06/12/18) if absent on first load of the Rounds Setup screen. The scaffold is not written to OneDrive automatically — the user must save explicitly.
- `data/rounds/logs/` — new OneDrive folder. Created automatically by the console on first rounds log write.
- `rounds_config_snapshots` and `rounds_entries` SQLite tables — added via `CREATE TABLE IF NOT EXISTS` on console startup. No manual migration required.
- `consoleconfig.json → connections` — `roundsconfig`, `rounds_logs`, and `rounds_reports` path entries added (see §6).
- `rounds.js` — new console renderer module for the Rounds Setup screen under Administration.
- IPC handlers added: `db:ingestRoundsLog`, `db:getRoundsDates`, `db:getRoundsSummary`.
- Rounds log polling added to the console ingestion cycle alongside department event logs.
- `active_rounds` field added to item objects in `roundsconfig.json` — integer array of round numbers for which a given item is active. Defaults to all rounds. Headings do not carry this field.
- `section_completions` block added to round objects in the rounds log file — records which user completed each section. `completed_by` is stored per row in `rounds_entries` (see §20).
- `custom_options` field added to item objects in `roundsconfig.json` — required when `type` is `"custom"`. Stores an ordered string array of selectable options. At data entry time the field PWA renders these as a dropdown. Value stored in log files as a plain string.
- Item type `"custom"` added alongside `"numeric"`, `"text"`, `"checkbox"`, `"heading"`. `"text"` remains an unvalidated free-text input; `"custom"` constrains entry to `custom_options`.
- Valid unit list expanded: added `inH2O`, `ppm`, `mV`, `mA`, `Hz`, `KVA`, `KVAR`, and `°` (compass heading / angular degrees). Units are now grouped by physical category in the schema reference and in the console dropdown.

### Phase 5 (partial continued) — Tank Setup screen ✅ Complete

- `tankconfig.json` — new file at `Documents/IDMS/config/tankconfig.json`. Scaffold written by console if absent. Pre-populated from `Book6.xlsx` hydrostatic tables (44 tanks, 21 rows each at 0%–100%).
- `tank.js` — new console renderer module for the tank hydrostatic table editor. Originally added as a standalone screen under Administration; subsequently moved to the Vessel Setup → Stability tab (see Navigation restructuring note).
- `consoleconfig.json → connections.config` — `tankconfig` path entry added.
- IPC handlers: none required (config is loaded/saved directly via Graph API; no SQLite involvement).

### Phase 5 (partial continued) — Liquid Cargo & Fuel screen ✅ Complete

- `fuelstate.json` — new file at `Documents/IDMS/data/fuel/fuelstate.json`. Console scaffolds a default state (all volumes zero, no burn plan tanks set) if absent on first load of the Fuel & Oil Transfers screen. The scaffold is not written to OneDrive automatically — the user must save explicitly.
- `fuel.js` — new console renderer module for the Fuel & Oil Transfers screen under Operations. Positioned after Overview and Live timers in the sidebar. Replaces the previously-disabled "Fuel & transfers" nav item.
- `burn_plan` field added to `fuelstate.json` — stores `tank_a_id` and `tank_b_id` UUIDs for the active draw tanks. Editable by Chief Engineer / admin only; all other roles see read-only text.
- Fuel Onboard two-column responsive layout — the inventory panel splits into two side-by-side columns at wider viewports.
- Negative fuel volumes — fuel tank volume inputs accept negative values to accommodate flow-meter calibration errors.
- `consoleconfig.json → connections.data` — `fuel_state` path entry should be added (see §22).
- Settling tank burn logic: transfers to `Settling Tk.` deduct from source but do not accumulate in the settling tank, simulating fuel consumption by the main engine.

### Console UI — Navigation restructuring ✅ Complete

- **Collapsible sidebar groups** — The four sidebar section headers (Operations, Personnel, Logs, Administration) are now interactive toggles. Clicking a header collapses or expands its items with a smooth max-height transition. Collapsed/expanded state persists to `localStorage` under the key `navCollapsed`. Each header displays a chevron (▾ expanded, ▸ collapsed).

- **Vessel Setup converted to tabbed layout** — `vessel.js` now renders three tabs using the same `cs-tab-bar` / `cs-tab` CSS pattern as Crew Setup:
  - **Vessel Particulars** — Combined single-panel form containing all fields previously split across the "Vessel Information" and "Vessel Particulars" sections. The "Vessel Information" section heading has been removed; both sets of fields now appear in one grid.
  - **Liquid Cargo & Fuel Tanks** — The tank categories grid (fuel, lube oil, waste oil, water, sewage) with tank linkage to `tankconfig.json`. Redundant "Liquid Cargo & Fuel Tanks" section heading removed (tab name is sufficient).
  - **Stability** — Hosts the tank hydrostatic table editor (previously the standalone Tank Setup screen). `tank.js` renders into a `<div id="ves-stability-content">` within this tab via a new `TK.containerId` property. The Tank Setup sidebar button has been removed.

- **Tank Setup removed from sidebar** — `Administration → Tank Setup` nav item removed. The functionality is now exclusively accessed via `Administration → Vessel Setup → Stability`. The `screen-tank` div remains in the DOM and the `tank` SCREENS entry is retained for programmatic use, but no sidebar button triggers it.

- **`TK.containerId` pattern** — `tank.js` gained a `containerId` field on the `TK` state object (default `null`). All three container references in `initTank()`, `renderTank()`, and `bindTankEvents()` resolve to `TK.containerId || 'screen-tank'`. When `vessel.js` activates the Stability tab it sets `TK.containerId = 'ves-stability-content'` before calling `initTank()`. `initTank()` skips a full OneDrive reload if `TK.config` is already in memory, re-rendering immediately instead.

- **Crew Setup gained a fourth "Crew List" tab** — `crewsetup.js` now renders four tabs: Departments & Roles, Certificate Types, Requirements Matrix, and **Crew List**. When the Crew List tab is active the topbar shows `+ Add crew member` instead of the training-matrix Save button.

- **Crew List removed from Personnel sidebar** — The `nav-crew` button (`data-screen="crew"`) has been removed from the sidebar Personnel group. Crew List is now accessed exclusively via `Administration → Crew Setup → Crew List`.

- **`CREW.containerId` pattern** — `crew.js` gained a `containerId` field on the `CREW` state object (default `null`), matching the `TK.containerId` pattern. `initCrew()` and `renderCrewScreen()` target `CREW.containerId || 'screen-crew'`. When embedded, topbar manipulation is skipped (the parent `crewsetup.js` manages the topbar). `CREW.containerId` is reset to `null` when switching away from the Crew List tab.

### Phase 6 — Trip Planner ✅ Complete

- Three new SQLite tables added via `CREATE TABLE IF NOT EXISTS` on console startup (no manual migration required):
  - `trips` — one row per fishing trip (trip_number, year, status, fishery_target, open/close dates, ports, crew attribution).
  - `trip_daily_logs` — one row per trip per day (position, fuel burned, production).
  - `trip_crew_assignments` — one row per crew member per trip segment (board/offboard dates, role).
- `trips.json` — new OneDrive mirror file at `data/trips/trips.json`. Console-write only; written on trip open and trip close. Array of trip summary objects.
- `consoleconfig.json → operational` — `active_trip_number` field added (null when no active trip; populated with YYNN string when a trip is open).
- `consoleconfig.json → connections.data` — `trips_log`, `trips_daily`, and `icms_production` path entries added.
- `tripplanner.js` — new console renderer module for Trip Planner screen under Operations (after Fuel & Oil Transfers).
- IPC handlers added: `db:openTrip`, `db:closeTrip`, `db:getActiveTrip`, `db:getTrips`, `db:getTripDailyLogs`, `db:upsertDailyPosition`, `db:getTripCrew`, `db:updateCrewOffboard`, `db:addCrewMidTrip`, `db:upsertTripFuelBurn`, `db:upsertTripProduction`, `db:getTripFuelAvgByFishery`.
- Trip fuel polling added to `ingest.js` daily cycle — sums `fuelstate.json → burn_log` entries to the Settling Tank within the daily cutoff window and writes to `trip_daily_logs.fuel_burned_usg`.
- ICMS production polling added to `ingest.js` daily cycle — reads `production-{YYYY-MM-DD}.json` from `data/icms/production/`; writes `production_mt` to `trip_daily_logs`. File format is a stub pending ICMS integration confirmation (see §23).
- `operations/trip_planner` resource key added to `DEPT_RESOURCES` under new 'Operations' group in `users.js`.
- Spacing variables `--sp-1` through `--sp-6` and `--accent-2` added to `base.css :root`. Shared utility classes `btn-danger`, `btn-link`, `section-card`, `data-table`, `form-grid`, `form-row`, `form-label`, `form-hint`, `badge-ok`, `badge-neutral`, and Trip Planner chart classes added to `components.css`.

### Pending

- `console.lock` heartbeat implementation (Phase 5).
- Console sidebar: dynamic nav rendering from `window.idmsCurrentUser.resources` (Phase 5 — sidebar group items are currently static HTML; collapsible group toggle is complete).
- PWA schema version check against `SCHEMA_VERSION` constant to be verified after user config migration.
- Storage provider abstraction (future phase — see §8).
- Security phase: password hashing (currently plaintext).
- ICMS production file format (§23) — stub only; must be confirmed against actual ICMS export before polling logic can be fully validated.

---

## 17. Azure App Registration

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

## 18. Console Application

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

CREATE TABLE assets (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  serial_no     TEXT,
  maker         TEXT,
  makers_type   TEXT,
  parent_code   TEXT,
  install_date  TEXT,
  notes         TEXT,
  department    TEXT,
  ingested_at   TEXT NOT NULL
);

CREATE TABLE equipment_assignments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  dept_key      TEXT NOT NULL,
  range_from    TEXT NOT NULL,
  range_to      TEXT NOT NULL,
  is_ignore     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rounds_config_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  config_version  INTEGER NOT NULL,
  captured_at     TEXT NOT NULL,
  config_json     TEXT NOT NULL
);

CREATE TABLE rounds_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  round_number    INTEGER NOT NULL,
  scheduled_time  TEXT NOT NULL,
  submitted_at    TEXT NOT NULL,
  submitted_by    TEXT NOT NULL,
  section_id      TEXT NOT NULL,
  item_id         TEXT NOT NULL,
  value_numeric   REAL,
  value_bool      INTEGER,
  value_text      TEXT,
  item_type       TEXT NOT NULL,
  completed_by    TEXT,
  ingested_at     TEXT NOT NULL,
  UNIQUE(date, round_number, section_id, item_id)
);
```

`user_id` columns in `log_files` and `events` were added via `ALTER TABLE` migration in Phase 4 and are nullable to support pre-UUID log files. The `assets` and `equipment_assignments` tables were added in Phase 5 via `CREATE TABLE IF NOT EXISTS` on startup. The `rounds_config_snapshots` and `rounds_entries` tables were added in Phase 5 (continued) via `CREATE TABLE IF NOT EXISTS` on startup.

**`assets` column notes:**

| Column | Notes |
|---|---|
| `code` | Primary key. The `Code` field from `assets.csv`. |
| `name` | Human-readable asset name. |
| `department` | Computed at ingest. One of: a dept key (`engine`, `factory`, `deck`), a comma-separated list for multi-matches, `ignore`, or `NULL` (unassigned). |
| `ingested_at` | ISO 8601 UTC timestamp of last ingest. |

**`rounds_entries` column notes:**

| Column | Notes |
|---|---|
| `value_numeric` / `value_bool` / `value_text` | Mutually exclusive — exactly one is non-null per row, determined by `item_type`. |
| `completed_by` | Username of the user who filled in this section's entries. Populated at ingest from the `section_completions` block in the log file. `NULL` for log files written before this field existed. |
| `ingested_at` | ISO 8601 UTC timestamp of last ingest. |

**`equipment_assignments` notes:** Denormalised snapshot of current `equipmentconfig.json` ranges. Fully rebuilt on every ingest. Used for fast range queries during department computation and by `db:getAssetRangeCounts`.

**`rounds_config_snapshots` notes:** Stores a full copy of `roundsconfig.json` each time a rounds log file is ingested whose `config_version` differs from the most recently stored snapshot. Allows historical rounds data to be displayed with correct item labels even if the config has since changed.

### Console renderer modules

| File               | Screen / Role                                     | Status      |
|--------------------|---------------------------------------------------|-------------|
| `app.js`           | Navigation, collapsible sidebar groups            | ✅ Complete  |
| `auth.js`          | Sign-in                                           | ✅ Complete  |
| `graph.js`         | OneDrive API                                      | ✅ Complete  |
| `ingest.js`        | Polling engine                                    | ✅ Complete  |
| `overview.js`      | Overview                                          | ✅ Complete  |
| `eventlogs.js`     | Event logs                                        | ✅ Complete  |
| `reports.js`       | Reports                                           | ✅ Complete  |
| `users.js`         | Users                                             | ✅ Complete  |
| `vessel.js`        | Vessel setup (tabbed: Vessel Particulars · Liquid Cargo & Fuel Tanks · Stability) | ✅ Complete  |
| `tank.js`          | Tank hydrostatic tables — embedded in Vessel Setup → Stability tab | ✅ Complete  |
| `equipment.js`     | Equipment setup                                   | ✅ Complete  |
| `rounds.js`        | Rounds setup                                      | ✅ Complete  |
| `fuel.js`          | Fuel & Oil Transfers                              | ✅ Complete  |
| `bunker.js`        | Bunker Pre-Loading                                | ✅ Complete  |
| `stability.js`     | Stability Calculations                            | ✅ Complete  |
| `crew.js`          | Crew List — embedded in Crew Setup → Crew List tab | ✅ Complete  |
| `trainingmatrix.js`| Training Matrix                                   | ✅ Complete  |
| `crewsetup.js`     | Crew setup (tabbed: Departments & Roles · Certificate Types · Requirements Matrix · Crew List) | ✅ Complete  |
| `settings.js`      | Settings                                          | ✅ Complete  |
| `tripplanner.js`   | Trip Planner (tabbed: Overview · Fuel Management · Rotation Planner) | ✅ Complete  |

### Phase 5 (partial) — Equipment setup complete

Asset register ingestion, department range assignment, and Equipment Setup screen are operational. The following Phase 5 items remain pending:

- `console.lock` heartbeat (write/read on startup, 60s interval, clean delete on shutdown)
- Live timers screen (active event monitoring across all users)
- Fuel & transfers module (reads tank definitions from `vesselconfig.json` by `tank_id`)
- Navigation calculations
- Stability module (reads tank SG and capacity from `vesselconfig.json`)
- Analytics screen
- Storage provider abstraction (`storage.js` interface layer — see §8 for design notes)

---

## 19. tankconfig.json

**Location:** `Documents/IDMS/config/tankconfig.json`
**Edited by:** Admin (via console Administration → Vessel Setup → Stability tab)
**Read by:** Console (Vessel Setup → Stability tab; Vessel Setup → Liquid Cargo & Fuel Tanks tab for tank linkage)

Defines the vessel's hydrostatic tank tables. Each entry represents one tank and contains an ordered list of data rows at discrete fill percentages. This is a vessel-level config — not per-department. It is never written to by operational processes; the field PWA does not read this file.

### Full example

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",

  "tanks": [
    {
      "tank_id": "TK01C",
      "order": 1,
      "rows": [
        { "fill_pct": 0,   "net_vol_m3": 0.0,  "weight_t": 0.0,  "lcg_m": 49.41, "lmom_tm": 0.0,    "vcg_m": 0.46, "vmom_tm": 0.0   },
        { "fill_pct": 5,   "net_vol_m3": 4.2,  "weight_t": 4.2,  "lcg_m": 50.79, "lmom_tm": 210.84, "vcg_m": 0.89, "vmom_tm": 3.69  },
        { "fill_pct": 100, "net_vol_m3": 83.0, "weight_t": 83.0, "lcg_m": 50.98, "lmom_tm": 4232.81,"vcg_m": 4.27, "vmom_tm": 354.53 }
      ]
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-04-23", "note": "Initial tank hydrostatic table configuration." }
  ]
}
```

### Top-level fields

| Field            | Type     | Required | Notes                                                               |
|------------------|----------|----------|---------------------------------------------------------------------|
| `schema_version` | integer  | yes      | Increment when structure changes.                                   |
| `vessel`         | string   | yes      | Vessel name. Copied from sidebar on scaffold.                       |
| `tanks`          | object[] | yes      | Ordered array of tank objects.                                      |
| `changelog`      | object[] | yes      | Version history. Each entry has `version`, `date`, `note`.         |

### Tank object fields

| Field     | Type     | Required | Notes                                                                                  |
|-----------|----------|----------|----------------------------------------------------------------------------------------|
| `tank_id` | string   | yes      | Tank identifier (e.g. `"TK01C"`). Editable via the Tank Setup screen. Must be unique. |
| `order`   | integer  | yes      | Display order. 1-indexed. Maintained automatically by the console on reorder.          |
| `rows`    | object[] | yes      | Ordered array of hydrostatic data row objects. May be empty.                           |

### Row object fields

| Field        | Type    | Required | Notes                                              |
|--------------|---------|----------|----------------------------------------------------|
| `fill_pct`   | number  | yes      | Fill percentage. Typically 0–100 in 5% increments. |
| `net_vol_m3` | number  | yes      | Net volume in cubic metres.                        |
| `weight_t`   | number  | yes      | Weight in metric tonnes.                           |
| `lcg_m`      | number  | yes      | Longitudinal centre of gravity in metres.          |
| `lmom_tm`    | number  | yes      | Longitudinal moment (t·m).                         |
| `vcg_m`      | number  | yes      | Vertical centre of gravity in metres.              |
| `vmom_tm`    | number  | yes      | Vertical moment (t·m).                             |

Any field may be `null` for rows where a value is not recorded.

### Console UI behaviour

The Tank Setup editor (Administration → Vessel Setup → Stability tab) operates as follows:

- Tanks are displayed in `order` sequence, each as a collapsible panel.
- The tank ID is shown as an editable text field in the panel header. Editing it renames the tank; duplicate IDs are rejected.
- Each tank panel contains a data table with fixed columns: **Fill %**, **Net Vol m³**, **Weight t**, **LCG m**, **LMom t·m**, **VCG m**, **VMom t·m**.
- All cells are numeric inputs. Spinner controls are suppressed; values are entered directly.
- **[+ Add row]** appends a blank row to the tank's table.
- Row delete button (×) removes a single row immediately without confirmation.
- **[+ Add tank]** opens an inline form to enter a new tank ID. Press Enter or Add to confirm; Escape or Cancel to dismiss.
- Tanks can be reordered with ▲/▼ buttons on the panel header.
- A tank can be deleted via the × button on its panel header. Confirmation is required if the tank contains rows.
- **[Save to OneDrive]** writes the config. **[Refresh from OneDrive]** re-fetches, discarding unsaved changes (requires confirmation).

### Initial population

The initial `tankconfig.json` for F/V Araho was generated from `Book6.xlsx` (hydrostatic tables export) and contains 44 tanks with 21 rows each (0%–100% in 5% increments). The file is located in the IDMS repository at `tankconfig.json` and must be uploaded to `Documents/IDMS/config/tankconfig.json` on OneDrive before first use.

---

## 20. roundsconfig.json  <!-- previously §19 -->

**Location:** `Documents/IDMS/config/roundsconfig.json`
**Edited by:** Admin (via console Administration → Rounds Setup screen)
**Read by:** Console (Rounds Setup, sheet generation); Field PWA (future — rounds entry module)

This file defines the vessel's complete rounds programme: how many rounds are conducted per day, when each round takes place, and the full ordered list of sections and items that make up the rounds sheet. It is a vessel-level config — not per-department — because a rounds sheet typically spans multiple departments in a single physical document.

### Full example

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",

  "schedule": {
    "rounds_per_day": 4,
    "round_times": [
      { "round": 1, "time": "00:00" },
      { "round": 2, "time": "06:00" },
      { "round": 3, "time": "12:00" },
      { "round": 4, "time": "18:00" }
    ]
  },

  "sections": [
    {
      "section_id": "a1b2c3d4-0001-4000-8000-000000000001",
      "label": "MAIN ENGINE",
      "dept_key": "engine",
      "order": 1,
      "items": [
        {
          "item_id": "b2c3d4e5-0001-4000-8000-000000000001",
          "order": 1,
          "type": "numeric",
          "label": "COOLANT PRESS IN",
          "unit": "PSI",
          "asset_code": "601.001.001.001",
          "active_rounds": [1, 2, 3, 4],
          "notes": ""
        },
        {
          "item_id": "b2c3d4e5-0002-4000-8000-000000000001",
          "order": 2,
          "type": "heading",
          "label": "EXHAUST TEMPS",
          "unit": null,
          "asset_code": null,
          "notes": ""
        },
        {
          "item_id": "b2c3d4e5-0003-4000-8000-000000000001",
          "order": 3,
          "type": "numeric",
          "label": "CYLINDER #1",
          "unit": "°F",
          "asset_code": "601.001.027.001",
          "active_rounds": [1, 2, 3, 4],
          "notes": ""
        },
        {
          "item_id": "b2c3d4e5-0004-4000-8000-000000000001",
          "order": 4,
          "type": "checkbox",
          "label": "OIL LEVEL",
          "unit": null,
          "asset_code": null,
          "active_rounds": [1, 2, 3, 4],
          "notes": ""
        },
        {
          "item_id": "b2c3d4e5-0005-4000-8000-000000000001",
          "order": 5,
          "type": "text",
          "label": "ALARMS / REMARKS",
          "unit": null,
          "asset_code": null,
          "active_rounds": [1, 2, 3, 4],
          "notes": ""
        },
        {
          "item_id": "b2c3d4e5-0006-4000-8000-000000000001",
          "order": 6,
          "type": "custom",
          "label": "ENGINE STATUS",
          "unit": null,
          "asset_code": "601.001.001.001",
          "active_rounds": [1, 2, 3, 4],
          "custom_options": ["Normal", "Standby", "Fault", "Shutdown"],
          "notes": ""
        }
      ]
    },
    {
      "section_id": "a1b2c3d4-0002-4000-8000-000000000001",
      "label": "REFER SYSTEM",
      "dept_key": "factory",
      "order": 2,
      "items": []
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-04-21", "note": "Initial rounds configuration." }
  ]
}
```

---

### schedule object fields

| Field            | Type     | Required | Notes                                                                                     |
|------------------|----------|----------|-------------------------------------------------------------------------------------------|
| `rounds_per_day` | integer  | yes      | Number of rounds conducted per 24-hour period. Range: 1–24.                              |
| `round_times`    | object[] | yes      | Array of round time objects. Length must equal `rounds_per_day`.                          |

### round_time object fields

| Field   | Type    | Required | Notes                                                                        |
|---------|---------|----------|------------------------------------------------------------------------------|
| `round` | integer | yes      | Round number. Sequential, 1-indexed. Matches the display label ("Round 1"). |
| `time`  | string  | yes      | Nominal start time in `"HH:MM"` 24-hour format. Used as the column header on the generated sheet. |

The `round_times` array must be sorted ascending by `time`. The UI enforces this on save.

---

### section object fields

| Field        | Type     | Required | Notes                                                                                             |
|--------------|----------|----------|---------------------------------------------------------------------------------------------------|
| `section_id` | string   | yes      | UUID v4. Generated on creation. Never changes. Stable foreign key for log files.                 |
| `label`      | string   | yes      | Section heading as it appears on the sheet. Uppercase convention. E.g. `"MAIN ENGINE"`.          |
| `dept_key`   | string   | no       | One of `"engine"`, `"factory"`, `"deck"`, or `null`. Used for reporting and filtering only. Does not restrict which users can complete the section. |
| `order`      | integer  | yes      | Display order on the sheet. 1-indexed, unique across all sections.                               |
| `items`      | object[] | yes      | Ordered array of item objects. May be empty (section with no items is valid but renders as a blank heading). |

---

### item object fields

| Field            | Type              | Required | Notes                                                                                                                     |
|------------------|-------------------|----------|---------------------------------------------------------------------------------------------------------------------------|
| `item_id`        | string            | yes      | UUID v4. Generated on creation. Never changes. Used as the stable column key in log entries.                             |
| `order`          | integer           | yes      | Display order within the section. 1-indexed, unique within the section.                                                  |
| `type`           | string            | yes      | One of `"numeric"`, `"text"`, `"custom"`, `"checkbox"`, `"heading"`. See item type reference below.                     |
| `label`          | string            | yes      | Row label as it appears on the sheet. E.g. `"COOLANT PRESS IN"`.                                                        |
| `unit`           | string            | no       | Unit of measurement. Must be one of the valid unit values listed below, or `null`. Only applies to `"numeric"` items. Set `null` for all other types. |
| `asset_code`     | string            | no       | Equipment asset code from `assets.csv`. Alphanumeric with periods, e.g. `"601.001.001.001"`. Set `null` if not applicable. Validated against the SQLite `assets` table by the console UI on input, but **not enforced at schema level** — an unrecognised code is stored as-is and flagged in the UI. |
| `active_rounds`  | integer[]         | no       | Array of round numbers (1-indexed) for which this item is active. Defaults to all rounds when not present. Omitted for `"heading"` type items. When `rounds_per_day` changes, the console adds new rounds as active and prunes removed rounds from all items. |
| `custom_options` | string[]          | no       | Required when `type` is `"custom"`. Ordered list of selectable options presented as a dropdown at data entry time. E.g. `["Normal", "Standby", "Fault", "Shutdown"]`. Must be `null` or omitted for all other types. |
| `notes`          | string            | yes      | Free text. Internal operator note visible during config editing. Does not appear on the printed sheet. May be empty string. |

---

### Item type reference

| Type       | Data cell content                       | Has `unit` | Has `custom_options` | Has `active_rounds` | Appears in log data |
|------------|-----------------------------------------|------------|----------------------|---------------------|---------------------|
| `numeric`  | Number input                            | Yes        | No                   | Yes                 | Yes — numeric value or `null` if not recorded  |
| `text`     | Free-text input (unvalidated)           | No         | No                   | Yes                 | Yes — string value or `null` if not recorded   |
| `custom`   | Dropdown from `custom_options` list     | No         | Yes                  | Yes                 | Yes — string value or `null` if not recorded   |
| `checkbox` | Checked / unchecked                     | No         | No                   | Yes                 | Yes — boolean or `null` if not recorded        |
| `heading`  | Display separator only                  | No         | No                   | No                  | No — omitted from log entirely                 |

`heading` items have no data column and no `active_rounds` field. They are purely a visual element on the generated sheet. Their `unit`, `asset_code`, and `custom_options` fields must be `null`.

`text` items accept any free-form string with no validation. `custom` items constrain entry to the values listed in `custom_options` — the field PWA presents these as a dropdown. Both types store their log value as a string in the `value_text` column of `rounds_entries`.

---

### Valid unit values

Units are grouped by physical category below. The console Rounds Setup screen presents them in this order in the dropdown. No other values are accepted for `"numeric"` items.

| Group | Value   | Description                              |
|-------|---------|------------------------------------------|
| Pressure | `PSI`  | Pounds per square inch                |
| Pressure | `kPa`  | Kilopascals                           |
| Pressure | `inHg` | Inches of mercury (vacuum / pressure) |
| Pressure | `inH2O`| Inches of water column                |
| Pressure | `bar`  | Bar                                   |
| Temperature | `°F` | Degrees Fahrenheit                  |
| Temperature | `°C` | Degrees Celsius                     |
| Concentration | `%`  | Percentage                        |
| Concentration | `ppm`| Parts per million                 |
| Electrical | `V`   | Volts                              |
| Electrical | `mV`  | Millivolts                         |
| Electrical | `A`   | Amps                               |
| Electrical | `mA`  | Milliamps                          |
| Electrical | `kW`  | Kilowatts                          |
| Electrical | `KVA` | Kilovolt-amperes (apparent power)  |
| Electrical | `KVAR`| Kilovolt-amperes reactive          |
| Electrical | `HP`  | Horsepower                         |
| Mechanical | `RPM` | Revolutions per minute             |
| Mechanical | `Hz`  | Hertz (frequency)                  |
| Volume  | `USG`  | US gallons                          |
| Volume  | `L`    | Litres                              |
| Volume  | `m³`   | Cubic metres                        |
| Navigation | `°`  | Degrees (compass heading / angular) |
| Navigation | `kts`| Knots                               |
| Navigation | `nm` | Nautical miles                      |
| Unitless | `—`   | Dimensionless / no unit             |

---

### Console UI behaviour

The Rounds Setup screen (Administration → Rounds Setup) operates as follows:

**General options (top of screen)**

- `rounds_per_day` is an integer input (spinner or direct entry). Minimum 1, maximum 24.
- Changing this value dynamically adds or removes `round_times` rows below it, and updates `active_rounds` on all existing items — new rounds are appended as active, removed rounds are pruned.
- Each `round_times` row has two dropdowns: hours (00–23) and minutes (00, 15, 30, 45).
- Rows are numbered automatically ("Round 1", "Round 2", etc.).

**Sections**

- Sections are displayed in `order` sequence.
- An **[ADD SECTION]** button reveals an inline name input at the bottom. Press Enter or click Add to confirm; Escape or Cancel to dismiss.
- Section headers have up/down reorder buttons (updates `order` values).
- A section can be deleted if it contains no items. If it contains items, deletion requires confirmation and removes all items.

**Items within a section**

- An **[ADD ITEM]** button appends a new `numeric` item. The `asset_code` field inherits the value from the nearest item above it that has a code, reducing repetitive entry for related items on the same equipment.
- An **[ADD HEADING]** button appends a new `heading` item.
- Each item row exposes:
  - `label` — text input
  - `type` — dropdown: `numeric`, `text`, `custom`, `checkbox`, `heading`
  - `unit` — dropdown (valid unit values above); visible only when type is `numeric`
  - `custom_options` — comma-separated text input; visible only when type is `custom`. Values are split on commas, trimmed, and stored as a string array. These become the selectable options in the field PWA dropdown at data entry time. Cleared automatically when type changes away from `custom`.
  - `asset_code` — text input; hidden for `heading` type. Validated on blur against the SQLite `assets` table. Displays the asset name on match; shows a warning on no-match (does not block save).
  - `active_rounds` — one checkbox per round (labelled by round number). All checked by default. Hidden for `heading` type. Allows per-item scheduling — e.g. an item that only applies to daytime rounds.
  - Delete button — removes the item. No confirmation required.
- Items can be reordered within a section using up/down buttons (updates `order` values).
- Items **cannot** be moved between sections. Move via delete and re-add.

**Save behaviour**

- Saving writes `roundsconfig.json` to OneDrive via Graph API.
- A **[Refresh from OneDrive]** button re-fetches the live file and discards unsaved local changes (requires confirmation if there are unsaved changes).
- Unsaved changes are indicated by a status message in the toolbar.

---

## 20. Rounds Log File (per-date)

**Location:** `Documents/IDMS/data/rounds/logs/rounds-{YYYY-MM-DD}.json`
**Written by:** Console (sheet generation + submission) or Field PWA (future — when digital rounds entry is implemented)
**Read by:** Console (ingestion into SQLite)

One file per calendar date. A file may be partially populated — entries are present only for rounds that have been submitted. Incomplete rounds (started but not submitted) are not written.

### Full example

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "date": "2026-04-21",
  "generated": "2026-04-21T06:05:00.000Z",
  "generated_by": "tploch",
  "config_version": 1,

  "rounds": [
    {
      "round_number": 1,
      "scheduled_time": "00:00",
      "submitted_at": "2026-04-21T00:12:00.000Z",
      "submitted_by": "tploch",
      "section_completions": [
        { "section_id": "a1b2c3d4-0001-4000-8000-000000000001", "completed_by": "tploch" },
        { "section_id": "a1b2c3d4-0002-4000-8000-000000000001", "completed_by": "spotchik" }
      ],
      "entries": [
        {
          "section_id": "a1b2c3d4-0001-4000-8000-000000000001",
          "item_id":    "b2c3d4e5-0001-4000-8000-000000000001",
          "value":      48.0
        },
        {
          "section_id": "a1b2c3d4-0001-4000-8000-000000000001",
          "item_id":    "b2c3d4e5-0004-4000-8000-000000000001",
          "value":      true
        },
        {
          "section_id": "a1b2c3d4-0001-4000-8000-000000000001",
          "item_id":    "b2c3d4e5-0005-4000-8000-000000000001",
          "value":      "HP alarm cleared at 0008, reset normal."
        }
      ]
    }
  ]
}
```

### Top-level log file fields

| Field            | Type     | Notes                                                                                             |
|------------------|----------|---------------------------------------------------------------------------------------------------|
| `schema_version` | integer  | Always `1` for this version.                                                                      |
| `vessel`         | string   | Copied from `roundsconfig.json → vessel` at time of generation.                                  |
| `date`           | string   | `YYYY-MM-DD`. Calendar date this file covers (vessel local date at time of first round entry).   |
| `generated`      | string   | ISO 8601 UTC. Timestamp when the file was first created.                                         |
| `generated_by`   | string   | Username of the user who created the file.                                                        |
| `config_version` | integer  | The `schema_version` value of `roundsconfig.json` at the time of generation. Used by the console to detect config drift when ingesting older log files. |
| `rounds`         | object[] | Array of submitted round objects. Absent rounds are simply not present in this array.            |

### round object fields

| Field                | Type     | Notes                                                                                     |
|----------------------|----------|-------------------------------------------------------------------------------------------|
| `round_number`       | integer  | Which round this is (matches `round_times[].round` in `roundsconfig.json`).              |
| `scheduled_time`     | string   | The nominal `"HH:MM"` time from config, copied at time of submission. Preserved even if config later changes. |
| `submitted_at`       | string   | ISO 8601 UTC. Actual time of submission.                                                  |
| `submitted_by`       | string   | Username of the user who submitted this round (pressed submit).                           |
| `section_completions`| object[] | One entry per section that was filled in. Records which user completed each section's entries. Sections with no recorded entries are omitted. |
| `entries`            | object[] | One entry per non-`heading` item that was recorded. Unrecorded items are omitted (not stored as `null` entries). Flat array — not grouped by section. |

### section_completion object fields

| Field          | Type   | Notes                                                                                    |
|----------------|--------|------------------------------------------------------------------------------------------|
| `section_id`   | string | UUID matching `sections[].section_id` in `roundsconfig.json`.                           |
| `completed_by` | string | Username of the user who filled in this section's entries. May differ from `submitted_by` when multiple crew members contribute to a single round. |

**Design note:** `section_completions` is stored as a parallel array alongside the flat `entries` array, rather than grouping entries by section. This preserves the intentionally flat entries structure while allowing per-section user attribution. At ingest, the console joins each entry to its section's `completed_by` value and stores it in the `rounds_entries.completed_by` column.

### entry object fields

| Field        | Type                       | Notes                                                                                              |
|--------------|----------------------------|----------------------------------------------------------------------------------------------------|
| `section_id` | string                     | UUID matching `sections[].section_id` in `roundsconfig.json`.                                     |
| `item_id`    | string                     | UUID matching `sections[].items[].item_id` in `roundsconfig.json`.                                |
| `value`      | number\|boolean\|string    | Type matches the item's `type`: `number` for `numeric`, `boolean` for `checkbox`, `string` for `text` and `custom`. For `custom` items the string must be one of the values in `custom_options`, enforced by the field PWA at entry time. Never `null` — if a value was not recorded, the entry is omitted entirely from the array. |

**Note on `active_rounds`:** Items with `active_rounds` that exclude a given round number are not expected to appear in that round's entries. The field PWA enforces this at entry time. The console ingestion layer stores whatever entries are present without validating against `active_rounds`.

---

## 22. fuelstate.json

**Location:** `Documents/IDMS/data/fuel/fuelstate.json`
**Edited by:** Console (via Operations → Fuel & Oil Transfers screen)
**Read by:** Console only

Stores the current volume for every tracked tank (fuel, lube oil, waste oil) and a running burn/transfer log. This is an **operational state file** — not a config. It is updated every time the operator applies a transfer or edits a tank volume and saves. The field PWA does not read this file.

### Full example

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "last_updated": "2026-04-23T14:00:00.000Z",
  "updated_by": "tploch",

  "burn_plan": {
    "tank_a_id": "a1b2c3d4-0007-4000-8000-000000000007",
    "tank_b_id": "a1b2c3d4-0008-4000-8000-000000000008"
  },

  "tanks": [
    { "tank_id": "a1b2c3d4-0001-4000-8000-000000000001", "volume": 0 },
    { "tank_id": "a1b2c3d4-0003-4000-8000-000000000003", "volume": 8325 }
  ],

  "burn_log": [
    {
      "id": 1713620000000,
      "timestamp": "2026-04-13T22:49:00.000Z",
      "from_tank_id": "a1b2c3d4-0008-4000-8000-000000000008",
      "to_tank_id":   "a1b2c3d4-0013-4000-8000-000000000013",
      "quantity": 2800
    }
  ]
}
```

### Top-level fields

| Field            | Type     | Required | Notes                                                                  |
|------------------|----------|----------|------------------------------------------------------------------------|
| `schema_version` | integer  | yes      | Always `1` for this version.                                           |
| `vessel`         | string   | yes      | Copied from `vesselconfig.json → vessel` at time of first save.        |
| `last_updated`   | string   | yes      | ISO 8601 UTC. Timestamp of the most recent save. `null` if never saved.|
| `updated_by`     | string   | yes      | Username of the user who last saved. `null` if not yet saved.          |
| `burn_plan`      | object   | yes      | Active draw-tank configuration. See burn plan object fields below.     |
| `tanks`          | object[] | yes      | One entry per tracked tank. See tank state object fields below.        |
| `burn_log`       | object[] | yes      | Ordered array of transfer/burn log entries. Append-only.               |

### Burn plan object fields

| Field        | Type   | Required | Notes                                                                                                     |
|--------------|--------|----------|-----------------------------------------------------------------------------------------------------------|
| `tank_a_id`  | string | yes      | UUID of the primary active draw tank. `null` if not set. Must match a `"fuel"` tank in `vesselconfig.json`. |
| `tank_b_id`  | string | yes      | UUID of the secondary active draw tank. `null` if not set. May be the same as `tank_a_id`.               |

The burn plan is editable only by users whose `role` is `"Chief Engineer"` or whose `permission_tier` is `"admin"`. All other users see it as read-only text showing the selected tank abbreviations.

### Tank state object fields

| Field      | Type   | Required | Notes                                                                            |
|------------|--------|----------|----------------------------------------------------------------------------------|
| `tank_id`  | string | yes      | UUID matching `tanks[].tank_id` in `vesselconfig.json`.                          |
| `volume`   | number | yes      | Current volume in the tank's native units (USG for all Araho tanks). `0` default.|

Only tanks with `category` of `"fuel"`, `"lube_oil"`, or `"waste_oil"` are tracked. Water and sewage tanks are excluded.

**Note on negative volumes:** Fuel tank volumes may be negative to account for flow-meter calibration errors. Waste oil and lube oil volumes are clamped to ≥ 0.

### Burn log entry fields

| Field           | Type    | Required | Notes                                                                                 |
|-----------------|---------|----------|---------------------------------------------------------------------------------------|
| `id`            | integer | yes      | Unix timestamp ms at creation. Unique within the file.                               |
| `timestamp`     | string  | yes      | ISO 8601 UTC. Time the transfer was applied.                                          |
| `from_tank_id`  | string  | yes      | Source tank UUID. Must match a `"fuel"` category tank in `vesselconfig.json`.         |
| `to_tank_id`    | string  | yes      | Destination tank UUID.                                                                |
| `quantity`      | number  | yes      | Volume transferred, in USG.                                                           |

### Settling tank (fuel consumption) behaviour

The **Fuel Settling Tank 8** (abbreviation `Settling Tk.`) is the engine's direct feed tank. In the Burn Plan, transfers **to** the Settling Tank represent fuel consumed by the main engine — the quantity is deducted from the source tank but **not added** to the Settling Tank's tracked volume. This simulates fuel burn without accumulating phantom volume in the settling tank. The Settling Tank's displayed volume in the inventory is whatever was last manually entered there.

Transfers **between** any two non-settling tanks move volume normally (deduct from source, add to destination).

### Console UI behaviour

The Fuel & Oil Transfers screen (Operations → Fuel & Oil Transfers) presents two panels side-by-side:

**Left — Burn Plan + Fuel Transfers**

*Burn Plan* (top panel):
- Displays "From [tank A] and [tank B]" — the tanks currently being drawn from by the vessel.
- **Chief Engineer / admin**: rendered as two dropdowns populated with all `"fuel"` category tank abbreviations from `vesselconfig.json`. Changes are saved with the rest of the state.
- **All other roles**: rendered as read-only text showing the selected tank abbreviations.

*Fuel Transfers* (log panel below Burn Plan):
- Displays the `burn_log` in chronological order (oldest at top, newest at bottom, scrollable).
- Each row shows: timestamp, FROM tank abbreviation, TO tank abbreviation, quantity.
- A new-entry row at the bottom has: auto-filled current timestamp (read-only), FROM dropdown (all fuel tanks), TO dropdown (all fuel tanks, default `Settling Tk.`), quantity input.
- **[Apply transfer]** validates the entry, updates tank volumes in state, appends to `burn_log`, and re-renders.
- If the transfer quantity exceeds the source tank's current volume, the user is warned and must confirm before proceeding.

**Right — Tank Inventory**
- Three sub-sections: **Fuel Onboard**, **Waste Oils Onboard**, **Lube Oils Onboard**.
- **Fuel Onboard** renders in two side-by-side columns when the viewport is wide enough (≥ ~700 px available for the inventory panel), collapsing to a single column when constrained. Tanks are split evenly between the two columns.
- Each tank row shows: full tank name, `QTY (USG)` volume input (editable; fixed column width accommodates values up to 100,000), fill-level bar with percentage.
- Fuel tank volume inputs allow **negative values** to account for flow-meter calibration errors. Waste and lube oil inputs are clamped to ≥ 0.
- Editing a volume input updates the in-memory state and redraws the fill bar immediately.
- Fill bar colour: green above 25% for fuel/lube (red below 10%, orange 10–25%); inverted for waste tanks (green below 50%, orange 50–80%, red above 80%).
- **[Save to OneDrive]** (topbar) writes the updated `fuelstate.json`.

### Path registration

Add the following entry to `consoleconfig.json → connections.data`:

```json
"fuel_state": "data/fuel/fuelstate.json"
```

The `data/fuel/` folder does not exist by default and must be created on OneDrive before the first save (the Graph API `PUT` call creates it automatically when writing to a new path).

### Migration note

This section was added in the Phase 5 (Liquid Cargo & Fuel) implementation. No migration of existing files is required — the console scaffolds a default state (all volumes at zero) if `fuelstate.json` is absent on first load.

---

## 22. Stability Calculations  *(added v1.8)*

### Overview

The Stability Calculations page (Logs → Stability Calculations) provides a real-time loading condition summary and stability assessment for the vessel. It reads live tank inventory from `fuelstate.json`, hydrostatic tables from `tankconfig.json`, and tank definitions from `vesselconfig.json`. Variable weights (crew, provisions, catch, etc.) and lightship data are manually entered by the operator and persisted to `stability.json` on OneDrive.

### stability.json

**Location on OneDrive:** `data/stability/stability.json`  
**Loaded by:** `graph.js → loadStabilityDoc()` / `saveStabilityDoc()`

```json
{
  "schema_version": 1,
  "date": "2026-04-24",
  "prepared_by": "J. Smith",
  "lightship": {
    "weight_t": 1423.5,
    "lcg_m": 25.81,
    "vcg_m": 5.94
  },
  "var_weights": [
    { "id": "crew",        "label": "Crew & Effects",          "weight_t": 2.5,  "lcg_m": 26.1, "vcg_m": 6.8 },
    { "id": "provisions",  "label": "Provisions & Stores",     "weight_t": 3.2,  "lcg_m": 25.4, "vcg_m": 5.2 },
    { "id": "spare_parts", "label": "Spare Parts & Equipment", "weight_t": 1.0,  "lcg_m": 24.8, "vcg_m": 4.5 },
    { "id": "catch",       "label": "Catch",                   "weight_t": 0.0,  "lcg_m": 0.0,  "vcg_m": 0.0 },
    { "id": "cargo",       "label": "Cargo / Production",      "weight_t": 0.0,  "lcg_m": 0.0,  "vcg_m": 0.0 },
    { "id": "ice",         "label": "Ice Accretion on Vessel", "weight_t": 0.0,  "lcg_m": 0.0,  "vcg_m": 0.0 }
  ],
  "tank_overrides": {
    "a1b2c3d4-0001-4000-8000-000000000001": 72.3
  }
}
```

#### Field descriptions

| Field | Type | Notes |
|---|---|---|
| `schema_version` | integer | Always `1`. |
| `date` | string | ISO date of the calculation (YYYY-MM-DD). |
| `prepared_by` | string | Name or watch designation of the person preparing the form. |
| `lightship.weight_t` | number | Lightship displacement in metric tonnes. |
| `lightship.lcg_m` | number | Lightship longitudinal centre of gravity (m from AP or reference). |
| `lightship.vcg_m` | number | Lightship vertical centre of gravity (m above keel). |
| `var_weights[].id` | string | Stable identifier for this row (`crew`, `provisions`, etc.). |
| `var_weights[].label` | string | Editable description shown on the form. |
| `var_weights[].weight_t` | number\|null | Weight of this item in metric tonnes. |
| `var_weights[].lcg_m` | number\|null | LCG of this item (m). |
| `var_weights[].vcg_m` | number\|null | VCG of this item (m). |
| `tank_overrides` | object | Map of `tank_id → fill_pct`. When present, overrides the fill % derived from `fuelstate.json` for that tank. Cleared when the operator clicks "Refresh from Fuel State". |

### Calculation method

All moments are computed per item; the page does **not** store pre-computed moments — they are always derived at render time.

| Symbol | Formula |
|---|---|
| **A** | Σ weight_t (all tanks) |
| **B** | Σ lmom_tm (all tanks, from `tankconfig.json`) |
| **C** | Σ vmom_tm (all tanks, from `tankconfig.json`) |
| **D** | Σ fsm_tm (all partially-filled tanks, from `tankconfig.json`) |
| **E / F / G** | Lightship weight / L.Mom / V.Mom |
| **H / I / J** | Variable weights total / L.Mom / V.Mom (weight × LCG, weight × VCG) |
| **K** | A + E + H (Total Displacement) |
| **L** | B + F + I (Total L.Mom) |
| **M** | C + G + J (Total V.Mom) |
| **N** | L ÷ K (LCG) |
| **O** | (M + D) ÷ K (VCG corrected for free surface) |

Tank hydrostatic values are interpolated from `tankconfig.json` at the current fill %. If a tank has no `tank_setup_id` link to `tankconfig.json`, weight is estimated from volume × specific gravity; LCG, VCG, and FSM are shown as zero (marked with `◦` in the UI).

### Chart assets (local, bundled)

The Stability Assessment section displays two background chart images from the vessel's stability booklet with a red diamond cursor (◆) positioned at the computed coordinates.

| Asset | Local path | Source | Dimensions |
|---|---|---|---|
| Trim Determination | `src/renderer/assets/stab-trim-chart.png` | Stability booklet p.3, image 1 | 616 × 659 px |
| Max VCG | `src/renderer/assets/stab-vcg-chart.png` | Stability booklet p.3, image 2 | 989 × 875 px |

Chart axes and plot-area calibration (percentage offsets from image edges used to map cartesian coordinates to CSS `left`/`top` position) are defined as constants at the top of `stability.js`:

```javascript
const TRIM_CHART = {
  xMin: 23.5, xMax: 28.5,   // LCG axis (m)
  yMin: 2100, yMax: 3700,   // Displacement axis (MT)
  left: 11.5, right: 3.5, top: 9.0, bottom: 13.5
};
const VCG_CHART = {
  xMin: 2100, xMax: 3700,   // Displacement axis (MT)
  yMin: 6.30, yMax: 7.10,   // VCG corrected axis
  left: 11.5, right: 3.5, top: 8.5, bottom: 12.5
};
```

Tune `left / right / top / bottom` values if the diamond cursor does not align with the chart grid after the images are replaced.

These images are **not** synced to OneDrive. To update them, replace the PNG files on disk and restart the console. File locations are documented in Settings → Advanced → Connections & Paths → Local application assets.

### IPC handlers

| Channel | Direction | Description |
|---|---|---|
| `stability:exportPDF` | renderer → main | Shows save dialog; renders HTML to a landscape Letter PDF. |
| `stability:print` | renderer → main | Opens system print dialog for the stability report. |

### Path registration

Add the following entry to `consoleconfig.json → connections.data`:

```json
"stability_doc": "data/stability/stability.json"
```

The `data/stability/` folder is created automatically by the Graph API on first save. The console falls back to a blank default document if the file is absent.

### Migration note

Added in IDMS Console v1.8. No migration required for existing installations — the console creates a fresh default document on first navigation to the Stability Calculations page.

---

## 23. Trip Planner

**Added in:** IDMS Console v1.9 (Phase 6)
**Screen:** Operations → Trip Planner (after Fuel & Oil Transfers)
**Tabs:** Overview · Fuel Management · Rotation Planner

The Trip Planner is the operational lifecycle manager for fishing trips. It is the single source of truth for trip metadata, daily logs, and crew assignments. Downstream modules (Scheduling, Fuel Log) read from this data.

---

### SQLite Tables

All three tables are created via `CREATE TABLE IF NOT EXISTS` in the console startup sequence. No manual migration required.

#### `trips`

One row per fishing trip.

| Column           | Type    | Constraints          | Notes |
|------------------|---------|----------------------|-------|
| `id`             | INTEGER | PK AUTOINCREMENT     | |
| `trip_number`    | TEXT    | NOT NULL UNIQUE      | YYNN format, e.g. `"2601"`. Zero-padded 4-digit string. |
| `year`           | INTEGER | NOT NULL             | 4-digit year, e.g. `2026`. |
| `status`         | TEXT    | NOT NULL DEFAULT 'active' | `'active'` or `'closed'`. |
| `fishery_target` | TEXT    | nullable             | `'YF'`, `'Mack'`, `'Gulf'`, `'POP'`, or null. |
| `open_date`      | TEXT    | NOT NULL             | ISO date `YYYY-MM-DD` (vessel local). |
| `close_date`     | TEXT    | nullable             | ISO date `YYYY-MM-DD`; null until closed. |
| `offload_port`   | TEXT    | nullable             | Free text. |
| `opened_by`      | TEXT    | NOT NULL             | Username from userconfig.json. |
| `closed_by`      | TEXT    | nullable             | Username; null until closed. |
| `notes`          | TEXT    | nullable             | Free text. |

#### `trip_daily_logs`

One row per trip per operational day.

| Column                | Type    | Constraints               | Notes |
|-----------------------|---------|---------------------------|-------|
| `id`                  | INTEGER | PK AUTOINCREMENT          | |
| `trip_id`             | INTEGER | NOT NULL REFERENCES trips | |
| `log_date`            | TEXT    | NOT NULL                  | ISO date `YYYY-MM-DD` (vessel local). |
| `lat`                 | REAL    | nullable                  | Decimal degrees. |
| `lon`                 | REAL    | nullable                  | Decimal degrees. |
| `position_entered_by` | TEXT    | nullable                  | Username. |
| `fuel_burned_usg`     | REAL    | nullable                  | Sum of settling tank transfers for this operational day (USG). |
| `production_mt`       | REAL    | nullable                  | Metric tonnes from ICMS integration. |
| `ingested_at`         | TEXT    | NOT NULL                  | ISO 8601 UTC. |
| *(unique)*            |         | UNIQUE(trip_id, log_date) | |

#### `trip_crew_assignments`

One row per crew member per trip segment (re-inserted on mid-trip joins).

| Column         | Type    | Constraints               | Notes |
|----------------|---------|---------------------------|-------|
| `id`           | INTEGER | PK AUTOINCREMENT          | |
| `trip_id`      | INTEGER | NOT NULL REFERENCES trips | |
| `user_id`      | TEXT    | NOT NULL                  | UUID from userconfig.json. |
| `username`     | TEXT    | NOT NULL                  | |
| `display_name` | TEXT    | NOT NULL                  | |
| `role`         | TEXT    | NOT NULL                  | Role at time of assignment (may differ from current role). |
| `board_date`   | TEXT    | NOT NULL                  | ISO date `YYYY-MM-DD`. Defaults to trip open_date on initial assignment. |
| `offboard_date`| TEXT    | nullable                  | ISO date `YYYY-MM-DD`; null if still aboard. |

---

### trips.json (OneDrive Mirror)

**Location:** `data/trips/trips.json`
**Written by:** Console only — on trip open and trip close
**Read by:** Console (for PDF reports and cross-module reads that cannot query SQLite directly)

This is a lightweight read-only mirror of the `trips` table. The console writes it; nothing else writes it.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "last_updated": "2026-01-28T14:22:00.000Z",
  "trips": [
    {
      "trip_number":    "2601",
      "year":           2026,
      "status":         "closed",
      "fishery_target": "YF",
      "open_date":      "2026-01-10",
      "close_date":     "2026-01-28",
      "offload_port":   "Dutch Harbor",
      "opened_by":      "tploch",
      "closed_by":      "tploch"
    }
  ]
}
```

#### trips.json field table

| Field            | Type     | Notes |
|------------------|----------|-------|
| `schema_version` | integer  | `1`. Increment if structure changes. |
| `vessel`         | string   | Vessel name from userconfig.json. |
| `last_updated`   | string   | ISO 8601 UTC timestamp of last write. |
| `trips`          | object[] | Array of trip summary objects, newest first. |

Each trip summary object mirrors the `trips` SQLite row (all columns except `id` and `notes`).

---

### consoleconfig.json additions

See §6 for the full example. Phase 6 adds:

**`operational`:**
```json
"active_trip_number": null
```
Set to the YYNN string on trip open; cleared to `null` on trip close. The `trip_start_date` stub that already existed is populated on trip open (not a new field — use the existing field).

**`connections.data`:**
```json
"trips_log":       "data/trips/trips.json",
"trips_daily":     "data/trips/daily/",
"icms_production": "data/icms/production/"
```

---

### ICMS Production File (TODO — format to be confirmed)

**Location:** `data/icms/production/production-{YYYY-MM-DD}.json`
**Written by:** External ICMS integration (not by the console)
**Read by:** Console ingest cycle (daily, when a trip is active)

> **⚠ TODO:** The exact structure of the ICMS production file must be confirmed against what the ICMS system actually exports before this section can be fully specified. The scaffold below assumes minimum fields and is used by the current polling code.

```json
{
  "date":          "2026-01-15",
  "vessel":        "F/V Araho",
  "production_mt": 42.5
}
```

The console ingest reads `production_mt` from this file and writes it to `trip_daily_logs.production_mt` for the active trip and the matching `log_date`. If the file is absent, `production_mt` remains `null` and a warning is written to the ingest log. All production values are in metric tonnes (MT). No conversion to short tons is performed.

---

### Resource key

| Key                        | Group       | Label          | Access scope |
|----------------------------|-------------|----------------|--------------|
| `operations/trip_planner`  | Operations  | Trip Planner   | Grants view access to all three Trip Planner tabs. Admin permission is additionally required to open/close trips, record departures, and add mid-trip crew. |

---

### Trip lifecycle

| Action                | Permission          | Notes |
|-----------------------|---------------------|-------|
| Open trip             | admin only          | Writes `trips` row + `trip_crew_assignments`; updates `consoleconfig.json`; writes `trips.json`. |
| Enter/edit position   | admin or standard   | Upserts `trip_daily_logs` via `db:upsertDailyPosition`. No OneDrive write. |
| Close trip            | admin only          | Sets `status='closed'`, `close_date`, `closed_by`; updates `consoleconfig.json`; writes `trips.json`. Irreversible. |
| Record departure      | admin only          | Sets `offboard_date` on a `trip_crew_assignments` row. |
| Add mid-trip crew     | admin only          | Inserts new `trip_crew_assignments` row with today as `board_date`. |
| View tabs (all three) | `operations/trip_planner` resource or admin | |

---

### IPC handlers

| Handler                      | Description |
|------------------------------|-------------|
| `db:openTrip`                | Inserts `trips` row + `trip_crew_assignments` rows in a single transaction. Returns `{ ok, trip_id }`. |
| `db:closeTrip`               | Updates `trips` row (`status`, `close_date`, `closed_by`, `offload_port`). Returns `{ ok, trip }`. |
| `db:getActiveTrip`           | Returns the single row with `status='active'`, or `null`. |
| `db:getTrips`                | Returns all trips ordered by `open_date DESC`. |
| `db:getTripDailyLogs`        | Returns all `trip_daily_logs` rows for a given `trip_id`, ordered by `log_date ASC`. |
| `db:upsertDailyPosition`     | Inserts or updates `lat`, `lon`, `position_entered_by` for a given `trip_id` + `log_date`. |
| `db:getTripCrew`             | Returns all `trip_crew_assignments` rows for a given `trip_id`. |
| `db:updateCrewOffboard`      | Sets `offboard_date` for a given assignment `id`. |
| `db:addCrewMidTrip`          | Inserts a new assignment row for an active trip. |
| `db:upsertTripFuelBurn`      | Inserts or updates `fuel_burned_usg` for `trip_id` + `log_date`. Called by ingest cycle. |
| `db:upsertTripProduction`    | Inserts or updates `production_mt` for `trip_id` + `log_date`. Called by ingest cycle. |
| `db:getTripFuelAvgByFishery` | Returns `{ avg_daily_usg, sample_days }` for all closed trips matching a fishery target. Used by Fuel Management tab comparison line. |

---

### Migration note

No migration required. All three tables are created with `CREATE TABLE IF NOT EXISTS` on every console startup. Existing installations will have the tables created automatically on next launch.
