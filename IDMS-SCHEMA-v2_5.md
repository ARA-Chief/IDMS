# IDMS Schema Specification
**Version 2.7 — F/V Araho**  
v2.7 — Tasks & Maintenance module revised (§32). Status lifecycle expanded from 4 states to 7 active states plus 2 terminal states. due_date retired; tasks ordered by priority and created_at. Task event log introduced: append-only thread of transition and comment entries on each task object. Active state file retired; replaced by event log as source of in-flight state truth. task_active_state SQLite table retired; task_events and task_transitions tables added. ISO 14224 failure mode, mechanism, and detection method fields added — editable at any point, required at close. Close task is a distinct admin action (Chief Engineer or admin tier only) that triggers asset history write. Tab rename: Due & Assigned → Active Tasks, All Tasks → Closed Tasks. failure_modes reference table added to SQLite (db:getFailureModes IPC handler). Asset Records module added (§38): data/assets/{codeRange}/{codeRange}-assets.json, one file per code range. Each asset carries item_id, asset_no, asset_name, last_round, event_history[], and oil_history[]. Four new IPC handlers, two new SQLite tables. consoleconfig.json connections.data gains tasks_assets path; schema_version incremented to 9.

v2.6 — Factory Production module §37 revised. `factoryconfig.json` production section restructured: pan specification (`pan_volume_l`, `pan_gross_weight_kg`, `pan_target_overpack_pct`) moved to production top-level (global, replaces per-section `pan_net_weight_kg`); `target_species` field added; line sections consolidated to 7 (removed Check Weigher, Label Applicator, Welding Machine; renamed Pan Ejectors → Pan Breaking, Bag Applicator → Case-Up, added Headers as distinct `header` type). Sub-assets gain arrangement topology fields (`arrangement`, `order`, `sub_order`, `ranking`). Type-specific sub-asset fields added per section type (plate_freezer: ops params; throughput: `pans_per_minute` per sub-asset; header: `belt_speed_ms`, `fish_per_minute` at section level; belt: `belt_speed_ms` per sub-asset; packing: `minutes_per_pan` per sub-asset). Three new IPC handlers: `db:getEquipmentGroups`, `db:getAssetChildren`, `db:searchAssetsByGroup`, `db:getDistinctFisheries`, `db:getProductionAvgByFishery`. Equipment list in `factoryconfig.json` updated (Breaking Station 1/2, Case Up, Conveyor Belts, Packing Stations).

v2.5 (update 2) — Factory Production module built (§37). New `production` section added to `factoryconfig.json` (schema_version 2) with 10 line sections for F/V Araho. Three new SQLite tables (`production_entries`, `capacity_observations`, `production_config_snapshots`), six new IPC handlers, OneDrive file paths `data/factory/production/production-state.json` and `data/factory/production/capacity-{date}.json`, graph.js helpers (`saveDeptConfig`, `loadProductionState`, `saveProductionState`, `loadCapacityLog`, `saveCapacityLog`, `graphMailFetch`), and production polling block in `ingest.js`. `production.js` status updated to Built in module table (§18).

v2.5 — Equipment Setup screen split into two tabs: **Department Assignment** and **Group Assignment** (§10, §18). `equipmentconfig.json` gains an `order` field per department (highest order wins when an asset matches multiple departments, replacing comma-separated multi-assignment). A new `groups` array stores code-range section headers with auto-populated labels from `assets.csv` and resolved department tags; groups are displayed grouped by department with up/down/delete controls. SQLite gains an `equipment_groups` table; `equipment_assignments` gains a `dept_order` column. `equipment.js` updated to 2-tab layout in module table (§18).

v2.4 — Tank Layout tab added to Vessel Setup (§7, §18). `vesselconfig.json` gains a `tank_layout` object storing grid dimensions and a sparse array of hull cells with optional tank assignments. Hull Preview canvas renders fill bars coloured by tank category (fuel=green, lube_oil=amber, waste_oil=brown, sewage=near-black, water=blue), displays volume in USG, word-wraps tank names, and draws all labels in a second pass to prevent cell overlap. `vessel.js` updated to 5 tabs in the module table (§18).

v2.3 — Tasks & Maintenance module built (§32). Added `data/tasks/` folder tree to File Location Map (§1). Added `tasks_definitions`, `tasks_records`, `tasks_active` paths to `consoleconfig.json → connections.data` (§6). §32 fully documented: OneDrive file structures (definition, record, active-state files), task object fields, completed record fields, active state fields, valid category codes, interval values, status lifecycle, SQLite schema (4 tables), IPC handler signatures (9 handlers), and console UI behaviour. `tasks.js` status updated to Built in module table (§18).

v2.2 — Rough Log module built (§31). Added `data/roughlog/` to File Location Map (§1). Added `roughlog` path to `consoleconfig.json → connections.data` (§6). §31 fully documented: OneDrive file structure, entry object fields, defined categories, SQLite schema, IPC handler signatures, filter parameters, and UI behaviour. `roughlog.js` status updated to Built in module table (§18).

v2.1 — Navigation restructure. Sidebar groups renamed and reorganised. Stability Calculations moved to Vessel Setup. Trip Planner dissolved into Records and Dashboard. Rough Log, Tasks & Maintenance, Oil Record Book, Messages, KSA, and Navigation added as stub sections (§30–§36).
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
24. [portsconfig.json](#24-portsconfigjson)
25. [scheduleconfig.json](#25-scheduleconfigjson)
26. [schedule_draft.json](#26-schedule_draftjson)
27. [Schedule Notification System](#27-schedule-notification-system)
28. [Schedule Module — Console UI](#28-schedule-module--console-ui)
29. [crewconfig.json](#29-crewconfigjson)
30. [Dashboard](#30-dashboard)
31. [Rough Log](#31-rough-log)
32. [Tasks & Maintenance](#32-tasks--maintenance)
33. [Oil Record Book](#33-oil-record-book)
34. [Messages](#34-messages)
35. [KSA Profiles](#35-ksa-profiles)
36. [Navigation & Weather](#36-navigation--weather)
37. [Factory Production Module](#37-factory-production-module)
38. [Asset Records](#38-asset-records)

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
│   ├── portsconfig.json            ← Port reference data (name, lat/long, timezone, airport)
│   ├── crewconfig.json             ← Vessel crew registry (personnel, contact info, vessel assignment)
│   ├── scheduleconfig.json         ← Approved crew rotation schedule (current year)
│   ├── schedule_draft.json         ← Working draft schedule (editable, not crew-visible)
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
│   ├── rounds/
│   │   ├── logs/                   ← rounds-{YYYY-MM-DD}.json
│   │   └── reports/                ← rounds-report-{YYYY-MM-DD}.json (future)
│   ├── roughlog/
│   │   └── roughlog-{YYYY}.json    ← Vessel-wide rough log, one file per calendar year
│   ├── tasks/
│   │   ├── definitions/            ← tasks-{codeRange}-{year}.json (task definition files per equip range per year)
│   │   ├── records/
│   │   │   └── {YYYY}/             ← {equipmentCodeTop}-{YYYY}.json (completed task records per equipment top per year)
│   │   └── ~~active/~~             ← RETIRED. Per-user active state files no longer written.
│   ├── assets/
│   │   └── {codeRange}/
│   │       └── {codeRange}-assets.json  ← Asset records with full history (§38)
│   └── schedule/
│       └── notifications/          ← schedule-notification-{YYYY-MM-DD}.json (audit log mirrors)
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

**Current schema version: `2`**

Increment this value whenever a field is added, removed, or renamed in any schema defined in this document. Document the change in a `"changelog"` array within the affected file.

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
  "schema_version": 9,
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
      "tankconfig":    "config/tankconfig.json",
      "failure_modes": "config/failuremodes.json"
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
      "roughlog":        "data/roughlog/",
      "tasks_definitions":   "data/tasks/definitions/",
      "tasks_records":       "data/tasks/records/",
      "tasks_assets":        "data/assets/",
      "trips_log":           "data/trips/trips.json",
      "trips_daily":         "data/trips/daily/",
      "icms_production":     "data/icms/production/",
      "ports_config":        "config/portsconfig.json",
      "schedule_approved":   "config/scheduleconfig.json",
      "schedule_draft":      "config/schedule_draft.json",
      "schedule_notify_log": "data/schedule/notifications/"
    },
    "lock_file": "console.lock"
  },

  "changelog": [
    { "version": 1, "date": "2026-04-20", "note": "Initial schema definition." },
    { "version": 2, "date": "2026-04-21", "note": "Added connections block (config paths, data paths, lock file)." },
    { "version": 3, "date": "2026-04-22", "note": "Added roundsconfig to connections.config; rounds_logs and rounds_reports to connections.data." },
    { "version": 4, "date": "2026-04-23", "note": "Added tankconfig to connections.config." },
    { "version": 5, "date": "2026-04-26", "note": "Added active_trip_number to operational; trips_log, trips_daily, icms_production to connections.data." },
    { "version": 6, "date": "2026-04-27", "note": "Added ports_config, schedule_approved, schedule_draft, schedule_notify_log to connections.data (Schedule module)." },
    { "version": 7, "date": "2026-04-28", "note": "Added roughlog to connections.data (Rough Log module)." },
    { "version": 8, "date": "2026-04-28", "note": "Added tasks_definitions, tasks_records, tasks_active to connections.data (Tasks & Maintenance module)." },
    { "version": 9, "date": "2026-05-03", "note": "Retired tasks_active path; added tasks_assets path (Tasks revision + Asset Records module). Added failure_modes to connections.config." }
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

  "tank_layout": {
    "rows": 5,
    "cols": 7,
    "cells": [
      { "row": 0, "col": 2, "in_hull": true, "tank_id": null },
      { "row": 0, "col": 3, "in_hull": true, "tank_id": "a1b2c3d4-0001-4000-8000-000000000001" },
      { "row": 1, "col": 1, "in_hull": true, "tank_id": null }
    ]
  },

  "changelog": [
    { "version": 1, "date": "2026-04-21", "note": "Initial vessel configuration." },
    { "version": 2, "date": "2026-04-29", "note": "Added tank_layout object (grid dimensions and sparse hull-cell array)." }
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

### `tank_layout` object

Optional. Absent on first-run vessels until an admin saves the Tank Layout tab. When present:

| Field   | Type    | Required | Notes                                                    |
|---------|---------|----------|----------------------------------------------------------|
| `rows`  | integer | yes      | Number of rows in the edit grid. Default 3.              |
| `cols`  | integer | yes      | Number of columns in the edit grid. Default 5.           |
| `cells` | array   | yes      | Sparse list of hull cells. Only `in_hull: true` cells are stored; empty/non-hull cells are omitted to keep the file compact. |

Each entry in `cells`:

| Field      | Type    | Required | Notes                                                                   |
|------------|---------|----------|-------------------------------------------------------------------------|
| `row`      | integer | yes      | Zero-based row index.                                                   |
| `col`      | integer | yes      | Zero-based column index.                                                |
| `in_hull`  | boolean | yes      | Always `true` — non-hull cells are never written.                       |
| `tank_id`  | string  | no       | UUID matching a `tank_id` in the `tanks` array, or `null` if the cell is unassigned. Each tank may appear in at most one cell. |

**Hull Preview canvas — display rules:**

The console renders the layout as an HTML5 Canvas silhouette when the Hull Preview sub-tab is active. Stepped hull boundary corners are smoothed with implicit diagonal fills (no edit-grid change required).

| Tank category | Fill bar colour |
|---------------|-----------------|
| `fuel`        | Green (`#3B8C4A`) |
| `lube_oil`    | Amber (`#A07820`) |
| `waste_oil`   | Brown (`#7A4A1A`) |
| `sewage`      | Near-black (`#2A2A2A`) |
| `water`       | Blue (`#1A5F8E`) |

- Fill bar height represents current volume as a fraction of `capacity`.
- Volume is displayed as `{volume} usg` (rounded to nearest integer). Shown as `—` when no fuel state data is available.
- Tank name (`abbreviation` or `tank_id` fallback) is word-wrapped into the label area.
- All labels are drawn in a second rendering pass so they are never obscured by adjacent cell fills.

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
**Edited by:** Admin (via console Config → Equipment Setup screen)
**Read by:** Console (at ingest time, to compute `department` column in `assets` table); Field PWA (future — to filter autocomplete by department)

Defines which asset code ranges belong to which department, and which ranges are excluded entirely. This is the sole source of truth for department assignment. Assignment is computed at ingest time and stored in the `assets.department` SQLite column.

```json
{
  "schema_version": 2,
  "departments": {
    "engine": {
      "order": 1,
      "ranges": [
        { "from": "600", "to": "650" },
        { "from": "700", "to": "760" },
        { "from": "790", "to": "793" }
      ]
    },
    "factory": {
      "order": 2,
      "ranges": [
        { "from": "310", "to": "320" },
        { "from": "360", "to": "362" },
        { "from": "491", "to": "492" }
      ]
    },
    "deck": {
      "order": 3,
      "ranges": [
        { "from": "400", "to": "440" },
        { "from": "464", "to": "464" }
      ]
    }
  },
  "groups": [
    { "code": "740", "label": "Exhaust Systems and Air Intakes", "department": "engine", "sort_order": 0 }
  ],
  "ignore": {
    "ranges": [
      { "from": "100", "to": "199" },
      { "from": "991", "to": "999" }
    ]
  },
  "changelog": [
    { "version": 1, "date": "2026-04-21", "note": "Initial department range assignment." },
    { "version": 2, "date": "2026-04-29", "note": "Added order field per department. Added groups array. Assignment rule changed: highest order wins on multi-department conflict." }
  ]
}
```

### Department object fields

| Field  | Type     | Required | Notes                                                                                        |
|--------|----------|----------|----------------------------------------------------------------------------------------------|
| `order` | integer | yes      | Priority weight for conflict resolution. When an asset matches multiple departments, the department with the **highest** `order` value wins. Values must be unique across departments. |
| `ranges` | array  | yes      | Ordered list of range objects assigned to this department.                                   |

### Range object fields

| Field  | Type   | Required | Notes                                                                                                   |
|--------|--------|----------|---------------------------------------------------------------------------------------------------------|
| `from` | string | yes      | Starting code, inclusive. Top-level segment only (e.g. `"600"`). All children included automatically. |
| `to`   | string | yes      | Ending code, inclusive. Top-level segment only.                                                         |

### Group object fields (`groups` array)

Each entry represents a named section header for a block of equipment used by the **Group Assignment** tab. Groups are displayed in the console grouped by their resolved department, in ascending `sort_order`.

| Field        | Type    | Required | Notes                                                                                                             |
|--------------|---------|----------|-------------------------------------------------------------------------------------------------------------------|
| `code`       | string  | yes      | Top-level asset code (e.g. `"740"`). Used to look up `label` from the `assets` table at ingest time.             |
| `label`      | string  | yes      | Human-readable header text. Auto-populated from the `name` column of the first asset whose code matches this top-level segment. Stored here so the label survives if the asset register is replaced. |
| `department` | string  | yes      | Resolved department key (e.g. `"engine"`). Computed automatically from `equipmentconfig.json` department ranges at the time the group is saved. If the entered code falls within a conflicting range the winning department (highest `order`) is used. |
| `sort_order` | integer | yes      | Display position within the department's group list. Lower numbers appear first. Rewritten on every save to reflect the current drag/reorder state. |

### Assignment rules

1. Range boundaries are evaluated at the top-level integer segment only. `{ "from": "600", "to": "650" }` includes all assets whose first code segment is between 600 and 650 inclusive.
2. **Conflict resolution.** If an asset matches ranges for more than one department, the department with the highest `order` value is assigned. Only one department is ever stored per asset.
3. **Ignore takes precedence.** If an asset matches any Ignore range, it receives `department = 'ignore'` regardless of any department match or order value.
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

### Cross-department resource keys

Some modules span departments or are vessel-wide and use a group prefix rather than a department key. These keys are added to `DEPT_RESOURCES` under their group name and follow the same access model.

```javascript
const DEPT_RESOURCES = {
  // ... existing department groups above ...
  'Operations': [
    { key: 'operations/trip_planner', label: 'Trip Planner',
      note: 'Admin permission additionally required to open/close trips, record departures, and add mid-trip crew.' },
    { key: 'operations/schedule',     label: 'Schedule',
      note: 'Admin permission additionally required to promote draft to approved, confirm crew assignments, and edit rotation groups.' }
  ],
  'Administration': [
    { key: 'administration/ports', label: 'Ports',
      note: 'Admin only. Grants access to add, edit, and remove ports in portsconfig.json.' }
  ]
};
```

| Key | Group | Label | Access scope |
|-----|-------|-------|--------------|
| `operations/trip_planner` | Operations | Trip Planner | Grants view access to all Trip Planner tabs. Admin permission is additionally required to open/close trips, record departures, and add mid-trip crew. |
| `operations/schedule` | Operations | Schedule | Grants view access to all three Schedule tabs. Admin permission is additionally required to promote draft to approved, confirm crew assignments, and edit rotation groups. |
| `administration/ports` | Administration | Ports | Grants access to the Ports configuration tab (add, edit, remove ports). Admin only. |

### Resource key format

`"{group_key}/{module_key}"` — lowercase, no spaces, underscore-separated.

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
- `equipment.js` renderer module — Equipment Setup screen added under Administration. Split into two tabs: **Department Assignment** (department range configuration with per-department `order` priority) and **Group Assignment** (code-range section headers with auto-resolved department tags and drag-order controls). Save to OneDrive and Refresh from OneDrive operational on both tabs.
- `assets`, `equipment_assignments`, and `equipment_groups` SQLite tables — created via `CREATE TABLE IF NOT EXISTS` on startup (safe migration, no manual intervention required). `equipment_assignments` carries `dept_order` for conflict resolution during ingest. `equipment_groups` is fully rebuilt from the `groups` array on every ingest.
- Asset ingest architecture — CSV fetch and config load run in renderer (Graph API token); all parsing and SQLite writes run in main process via `db:ingestAssets` IPC handler. Full transaction upsert of ~2,800 rows.
- Assignment conflict rule changed: when an asset matches multiple departments the department with the highest `order` value wins (single department stored, not comma-separated).
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
- `active_days` field added to item objects in `roundsconfig.json` — integer array of ISO weekday numbers (1=Monday … 7=Sunday) for which a given item is active. Defaults to all seven days when not present. Headings do not carry this field.
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

### Phase 6b/6c — Historical Seed + Trip History UI ✅ Complete

- **Historical seed script** (`scripts/seed-historical-trips.js`, run via `npm run seed`): one-time import of ~142 historical closed trips from two Excel sources (Engineering Schedule.xlsx `TripHistorical` + `ProdHistorical` sheets; Overall Trip Fuel Consumption Log fuel sheets). Idempotent via `INSERT OR IGNORE` on `trip_number` UNIQUE constraint.
- `opened_by = 'seed_import'` and `closed_by = 'seed_import'` written to all seeded rows. UI uses this to discriminate historical from live trips.
- Historical trips receive **one aggregate `trip_daily_logs` row** (trip total fuel + production) rather than daily rows. `log_date` equals the trip's `close_date`.
- Structured `trips.notes` field introduced (semicolon-delimited `key=value` pairs). See §23 **notes field format**. Keys: `days_at_sea`, `fuel_total_usg`, `prod_total_mt`, `gpd`. Flag tokens encode per-trip anomalies from the seed run.
- `parseNotes()` utility added to `main.js` and `tripplanner.js`. Parses the notes field into a plain object; tokens without `=` are silently skipped.
- **Trip History tab** (Tab 4 in `tripplanner.js`): sortable, filterable, paginated table of all closed trips. Year and fishery dropdowns; free-text search against trip number and port. Shows days-at-sea, fuel total, production total, GPD from notes for historical trips; live-computed equivalents for live trips.
- **Season Analytics tab** (Tab 5 in `tripplanner.js`): year summary table, fishery composition breakdown, CSS-rendered fuel-efficiency bar chart (no external charting library).
- IPC handlers added: `db:getTripHistory`, `db:getSeasonSummary`, `db:getFisheryComposition`, `db:getFuelEfficiencyByYear`.
- Seed runner (`scripts/seed-runner.js`) launches seed script via Electron's own binary to avoid `better-sqlite3` native module version mismatch between system Node and Electron's bundled Node.
- `xlsx` npm package (`^0.18.5`) added to `dependencies` for Excel parsing in seed script.

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

### Schema v2.0 — Crew registry + Schedule module rewrite ✅ Complete

- **`crewconfig.json`** — new file at `Documents/IDMS/config/crewconfig.json`. Dedicated crew member registry for vessel personnel, separate from `userconfig.json`. Schema fields: `crew_id` (UUID v4), `username`, `name`, `role_id`, `role_label`, `department`, `status`, `vessel`, `contact` (`phone`, `email`, `preferred_airport`, `whatsapp`, `messenger`), `certificates[]`. Populated from the Crew Setup → Crew List screen and uploaded to OneDrive. See §29 for full schema.
- **`vessel` field added to crew members** — each crew entry in `crewconfig.json` carries a `vessel` string (e.g. `"F/T ARAHO"`). This field drives the three-tier crew picker in the Schedule grid (Engineers on vessel / Other Dept on vessel / Non-Validated free entry). Editable via a validated dropdown in the Crew List form: `F/T ALASKA SPIRIT`, `F/T ARAHO`, `F/T CONSTELLATION`, `F/T DEFENDER`, `F/T ENTERPRISE`.
- **`preferred_airport` IATA datalist** — the `preferred_airport` field in the `crewconfig.json` contact block stores a raw IATA code (e.g. `"ANC"`). The Crew List edit form renders it as an `<input list>` backed by a 76-option `<datalist>`, allowing the operator to filter by code or city name.
- **`schedule.js` — complete rewrite (Schedule module v2.0)** — see §28 for updated UI documentation. Key new behaviours:
  - Year selector replaces "Season" label; dropdown populated from SQLite trip history + current config year, descending.
  - Past years display a read-only historical table sourced from SQLite `trips`.
  - Current year displays the editable schedule grid. Admin users can click crew cells to open a three-tier optgroup picker (Engineers on F/T ARAHO → Other Dept on F/T ARAHO → Non-Validated). Non-Validated entries are collected via `window.prompt`.
  - Fishery badges in trip column headers are clickable (admin only) and open an inline `<select>` for `YF / Mack / Gulf / POP / STEAM`. Average historical trip duration per fishery is shown in the picker and in a legend row beneath the grid.
  - Trip close dates and port of call are pulled from SQLite (`window.idms.db.getTrips()`) and overlaid on `scheduleconfig.json` at render time. Actual confirmed dates display in green; projected future dates are italic/muted.
  - Re-anchor logic runs on every fishery-type change and on module load: walks trips in sequence order, sets `est_trip_days` and `est_close_date` from fishery historical average for all non-confirmed trips.
  - Crew Totals table rendered beneath the grid: one row per person, grouped by position type (Chief Engineer / 1st Engineer / Oiler / Factory / Other), showing scheduled trip count, estimated days, and actual days (green when confirmed).
  - "Save Schedule" button injected into the topbar on first edit; calls `saveScheduleConfig()` and strips internal `_actualClose`/`_port` annotations before writing.
- **Sidebar version string** updated to `schema v2.0 · IDMS v1.9`.
- **`scheduleconfig.json` and `crewconfig.json` schema_version** both set to `2` from initial creation.

### v2.1 — Navigation restructure

Sidebar groups renamed: Administration → Config; new groups Overview, Operations, Personnel introduced. Stability Calculations moved to Config → Vessel Setup → Stability Calculations tab. Trip Planner dissolved: Tabs 4–5 move to Records → Trip History; Tabs 1–3 redistribution pending refactor. overview.js to be retired; functionality absorbed into dashboard.js. New stub sections added: §30 Dashboard, §31 Rough Log, §32 Tasks & Maintenance, §33 Oil Record Book, §34 Messages, §35 KSA Profiles, §36 Navigation & Weather. No file schema changes in this version.

### v2.2 — Rough Log module built ✅ Complete

- `data/roughlog/roughlog-{YYYY}.json` — new OneDrive file, one per calendar year. Created automatically by the console on first entry save. Each file contains a `year` integer and an `entries` array of rough log entry objects.
- `rough_log` SQLite table — added via `CREATE TABLE IF NOT EXISTS` on console startup (no manual migration required). Indexes on `date`, `timestamp`, `category`, and `user`.
- `roughlog` path entry added to `consoleconfig.json → connections.data`.
- `roughlog.js` — new console renderer module for the Rough Log screen under Overview.
- IPC handlers added: `db:ingestRoughLog` (INSERT OR IGNORE, idempotent re-ingest), `db:getRoughLogEntries` (paginated, filterable).
- Rough log polling added to the console ingestion cycle alongside rounds and department logs.
- `graph.js` helpers added: `loadRoughLogFile(year)`, `saveRoughLogFile(year, data)`.
- `app.js` SCREENS registry: `roughlog` entry added with `onEnter: initRoughLog`.
- `index.html`: `screen-roughlog` div added; `roughlog.js` script tag added before `app.js`; nav button `disabled` class removed.

### v2.7 — Tasks & Maintenance revision

- `task_active_state` table: retained but no longer populated. Safe to drop via `DROP TABLE IF EXISTS task_active_state` after confirming no active in-flight tasks remain.
- `tasks` table: run the `ALTER TABLE` migrations below to add `other_label`, `failure_mode`, `failure_mechanism`, `detection_method` columns. Existing rows will have `null` for all new columns.
- `task_records` table: run the `ALTER TABLE` migrations below. Existing rows will have `null` for `outcome`, `closed_by`, `closed_at`, ISO 14224 fields, `close_note`, `events_snapshot`. Display `outcome` as `completed` where null.
- Definition files on OneDrive: existing files have `schema_version: 1` and no `events[]` array. The ingest handler must treat a missing or empty `events[]` as an empty array. `due_date` fields on existing task objects are ignored but not removed — they will remain in OneDrive files until those tasks are next written.
- Active state files (`data/tasks/active/`): no action required. Console will stop reading and writing them. They can be manually deleted from OneDrive at any time.

### v2.7 — Asset Records

- No migration required — all asset record files are new.
- `asset_records` and `asset_event_history` tables created via `CREATE TABLE IF NOT EXISTS` on console startup.

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
  dept_order    INTEGER NOT NULL DEFAULT 0,
  is_ignore     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE equipment_groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  department  TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE schedule_notifications (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  triggered_at            TEXT    NOT NULL,
  trigger_type            TEXT    NOT NULL,
  triggered_by_trip       TEXT    NOT NULL,
  drift_days              REAL,
  cumulative_drift_days   REAL,
  affected_user_ids       TEXT    NOT NULL,
  broadcast_sent          INTEGER NOT NULL DEFAULT 0,
  cooldown_suppressed_ids TEXT,
  notes                   TEXT
);

CREATE TABLE schedule_drift_log (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_number           TEXT    NOT NULL UNIQUE,
  schedule_year         INTEGER NOT NULL,
  fishery_target        TEXT    NOT NULL,
  estimated_close_date  TEXT    NOT NULL,
  actual_close_date     TEXT    NOT NULL,
  delta_days            REAL    NOT NULL,
  cumulative_drift_days REAL    NOT NULL,
  reanchor_applied      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rough_log (
  id            TEXT PRIMARY KEY,
  timestamp     TEXT NOT NULL,
  date          TEXT NOT NULL,
  time_label    TEXT NOT NULL,
  department    TEXT NOT NULL,
  source        TEXT NOT NULL,
  category      TEXT NOT NULL,
  user          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  body          TEXT NOT NULL,
  equipment_id  TEXT,
  ref_id        TEXT,
  year          INTEGER NOT NULL,
  ingested_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rough_log_date      ON rough_log(date);
CREATE INDEX IF NOT EXISTS idx_rough_log_timestamp ON rough_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_rough_log_category  ON rough_log(category);
CREATE INDEX IF NOT EXISTS idx_rough_log_user      ON rough_log(user);

CREATE TABLE IF NOT EXISTS tasks (
  task_id         TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  equipment_ids   TEXT NOT NULL,
  category        TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'Normal',
  role            TEXT,
  assigned_to     TEXT,
  description     TEXT,
  skill_tags      TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  recurring       INTEGER NOT NULL DEFAULT 0,
  interval        TEXT,
  interval_hours  INTEGER,
  due_date        TEXT,
  created_at      TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  notes           TEXT,
  code_range      TEXT NOT NULL,
  year            INTEGER NOT NULL,
  ingested_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_records (
  record_id       TEXT PRIMARY KEY,
  task_id         TEXT,
  equipment_ids   TEXT NOT NULL,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL,
  completed_by    TEXT NOT NULL,
  completed_at    TEXT NOT NULL,
  hours_spent     REAL,
  parts_used      TEXT,
  notes           TEXT,
  follow_up       TEXT,
  code_range      TEXT NOT NULL,
  year            INTEGER NOT NULL,
  ingested_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_active_state (
  username        TEXT NOT NULL,
  task_id         TEXT NOT NULL,
  state           TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  ingested_at     TEXT NOT NULL,
  PRIMARY KEY (username, task_id)
);

CREATE TABLE IF NOT EXISTS task_skill_tags (
  tag             TEXT PRIMARY KEY,
  label           TEXT NOT NULL
);

-- v2.7 additions: ALTER TABLE migrations for existing tables
ALTER TABLE tasks ADD COLUMN other_label       TEXT;
ALTER TABLE tasks ADD COLUMN failure_mode      TEXT;
ALTER TABLE tasks ADD COLUMN failure_mechanism TEXT;
ALTER TABLE tasks ADD COLUMN detection_method  TEXT;

ALTER TABLE task_records ADD COLUMN outcome           TEXT;
ALTER TABLE task_records ADD COLUMN closed_by         TEXT;
ALTER TABLE task_records ADD COLUMN closed_at         TEXT;
ALTER TABLE task_records ADD COLUMN failure_mode      TEXT;
ALTER TABLE task_records ADD COLUMN failure_mechanism TEXT;
ALTER TABLE task_records ADD COLUMN detection_method  TEXT;
ALTER TABLE task_records ADD COLUMN close_note        TEXT;
ALTER TABLE task_records ADD COLUMN events_snapshot   TEXT;  -- JSON string

-- v2.7 new tables
CREATE TABLE IF NOT EXISTS task_events (
  event_id      TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL,
  type          TEXT NOT NULL,           -- 'transition' or 'comment'
  actor         TEXT NOT NULL,
  timestamp     TEXT NOT NULL,           -- ISO 8601 UTC
  from_status   TEXT,
  to_status     TEXT,
  note          TEXT,
  ingested_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS failure_modes (
  code          TEXT NOT NULL,
  list          TEXT NOT NULL,           -- 'failure_mode', 'failure_mechanism', 'detection_method'
  label         TEXT NOT NULL,
  PRIMARY KEY (code, list)
);

-- v2.7 indexes
CREATE INDEX IF NOT EXISTS idx_task_events_task_id   ON task_events (task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_timestamp ON task_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority        ON tasks (priority);

-- §38 Asset Records tables (v2.7)
CREATE TABLE IF NOT EXISTS asset_records (
  item_id     TEXT PRIMARY KEY,
  asset_no    TEXT NOT NULL,
  asset_name  TEXT NOT NULL,
  last_round  TEXT,                    -- ISO 8601 UTC, nullable
  code_range  TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_event_history (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id             TEXT NOT NULL,
  task_id             TEXT NOT NULL,
  title               TEXT NOT NULL,
  category            TEXT NOT NULL,
  outcome             TEXT NOT NULL,
  opened_at           TEXT NOT NULL,
  closed_at           TEXT NOT NULL,
  closed_by           TEXT NOT NULL,
  failure_mode        TEXT,
  failure_mechanism   TEXT,
  detection_method    TEXT,
  ingested_at         TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_event_item_id   ON asset_event_history (item_id);
CREATE INDEX IF NOT EXISTS idx_asset_event_task_id   ON asset_event_history (task_id);
CREATE INDEX IF NOT EXISTS idx_asset_event_closed_at ON asset_event_history (closed_at);
```

`user_id` columns in `log_files` and `events` were added via `ALTER TABLE` migration in Phase 4 and are nullable to support pre-UUID log files. The `assets` and `equipment_assignments` tables were added in Phase 5 via `CREATE TABLE IF NOT EXISTS` on startup. The `rounds_config_snapshots` and `rounds_entries` tables were added in Phase 5 (continued) via `CREATE TABLE IF NOT EXISTS` on startup. The `schedule_notifications` and `schedule_drift_log` tables were added in Phase 7 (Schedule module) via `CREATE TABLE IF NOT EXISTS` on startup. The `rough_log` table was added in v2.2 (Rough Log module) via `CREATE TABLE IF NOT EXISTS` on startup. The `tasks`, `task_records`, `task_active_state`, and `task_skill_tags` tables were added in v2.3 (Tasks & Maintenance module) via `CREATE TABLE IF NOT EXISTS` on startup. No SQLite schema changes in v2.4 — `tank_layout` is stored entirely within `vesselconfig.json` on OneDrive. In v2.7 (Tasks revision + Asset Records), `ALTER TABLE` migrations added `other_label`, `failure_mode`, `failure_mechanism`, `detection_method` to `tasks`; and `outcome`, `closed_by`, `closed_at`, ISO 14224 fields, `close_note`, `events_snapshot` to `task_records`. New tables `task_events`, `failure_modes`, `asset_records`, and `asset_event_history` added via `CREATE TABLE IF NOT EXISTS`. `task_active_state` is retired (no longer populated). See §16 for migration guidance.

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

**`equipment_assignments` notes:** Denormalised snapshot of current `equipmentconfig.json` ranges. Fully rebuilt on every ingest. `dept_order` mirrors the department's `order` value and is used during ingest to resolve conflicts: when an asset matches multiple department ranges the row with the highest `dept_order` determines the stored department. Used for fast range queries and by `db:getAssetRangeCounts`.

**`equipment_groups` notes:** Denormalised snapshot of the `groups` array from `equipmentconfig.json`. Fully rebuilt on every ingest. Rows are ordered by `(department, sort_order)` for display in the Group Assignment tab. `label` is stored at save time from the `assets` table lookup and preserved across subsequent asset-register replacements.

**`rounds_config_snapshots` notes:** Stores a full copy of `roundsconfig.json` each time a rounds log file is ingested whose `config_version` differs from the most recently stored snapshot. Allows historical rounds data to be displayed with correct item labels even if the config has since changed.

### Console renderer modules

| Module              | Nav Location                                                              | Status      |
|---------------------|---------------------------------------------------------------------------|-------------|
| `app.js`            | Navigation, collapsible sidebar groups                                    | Built       |
| `auth.js`           | Sign-in                                                                   | Built       |
| `graph.js`          | OneDrive API                                                              | Built       |
| `ingest.js`         | Polling engine                                                            | Built       |
| `dashboard.js`      | Overview → Dashboard                                                      | Not Built   |
| `roughlog.js`       | Overview → Rough Log                                                      | Built       |
| `tasks.js`          | Operations → Tasks & Maintenance                                          | Built       |
| `fuel.js`           | Operations → Fuel & Liquids                                               | Built       |
| `oilrecord.js`      | Operations → Oil Record Book                                              | Not Built   |
| `bunker.js`         | Operations → Bunker Pre-Load                                              | Built       |
| `schedule.js`       | Personnel → Schedule                                                      | Built       |
| `training.js`       | Personnel → Training & Certs                                              | Not Built   |
| `crewprofiles.js`   | Personnel → Crew Profiles                                                 | Not Built   |
| `messages.js`       | Personnel → Messages                                                      | Not Built   |
| `tripplanner.js`    | Records → Trip History (Tabs 4–5, transitional)                           | Partial     |
| `eventlogs.js`      | Records → Event Logs                                                      | Built       |
| `reports.js`        | Records → Reports                                                         | Built       |
| `vessel.js`         | Config → Vessel Setup (5 tabs: Particulars, Tanks, Machinery, Stability, Tank Layout) | Partial     |
| `tank.js`           | Embedded in Vessel Setup → Stability tab                                  | Built       |
| `stability.js`      | Embedded in Vessel Setup → Stability Calculations tab (to be moved)       | Partial     |
| `equipment.js`      | Config → Equipment Setup (2 tabs: Department Assignment, Group Assignment) | Built       |
| `rounds.js`         | Config → Rounds Setup                                                     | Built       |
| `users.js`          | Config → Users                                                            | Built       |
| `crewsetup.js`      | Config → Crew Setup                                                       | Built       |
| `crew.js`           | Embedded in Crew Setup → Crew List tab                                    | Built       |
| `trainingmatrix.js` | Embedded in Crew Setup → Requirements Matrix tab                          | Built       |
| `settings.js`       | Config → Settings                                                         | Built       |
| `overview.js`       | Retired — absorbed into dashboard.js                                      | Partial     |

### Equipment Setup screen — UI behaviour

The Equipment Setup screen (`equipment.js`) is organised into two tabs that share a single Save and Refresh toolbar.

#### Department Assignment tab

Displays all departments defined in `userconfig.json`, each rendered as a card. Within each card:

- An **Order** field (integer input) sets the department's priority weight. When an asset falls within ranges claimed by more than one department the department with the highest order value wins. Order values must be unique; the console warns on duplicate entry.
- A list of **range rows**, each with `From` and `To` inputs and a remove button.
- An **Add Range** button appends a blank row.
- A separate **Ignore** card lists ranges excluded entirely from all departments.
- **Badge** counts next to each range reflect exact SQLite asset counts post-ingest; badges show `—` while there are unsaved changes.

#### Group Assignment tab

Allows admins to define named section headers for blocks of equipment. Groups are displayed in the console UI grouped under their resolved department heading.

- An input field accepts a **top-level asset code** (e.g. `740`). On entry the console looks up that code in the SQLite `assets` table and auto-populates the adjacent **label** field with the matching asset name (e.g. `"Exhaust Systems and Air Intakes"`). The label is editable after auto-population.
- The **department** is resolved automatically from the current department-range configuration (highest order wins on conflict) and displayed as a read-only tag. The tag updates live if the Department Assignment config is changed before saving.
- Within each department group, rows can be **moved up** or **moved down** using arrow buttons, and **deleted** with a remove button. A **New Group** button at the bottom of each department section appends a blank code + label row.
- Groups with no matching asset code show a warning badge; their label must be filled manually.
- On **Save**, `sort_order` values are rewritten sequentially (0, 1, 2, …) to reflect the current display order within each department.

### Phase 5 (partial) — Equipment setup complete

Asset register ingestion, department range assignment, and Equipment Setup screen (Department Assignment + Group Assignment tabs) are operational. The following Phase 5 items remain pending:

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
**Edited by:** Admin (via console Config → Vessel Setup → Stability tab)
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
**Edited by:** Admin (via console Config → Rounds Setup screen)
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
| `active_days`    | integer[]         | no       | Array of ISO weekday numbers (1=Monday … 7=Sunday) for which this item is active. Defaults to all seven days when not present. Omitted for `"heading"` type items. Allows per-item day-of-week scheduling — e.g. an item that only applies on weekdays. |
| `custom_options` | string[]          | no       | Required when `type` is `"custom"`. Ordered list of selectable options presented as a dropdown at data entry time. E.g. `["Normal", "Standby", "Fault", "Shutdown"]`. Must be `null` or omitted for all other types. |
| `notes`          | string            | yes      | Free text. Internal operator note visible during config editing. Does not appear on the printed sheet. May be empty string. |

---

### Item type reference

| Type       | Data cell content                       | Has `unit` | Has `custom_options` | Has `active_rounds` | Has `active_days` | Appears in log data |
|------------|-----------------------------------------|------------|----------------------|---------------------|-------------------|---------------------|
| `numeric`  | Number input                            | Yes        | No                   | Yes                 | Yes               | Yes — numeric value or `null` if not recorded  |
| `text`     | Free-text input (unvalidated)           | No         | No                   | Yes                 | Yes               | Yes — string value or `null` if not recorded   |
| `custom`   | Dropdown from `custom_options` list     | No         | Yes                  | Yes                 | Yes               | Yes — string value or `null` if not recorded   |
| `checkbox` | Checked / unchecked                     | No         | No                   | Yes                 | Yes               | Yes — boolean or `null` if not recorded        |
| `heading`  | Display separator only                  | No         | No                   | No                  | No                | No — omitted from log entirely                 |

`heading` items have no data column and no `active_rounds` or `active_days` fields. They are purely a visual element on the generated sheet. Their `unit`, `asset_code`, and `custom_options` fields must be `null`.

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
  - `active_days` — seven checkboxes labelled M T W Th F Sa Su (ISO weekdays 1–7). All checked by default. Hidden for `heading` type. Allows per-item day-of-week scheduling — e.g. an item that only applies on weekdays.
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

**Note on `active_rounds` / `active_days`:** Items whose `active_rounds` exclude a given round number, or whose `active_days` exclude the current day of the week, are not expected to appear in that round's entries. The field PWA enforces both constraints at entry time. The console ingestion layer stores whatever entries are present without validating against either field.

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

The Stability Calculations page (Config → Vessel Setup → Stability Calculations tab) provides a real-time loading condition summary and stability assessment for the vessel.

**Note:** Summary block (final table + two chart images) exported to daily report automatically. It reads live tank inventory from `fuelstate.json`, hydrostatic tables from `tankconfig.json`, and tank definitions from `vesselconfig.json`. Variable weights (crew, provisions, catch, etc.) and lightship data are manually entered by the operator and persisted to `stability.json` on OneDrive.

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
**Tabs:** Overview · Fuel Management · Rotation Planner · Trip History · Season Analytics

The Trip Planner is the operational lifecycle manager for fishing trips. It is the single source of truth for trip metadata, daily logs, and crew assignments. Downstream modules (Scheduling, Fuel Log) read from this data.

> **Navigation note (v2.1)**  
> The Trip Planner screen is being dissolved into the new nav structure. Tabs 4–5 (Trip History, Season Analytics) will move to Records → Trip History. Tabs 1–3 will be redistributed to Dashboard, Fuel & Liquids, and Crew Setup respectively. The tripplanner.js module remains operational and is not deleted during this transition — it is marked Partial in the renderer modules table until the refactor is complete.

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
| `opened_by`      | TEXT    | NOT NULL             | Username from userconfig.json. `'seed_import'` for historical trips inserted by the seed script. |
| `closed_by`      | TEXT    | nullable             | Username; null until closed. `'seed_import'` for historical trips. |
| `notes`          | TEXT    | nullable             | Semicolon-delimited `key=value` pairs. See **notes field format** below. |

#### `trip_daily_logs`

One row per trip per operational day for **live trips**. Historical trips (seeded via `opened_by = 'seed_import'`) store exactly **one aggregate row** per trip whose `log_date` equals the trip's `close_date` and whose `fuel_burned_usg` and `production_mt` are trip totals. UI code must check `trips.opened_by` to choose the correct display logic.

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

#### `trips.notes` field format

The `notes` column stores structured metadata as semicolon-delimited tokens. Each token is either a `key=value` pair or a bare flag word (which is ignored by parsers but preserved for human readability).

```
days_at_sea=18;fuel_total_usg=14200;prod_total_mt=183.4;close_date_from_TripHistorical;date_conflict_TH=2024-09-04_FL=2024-09-01
```

| Key | Value type | Description |
|-----|-----------|-------------|
| `days_at_sea` | integer | Trip length in days. For historical trips, derived from fuel log or TripHistorical sheet. |
| `fuel_total_usg` | float | Total fuel consumed (USG). Stored as trip total; mirrors `trip_daily_logs.fuel_burned_usg` for historical trips. |
| `prod_total_mt` | float | Total production (metric tonnes). Stored as trip total; mirrors `trip_daily_logs.production_mt` for historical trips. |
| `gpd` | float | Fuel efficiency: gallons per sea-day. |

Flag tokens (no `=`) are anomaly annotations written by the seed script (e.g. `close_date_from_TripHistorical`, `no_fuel_data`, `prod_data_corrupt_skipped`, `split_trip_same_season_sequence`). They are silently skipped by `parseNotes()` and are human-readable only.

**`parseNotes(notesStr)`** — utility function in `main.js` and `tripplanner.js`. Splits on `;`, parses `key=value` pairs, coerces numeric strings to `parseFloat`, and returns a plain object. Tokens without `=` are ignored.

---

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
| `db:getTripHistory`          | Returns paginated closed trips with optional filters (`year`, `fishery`, `search`, `page`, `pageSize`). Returns `{ rows, total, pages }`. Historical trips use notes-parsed `days_at_sea`; live trips derive it from `COUNT(DISTINCT log_date)`. |
| `db:getSeasonSummary`        | Returns one row per year with aggregated totals: `trips`, `days_at_sea`, `fuel_usg`, `prod_mt`, `avg_gpd`. Covers all closed trips. |
| `db:getFisheryComposition`   | Returns one row per `(year, fishery_target)` pair with `trip_count`. Used by Season Analytics tab fishery breakdown table. |
| `db:getFuelEfficiencyByYear` | Returns one row per year with `avg_gpd` (average gallons per sea-day across all closed trips in that year). Used by Season Analytics bar chart. |

---

### Migration note

No migration required. All three tables are created with `CREATE TABLE IF NOT EXISTS` on every console startup. Existing installations will have the tables created automatically on next launch.


---

## §24 — portsconfig.json

**Location:** `Documents/IDMS/config/portsconfig.json`
**Edited by:** Admin (via console Ports tab)
**Read by:** Console (Schedule module, Trip Reference tab; future: navigation and fuel modules)

A validated reference list of all ports the vessel may call at. Port entries are referenced by `port_id` in `scheduleconfig.json` and `schedule_draft.json`. The schedule module will only accept `port_id` values that exist in this file.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "last_updated": "2026-04-27T00:00:00.000Z",
  "updated_by": "tploch",

  "ports": [
    {
      "port_id":    "DUT",
      "name":       "Dutch Harbor",
      "alias":      "Unalaska",
      "lat":        53.8957,
      "lon":        -166.5422,
      "timezone":   "America/Adak",
      "airport":    "DUT",
      "notes":      "Primary offload port. Fuel barge available."
    },
    {
      "port_id":    "SEA",
      "name":       "Seattle",
      "alias":      "Pier 91 / Fishermens Terminal",
      "lat":        47.6558,
      "lon":        -122.3968,
      "timezone":   "America/Los_Angeles",
      "airport":    "SEA",
      "notes":      "Drydock and shipyard port."
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-04-27", "note": "Initial port reference list." }
  ]
}
```

### Port object fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `port_id` | string | yes | Short uppercase key. Used as foreign key in schedule files. Must be unique. Prefer IATA code where one exists. |
| `name` | string | yes | Full display name. |
| `alias` | string | no | Alternate name or berth description. May be empty string. |
| `lat` | number | yes | Decimal degrees, WGS84. |
| `lon` | number | yes | Decimal degrees, WGS84. |
| `timezone` | string | yes | IANA timezone string. Used to display port call times in local time. |
| `airport` | string | no | IATA airport code for nearest airport. Used in Trip Reference flight logistics view. May be empty string. |
| `notes` | string | no | Free text. Operational notes (fuel availability, customs, etc.). |

---

## §25 — scheduleconfig.json

**Location:** `Documents/IDMS/config/scheduleconfig.json`
**Edited by:** Admin only (via console Schedule tab — promote from draft action)
**Read by:** Console (Schedule module); Field PWA (read-only, crew visibility — Phase 3+)

The approved schedule for the current season. Authoritative record of confirmed crew assignments and projected trip timeline. Written only when an admin promotes a draft to approved. Dates are re-anchored automatically at trip close; crew changes require explicit confirmation before promotion.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "schedule_year": 2026,
  "approved_at": "2026-01-15T10:00:00.000Z",
  "approved_by": "tploch",
  "last_updated": "2026-04-27T14:00:00.000Z",

  "season_frame": {
    "steam_north_date": "2026-01-19",
    "steam_north_port":  "SEA",
    "steam_south_date": "2026-11-18",
    "steam_south_port":  "SEA",
    "total_trips": 18
  },

  "alert_config": {
    "drift_threshold_days":            7,
    "broadcast_threshold_days":        10,
    "cooldown_days":                    7,
    "pre_port_reminder_days":           7,
    "long_trip_threshold_multiplier": 1.25,
    "broadcast_recipients":            "all_active"
  },

  "positions": [
    { "position_id": "chief",          "label": "Chief",            "department": "Engine Room", "type": "rotated", "rotation_group": "rg_chief"   },
    { "position_id": "first",          "label": "1st",              "department": "Engine Room", "type": "rotated", "rotation_group": "rg_first"   },
    { "position_id": "oiler_a",        "label": "Oiler",            "department": "Engine Room", "type": "rotated", "rotation_group": "rg_oiler_a" },
    { "position_id": "oiler_b",        "label": "Oiler",            "department": "Engine Room", "type": "rotated", "rotation_group": "rg_oiler_b" },
    { "position_id": "factory_tech",   "label": "Factory Tech",     "department": "Factory",     "type": "float",   "rotation_group": null          },
    { "position_id": "training_extra", "label": "Training / Extra", "department": null,          "type": "adhoc",   "rotation_group": null          }
  ],

  "rotation_groups": [
    {
      "group_id": "rg_chief",   "label": "Chief Engineer", "pattern": "2way_alternating",
      "members": ["uuid-william", "uuid-taylor"],
      "trips_on": 3, "max_days_on": null, "return_mode": "whichever_first", "notifications_enabled": true
    },
    {
      "group_id": "rg_first",   "label": "1st Engineer",   "pattern": "2way_alternating",
      "members": ["uuid-sam", "uuid-patience"],
      "trips_on": 3, "max_days_on": null, "return_mode": "whichever_first", "notifications_enabled": true
    },
    {
      "group_id": "rg_oiler_a", "label": "Oiler A",        "pattern": "manual",
      "members": ["uuid-ivan", "uuid-miloud"],
      "trips_on": null, "max_days_on": null, "return_mode": "manual", "notifications_enabled": true
    },
    {
      "group_id": "rg_oiler_b", "label": "Oiler B",        "pattern": "manual",
      "members": ["uuid-juan", "uuid-megan"],
      "trips_on": null, "max_days_on": null, "return_mode": "manual", "notifications_enabled": true
    }
  ],

  "time_off": [
    {
      "user_id": "uuid-taylor",
      "off_after_trip": "2605", "expected_reboard_trip": "2609",
      "return_condition": { "max_trips_off": 3, "max_days_off": null, "mode": "whichever_first" },
      "last_notified_return_date": null, "last_notification_sent": null
    },
    {
      "user_id": "uuid-william",
      "off_after_trip": "2608", "expected_reboard_trip": "2612",
      "return_condition": { "max_trips_off": 3, "max_days_off": null, "mode": "whichever_first" },
      "last_notified_return_date": null, "last_notification_sent": null
    }
  ],

  "trips": [
    {
      "trip_number": "2600", "sequence": 0,  "fishery_target": "STEAM", "projected_port": "DUT",
      "est_trip_days": 8.0,  "est_close_date": "2026-01-27", "actual_close_date": "2026-01-27", "crew_status": "confirmed",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-miloud",  "display_name": "MILOUD"  },
        { "position_id": "oiler_b",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",    "display_name": "LUCE"    },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2601", "sequence": 1,  "fishery_target": "YF",    "projected_port": "DUT",
      "est_trip_days": 18.0, "est_close_date": "2026-02-14", "actual_close_date": "2026-02-14", "crew_status": "confirmed",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-miloud",  "display_name": "MILOUD"  },
        { "position_id": "oiler_b",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",    "display_name": "LUCE"    },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2602", "sequence": 2,  "fishery_target": "YF",    "projected_port": "DUT",
      "est_trip_days": 17.0, "est_close_date": "2026-03-03", "actual_close_date": "2026-03-03", "crew_status": "confirmed",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-ivan",    "display_name": "IVAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",   "display_name": "MEGAN"   },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",    "display_name": "LUCE"    },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2603", "sequence": 3,  "fishery_target": "YF",    "projected_port": "DUT",
      "est_trip_days": 16.0, "est_close_date": "2026-03-19", "actual_close_date": "2026-03-19", "crew_status": "confirmed",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-ivan",    "display_name": "IVAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",   "display_name": "MEGAN"   },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando", "display_name": "ROLANDO" },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2604", "sequence": 4,  "fishery_target": "Mack",  "projected_port": "DUT",
      "est_trip_days": 12.0, "est_close_date": "2026-03-31", "actual_close_date": "2026-03-31", "crew_status": "confirmed",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",  "display_name": "TAYLOR"  },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-ivan",    "display_name": "IVAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando", "display_name": "ROLANDO" },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2605", "sequence": 5,  "fishery_target": "Mack",  "projected_port": "DUT",
      "est_trip_days": 12.0, "est_close_date": "2026-04-12", "actual_close_date": "2026-04-12", "crew_status": "confirmed",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",  "display_name": "TAYLOR"  },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-ivan",    "display_name": "IVAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando", "display_name": "ROLANDO" },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2606", "sequence": 6,  "fishery_target": "Mack",  "projected_port": "DUT",
      "est_trip_days": 14.75, "est_close_date": "2026-04-26", "actual_close_date": "2026-04-26", "crew_status": "confirmed",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william",  "display_name": "WILLIAM"  },
        { "position_id": "first",          "user_id": "uuid-sam",      "display_name": "SAM"      },
        { "position_id": "oiler_a",        "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_b",        "user_id": "uuid-juan",     "display_name": "JUAN"     },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando",  "display_name": "ROLANDO"  },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2607", "sequence": 7,  "fishery_target": "Mack",  "projected_port": "DUT",
      "est_trip_days": 14.75, "est_close_date": "2026-05-11", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william",  "display_name": "WILLIAM"  },
        { "position_id": "first",          "user_id": "uuid-sam",      "display_name": "SAM"      },
        { "position_id": "oiler_a",        "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_b",        "user_id": "uuid-ivan",     "display_name": "IVAN"     },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando",  "display_name": "ROLANDO"  },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2608", "sequence": 8,  "fishery_target": "Gulf",  "projected_port": "DUT",
      "est_trip_days": 15.23, "est_close_date": "2026-05-26", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william",  "display_name": "WILLIAM"  },
        { "position_id": "first",          "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_a",        "user_id": "uuid-ivan",     "display_name": "IVAN"     },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",    "display_name": "MEGAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",     "display_name": "LUCE"     },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2609", "sequence": 9,  "fishery_target": "Gulf",  "projected_port": "DUT",
      "est_trip_days": 15.23, "est_close_date": "2026-06-10", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",   "display_name": "TAYLOR"   },
        { "position_id": "first",          "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_a",        "user_id": "uuid-ivan",     "display_name": "IVAN"     },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",    "display_name": "MEGAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",     "display_name": "LUCE"     },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2610", "sequence": 10, "fishery_target": "Gulf",  "projected_port": "DUT",
      "est_trip_days": 15.23, "est_close_date": "2026-06-26", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",   "display_name": "TAYLOR"   },
        { "position_id": "first",          "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_a",        "user_id": "uuid-ivan",     "display_name": "IVAN"     },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",    "display_name": "MEGAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",     "display_name": "LUCE"     },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2611", "sequence": 11, "fishery_target": "Gulf",  "projected_port": "DUT",
      "est_trip_days": 15.23, "est_close_date": "2026-07-11", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",  "display_name": "TAYLOR"  },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",   "display_name": "MEGAN"   },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",    "display_name": "LUCE"    },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2612", "sequence": 12, "fishery_target": "POP",   "projected_port": "DUT",
      "est_trip_days": 16.18, "est_close_date": "2026-07-27", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",   "display_name": "MEGAN"   },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",    "display_name": "LUCE"    },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2613", "sequence": 13, "fishery_target": "POP",   "projected_port": "DUT",
      "est_trip_days": 16.18, "est_close_date": "2026-08-12", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-ivan",    "display_name": "IVAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando", "display_name": "ROLANDO" },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2614", "sequence": 14, "fishery_target": "POP",   "projected_port": "DUT",
      "est_trip_days": 16.18, "est_close_date": "2026-08-28", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",    "display_name": "JUAN"    },
        { "position_id": "oiler_b",        "user_id": "uuid-ivan",    "display_name": "IVAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando", "display_name": "ROLANDO" },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2615", "sequence": 15, "fishery_target": "POP",   "projected_port": "DUT",
      "est_trip_days": 16.18, "est_close_date": "2026-09-14", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-william", "display_name": "WILLIAM" },
        { "position_id": "first",          "user_id": "uuid-sam",     "display_name": "SAM"     },
        { "position_id": "oiler_a",        "user_id": null,           "display_name": ""        },
        { "position_id": "oiler_b",        "user_id": "uuid-ivan",    "display_name": "IVAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando", "display_name": "ROLANDO" },
        { "position_id": "training_extra", "user_id": null,           "display_name": ""        }
      ]
    },
    {
      "trip_number": "2616", "sequence": 16, "fishery_target": "POP",   "projected_port": "DUT",
      "est_trip_days": 16.18, "est_close_date": "2026-09-30", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",   "display_name": "TAYLOR"   },
        { "position_id": "first",          "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",     "display_name": "JUAN"     },
        { "position_id": "oiler_b",        "user_id": "uuid-ivan",     "display_name": "IVAN"     },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",     "display_name": "LUCE"     },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2617", "sequence": 17, "fishery_target": "POP",   "projected_port": "DUT",
      "est_trip_days": 16.18, "est_close_date": "2026-10-16", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",   "display_name": "TAYLOR"   },
        { "position_id": "first",          "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",     "display_name": "JUAN"     },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",    "display_name": "MEGAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-luce",     "display_name": "LUCE"     },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2618", "sequence": 18, "fishery_target": "YF",    "projected_port": "DUT",
      "est_trip_days": 17.40, "est_close_date": "2026-11-02", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",   "display_name": "TAYLOR"   },
        { "position_id": "first",          "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",     "display_name": "JUAN"     },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",    "display_name": "MEGAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando",  "display_name": "ROLANDO"  },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    },
    {
      "trip_number": "2619", "sequence": 19, "fishery_target": "STEAM", "projected_port": "SEA",
      "est_trip_days": 7.0,  "est_close_date": "2026-11-18", "actual_close_date": null, "crew_status": "projected",
      "crew": [
        { "position_id": "chief",          "user_id": "uuid-taylor",   "display_name": "TAYLOR"   },
        { "position_id": "first",          "user_id": "uuid-patience", "display_name": "PATIENCE" },
        { "position_id": "oiler_a",        "user_id": "uuid-juan",     "display_name": "JUAN"     },
        { "position_id": "oiler_b",        "user_id": "uuid-megan",    "display_name": "MEGAN"    },
        { "position_id": "factory_tech",   "user_id": "uuid-rolando",  "display_name": "ROLANDO"  },
        { "position_id": "training_extra", "user_id": null,            "display_name": ""         }
      ]
    }
  ],

  "vacation_requests": [
    {
      "user_id": "uuid-sam", "username": "sam",
      "windows": [
        { "start": "2026-06-18", "end": "2026-07-01", "note": "Confirmed" }
      ]
    },
    {
      "user_id": "uuid-megan", "username": "megan",
      "windows": [
        { "start": "2026-03-20", "end": "2026-06-20",
          "note": "Partially covered by off-ship window after trip 3; overlap through early June is unresolved." },
        { "start": "2026-07-23", "end": "2026-08-25",
          "note": "Requested — conflicts with projected trips 2612-2613. Not yet scheduled." }
      ]
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-01-15", "note": "Initial schedule created for 2026 season." },
    { "version": 2, "date": "2026-04-27", "note": "Trips 1-6 confirmed with actuals. Trips 7-18 re-anchored from trip 6 close." }
  ]
}
```

### `season_frame` fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `steam_north_date` | string | yes | ISO date. Departure date from home port. |
| `steam_north_port` | string | yes | `port_id` from portsconfig.json. |
| `steam_south_date` | string | yes | ISO date. Projected return date. Updated on re-anchor. |
| `steam_south_port` | string | yes | `port_id` from portsconfig.json. |
| `total_trips` | integer | yes | Total fishing trips in the season, not counting steam legs. |

### `alert_config` fields

| Field | Type | Notes |
|-------|------|-------|
| `drift_threshold_days` | integer | Personal alert fires when a crew member's projected return date shifts by this many days since their last notification. Default: 7. |
| `broadcast_threshold_days` | integer | Broadcast fires when cumulative drift reaches this value. May be set higher than `drift_threshold_days`. Default: 10. |
| `cooldown_days` | integer | Minimum days between notifications for the same crew member, regardless of additional drift. Default: 7. |
| `pre_port_reminder_days` | integer | Days before a projected port call with a crew rotation at which a logistics reminder is sent. Default: 7. |
| `long_trip_threshold_multiplier` | number | Active-trip duration multiplier that triggers the mid-trip long-run alert. Default: 1.25. |
| `broadcast_recipients` | string or array | `"all_active"` sends to all users with a non-empty email. Alternatively, a JSON array of `user_id` strings for a restricted list. |

### `positions` object fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `position_id` | string | yes | Unique key within this schedule. |
| `label` | string | yes | Display label for the schedule grid. |
| `department` | string | no | If set, crew dropdowns filter to this department. Null means no filter. |
| `type` | string | yes | One of `rotated`, `float`, `adhoc`. |
| `rotation_group` | string | no | `group_id` from `rotation_groups`. Required if `type` is `rotated`. Null otherwise. |

**Position types:**

| Type | Behaviour |
|------|-----------|
| `rotated` | Linked to a rotation group. Assignments projected by the scheduler. Crew dropdown validates against department. |
| `float` | No rotation group. Assignments entered manually. Crew dropdown validates against department if set. |
| `adhoc` | No rotation, no projection. Dropdown shows department-filtered crew plus a free-text write-in option. No drift notifications. |

### `rotation_groups` object fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `group_id` | string | yes | Unique key. Referenced by `positions`. |
| `label` | string | yes | Display name. |
| `pattern` | string | yes | One of `2way_alternating`, `3way_rotation`, `manual`. |
| `members` | string[] | yes | Ordered array of `user_id` values. Order determines rotation sequence for algorithmic patterns. |
| `trips_on` | integer | no | Consecutive trips on before rotation. Null if `manual`. |
| `max_days_on` | integer | no | Maximum days aboard regardless of trip count. Null if not used. |
| `return_mode` | string | yes | One of `whichever_first`, `both_required`, `manual`. |
| `notifications_enabled` | boolean | yes | If false, no drift alerts generated for members of this group. |

**Pattern notes:**

| Pattern | Behaviour |
|---------|-----------|
| `2way_alternating` | Members[0] on, Members[1] off; swap when `trips_on` or `max_days_on` condition is met. |
| `3way_rotation` | Three-person rotating cycle; `trips_on` applies per person per cycle leg. |
| `manual` | No algorithmic projection. Assignments entered at trip close confirmation. System flags coverage gaps but does not project. |

### `time_off` object fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | yes | UUID from userconfig.json. |
| `off_after_trip` | string | yes | Trip number (YYNN) after which this person departs. |
| `expected_reboard_trip` | string | yes | Trip number (YYNN) at which this person is projected to reboard. |
| `return_condition.max_trips_off` | integer | no | Maximum trips off before return is due. |
| `return_condition.max_days_off` | integer | no | Maximum calendar days off before return is due. |
| `return_condition.mode` | string | yes | `whichever_first`, `both_required`, or `manual`. |
| `last_notified_return_date` | string | no | ISO date. Projected return date at time of last notification. Null if never notified. |
| `last_notification_sent` | string | no | ISO 8601 UTC timestamp of last notification. Null if never notified. |

### `trips` object fields

One entry per trip in the season, including steam legs (sequence 0 for steam north, sequence N+1 for steam south).

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `trip_number` | string | yes | YYNN format. Must match `trips` table in SQLite if trip has been opened. Steam north = YY00; steam south = YY(total_trips+1). |
| `sequence` | integer | yes | Trip order. Steam north = 0, steam south = total_trips + 1. |
| `fishery_target` | string | yes | One of `YF`, `Mack`, `Gulf`, `POP`, `STEAM`. Used for average trip length lookup. |
| `projected_port` | string | yes | `port_id` from portsconfig.json. Overridable at trip close. |
| `est_trip_days` | number | yes | Estimated trip length in days. Sourced from per-fishery historical average at schedule creation or last re-anchor. |
| `est_close_date` | string | yes | ISO date. Derived from prior trip's actual or estimated close plus `est_trip_days`. Updated on re-anchor. |
| `actual_close_date` | string | no | ISO date. Set at trip close. Null if not yet closed. |
| `crew_status` | string | yes | One of `confirmed`, `projected`, `pending`. |
| `crew` | object[] | yes | One entry per position in `positions`. |

**`crew_status` values:**

| Value | Meaning |
|-------|---------|
| `confirmed` | Explicitly confirmed by admin. Used for past trips and manually reviewed future trips. |
| `projected` | Generated by the rotation scheduler. Not yet confirmed. Displayed with visual distinction in the console. |
| `pending` | Trip has closed but next-trip crew not yet confirmed. Triggers prompt at next console login. |

### `crew` assignment object fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `position_id` | string | yes | Must match a `position_id` in `positions`. |
| `user_id` | string | no | UUID from userconfig.json. Null for empty slots or unresolved write-ins. |
| `display_name` | string | yes | Name as displayed in schedule grid. May differ from current userconfig name if role changed. |

**Unlinked name flag:** If `display_name` is non-empty and `user_id` is null on a non-adhoc position, the console flags this as an unlinked entry.

---

## §26 — schedule_draft.json

**Location:** `Documents/IDMS/config/schedule_draft.json`
**Edited by:** Admin (freely, via console Schedule tab projected panel)
**Read by:** Console only. Never read by the field PWA.

Identical structure to `scheduleconfig.json`. The draft exists as a what-if workspace: the admin can reassign crew, adjust fishery sequences, or test rotation configurations without affecting the approved schedule.

Additional top-level fields not present in `scheduleconfig.json`:

```json
{
  "based_on_approved_at": "2026-01-15T10:00:00.000Z",
  "draft_created":        "2026-04-27T14:30:00.000Z",
  "draft_modified":       "2026-04-27T15:12:00.000Z",
  "draft_notes":          "Testing SAM / PATIENCE swap from trip 9 forward."
}
```

| Field | Type | Notes |
|-------|------|-------|
| `based_on_approved_at` | string | Timestamp of the approved schedule this draft was forked from. Used to detect staleness — warns if the approved schedule has been updated since the draft was created. |
| `draft_created` | string | ISO 8601 UTC. |
| `draft_modified` | string | ISO 8601 UTC. Updated on every save. |
| `draft_notes` | string | Free text. Admin note describing the purpose of this draft. |

**Promotion rules:**
- Promoting draft to approved overwrites `scheduleconfig.json`.
- If `based_on_approved_at` does not match the current `approved_at` in `scheduleconfig.json`, the console warns that the approved schedule has changed since the draft was created and requires explicit confirmation before overwriting.
- Date-only changes (re-anchor from trip closes) are applied directly to `scheduleconfig.json` without requiring a draft promotion. Only crew assignment changes require the draft workflow.

---

## §27 — Schedule Notification System

The notification system runs checks at two points: **on trip close** and **on daily ingest poll**.

### Trigger 1 — Trip close drift check

Fires when a trip is closed via `db:closeTrip`. Steps:

1. Calculate `delta_days = actual_close_date - est_close_date` for the closing trip.
2. Write a row to `schedule_drift_log`.
3. Re-anchor all future trip `est_close_date` values in `scheduleconfig.json` from this trip forward, using per-fishery historical averages from the `trips` table.
4. Update `season_frame.steam_south_date` to reflect the re-anchored season end.
5. For each entry in `time_off` where `expected_reboard_trip` is in the future:
   a. Compute new projected return date = `est_close_date` of the trip *before* `expected_reboard_trip`.
   b. Compare against `last_notified_return_date` (or original schedule date if null).
   c. If shift >= `drift_threshold_days` AND time since `last_notification_sent` >= `cooldown_days`: emit personal alert, update `last_notified_return_date` and `last_notification_sent`.
   d. Record suppressed user_ids (cooldown active) in `schedule_notifications.cooldown_suppressed_ids`.
6. If cumulative drift >= `broadcast_threshold_days`: emit broadcast to `broadcast_recipients`.
7. Write a row to `schedule_notifications`.

### Trigger 2 — Daily ingest poll (pre-port rotation reminder)

Fires as part of the existing ingest poll cycle. Steps:

1. For each future trip in `scheduleconfig.json` where `crew_status` is `confirmed` or `projected`:
   a. Check if any crew assignment differs from the *previous* trip (a rotation is occurring at this port call).
   b. If yes, and `est_close_date - today <= pre_port_reminder_days`:
   c. Check `schedule_notifications` for a prior `pre_port_rotation` notification for this trip.
   d. If none exists: emit logistics reminder, write row to `schedule_notifications`.

### Trigger 3 — Mid-trip long run check

Fires as part of the daily ingest poll when a trip is active.

1. Retrieve active trip from `db:getActiveTrip`.
2. Calculate `current_duration = today - open_date`.
3. Retrieve fishery average from historical data.
4. If `current_duration >= fishery_average * long_trip_threshold_multiplier`:
   a. Check whether the *next* port call has a crew rotation scheduled.
   b. If yes, and no `mid_trip_long` notification exists for this trip: emit alert, write row to `schedule_notifications`.

### Notification content

All notifications are sent via email using addresses from `userconfig.json`, via the Microsoft Graph `sendMail` API (`https://graph.microsoft.com/v1.0/me/sendMail`). This requires the `Mail.Send` scope on the Azure app registration (see §17 and open question 1 below).

**Personal drift alert (to affected crew member):**
> Subject: Schedule Update — Return Date Shift
> Body: "Your projected return date for Trip [N] has shifted by [X] days. New estimated return: [date]. Contact [Chief name] if this affects your arrangements."

**Broadcast notice (to all recipients):**
> Subject: F/V Araho — Schedule Drift Notice
> Body: "Trip [N] closed [X] days [early/late]. Cumulative schedule drift is now [Y] days. [Name(s)]'s projected return date(s) have been updated. If you are available to cover a rotation, please contact the Chief Engineer."

**Pre-port logistics reminder (to Chief / admin):**
> Subject: Crew Rotation Reminder — Trip [N] port call in [X] days
> Body: "Trip [N] is projected to offload at [Port] on [date], [X] days from today. The following crew rotation is scheduled: [list]. Arrange transportation as needed."

**Mid-trip long run alert (to Chief / admin):**
> Subject: Active Trip Running Long — Rotation at Next Port Call
> Body: "Trip [current trip number] has been at sea for [N] days ([X]% over the [fishery] average). A crew rotation is scheduled at the next port call. Consider contacting outgoing/incoming crew."

### IPC handlers

| Handler | Description |
|---------|-------------|
| `db:getScheduleDriftLog` | Returns all rows from `schedule_drift_log` for a given `schedule_year`, ordered by trip sequence. |
| `db:getScheduleNotifications` | Returns paginated rows from `schedule_notifications`, optionally filtered by `trigger_type` or date range. |
| `schedule:reanchor` | Re-runs the drift anchor calculation from a given trip forward. Returns the updated trip array for preview before writing to OneDrive. |
| `schedule:promoteFromDraft` | Reads `schedule_draft.json`, validates it against current `scheduleconfig.json`, and overwrites the approved file. Returns `{ ok, changes_summary }`. |
| `schedule:confirmNextTripCrew` | Called at trip close. Accepts a crew assignment array for the next trip, sets `crew_status` to `"confirmed"`, and writes to `scheduleconfig.json`. |
| `schedule:checkDrift` | Runs the full drift check manually. Returns `{ affected_users, cumulative_drift, broadcast_would_fire }` without sending notifications. |

### Open questions

1. **Mail.Send scope** — adding `Mail.Send` to the Azure app registration (§17) requires admin consent from O'Hara IT. This should be raised before the notification system is implemented, as it may require a separate service account rather than sending from the authenticated user's mailbox.

2. **PWA schedule visibility** — the field PWA reading `scheduleconfig.json` is noted as Phase 3+. When implemented, the PWA should show a crew member only their own trips and time-off windows, not the full schedule grid. Display-layer filter only, not a data-layer access control change.

3. **3-way rotation scheduling** — the `3way_rotation` pattern is defined but its projection algorithm is more complex than `2way_alternating`. If no 3-way rotation is needed for the 2026 season, implementation can be deferred without affecting the schema.

4. **Deck and Factory schedules** — `scheduleconfig.json` is vessel-wide. Whether Deck and Factory use the same file or separate per-department files is an open question. A single file is simpler; separate files allow department heads to manage their own schedules independently. To be decided before implementing the Setup tab.

5. **Historical schedule import** — the Excel sheets for 2020–2025 contain structured data that could be seeded into the database via a one-time import utility (similar to the TripHistorical seed script). Deferred; does not block current implementation.

6. **Trip 15 Oiler A vacancy** — the 2026 schedule has no Oiler A assigned for trip 2615. This is a known gap carried from the Excel planning sheet. An admin must assign coverage before this trip opens.

7. **MEGAN vacation conflict** — MEGAN has a vacation request for July 23 – August 25, 2026 that overlaps with projected trips 2612–2613. Resolution requires either a schedule adjustment or explicit denial of the request before those trips open.

---

## §28 — Schedule Module — Console UI

**Added in:** IDMS Console v2.0 (complete rewrite of v1.9 stub)
**Screen:** Personnel → Schedule
**Access:** `operations/schedule` resource key, or admin permission tier.
**Module file:** `schedule.js`

The Schedule module renders three tabs via the standard `cs-tab-bar` / `cs-tab` / `cs-tab-content` CSS pattern shared with Crew Setup, Vessel Setup, and Trip Planner.

---

### Tab 1 — Schedule

#### Year selector

A **Year** label and `<select>` dropdown appear at the top of the tab. Available years are computed from two sources: the current `scheduleconfig.json → schedule_year` value, and the set of unique years present in the SQLite `trips` table (`open_date` and `close_date` columns). The dropdown is sorted descending so the current season is always selected by default.

**Past year view** — when a year other than the current config year is selected, the tab renders a read-only historical table sourced exclusively from SQLite `trips`. Columns: Trip #, Fishery, Open, Close, Days, Port, Status. No crew data is displayed (crew assignments are not stored in SQLite).

**Current year view** — when the current config year is selected, the full editable grid and crew totals table are displayed (see below).

#### Season meta bar

Below the year selector, a single-line meta bar displays: Steam North date, Steam South date, and total trip count (sourced from `scheduleconfig.json → season_frame`).

#### Schedule grid

The grid is a horizontally scrollable table. Columns are trips in sequence order (Steam North → trip 01 → … → trip 18 → Steam South). Rows are positions from `scheduleconfig.json → positions`. The first column (position label) is sticky.

**Header row 1 — Trip labels and fishery badges**

Each trip column header shows the trip label (e.g. `01`, `SN`, `SS`) and a coloured fishery badge (`YF`, `Mack`, `Gulf`, `POP`, `STEAM`). For admin users, fishery badges on non-confirmed future trips are clickable and open an inline `<select>` with the five fishery options. Each option is labelled with the fishery code and its historical average duration (e.g. `YF (~17d)`). Selecting a new fishery immediately triggers `scReanchorFutureDates()` and marks the schedule dirty.

**Header row 2 — Close dates and ports**

Each trip column shows a close date and port of call. Dates are reconciled at load time: the SQLite `trips` row for that `trip_number` is the source of truth for `close_date` and `offload_port` (or `port`). If a SQLite record exists with a close date, it is shown in **green** as an actual confirmed date. If no SQLite record exists, the `est_close_date` from `scheduleconfig.json` is displayed in italic muted text.

**Data rows — Crew cells**

Each cell displays the `display_name` of the assigned crew member for that position and trip. Styling: confirmed trips (actual close date from SQLite) render names in normal weight; projected future trips render names in italic/muted. Empty slots show `—`.

For admin users, cells in non-confirmed future trips are clickable and open an inline `<select>` with three optgroups:

| Optgroup | Source |
|---|---|
| Engineers — F/T ARAHO | `crewconfig.json` crew where `status = 'active'`, `vessel = 'F/T ARAHO'`, `department = 'Engine Room'` |
| Other Dept — F/T ARAHO | `crewconfig.json` crew where `status = 'active'`, `vessel = 'F/T ARAHO'`, `department ≠ 'Engine Room'` |
| + Non-validated… | Triggers `window.prompt()` for a free-text name entry. Stored with `user_id: null`. |

Selecting a crew member or non-validated name updates the in-memory `SC.config` and marks the schedule dirty. A `—` / blank option is provided to clear the slot.

**Fishery average legend**

A row of coloured fishery badges with day averages appears below the grid. Values marked with `*` indicate no historical data exists and the default estimate is used. Historical averages are computed from the SQLite `trips` table: `mean(close_date − open_date)` per `fishery_target` across all closed trips with durations between 1 and 60 days. Defaults: YF 17d, Mack 13d, Gulf 15d, POP 16d, STEAM 8d.

#### Re-anchor logic (`scReanchorFutureDates`)

Runs at module load and after every fishery type change. Processes trips in `sequence` order:

1. For each trip: look up the matching SQLite row by `trip_number`.
2. If SQLite provides a `close_date` (or `actual_close_date` in config): mark the trip as confirmed, set `_actualClose` and `_port`, advance `prevClose`.
3. Otherwise: compute `est_trip_days = scFisheryAvg(fishery_target)` and `est_close_date = prevClose + est_trip_days`. Advance `prevClose` to the new `est_close_date`.
4. Starting `prevClose` is `season_frame.steam_north_date`.

`_actualClose` and `_port` are in-memory annotations only — they are stripped from the config object before any OneDrive write.

#### Crew Totals table

Rendered below the schedule grid for the current year. Grouped by position type:

| Group | Match rule |
|---|---|
| Chief Engineer | Position label contains "chief" (case-insensitive) |
| 1st Engineer | Position label contains "1st" or "first" |
| Oiler | Position label contains "oiler" |
| Factory | Position label contains "factory" or "deck" |
| Other | Catch-all |

Within each group, one row per unique person (by `user_id`, or display name for non-validated entries). Columns:

| Column | Value |
|---|---|
| Name | `display_name` from crew assignment |
| Trips | Count of trips where the person appears |
| Est. Days | Sum of `est_trip_days` for their trips |
| Actual Days | Sum of `actual_close − prev_close` for confirmed trips only; shown in green when > 0 |

Actual days computation uses the same running `prevClose` chain as re-anchor: for each confirmed trip, `actual_days = scDateDiffDays(prevClose, _actualClose)`, starting from `steam_north_date`.

#### Save behaviour

On first edit (crew cell assignment or fishery change), a **Save Schedule** button is injected into the topbar. Clicking calls `saveScheduleConfig()` with a deep copy of `SC.config` that has all `_actualClose` and `_port` annotations removed. On success, the button is removed and `SC.dirty` is reset to `false`.

---

### Tab 2 — Setup

Read-only summary of `scheduleconfig.json` configuration blocks, organised into collapsible-style panels:

- **Season Frame** — steam north/south dates and ports, total trip count.
- **Alert Configuration** — all `alert_config` threshold and cooldown values.
- **Rotation Groups** — one panel per group: pattern, members, trips_on, return_mode.
- **Time Off** — per-crew time-off windows.
- **Vacation Requests** — per-crew vacation request windows with notes.

Editing requires admin permission. The Setup tab is currently read-only pending the full setup editor implementation.

---

### Tab 3 — Trip Reference

A read-only logistics table. One row per trip in the current config. Columns:

| Column | Notes |
|---|---|
| Trip | Status dot (green = confirmed, grey = projected) + trip label |
| Fishery | Coloured badge |
| Port | `_port` (SQLite override) or `projected_port` from config |
| Close Date | Actual (green ✓) or estimated (italic) |
| Days Out | Days until projected close; colour-coded: today = amber, ≤ 7d = orange, further = normal, past = muted |
| Crew | Pipe-separated list of `display_name` for assigned crew |
| — | `ROTATION` badge if any position assignment differs from the previous trip |

The Ports configuration tab lives under **Administration**, not the Schedule module, since port data is shared infrastructure. Access requires the `administration/ports` resource key.

---

## §29 — crewconfig.json

**Location:** `Documents/IDMS/config/crewconfig.json`
**Edited by:** Admin (via console Config → Crew Setup → Crew List tab)
**Read by:** Console (Crew List, Training Matrix, Schedule module crew picker)

The crew registry for vessel personnel. Distinct from `userconfig.json` (which governs IDMS console login accounts): `crewconfig.json` holds the broader roster of crew members who may be assigned to trips on the schedule, whether or not they have a console account. A crew member can exist in `crewconfig.json` without a corresponding `userconfig.json` entry.

### Full example

```json
{
  "schema_version": 2,
  "vessel": "F/T ARAHO",
  "departments": ["Engine Room", "Factory"],

  "crew": [
    {
      "crew_id":    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "username":   "tploch",
      "name":       "Taylor Ploch",
      "role_id":    "chief_engineer",
      "role_label": "Chief Engineer",
      "department": "Engine Room",
      "status":     "active",
      "vessel":     "F/T ARAHO",
      "contact": {
        "phone":             "+1 907 555 0100",
        "email":             "tploch@example.com",
        "preferred_airport": "ANC",
        "whatsapp":          "+1 907 555 0100",
        "messenger":         ""
      },
      "certificates": []
    }
  ],

  "changelog": [
    { "version": 1, "date": "2026-04-27", "note": "Initial crew registry populated from Engineering Contact List." },
    { "version": 2, "date": "2026-04-27", "note": "Added vessel field; schema_version bumped to 2." }
  ]
}
```

### Top-level fields

| Field            | Type     | Required | Notes |
|------------------|----------|----------|-------|
| `schema_version` | integer  | yes      | Increment on structural change. Currently `2`. |
| `vessel`         | string   | yes      | Primary vessel name. Copied from sidebar on scaffold. |
| `departments`    | string[] | yes      | Departments represented in this file. |
| `crew`           | object[] | yes      | Ordered array of crew member objects. |
| `changelog`      | object[] | yes      | Version history. Each entry: `version`, `date`, `note`. |

### Crew member object fields

| Field        | Type     | Required | Notes |
|--------------|----------|----------|-------|
| `crew_id`    | string   | yes      | UUID v4. Generated on creation. Never changes. Used as the stable foreign key in `scheduleconfig.json → trips[].crew[].user_id`. |
| `username`   | string   | no       | Lowercase, no spaces. Matches `userconfig.json → username` if the crew member has a console account. `null` or empty for crew without a system account. |
| `name`       | string   | yes      | Full display name. E.g. `"Taylor Ploch"`. Used in the schedule grid and crew totals table. |
| `role_id`    | string   | no       | Machine-readable role key. E.g. `"chief_engineer"`. Matches entries in the Training Matrix role definitions. |
| `role_label` | string   | no       | Human-readable role label. E.g. `"Chief Engineer"`. |
| `department` | string   | yes      | Must match an entry in the top-level `departments` array. Determines which optgroup the crew member appears in on the Schedule crew picker. |
| `status`     | string   | yes      | One of `"active"`, `"inactive"`. Only `"active"` crew appear in the Schedule crew picker and Crew List active tab. |
| `vessel`     | string   | no       | The vessel this crew member is currently assigned to. One of the validated vessel values (see below). `null` if unassigned. Drives the Schedule crew picker — only crew with `vessel = 'F/T ARAHO'` appear in the first two optgroups. |
| `contact`    | object   | yes      | Contact block. All sub-fields may be empty string. |
| `certificates` | object[] | yes   | Array of certificate objects. May be empty. Schema defined by the Training Matrix module. |

### Valid `vessel` values

| Value | Notes |
|---|---|
| `"F/T ALASKA SPIRIT"` | |
| `"F/T ARAHO"` | Primary vessel for this console instance. |
| `"F/T CONSTELLATION"` | |
| `"F/T DEFENDER"` | |
| `"F/T ENTERPRISE"` | |
| `null` | Unassigned — crew member not currently aboard any vessel in the fleet. |

### Contact object fields

| Field               | Type   | Required | Notes |
|---------------------|--------|----------|-------|
| `phone`             | string | no       | International format preferred. E.g. `"+1 907 555 0100"`. |
| `email`             | string | no       | Contact email. |
| `preferred_airport` | string | no       | IATA airport code. E.g. `"ANC"` (Anchorage). Stored as the raw code; the Crew List form renders a datalist of 76 options for selection by code or city name. |
| `whatsapp`          | string | no       | WhatsApp number or handle. |
| `messenger`         | string | no       | Facebook Messenger handle or other messaging identifier. |

### Schedule crew picker integration

When an admin clicks a crew cell in the Schedule grid, a `<select>` element opens with three optgroups populated from `crewconfig.json`:

| Optgroup | Filter |
|---|---|
| **Engineers — F/T ARAHO** | `status = 'active'` AND `vessel = 'F/T ARAHO'` AND `department = 'Engine Room'` |
| **Other Dept — F/T ARAHO** | `status = 'active'` AND `vessel = 'F/T ARAHO'` AND `department ≠ 'Engine Room'` |
| **+ Non-validated…** | Free-text entry via `window.prompt()`. Stored as `{ user_id: null, display_name: "<entered name>" }`. |

Selecting a validated crew member stores their `crew_id` as `user_id` in `scheduleconfig.json → trips[].crew[]`. Non-validated entries store `user_id: null` and flag as unlinked in the console (display name shown, no UUID linkage).

### Relationship to userconfig.json

`crewconfig.json` and `userconfig.json` are independent files with overlapping but distinct purposes:

| | `userconfig.json` | `crewconfig.json` |
|---|---|---|
| **Purpose** | IDMS console login accounts | Vessel crew roster |
| **Key field** | `user_id` | `crew_id` |
| **Scope** | Anyone who logs into the console | Anyone who sails or may be scheduled |
| **Required for console login** | Yes | No |
| **Appears in Schedule picker** | No (indirectly via crewconfig) | Yes (if `status = 'active'` and `vessel` matches) |

A crew member may exist in both files. When they do, `username` in `crewconfig.json` should match `username` in `userconfig.json` to allow future cross-referencing, but this is not enforced by the current schema.

### Initial population

The initial `crewconfig.json` for F/T Araho was generated from `S:\Engineer's Files\Department Crew\Araho Engineers Contact Information.xlsx` and contains 25 crew members (11 active, 14 inactive). The file is located in the IDMS repository at `crewconfig.json` and must be uploaded to `Documents/IDMS/config/crewconfig.json` on OneDrive before first use.


---

## §30 — Dashboard

**Status:** Not built
**File:** `dashboard.js`
**Location:** Overview → Dashboard

Two tabs: Status and Rough Log (Rough Log tab is a view into §31 data)

**Status tab displays:**

- Active trip context: trip number, fishery, day count, destination port, distance in nm, ETA
- Fuel state summary: total fuel remaining, today's burn
- Tank state: fuel and oil levels at a glance
- Open tasks: overdue highlighted, due today, assigned to logged-in user's role
- Tasks closed today
- Rounds status for current watch
- Fish produced today (from ICMS)
- Stability summary block: GM, displacement, trim, two chart images
- Daily report ready indicator
- Upcoming crew change flag
- Cert / training alerts

Daily report is generated from this screen. Auto-compiled at midnight when position is entered. Exported as printable/emailable document. No manual composition.

**Note:** Vessel profiles (deferred): named loading condition presets (e.g. "Fishing Yellowfin") for variable weight defaults. To be implemented as `vessel_profiles` array in `vesselconfig.json` or `stability.json`.

---

## §31 — Rough Log

**Status:** Built (v2.2)
**File:** `roughlog.js`
**Location:** Overview → Rough Log (also intended as Tab 2 of Dashboard when dashboard.js is built)

Single vessel-wide chronological log, department-tagged. Manual entries are fully implemented. Auto-population from system events is planned but not yet implemented for all sources.

---

### OneDrive file

**Location:** `Documents/IDMS/data/roughlog/roughlog-{YYYY}.json`
**Written by:** Console (via Rough Log screen new-entry form, and by any future auto-population hooks)
**Read by:** Console (ingested into SQLite on every poll cycle and on screen init)

One file per calendar year. The file is created automatically on the first entry save for that year. Files for previous years are loaded on demand when the date filter spans a year boundary.

#### Full example

```json
{
  "year": 2026,
  "entries": [
    {
      "id":           "a1b2c3d4-0001-4000-8000-000000000001",
      "timestamp":    "2026-04-28T14:35:00.000Z",
      "date":         "2026-04-28",
      "time_label":   "14:35",
      "department":   "engine",
      "source":       "manual",
      "category":     "Manual Entry",
      "user":         "tploch",
      "display_name": "Taylor Ploch",
      "body":         "Changed main engine HT pump impeller. System back online.",
      "equipment_id": "601.001.003.001",
      "ref_id":       null
    }
  ]
}
```

#### Top-level fields

| Field     | Type     | Notes                                                  |
|-----------|----------|--------------------------------------------------------|
| `year`    | integer  | Calendar year this file covers (e.g. `2026`).          |
| `entries` | object[] | Ordered array of rough log entry objects, sorted ascending by `timestamp`. |

#### Entry object fields

| Field          | Type   | Required | Notes                                                                                               |
|----------------|--------|----------|-----------------------------------------------------------------------------------------------------|
| `id`           | string | yes      | UUID v4. Generated at creation via `crypto.randomUUID()`. Never changes. Primary key in SQLite.    |
| `timestamp`    | string | yes      | ISO 8601 UTC. Derived from vessel-local date + time using `consoleconfig.console.timezone`.        |
| `date`         | string | yes      | `YYYY-MM-DD` vessel local date.                                                                    |
| `time_label`   | string | yes      | `"HH:MM"` vessel local time (display label, 24-hour).                                             |
| `department`   | string | yes      | One of `"engine"`, `"factory"`, `"deck"`, `"vessel"`.                                             |
| `source`       | string | yes      | One of `"manual"` (user-created via form), `"system"` (auto-generated by console action), `"pwa"` (submitted from field PWA). |
| `category`     | string | yes      | One of the nine defined category values (see Category reference below).                            |
| `user`         | string | yes      | Username of the creating user, or `"system"` for auto-generated entries.                           |
| `display_name` | string | yes      | Full display name of the creating user at time of entry.                                           |
| `body`         | string | yes      | The log line text. Free text, no length limit enforced.                                            |
| `equipment_id` | string | no       | Asset code from `assets.csv` (e.g. `"601.001.003.001"`). `null` if not associated with equipment. |
| `ref_id`       | string | no       | Optional reference to an originating record (e.g. a transfer ID, task ID). `null` if not used.    |

---

### Category reference

| Category value    | Colour   | User-selectable | Auto-generated by |
|-------------------|----------|-----------------|-------------------|
| `Manual Entry`    | neutral (grey) | **Yes** (only this category is available in the new-entry form) | — |
| `Service Report`  | blue     | No              | Tasks & Maintenance (§32) on task close |
| `Fuel Transfer`   | amber    | No              | Fuel & Oil Transfers (§22) on transfer apply |
| `Bunkering`       | amber    | No              | Bunker Pre-Load screen on event save |
| `Oil Transfer`    | amber    | No              | Fuel & Oil Transfers (§22) on lube/waste oil transfer |
| `Rounds`          | green    | No              | Rounds module on round submission or missed-round flag |
| `Trip Event`      | purple   | No              | Trip Planner (§23) on trip open/close/port-call |
| `System`          | muted (dim) | No           | Console system actions (stability save, watch change, etc.) |
| `Reminder`        | orange   | No              | Deferred — future scheduled reminder feature |

**Auto-population is planned but not yet implemented** for any category except `Manual Entry`. The category field is constrained in the UI to prevent users from selecting non-manual categories directly.

---

### SQLite table — `rough_log`

Created via `CREATE TABLE IF NOT EXISTS` on every console startup. No manual migration required for existing installations.

```sql
CREATE TABLE rough_log (
  id            TEXT PRIMARY KEY,
  timestamp     TEXT NOT NULL,
  date          TEXT NOT NULL,
  time_label    TEXT NOT NULL,
  department    TEXT NOT NULL,
  source        TEXT NOT NULL,
  category      TEXT NOT NULL,
  user          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  body          TEXT NOT NULL,
  equipment_id  TEXT,
  ref_id        TEXT,
  year          INTEGER NOT NULL,
  ingested_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rough_log_date      ON rough_log(date);
CREATE INDEX IF NOT EXISTS idx_rough_log_timestamp ON rough_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_rough_log_category  ON rough_log(category);
CREATE INDEX IF NOT EXISTS idx_rough_log_user      ON rough_log(user);
```

**Column notes:**

| Column | Notes |
|--------|-------|
| `id` | UUID v4. Primary key. `INSERT OR IGNORE` on ingest makes re-processing idempotent. |
| `timestamp` | ISO 8601 UTC. Use for sorting and range queries. |
| `date` | `YYYY-MM-DD` vessel local. Index enables fast date-range filtering. |
| `time_label` | `"HH:MM"` vessel local. Display only — not used for comparisons. |
| `department` | Denormalised from the entry object. `"vessel"` means vessel-wide (not department-specific). |
| `source` | `"manual"` / `"system"` / `"pwa"`. |
| `category` | Verbatim category string from the entry (e.g. `"Manual Entry"`). |
| `user` | Username or `"system"`. |
| `display_name` | Full display name at time of entry. Preserved even if the user's name later changes. |
| `body` | Log line text. Searched via `LIKE '%query%'` in full-text search. |
| `equipment_id` | Asset code. `NULL` if not equipment-related. |
| `ref_id` | Originating record reference. `NULL` if not used. |
| `year` | Calendar year. Matches the source OneDrive file year. |
| `ingested_at` | ISO 8601 UTC. Last ingest timestamp. Not used as a filter — for diagnostics only. |

---

### IPC handlers

| Handler | Direction | Description |
|---------|-----------|-------------|
| `db:ingestRoughLog` | renderer → main | Accepts `{ year, entries[] }`. Inserts all entries with `INSERT OR IGNORE` (safe to re-run on the same data). Returns `{ ok, inserted }`. |
| `db:getRoughLogEntries` | renderer → main | Accepts a filter object (see below). Returns `{ rows, total }`. |

#### `db:getRoughLogEntries` filter object

| Field | Type | Notes |
|-------|------|-------|
| `date_from` | string | `YYYY-MM-DD`. Lower bound (inclusive) on `date`. |
| `date_to` | string | `YYYY-MM-DD`. Upper bound (inclusive) on `date`. |
| `equipment_id` | string | Exact match on `equipment_id`. Takes precedence over `equipment_from`/`equipment_to` if set. |
| `equipment_from` | string | Lower bound of asset code range. Matched using `CAST(substr(equipment_id, 1, 11) AS TEXT) >= ?`. |
| `equipment_to` | string | Upper bound of asset code range. |
| `categories` | string[] | Restricts results to these category values. Omit or pass empty array for all categories. |
| `user` | string | Exact match on `user`. Omit for all users. |
| `search` | string | Free-text substring search against `body` (`LIKE '%?%'`). |
| `limit` | integer | Page size. Default `200`. |
| `offset` | integer | Pagination offset. Default `0`. |

Returns `{ rows: [...], total: N }` where `total` is the total matching row count before pagination.

---

### graph.js helpers

```javascript
async function loadRoughLogFile(year)          // GET data/roughlog/roughlog-{year}.json
async function saveRoughLogFile(year, data)    // PUT data/roughlog/roughlog-{year}.json
```

`loadRoughLogFile` returns `null` if the file does not exist (HTTP 404). The caller is responsible for initialising a blank structure (`{ year, entries: [] }`) in that case.

---

### Console UI behaviour

#### Screen layout

The Rough Log screen (Overview → Rough Log) has three regions:

1. **Filter bar** — full-width flex row above the results table.
2. **Results panel** — scrollable table with pagination.
3. **New Entry form** — inline panel that slides open below the topbar button; only one entry can be in-progress at a time.

#### Filter bar

| Control | Type | Behaviour |
|---------|------|-----------|
| Date from / Date to | `<input type="date">` | Defaults to last 7 days on first load. |
| Preset | `<select>` | Options: Today, Yesterday, Last 7 days, Last 30 days, This month, Last 3 months, Custom. Selecting a preset updates both date inputs. Changing a date input manually switches preset to Custom. |
| Equipment | Text input + floating dropdown | Type-to-search against `window.idms.db.searchAssets(query, null, 12)`. Debounced 250 ms. Selecting an asset populates a hidden `equipment_id` field; the visible input shows the asset code + name. Cleared with ×. |
| Asset code from / to | Text inputs | Range filter on asset code prefix. Inactive when a specific Equipment is selected. |
| Category | Custom multi-select button | Button shows selected count; click opens a floating checklist of all 9 categories. Click outside closes. Default: all categories selected (no restriction). |
| Author | `<select>` | Populated from distinct `user` values already in the filtered SQLite dataset. Default: all authors. |
| Search | Text input | Free-text search against `body`. Enter key triggers apply. |
| Apply | Button | Triggers query with current filter values. |
| Clear | Button | Resets all filters to last-7-days default. |

Filters are applied by clicking Apply or pressing Enter in the search field. Results do not update live on keystroke.

#### Results table

| Column | Notes |
|--------|-------|
| Date & Time | `date` + `time_label` from the entry. Displayed in vessel local time. |
| Category | Coloured badge using the category colour map (see Category reference above). |
| Equipment | Asset code in monospace if `equipment_id` is set, otherwise `—`. |
| Author | `display_name` from the entry. |
| Entry | `body` text, wrapping. |

Pagination bar below the table shows entry count and prev/next buttons. Default page size: 200 entries.

#### New Entry form

Opened by **[+ New Entry]** button in the topbar. Only one form is open at a time — opening while one is already open has no effect.

| Field | Type | Notes |
|-------|------|-------|
| Date | `<input type="date">` | Defaults to today (vessel local). |
| Time | `<input type="time">` | Defaults to current vessel local time (HH:MM). |
| Category | `<select>` | Only `Manual Entry` is enabled; all other options are rendered disabled and serve as a reference label. |
| Equipment | Type-to-search (same asset search as filter bar) | Optional. |
| Entry body | `<textarea>` | Required. |
| Author | Read-only display | Shows `window.idmsCurrentUser.display_name`. Cannot be changed. |

**Submit** validates that `body` is non-empty, then:
1. Generates a UUID via `crypto.randomUUID()`.
2. Converts vessel-local date + time to UTC ISO using `consoleconfig.console.timezone`.
3. Appends the new entry to `RL.yearData[year].entries` in memory.
4. Sorts the year's entries ascending by `timestamp`.
5. Saves to OneDrive via `saveRoughLogFile(year, data)`.
6. Ingests to SQLite via `window.idms.db.ingestRoughLog({ year, entries: [newEntry] })`.
7. Re-renders the results panel with current filters applied.

**Cancel** closes the form without saving.

#### Year-boundary handling

If `date_from` and `date_to` span two calendar years (e.g. Dec 31 → Jan 1), both year files are fetched from OneDrive and ingested before the query runs. Fetched years are cached in `RL.yearData[year]` for the lifetime of the screen session.

#### Initialisation behaviour

On first navigation to the Rough Log screen (`initRoughLog()` called for the first time):
- Loads `consoleconfig` from the store.
- Fetches the current year's rough log file from OneDrive; initialises empty if absent.
- Ingests into SQLite.
- Renders the screen with default last-7-days filter.

On subsequent navigation (re-entry without page reload):
- Skips the OneDrive fetch (data already cached and ingested).
- Re-renders the screen immediately.

#### Ingest polling

Rough log is polled as part of the standard 2-minute ingest cycle (`ingest.js → pollNow()`). The current year's file is fetched and ingested on every poll. `INSERT OR IGNORE` ensures re-ingesting the same entries is a no-op.

---

### Auto-populating event sources (planned, not yet implemented)

The following sources are planned to write rough log entries automatically. None are currently wired.

| Source | Category | Trigger |
|--------|----------|---------|
| Fuel & Oil Transfers (§22) | `Fuel Transfer` | Transfer applied |
| Fuel & Oil Transfers (§22) | `Oil Transfer` | Lube or waste oil transfer applied |
| Bunker Pre-Load screen | `Bunkering` | Bunker event saved |
| Tasks & Maintenance (§32) | `Service Report` | Task closed with service report |
| Rounds module | `Rounds` | Round submitted or flagged missed |
| Trip Planner (§23) | `Trip Event` | Trip opened, closed, or port of call confirmed |
| Console system actions | `System` | Stability calculation saved; future: watch change |

---

### Daily report slice

When the daily report is generated from the Dashboard screen, the rough log contribution is:
- Entries where `date` matches the report date
- Filtered to `department` in `["engine", "vessel"]`
- Ordered by `timestamp` ascending

---

## §32 — Tasks & Maintenance

**Status:** Built (v2.3), Revised (v2.7)
**File:** `tasks.js`
**Location:** Operations → Tasks & Maintenance
**Tabs:** Active Tasks · Closed Tasks · Create Task · Manual Entry

---

### Overview

The Tasks & Maintenance module manages planned and unplanned maintenance work orders for vessel equipment. Tasks move through a structured lifecycle with a full event log recording every state transition and comment. Tasks are created by admin users (Create Task tab). Any authenticated user can add comments or update status. Only admin-tier users (Chief Engineer or above) may close a task, which triggers the write to the asset's event history. Recurring tasks automatically create the next instance on close.

The module was revised in v2.7 to support a richer CRM-style lifecycle, ISO 14224 failure mode capture at close, and a shared read/write model between the console and the field PWA (PWA access defined in a separate addendum).

---

### Status lifecycle

`due_date` is retired. Tasks are ordered by `priority` then `created_at`. The close action (not a status selection) moves a task to a terminal state.

```
open
  └──→ investigating
         └──→ waiting_parts
         └──→ waiting_opportunity
         └──→ shipyard
         └──→ other
         └──→ (any status can transition to any other active status)

Any active status ──→ [Close Task action] ──→ completed
Any active status ──→ [Close Task action] ──→ cancelled
```

| Status | Meaning |
|---|---|
| `open` | Task created, not yet acted on. |
| `investigating` | Assigned; inspection or diagnosis underway. |
| `waiting_parts` | Blocked on parts or materials. |
| `waiting_opportunity` | Blocked on operational window (offload, steam, drydock). |
| `shipyard` | Deferred to shipyard availability. |
| `other` | Blocked or deferred for another reason. `other_label` field stores free text. |
| `completed` | Terminal. Set by close action. Work done; asset history written. |
| `cancelled` | Terminal. Set by close action. Closed without completion; asset history written with outcome `cancelled`. |

**Note:** `in_progress` is retired. All active statuses above are functionally `in_progress` states with more descriptive semantics. The filter value `Active` in the UI maps to all non-terminal statuses.

---

### OneDrive files

#### Task Definition File

**Location:** `Documents/IDMS/data/tasks/definitions/tasks-{codeRange}-{year}.json`  
**No change to filename or location.**

The task object gains an `events[]` array, ISO 14224 fields, and loses `due_date`. The active state file (`data/tasks/active/{username}.json`) is retired — current status is derived from the most recent `transition` event in `events[]`.

**Written by:** Console and PWA (on task create, status update, comment, or close)  
**Read by:** Console and PWA

```json
{
  "schema_version": 2,
  "code_range": "601",
  "year": 2026,
  "tasks": [
    {
      "task_id":          "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "title":            "Investigate main engine oil pressure drop",
      "equipment_ids":    ["601.001.001.001"],
      "category":         "REP",
      "priority":         "High",
      "role":             "Chief Engineer",
      "assigned_to":      "spotchik",
      "description":      "Low lube oil pressure alarm on main engine. Investigate cause.",
      "skill_tags":       ["engine_maintenance"],
      "status":           "investigating",
      "other_label":      null,
      "recurring":        false,
      "interval":         null,
      "interval_hours":   null,
      "failure_mode":     "LOO",
      "failure_mechanism": "WEA",
      "detection_method": "ALM",
      "created_at":       "2026-05-03T08:00:00.000Z",
      "created_by":       "tploch",
      "notes":            "",
      "events": [
        {
          "event_id":   "aaaaaaaa-aaaa-4aaa-baaa-aaaaaaaaaaaa",
          "type":       "transition",
          "actor":      "tploch",
          "timestamp":  "2026-05-03T08:00:00.000Z",
          "from_status": null,
          "to_status":  "open",
          "note":       "Task created."
        },
        {
          "event_id":   "bbbbbbbb-bbbb-4bbb-cbbb-bbbbbbbbbbbb",
          "type":       "transition",
          "actor":      "tploch",
          "timestamp":  "2026-05-03T08:05:00.000Z",
          "from_status": "open",
          "to_status":  "investigating",
          "note":       "Assigned to Spotchik for diagnosis."
        },
        {
          "event_id":   "cccccccc-cccc-4ccc-dccc-cccccccccccc",
          "type":       "comment",
          "actor":      "spotchik",
          "timestamp":  "2026-05-03T10:30:00.000Z",
          "from_status": null,
          "to_status":  null,
          "note":       "Found scoring on oil pump drive gear. Recommending replacement."
        }
      ]
    }
  ]
}
```

##### Task definition object fields

| Field              | Type     | Required | Notes |
|--------------------|----------|----------|-------|
| `task_id`          | string   | yes      | UUID v4. Generated at creation. Primary key. |
| `title`            | string   | yes      | Short description of the work. |
| `equipment_ids`    | string[] | yes      | Array of asset codes from `assets.csv`. One or more. |
| `category`         | string   | yes      | One of the 9 valid category codes (unchanged from v2.3). |
| `priority`         | string   | yes      | One of `Critical`, `High`, `Normal`, `Low`. Default: `Normal`. |
| `role`             | string   | no       | Role label for assignment filtering. Not displayed in task list columns. |
| `assigned_to`      | string   | no       | Username of specific assignee. |
| `description`      | string   | no       | Detailed work instructions. Free text. |
| `skill_tags`       | string[] | no       | Skill category keys. |
| `status`           | string   | yes      | Current status. Must match the `to_status` of the most recent `transition` event. |
| `other_label`      | string   | no       | Required when `status` is `other`. Free text description of the reason. |
| `recurring`        | boolean  | yes      | If `true`, a new instance is created on close. |
| `interval`         | string   | no       | Required when `recurring` is `true`. |
| `interval_hours`   | integer  | no       | Required when `interval` is `CUSTOM`. |
| `failure_mode`     | string   | no       | ISO 14224 failure mode code. Editable at any point; required at close. |
| `failure_mechanism`| string   | no       | ISO 14224 failure mechanism code. Editable at any point; required at close. |
| `detection_method` | string   | no       | ISO 14224 detection method code. Editable at any point; required at close. |
| `created_at`       | string   | yes      | ISO 8601 UTC. |
| `created_by`       | string   | yes      | Username. |
| `notes`            | string   | no       | Internal admin note. |
| `events`           | array    | yes      | Append-only event log. Minimum one entry (creation transition). See event object below. |

**Retired fields:** `due_date` — removed. Tasks are ordered by `priority` then `created_at`.

##### Valid category codes

| Code  | Label                  | Colour (UI) |
|-------|------------------------|-------------|
| `SRV` | Service                | blue        |
| `ONE` | One-Off Job            | grey        |
| `CHK` | Inspection / Check     | teal        |
| `LUB` | Lubrication            | amber       |
| `CLN` | Cleaning               | green       |
| `RET` | Retorque / Adjustment  | purple      |
| `CAL` | Calibration            | indigo      |
| `REP` | Repair                 | red         |
| `MON` | Monitoring             | slate       |

##### Valid interval values

| Value    | Duration          |
|----------|-------------------|
| `7D`     | 7 days            |
| `1W`     | 1 week            |
| `2W`     | 2 weeks           |
| `1M`     | 1 month           |
| `3M`     | 3 months          |
| `6M`     | 6 months          |
| `1Y`     | 1 year            |
| `CUSTOM` | `interval_hours` defines duration in hours |

##### Event object fields

| Field        | Type   | Required | Notes |
|--------------|--------|----------|-------|
| `event_id`   | string | yes      | UUID v4. Generated at event creation. |
| `type`       | string | yes      | `transition` or `comment`. |
| `actor`      | string | yes      | Username of the user who created this event. |
| `timestamp`  | string | yes      | ISO 8601 UTC. |
| `from_status`| string | no       | Previous status. `null` for the creation transition and for comments. |
| `to_status`  | string | no       | New status. `null` for comments. |
| `note`       | string | no       | Free text. The comment body, or a brief note accompanying a transition. |

##### Write pattern for event log updates

To prevent last-write-wins collisions when both console and PWA may update the same definition file:

1. Fetch the current definition file from OneDrive (fresh copy).
2. Append the new event object to `events[]`.
3. Update `status` (and `other_label` if applicable) to match the new event.
4. Write the updated file back to OneDrive.

The fetch-before-write is mandatory on every update. The append-only nature of `events[]` means the collision window is limited to the milliseconds between fetch and write, and simultaneous transitions from two users are the only realistic collision scenario.

---

#### Completed Task Record File

**Location:** `Documents/IDMS/data/tasks/records/{year}/{equipmentCodeTop}-{year}.json`  
**No change to filename or location.**

The completed record gains ISO 14224 fields, a `close_note`, and an `outcome` field distinguishing `completed` from `cancelled`. `follow_up` is retired (superseded by the event log).

```json
{
  "schema_version": 2,
  "code_range": "601",
  "year": 2026,
  "records": [
    {
      "record_id":          "yyyyyyyy-yyyy-4yyy-zyyy-yyyyyyyyyyyy",
      "task_id":            "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "equipment_ids":      ["601.001.001.001"],
      "title":              "Investigate main engine oil pressure drop",
      "category":           "REP",
      "outcome":            "completed",
      "closed_by":          "tploch",
      "closed_at":          "2026-05-03T14:00:00.000Z",
      "hours_spent":        3.5,
      "parts_used":         "1x oil pump drive gear 601-PG-004",
      "failure_mode":       "LOO",
      "failure_mechanism":  "WEA",
      "detection_method":   "ALM",
      "close_note":         "Gear replaced. Pressure restored to normal. Monitor for 24hrs.",
      "events_snapshot":    []
    }
  ]
}
```

##### Completed record object fields

| Field               | Type     | Required | Notes |
|---------------------|----------|----------|-------|
| `record_id`         | string   | yes      | UUID v4. Generated at close. Primary key. |
| `task_id`           | string   | no       | UUID of the parent task. `null` for Manual Entry. |
| `equipment_ids`     | string[] | yes      | Asset codes. |
| `title`             | string   | yes      | Copied from the task title or entered manually. |
| `category`          | string   | yes      | Category code. |
| `outcome`           | string   | yes      | `completed` or `cancelled`. |
| `closed_by`         | string   | yes      | Username of the admin user who closed the task. |
| `closed_at`         | string   | yes      | ISO 8601 UTC. |
| `hours_spent`       | number   | no       | Time spent in hours. |
| `parts_used`        | string   | no       | Free text. |
| `failure_mode`      | string   | no       | ISO 14224 code. Required on `completed` outcome; omitted on `cancelled`. |
| `failure_mechanism` | string   | no       | ISO 14224 code. Required on `completed` outcome; omitted on `cancelled`. |
| `detection_method`  | string   | no       | ISO 14224 code. Required on `completed` outcome; omitted on `cancelled`. |
| `close_note`        | string   | no       | Closing summary. Free text. |
| `events_snapshot`   | array    | yes      | Full copy of `events[]` from the task definition at time of close. Provides self-contained history in the record file. |

**Retired fields:** `completed_by` (replaced by `closed_by`), `completed_at` (replaced by `closed_at`), `notes` (superseded by event log and `close_note`), `follow_up` (superseded by event log).

---

#### Active State File — RETIRED

`Documents/IDMS/data/tasks/active/{username}.json` is no longer written. Current task status is derived from the `status` field on the task object (which always reflects the most recent transition event). The `task_active_state` SQLite table is retired accordingly.

Existing active state files on OneDrive may be left in place; the console and PWA will ignore them.

---

### ISO 14224 Reference Tables

Three reference tables define the valid values for `failure_mode`, `failure_mechanism`, and `detection_method`. These are stored as a static config file on OneDrive and loaded into SQLite at startup.

**Location:** `Documents/IDMS/config/failuremodes.json`  
Path key in `consoleconfig.json → connections.config`: `failure_modes`

#### Failure Mode codes

| Code  | Label |
|-------|-------|
| `STR` | Structural failure |
| `LOO` | Loss of function — output |
| `LOI` | Loss of function — input |
| `PAR` | Partial loss of function |
| `INC` | Intermittent failure |
| `DEG` | Degraded performance |
| `UNI` | Unintended operation |
| `OVH` | Overheating |
| `LEK` | Leakage (external) |
| `LEI` | Leakage (internal) |
| `VIB` | Vibration |
| `NOI` | Noise / abnormal sound |
| `OTH` | Other |

#### Failure Mechanism codes

| Code  | Label |
|-------|-------|
| `COR` | Corrosion |
| `ERO` | Erosion |
| `WEA` | Wear |
| `FAT` | Fatigue |
| `OVL` | Overload |
| `CAV` | Cavitation |
| `FOL` | Fouling / blockage |
| `ELE` | Electrical fault |
| `INS` | Insulation breakdown |
| `MIS` | Misalignment |
| `INF` | Instrument / sensor failure |
| `HUM` | Human error |
| `UNK` | Unknown |
| `OTH` | Other |

#### Detection Method codes

| Code  | Label |
|-------|-------|
| `ALM` | Alarm / automatic detection |
| `OBS` | Operator observation |
| `RND` | Routine inspection / rounds |
| `TST` | Functional test |
| `MON` | Condition monitoring |
| `STV` | Scheduled service / teardown |
| `OTH` | Other |

#### failuremodes.json structure

```json
{
  "schema_version": 1,
  "failure_modes": [
    { "code": "STR", "label": "Structural failure" },
    { "code": "LOO", "label": "Loss of function — output" }
  ],
  "failure_mechanisms": [
    { "code": "COR", "label": "Corrosion" },
    { "code": "WEA", "label": "Wear" }
  ],
  "detection_methods": [
    { "code": "ALM", "label": "Alarm / automatic detection" },
    { "code": "OBS", "label": "Operator observation" }
  ]
}
```

---

### Task status lifecycle — close action

The close action is available to `admin` permission tier only. It is a distinct button ("Close Task"), not a status dropdown selection. On click it opens a modal form:

**Close Task form fields:**

| Field              | Type     | Required | Notes |
|--------------------|----------|----------|-------|
| Outcome            | Select   | yes      | `Completed` or `Cancelled`. |
| Failure Mode       | Select   | yes (if Completed) | Populated from `failuremodes.json`. Pre-filled if already set on task. |
| Failure Mechanism  | Select   | yes (if Completed) | Pre-filled if already set on task. |
| Detection Method   | Select   | yes (if Completed) | Pre-filled if already set on task. |
| Hours Spent        | Number   | no       | |
| Parts Used         | Text     | no       | |
| Closing Note       | Textarea | no       | |

On submit:
1. Appends a final `transition` event to `events[]` with `to_status: 'completed'` or `'cancelled'`.
2. Updates `status` on the task definition object.
3. Writes updated definition file to OneDrive.
4. Writes completed record (including `events_snapshot`) to the equipment record file.
5. Appends a summary entry to the asset's `event_history[]` in `data/assets/{codeRange}/{codeRange}-assets.json`.
6. If `recurring`, creates the next task instance in the definition file.

Steps 3–5 are performed as three sequential OneDrive writes. If step 4 or 5 fails, the console displays an error and retains the record for retry. The task definition write (step 3) is always attempted first as it is the authoritative state change.

---

### SQLite Tables

Tables and column definitions reflect the v2.7 state (post-ALTER TABLE migrations). See §16 for migration guidance and §18 for the full schema block including the DDL.

#### `tasks`

One row per task definition. Ingested from definition files; updated on every poll if the definition file has changed. **Default sort: `priority` ASC then `created_at` ASC.**

| Column             | Type    | Constraints               | Notes |
|--------------------|---------|---------------------------|-------|
| `task_id`          | TEXT    | PRIMARY KEY               | UUID v4. |
| `title`            | TEXT    | NOT NULL                  | |
| `equipment_ids`    | TEXT    | NOT NULL                  | JSON array string. |
| `category`         | TEXT    | NOT NULL                  | 3-letter category code. |
| `priority`         | TEXT    | NOT NULL DEFAULT 'Normal' | |
| `role`             | TEXT    | nullable                  | |
| `assigned_to`      | TEXT    | nullable                  | Username. |
| `description`      | TEXT    | nullable                  | |
| `skill_tags`       | TEXT    | nullable                  | JSON array string. |
| `status`           | TEXT    | NOT NULL DEFAULT 'open'   | |
| `other_label`      | TEXT    | nullable                  | Free text reason when status is `other`. Added v2.7. |
| `recurring`        | INTEGER | NOT NULL DEFAULT 0        | Boolean. |
| `interval`         | TEXT    | nullable                  | |
| `interval_hours`   | INTEGER | nullable                  | |
| `failure_mode`     | TEXT    | nullable                  | ISO 14224 code. Added v2.7. |
| `failure_mechanism`| TEXT    | nullable                  | ISO 14224 code. Added v2.7. |
| `detection_method` | TEXT    | nullable                  | ISO 14224 code. Added v2.7. |
| `created_at`       | TEXT    | NOT NULL                  | ISO 8601 UTC. |
| `created_by`       | TEXT    | NOT NULL                  | |
| `notes`            | TEXT    | nullable                  | |
| `code_range`       | TEXT    | NOT NULL                  | 3-digit equipment code prefix. |
| `year`             | INTEGER | NOT NULL                  | Calendar year of the definition file. |
| `ingested_at`      | TEXT    | NOT NULL                  | ISO 8601 UTC. |

**Retired column:** `due_date` — present in old rows but no longer written.

#### `task_records`

One row per completed task record. Ingested from equipment record files; idempotent via `INSERT OR REPLACE`.

| Column             | Type    | Constraints  | Notes |
|--------------------|---------|--------------|-------|
| `record_id`        | TEXT    | PRIMARY KEY  | UUID v4. |
| `task_id`          | TEXT    | nullable     | `null` for standalone manual entries. |
| `equipment_ids`    | TEXT    | NOT NULL     | JSON array string. |
| `title`            | TEXT    | NOT NULL     | |
| `category`         | TEXT    | NOT NULL     | |
| `outcome`          | TEXT    | nullable     | `completed` or `cancelled`. Null on pre-v2.7 rows — treat as `completed`. Added v2.7. |
| `closed_by`        | TEXT    | nullable     | Added v2.7. Pre-v2.7 rows carry `completed_by` instead. |
| `closed_at`        | TEXT    | nullable     | Added v2.7. Pre-v2.7 rows carry `completed_at` instead. |
| `hours_spent`      | REAL    | nullable     | |
| `parts_used`       | TEXT    | nullable     | |
| `failure_mode`     | TEXT    | nullable     | ISO 14224 code. Added v2.7. |
| `failure_mechanism`| TEXT    | nullable     | ISO 14224 code. Added v2.7. |
| `detection_method` | TEXT    | nullable     | ISO 14224 code. Added v2.7. |
| `close_note`       | TEXT    | nullable     | Added v2.7. |
| `events_snapshot`  | TEXT    | nullable     | JSON string. Full events array at time of close. Added v2.7. |
| `code_range`       | TEXT    | NOT NULL     | |
| `year`             | INTEGER | NOT NULL     | |
| `ingested_at`      | TEXT    | NOT NULL     | |

#### `task_active_state` — RETIRED

No longer populated. Retained in schema to avoid breaking existing installations. Safe to drop via `DROP TABLE IF EXISTS task_active_state`.

#### `task_events`

One row per event. Append-only. Ingested from `events[]` arrays in task definition files.

| Column       | Type | Constraints  | Notes |
|--------------|------|--------------|-------|
| `event_id`   | TEXT | PRIMARY KEY  | UUID v4. |
| `task_id`    | TEXT | NOT NULL     | FK to `tasks`. |
| `type`       | TEXT | NOT NULL     | `transition` or `comment`. |
| `actor`      | TEXT | NOT NULL     | Username. |
| `timestamp`  | TEXT | NOT NULL     | ISO 8601 UTC. |
| `from_status`| TEXT | nullable     | |
| `to_status`  | TEXT | nullable     | |
| `note`       | TEXT | nullable     | |
| `ingested_at`| TEXT | NOT NULL     | ISO 8601 UTC. |

#### `failure_modes`

Lookup table for ISO 14224 reference codes. Populated from `failuremodes.json` at startup.

| Column  | Type | Constraints         | Notes |
|---------|------|---------------------|-------|
| `code`  | TEXT | NOT NULL, PK (part) | |
| `list`  | TEXT | NOT NULL, PK (part) | `failure_mode`, `failure_mechanism`, or `detection_method`. |
| `label` | TEXT | NOT NULL            | Human-readable label. |

#### `task_skill_tags`

Unchanged from v2.3.

---

### IPC Handlers

| Handler | Direction | Description |
|---------|-----------|-------------|
| `db:ingestTasks` | renderer → main | Unchanged. Now also accepts `other_label`, `failure_mode`, `failure_mechanism`, `detection_method` fields. |
| `db:ingestTaskRecords` | renderer → main | Now also accepts `outcome`, `closed_by`, `closed_at`, ISO 14224 fields, `close_note`, `events_snapshot`. |
| `db:ingestTaskEvents` | renderer → main | **New.** Accepts `{ task_id, events[] }`. Upserts event rows into `task_events`. Returns `{ ok, upserted }`. |
| `db:ingestActiveState` | renderer → main | **Retired.** No longer called. |
| `db:getTasks` | renderer → main | Filter object gains `status[]` (replaces single `status`). `due_before` retired. Default sort: `priority` ASC then `created_at` ASC. |
| `db:getTaskEvents` | renderer → main | **New.** Accepts `{ task_id }`. Returns all events for that task ordered by `timestamp` ASC. |
| `db:getTaskRecords` | renderer → main | Unchanged. |
| `db:completeTask` | renderer → main | **Retired.** Replaced by `db:closeTask`. |
| `db:closeTask` | renderer → main | **New.** Accepts `{ task_id, record, final_event }`. Writes close record, appends final event, sets `status` to terminal value. Returns `{ ok, pending_next }`. |
| `db:confirmNextTask` | renderer → main | Unchanged. |
| `db:getSkillTags` | renderer → main | Unchanged. |
| `db:getFailureModes` | renderer → main | **New.** No arguments. Returns all rows from `failure_modes` table grouped by `list`. |

#### `db:getTasks` filter object (revised)

| Field          | Type     | Notes |
|----------------|----------|-------|
| `status`       | string[] | Array of status values. Omit for all. `'active'` expands to all non-terminal statuses. |
| `category`     | string   | Exact match. |
| `priority`     | string   | Exact match. |
| `assigned_to`  | string   | Exact match. |
| `role`         | string   | Exact match. Used for filtering; not displayed as a column. |
| `failure_mode` | string   | Exact match on code. |
| `search`       | string   | Substring match against `title`. |
| `limit`        | integer  | Default `50`. |
| `offset`       | integer  | Default `0`. |

**Retired filter fields:** `due_before`.

---

### graph.js helpers

```javascript
async function listTaskDefinitionFiles()                           // LIST data/tasks/definitions/
async function loadTaskDefinitionFile(filename)                    // GET  data/tasks/definitions/{filename}
async function saveTaskDefinitionFile(filename, data)              // PUT  data/tasks/definitions/{filename}
async function listTaskRecordFiles(year)                           // LIST data/tasks/records/{year}/
async function loadTaskEquipmentFile(year, filename)               // GET  data/tasks/records/{year}/{filename}
async function saveTaskEquipmentFile(year, filename, data)         // PUT  data/tasks/records/{year}/{filename}
async function loadFailureModes()                                  // GET  config/failuremodes.json
async function saveTaskActiveWrite(codeRange, year, taskObj)       // Fetch-append-write for single task update
async function loadAssetFile(codeRange)                            // GET  data/assets/{codeRange}/{codeRange}-assets.json
async function saveAssetFile(codeRange, data)                      // PUT  data/assets/{codeRange}/{codeRange}-assets.json
```

`saveTaskActiveWrite` encapsulates the mandatory fetch-before-write pattern for task updates: fetches the current definition file, finds the task by `task_id`, applies the update, writes back. Used for status transitions, comment appends, and ISO 14224 field updates.

**Retired helpers:** `listTaskActiveStateFiles`, `loadTaskActiveStateFile` — no longer called.

Definition filenames follow the pattern `tasks-{codeRange}-{year}.json`. Equipment record filenames follow `{equipmentCodeTop}-{year}.json`.

---

### Console UI behaviour

The Tasks & Maintenance screen (Operations → Tasks & Maintenance) is a four-tab screen using the standard `cs-tab-bar` / `cs-tab` pattern.

---

#### Tab 1 — Active Tasks (formerly All Tasks)

Displays all non-terminal tasks (`status` not in `completed`, `cancelled`). Refreshes from OneDrive on every tab open.

**Task list columns (left to right):**

| Column | Notes |
|---|---|
| Priority | Badge. `Critical` = red, `High` = amber, `Normal` = grey, `Low` = slate. Editable inline via dropdown. |
| Created | `created_at` formatted as `YYYY-MM-DD HH:MM`. |
| Equipment | Asset code on first line, asset name on second line. |
| Description | Task `title`. |
| Assigned | `assigned_to` display name, or `— Unassigned —` if null. |
| Status | Current status badge. Editable inline via dropdown (all active statuses). When `other` selected, a text input appears for `other_label`. |
| Category | 3-letter code badge with colour (unchanged from v2.3). |
| Failure Mode | ISO 14224 code badge if set, `—` if not. Editable inline via dropdown. |

**Default sort:** Priority ascending (Critical first), then `created_at` ascending (oldest first).

**Filters:** Status (Active / Open / Investigating / Waiting Parts / Waiting Opportunity / Shipyard / Other) · Category · Priority · Assigned To · Role (hidden column, filter only) · Search (title).

**Expanded row (click anywhere on row):**

Shows the full event log thread in chronological order. Each entry displays:
- Actor display name + timestamp
- For `transition` entries: status change badge (`from → to`) + note
- For `comment` entries: comment text only, no badge

**Actions in expanded row:**
- **Add Comment** — text input + submit. Appends a `comment` event. Available to all users.
- **Update Status** — status dropdown + optional note + submit. Appends a `transition` event. Available to all users.
- **Update Failure Mode** — three dropdowns (mode, mechanism, detection). Updates task fields directly; does not append an event. Available to all users.
- **Close Task** — opens close modal (admin tier only). See close action spec above.

---

#### Tab 2 — Closed Tasks (formerly Due & Assigned)

Displays completed and cancelled tasks from `task_records` in SQLite.

**Task list columns (left to right):**

| Column | Notes |
|---|---|
| Priority | Badge (read-only). |
| Closed | `closed_at` formatted as `YYYY-MM-DD HH:MM`. |
| Equipment | Asset code + name. |
| Description | `title`. |
| Closed By | Display name of the user who closed. |
| Outcome | `Completed` (green) or `Cancelled` (grey) badge. |
| Category | Code badge. |
| Failure Mode | ISO 14224 code badge, or `—` if cancelled without findings. |

**Expanded row:** Shows `events_snapshot` thread (read-only), ISO 14224 fields, hours spent, parts used, close note.

**Filters:** Outcome · Category · Failure Mode · Failure Mechanism · Search · Date range (closed_at).

---

#### Tab 3 — Create Task (unchanged structure, field changes)

`due_date` field removed. No other structural changes to the form. `failure_mode`, `failure_mechanism`, `detection_method` fields added as optional dropdowns (populated from `failuremodes.json`).

**Fields:**

| Field              | Type                    | Notes |
|--------------------|-------------------------|-------|
| Title              | Text input              | Required. |
| Equipment          | Asset search + tag list | Multi-select. Type-ahead search against `assets.csv`. |
| Category           | Select                  | 9 options (see category reference above). |
| Priority           | Select                  | Critical / High / Normal / Low. Default: Normal. |
| Role               | Text input              | Optional. Role label for assignment filtering. |
| Assigned To        | Text input              | Optional. Specific username. |
| Description        | Textarea                | Optional. Work instructions. |
| Skill Tags         | Multi-select dropdown   | Optional. Tags from `task_skill_tags`. |
| Recurring          | Checkbox                | Enables interval fields when checked. |
| Interval           | Select                  | Visible when Recurring is checked. |
| Interval Hours     | Number input            | Visible when Interval is `CUSTOM`. |
| Failure Mode       | Select                  | Optional. Populated from `failuremodes.json`. |
| Failure Mechanism  | Select                  | Optional. Populated from `failuremodes.json`. |
| Detection Method   | Select                  | Optional. Populated from `failuremodes.json`. |

On submit: generates a `task_id` (UUID), creates the creation `transition` event in `events[]`, determines the `code_range` from the first equipment code, writes/updates the definition file on OneDrive, then ingests into SQLite.

---

#### Tab 4 — Manual Entry (unchanged structure, field changes)

Allows recording a completion without a pre-created task. `failure_mode`, `failure_mechanism`, `detection_method` fields added — required for manual entries since they represent completed work with known findings. `follow_up` field removed.

**Fields:**

| Field              | Type           | Notes |
|--------------------|----------------|-------|
| Title              | Text input     | Required. Work description. |
| Equipment          | Asset search + tag list | Multi-select. Same pattern as Create Task tab. |
| Category           | Select         | 9 options. |
| Date               | Date input     | Defaults to today. |
| Time               | Time input     | Defaults to current vessel local time. |
| Hours Spent        | Number input   | Optional. |
| Parts Used         | Text input     | Optional. |
| Close Note         | Textarea       | Optional. |
| Failure Mode       | Select         | Required. Populated from `failuremodes.json`. |
| Failure Mechanism  | Select         | Required. Populated from `failuremodes.json`. |
| Detection Method   | Select         | Required. Populated from `failuremodes.json`. |

On submit: generates a `record_id` (UUID), sets `task_id = null`, sets `outcome = 'completed'`, writes the record to the equipment record file on OneDrive, then ingests into SQLite. No task status is modified.

---

## §33 — Oil Record Book

**Status:** Not built
**File:** `oilrecord.js`
**Location:** Operations → Oil Record Book

Auto-drafted from Fuel & Liquids interactions. Organised by ORB Part II codes.

**Auto-populating triggers:**

- Fuel transfer → relevant ORB code
- Bunkering → relevant ORB code
- Oily water separator run → relevant ORB code
- Sludge disposal → relevant ORB code (manual trigger)

**Review cycle:** weekly. Operator marks a batch of entries as transcribed to the physical ORB. Transcribed entries are locked (display only).

**Storage:** `data/orb/orb-{YYYY}.json`, one file per calendar year.

---

## §34 — Messages

**Status:** Not built
**File:** `messages.js`
**Location:** Personnel → Messages

**Message types:**

- Direct: one crew member to another
- Department broadcast: all active crew in a department
- Vessel broadcast: all active crew aboard

**Delivery model:** OneDrive polling. No real-time push. Message files written to `data/messages/`. Field PWA polls on sync cycle; console polls on ingest cycle.

**Notification rules:** notify only if recipient `status = active` AND `vessel = F/T ARAHO` AND current time falls within their watch rotation. Watch rotation field is deferred — initial implementation uses `active + aboard` as proxy.

---

## §35 — KSA Profiles

**Status:** Not built
**Location:** Personnel → Crew Profiles (embedded tab)

Skill categories defined in Config → Crew Setup.

**KSA record per crew member per skill:**

| Field              | Type     | Notes                                                       |
|--------------------|----------|-------------------------------------------------------------|
| `skill_id`         | string   | References a defined skill category                         |
| `task_completions` | integer  | Count of tasks completed carrying this skill tag            |
| `asset_history`    | string[] | Array of asset codes this crew member has worked on         |
| `last_activity`    | string   | Date of most recent qualifying task closure                 |
| `supervisor_score` | integer  | Optional manual override score (1–5), set by admin          |
| `notes`            | string   | Free text from contract review                              |

**Storage:** embedded within `crewconfig.json` as `ksa` array on each crew member object, or as separate `ksaprofiles.json` if file size becomes a concern.

---

## §36 — Navigation & Weather

**Status:** Not built
**Location:** Embedded block on Overview → Dashboard

**Manual inputs:**

- Current position (lat/lon) — entered at midnight, triggers daily report compilation
- Speed over ground (knots) — used for ETA calculation
- Destination port — selected from `portsconfig.json`

**Calculated outputs:**

- Distance to destination (nm) — great circle calculation (Haversine formula) 
- ETA — current position + distance ÷ speed, expressed in destination port's local timezone

**Future integrations (deferred):**

- Weather API — forecast for current position and destination port
- Map view — vessel position on a chart (Google Maps API or similar)

**Storage:** midnight position entries stored in `trip_daily_logs` (existing field). No new file required for basic navigation data.

---

## §37 — Factory Production Module

**Status:** Built (v2.6)  
**File:** `src/renderer/js/production.js`  
**Screen key:** `factory-production`  
**Nav group:** Factory  
**Permission gate:** `factory/production` resource key (admin / standard / observer tiers)

---

### 37.1 Overview

The Factory Production module tracks daily midnight-MT production figures, capacity observations from factory equipment, and line section theoretical throughput. It is a 4-tab screen: **Overview**, **Today**, **Observations**, and **Setup**.

---

### 37.2 OneDrive file locations

All paths are relative to `Documents/IDMS/` (the `ONEDRIVE_BASE` constant in `graph.js`).

| File | Path | Description |
|------|------|-------------|
| Production state | `data/factory/production/production-state.json` | Trip-scoped daily MT entries |
| Capacity log (per day) | `data/factory/production/capacity-{YYYY-MM-DD}.json` | Hourly capacity observations for one date |
| Factory config | `config/factoryconfig.json` | Vessel config; `production` section (schema_version 2) |

---

### 37.3 production-state.json

```json
{
  "trip_number": 12,
  "last_updated": "2026-04-29T00:05:00Z",
  "daily_entries": [
    {
      "entry_date":  "2026-04-28",
      "midnight_mt": 45.2,
      "source":      "email",
      "fetched_at":  "2026-04-29T00:05:00Z",
      "notes":       "Daily Production Report"
    }
  ]
}
```

**Field notes:**
- `trip_number` — matches `trips.trip_number` in SQLite
- `source` — `"email"` | `"manual"`
- `fetched_at` — ISO 8601 UTC; null for manually entered records
- Keyed by `(trip_number, entry_date)` — one row per calendar day per trip

---

### 37.4 capacity-{YYYY-MM-DD}.json

```json
{
  "obs_date": "2026-04-29",
  "observations": [
    {
      "obs_id":        "3f8c1a2b-7d4e-4f90-b123-000000000001",
      "obs_timestamp": "2026-04-29T08:30:00Z",
      "section_id":    "3e4a5f6b-7c8d-4e0f-a1b2-000000000001",
      "section_label": "Plate Freezers",
      "observed_rate": 48.5,
      "rate_unit":     "mt/day",
      "operator":      "J. Smith",
      "wind_speed_kt": 12.5,
      "sea_state_ft":  4.0,
      "notes":         "",
      "source":        "manual"
    }
  ]
}
```

**Field notes:**
- `obs_id` — UUID v4; used as upsert key
- `rate_unit` — `"mt/day"` | `"pans/min"` | `"cases/hr"`
- `source` — `"manual"` (console entry) | `"pwa"` (field device submission)
- `wind_speed_kt`, `sea_state_ft` — nullable

---

### 37.5 factoryconfig.json — production section (schema_version 2)

The `production` block lives inside `factoryconfig.json` alongside the `equipment` and `categories` arrays. The outer `schema_version` (integer 2) governs the overall factoryconfig structure.

#### 37.5.1 Top-level production fields

```json
{
  "production": {
    "reset_time":              "00:00",
    "target_species":          null,
    "trip_capacity_mt":        null,
    "species_baseline_avg_mt": null,
    "pan_volume_l":            null,
    "pan_gross_weight_kg":     null,
    "pan_target_overpack_pct": null,
    "email_subject_filter":    "Daily Production Report",
    "email_source_address":    null,
    "bottleneck_mt_per_day":   null,
    "line_sections":           []
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `reset_time` | string `"HH:MM"` | Daily midnight reset time (local vessel time). |
| `target_species` | string \| null | Selected fishery/species for baseline comparison. Populated from distinct `fishery_target` values in the `trips` table. |
| `trip_capacity_mt` | number \| null | Full trip hold capacity in metric tonnes. Used for Trip Capacity % stat. |
| `species_baseline_avg_mt` | number \| null | Manually confirmed or auto-populated average daily production (MT) for the selected species, drawn from historical daily logs. |
| `pan_volume_l` | number \| null | Pan internal volume in litres. Used to derive density. |
| `pan_gross_weight_kg` | number \| null | Pan gross fill weight in kg (pan + ice + product at full fill). |
| `pan_target_overpack_pct` | number \| null | Percentage of gross weight that is overpack. Net weight = gross × (1 − overpack/100). |
| `email_subject_filter` | string | Substring matched against email subjects when fetching DPR emails. |
| `email_source_address` | string \| null | Shared mailbox address for DPR email ingestion. |
| `bottleneck_mt_per_day` | number \| null | Auto-calculated: minimum `theoretical_mt_per_day` across all enabled sections (null sections excluded). Written back on each Setup save. |

**Pan derived values (computed in UI, not stored):**

| Derived value | Formula |
|---------------|---------|
| Density (kg/L) | `pan_gross_weight_kg / pan_volume_l` |
| Net weight (kg) | `pan_gross_weight_kg × (1 − pan_target_overpack_pct / 100)` |

---

#### 37.5.2 Line section object

```json
{
  "section_id":              "3e4a5f6b-7c8d-4e0f-a1b2-000000000001",
  "label":                   "Plate Freezers",
  "type":                    "plate_freezer",
  "equipment_group_code":    null,
  "equipment_subgroup_code": null,
  "sub_assets":              [],
  "enabled":                 true,
  "theoretical_mt_per_day":  null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `section_id` | string (UUID) | Stable identifier. Never changes once created. |
| `label` | string | Display name shown in Setup and Observations. |
| `type` | string | One of: `plate_freezer`, `header`, `throughput`, `belt`, `packing`. |
| `equipment_group_code` | string \| null | Asset register group code. Scopes asset search for sub-asset assignment. |
| `equipment_subgroup_code` | string \| null | Sub-group code within the group. Further scopes asset search. |
| `sub_assets` | array | Sub-asset objects (see §37.5.3). Empty until configured. |
| `enabled` | boolean | If false, section is excluded from bottleneck calculation and UI display. |
| `theoretical_mt_per_day` | number \| null | Auto-calculated and stored on each Setup save. null for belt/packing sections. |

**Type-specific section-level fields (additional, only present on the relevant type):**

| Type | Extra field | Type | Notes |
|------|-------------|------|-------|
| `header` | `belt_speed_ms` | number \| null | Belt speed in metres per second (section level). |
| `header` | `fish_per_minute` | number \| null | Fish processing rate (section level). |

---

#### 37.5.3 Sub-asset object

Every sub-asset carries a common base set of fields regardless of section type. Type-specific fields are additional.

**Base fields (all types):**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (UUID) | Stable identifier generated on add. |
| `label` | string | Free-text name (e.g. "PF #1", "Station A"). |
| `asset_code` | string \| null | Asset register code from `assets.csv`. |
| `asset_name` | string \| null | Asset display name from `assets.csv`. |
| `arrangement` | string | One of: `"series"`, `"parallel"`, `"series_parallel"`. |
| `order` | integer \| null | Position in the section's processing sequence. |
| `sub_order` | integer \| null | Series/Parallel group number. Only used when `arrangement = "series_parallel"`. Groups with the same `sub_order` run in parallel; groups run in series by ascending `sub_order`. |
| `ranking` | integer \| null | Priority rank within a `sub_order` group. Only used when `arrangement = "series_parallel"`. Lower rank = higher priority within the group. |

**Arrangement topology rules:**

| Arrangement | Behaviour on failure |
|-------------|----------------------|
| `series` | All units in the section halt. Full theoretical MT loss. |
| `parallel` | Only the failed unit's share of theoretical MT is deducted. Other units continue. |
| `series_parallel` | Units sharing a `sub_order` are parallel; `sub_order` groups are in series. A failure in any unit in a group halts that group. Loss = that group's share. |

**Type-specific sub-asset fields:**

| Section type | Field | Type | Notes |
|--------------|-------|------|-------|
| `plate_freezer` | `no_of_plates` | integer \| null | Number of plates in the freezer. |
| `plate_freezer` | `pans_per_plate` | number \| null | Pans per plate per freeze cycle. |
| `plate_freezer` | `freeze_cycle_minutes` | number \| null | Duration of one freeze cycle in minutes. |
| `plate_freezer` | `defrost_minutes` | number \| null | Duration of defrost cycle in minutes (optional). |
| `plate_freezer` | `time_between_defrosts_hours` | number \| null | Hours of run time between defrosts (optional). |
| `throughput` | `pans_per_minute` | number \| null | Processing rate in pans per minute. |
| `belt` | `belt_speed_ms` | number \| null | Belt speed in metres per second. |
| `packing` | `minutes_per_pan` | string \| null | Free-text packing rate, e.g. `"4–6 min"`. |

---

#### 37.5.4 Section types and theoretical MT formulae

| Type | Theoretical formula | Notes |
|------|---------------------|-------|
| `plate_freezer` | Sum across sub-assets: `cyclesPerDay × no_of_plates × pans_per_plate × netKg / 1000` | `cyclesPerDay` = `1440 / freeze_cycle_minutes` (simple) or, when defrost is configured: `floor(runMin / freeze_cycle_minutes) × (1440 / (runMin + defrost_minutes))` where `runMin = time_between_defrosts_hours × 60`. `netKg` = global pan net weight. |
| `throughput` | Sum across sub-assets: `pans_per_minute × 1440 × netKg / 1000` | `netKg` = global pan net weight. |
| `header` | null (no formula) | Belt speed and fish/min are informational only. |
| `belt` | null (no formula) | Belt speed per sub-asset is informational only. |
| `packing` | null (no formula) | Minutes per pan is informational only. |

**Global pan net weight:** `netKg = pan_gross_weight_kg × (1 − pan_target_overpack_pct / 100)`. Null if either input is null.

**Bottleneck:** minimum `theoretical_mt_per_day` across all enabled sections where the value is not null. Stored in `production.bottleneck_mt_per_day` on each Setup save.

---

#### 37.5.5 Pre-configured section UUIDs for F/V Araho

| section_id | label | type |
|------------|-------|------|
| `3e4a5f6b-7c8d-4e0f-a1b2-000000000001` | Plate Freezers | `plate_freezer` |
| `3e4a5f6b-7c8d-4e0f-a1b2-000000000002` | Headers | `header` |
| `3e4a5f6b-7c8d-4e0f-a1b2-000000000003` | Pan Breaking | `throughput` |
| `3e4a5f6b-7c8d-4e0f-a1b2-000000000004` | Case-Up | `throughput` |
| `3e4a5f6b-7c8d-4e0f-a1b2-000000000005` | Conveyor Belts | `belt` |
| `3e4a5f6b-7c8d-4e0f-a1b2-000000000006` | Packing Station | `packing` |
| `3e4a5f6b-7c8d-4e0f-a1b2-000000000007` | Back Line | `belt` |

---

#### 37.5.6 factoryconfig.json — equipment list (F/V Araho)

```json
{
  "equipment": [
    { "group": "Freezing",            "items": ["Plate Freezer #1", "Plate Freezer #2", "Plate Freezer #3", "Plate Freezer #4", "Plate Freezer #5"] },
    { "group": "Breaking & Case Up",  "items": ["Breaking Station 1", "Breaking Station 2", "Case Up"] },
    { "group": "Back Line & Packing", "items": ["Back Line", "Header #1", "Header #2", "Packing Stations"] },
    { "group": "General",             "items": ["Conveyor Belts", "Air Compressor", "Forklift"] }
  ],
  "presets_default": [
    { "equipment": "Plate Freezer #1",   "category": "Mechanical jam", "label": "PLATE FREEZER JAM"   },
    { "equipment": "Breaking Station 1", "category": "Mechanical jam", "label": "BREAKING STATION JAM" }
  ]
}
```

---

### 37.6 SQLite tables

#### production_entries

```sql
CREATE TABLE IF NOT EXISTS production_entries (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_number      INTEGER NOT NULL,
  entry_date       TEXT NOT NULL,
  midnight_mt      REAL NOT NULL,
  source           TEXT NOT NULL DEFAULT 'manual',
  fetched_at       TEXT,
  notes            TEXT DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(trip_number, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_prod_entries_trip ON production_entries(trip_number, entry_date);
```

#### capacity_observations

```sql
CREATE TABLE IF NOT EXISTS capacity_observations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  obs_id           TEXT NOT NULL UNIQUE,
  obs_date         TEXT NOT NULL,
  obs_timestamp    TEXT NOT NULL,
  section_id       TEXT NOT NULL,
  section_label    TEXT NOT NULL,
  observed_rate    REAL NOT NULL,
  rate_unit        TEXT NOT NULL,
  operator         TEXT NOT NULL,
  wind_speed_kt    REAL,
  sea_state_ft     REAL,
  notes            TEXT DEFAULT '',
  source           TEXT NOT NULL DEFAULT 'pwa',
  ingested_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cap_obs_date    ON capacity_observations(obs_date);
CREATE INDEX IF NOT EXISTS idx_cap_obs_section ON capacity_observations(section_id, obs_date);
```

#### production_config_snapshots

```sql
CREATE TABLE IF NOT EXISTS production_config_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date    TEXT NOT NULL,
  trip_number      INTEGER,
  config_json      TEXT NOT NULL,
  saved_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### 37.7 IPC handlers (main process)

All handlers are synchronous (better-sqlite3). Registered in `main.js`.

#### Core production handlers

| Channel | Payload / args | Returns |
|---------|---------------|---------|
| `db:ingestProductionState` | `{ trip_number, daily_entries[] }` | `{ ok, count }` |
| `db:ingestCapacityLog` | `{ obs_date, observations[] }` | `{ ok, count }` |
| `db:getProductionEntries` | `{ trip_number }` | `production_entries[]` ordered by `entry_date ASC` |
| `db:getCapacityObservations` | `{ obs_date?, section_id? }` | `capacity_observations[]` |
| `db:saveProductionConfig` | `{ snapshot_date, trip_number?, config_json }` | `{ ok }` |
| `db:getLatestProductionConfig` | — | Most recent `production_config_snapshots` row, or null |

**Upsert keys:**
- `production_entries`: `(trip_number, entry_date)`
- `capacity_observations`: `obs_id`

#### Asset group / sub-asset lookup handlers

| Channel | Payload / args | Returns |
|---------|---------------|---------|
| `db:getEquipmentGroups` | `{ dept? }` (optional department filter) | `equipment_groups[]` — each row: `{ code, label, dept, … }` |
| `db:getAssetChildren` | `parentCode` (string) | Array of child group objects `{ code, name }` for the given parent group code |
| `db:searchAssetsByGroup` | `query` (string), `groupCode` (string), `limit` (integer, default 30) | `assets[]` matching the query within the specified group scope |

#### Species baseline handlers

| Channel | Payload / args | Returns |
|---------|---------------|---------|
| `db:getDistinctFisheries` | — | `string[]` — distinct `fishery_target` values from `trips` table, alphabetically sorted, excluding null/empty |
| `db:getProductionAvgByFishery` | `fishery` (string) | `number \| null` — average daily production (MT/day) across all closed trips with the matching `fishery_target`. Seed-import trips use `prod_avg_day_mt` from the notes field (or `total_prod_mt / days_at_sea` as fallback). Live trips use `total_prod_mt / log_days`. Returns null if no usable data. |

---

### 37.8 preload.js bindings

All production-related bindings exposed via `contextBridge` under `window.idms.db`:

```javascript
// Core production
ingestProductionState:     (payload) => ipcRenderer.invoke('db:ingestProductionState', payload),
ingestCapacityLog:         (payload) => ipcRenderer.invoke('db:ingestCapacityLog', payload),
getProductionEntries:      (opts)    => ipcRenderer.invoke('db:getProductionEntries', opts),
getCapacityObservations:   (opts)    => ipcRenderer.invoke('db:getCapacityObservations', opts),
saveProductionConfig:      (payload) => ipcRenderer.invoke('db:saveProductionConfig', payload),
getLatestProductionConfig: ()        => ipcRenderer.invoke('db:getLatestProductionConfig'),

// Asset group lookups
getEquipmentGroups:  (opts)                    => ipcRenderer.invoke('db:getEquipmentGroups', opts),
getAssetChildren:    (parentCode)              => ipcRenderer.invoke('db:getAssetChildren', parentCode),
searchAssetsByGroup: (query, groupCode, limit) => ipcRenderer.invoke('db:searchAssetsByGroup', query, groupCode, limit),

// Species baseline
getDistinctFisheries:      ()        => ipcRenderer.invoke('db:getDistinctFisheries'),
getProductionAvgByFishery: (fishery) => ipcRenderer.invoke('db:getProductionAvgByFishery', fishery),
```

---

### 37.9 graph.js helpers

Added to `src/renderer/js/graph.js`:

| Function | Description |
|----------|-------------|
| `saveDeptConfig(deptKey, cfg)` | Writes `config/{deptKey}config.json` to OneDrive |
| `loadProductionState()` | Reads `data/factory/production/production-state.json` |
| `saveProductionState(state)` | Writes `production-state.json` |
| `loadCapacityLog(dateStr)` | Reads `capacity-{dateStr}.json` |
| `saveCapacityLog(dateStr, data)` | Writes `capacity-{dateStr}.json` |
| `graphMailFetch(url)` | GET request to any Graph API URL with Bearer auth; throws `err.status = 403` on Access Denied |

---

### 37.10 Ingest poller additions

`pollNow()` in `ingest.js` calls `pollProductionData(todayStr)` each cycle.

- Polls `production-state.json` → `db:ingestProductionState`
- Polls `capacity-{today}.json` → `db:ingestCapacityLog`
- On first poll after midnight (date change): also polls `capacity-{yesterday}.json`
- 404 responses silently skipped (file not yet created)

---

### 37.11 Email ingestion

On the Overview tab, admin/standard users see a **Fetch from DPR Email** panel.

**API call:**
```
GET https://graph.microsoft.com/v1.0/users/{email_source_address}/mailFolders/inbox/messages
  ?$filter=receivedDateTime ge {today}T00:00:00Z and contains(subject,'{email_subject_filter}')
  &$top=1
  &$select=subject,receivedDateTime,from,body
```

**MT extraction regex:**
```
/(?:midnight|total|production)[^\d]*(\d{1,4}(?:\.\d{1,3})?)\s*(?:mt|tonnes?)/i
```

**State machine:** `idle` → `fetching` → `found` | `notfound` | `error` → (on save) `saving` → `idle`

**Error states:**
- 403: display "Access denied — check Mail API permissions."
- No match: display "No matching email found for today."
- Parse failure: display specific error message

**On save:** entry is appended to `production-state.json` on OneDrive with `source: "email"`, then ingested to SQLite. Page re-renders.

---

### 37.12 Weighted rolling average

Used in the Overview tab chart (dashed green line) and stat cards.

- **Day 1:** `(species_baseline_avg_mt × 10 + actual_mt) / 11`
- **Day N > 1:** mean of all entries for the trip

`species_baseline_avg_mt` is configured in Setup → Production Settings. It is auto-populated when the user selects a Target Species — the console fetches the historical average via `db:getProductionAvgByFishery` and writes it into the baseline field. The user can then confirm or override the value before saving.

---

### 37.13 UI behaviour

**Tab: Overview**
- Stat strip: Trip Total, Days Recorded, Last Day, Weighted Avg, Bottleneck, Trip Capacity % (if configured)
- Canvas chart: bars = actual MT per day; dashed green line = weighted rolling average; solid purple line = cumulative total; dashed orange line = bottleneck ceiling
- Email fetch panel (admin/standard only): inline, not modal

**Tab: Today**
- Canvas 24-hour chart: orange background bars = theoretical ceiling per hour; blue dots = observed rates per hour bucket; solid green dashed line = daily average; orange dashed line = bottleneck/24
- Observation list below chart

**Tab: Observations**
- Filter bar: section dropdown, date-from, date-to, clear button
- Table: date, time, section, rate, unit, operator, notes
- Add Observation form (admin/standard only): section, rate, unit, timestamp, wind, sea state, notes
- Submitting: writes to `capacity-{date}.json` on OneDrive, then ingests to SQLite

**Tab: Setup**
- Collapsible cards: Production Settings, Email Settings, Line Sections (one card per section)
- **Production Settings card:** Target Species dropdown (auto-populates Species Baseline Avg MT/day from historical logs on selection), Trip Capacity, Species Baseline Avg MT/day (editable override), global Pan Specification block (Pan Volume, Gross Weight, Target Overpack %; derived Density and Net Weight displayed read-only)
- **Line section card:** shows section type badge, current theoretical MT/day, Group / Sub-group asset scope selectors, sub-asset list with inline add/remove
- **Sub-asset row fields:** label, asset code autocomplete, Arrangement dropdown (Series / Parallel / Series_Parallel), Order, Sub-order (visible for series_parallel only), Ranking (visible for series_parallel only), plus type-specific fields (see §37.5.3)
- Save button writes `factoryconfig.json` to OneDrive, recalculates theoretical MT and bottleneck, saves config snapshot to SQLite
- Bottleneck indicator: displays limiting section label and MT/day value
- All writes are admin-only; standard/observer see read-only view

**Error guards:**
- If `factoryconfig.production` is absent: display "not configured" banner
- If 403 on mail API: display specific "Access denied" message
- Null `bottleneck_mt_per_day`: display `—`
- Null `theoretical_mt_per_day` for header/belt/packing sections: display `—`, excluded from bottleneck calculation
- Autocomplete dropdowns: `position: absolute` — ancestor elements must not carry `overflow: hidden` (would clip the dropdown regardless of z-index)

---

## §38 — Asset Records

**Status:** New (v2.7)  
**File:** `assets.js` (new module) or integrated into `tasks.js` (TBD at implementation)  
**Location:** Asset history is accessed via expanded task rows and a future dedicated Asset History screen.

---

### Overview

Each equipment asset maintains a persistent record file on OneDrive containing its full work history, last rounds check timestamp, and oil addition history. The asset record is the longitudinal view of an asset's lifecycle — portable with the asset if it is transferred or renumbered.

Asset records are grouped by equipment code range, one JSON file per range. The console writes to asset records on task close. The rounds engine writes `last_round` on each rounds completion (out of scope for this version). Oil history is written via a dedicated oil log action (out of scope for this version).

---

### OneDrive file

**Location:** `Documents/IDMS/data/assets/{codeRange}/{codeRange}-assets.json`

**Written by:** Console (on task close; on oil log entry)  
**Read by:** Console (asset history display; task close workflow)

```json
{
  "schema_version": 1,
  "code_range": "601",
  "assets": [
    {
      "item_id":    "uuid-v4-stable-permanent",
      "asset_no":   "601.001.001.001",
      "asset_name": "Main Engine",
      "last_round": "2026-05-03T08:15:00.000Z",

      "event_history": [
        {
          "task_id":    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
          "title":      "Investigate main engine oil pressure drop",
          "category":   "REP",
          "outcome":    "completed",
          "opened_at":  "2026-05-03T08:00:00.000Z",
          "closed_at":  "2026-05-03T14:00:00.000Z",
          "closed_by":  "tploch",
          "failure_mode":       "LOO",
          "failure_mechanism":  "WEA",
          "detection_method":   "ALM"
        }
      ],

      "oil_history": [
        {
          "added_at":  "2026-05-01T08:30:00.000Z",
          "amount_l":  20.5,
          "oil_type":  "Mobilgard 410 NC",
          "hours":     14250
        }
      ]
    }
  ]
}
```

#### Asset object fields

| Field           | Type   | Required | Notes |
|-----------------|--------|----------|-------|
| `item_id`       | string | yes      | UUID v4. Stable permanent identifier. Never changes even if `asset_no` or `asset_name` changes. Generated at first record creation. |
| `asset_no`      | string | yes      | TM-Master asset code. E.g. `"601.001.001.001"`. Matches `assets.csv`. |
| `asset_name`    | string | yes      | Display name. Copied from `assets.csv` at record creation. |
| `last_round`    | string | no       | ISO 8601 UTC. Timestamp of the most recent rounds check for this asset. Overwritten on each check; full history in rounds logs. |
| `event_history` | array  | yes      | Append-only. One entry per closed task that references this asset. |
| `oil_history`   | array  | yes      | Append-only. One entry per oil addition. |

#### Event history entry fields

| Field              | Type   | Required | Notes |
|--------------------|--------|----------|-------|
| `task_id`          | string | yes      | UUID of the originating task. Join key to `task_records`. |
| `title`            | string | yes      | Task title at time of close. |
| `category`         | string | yes      | Category code. |
| `outcome`          | string | yes      | `completed` or `cancelled`. |
| `opened_at`        | string | yes      | ISO 8601 UTC. `created_at` from the task. |
| `closed_at`        | string | yes      | ISO 8601 UTC. |
| `closed_by`        | string | yes      | Username of the closing user. |
| `failure_mode`     | string | no       | ISO 14224 code. Omitted on cancelled tasks. |
| `failure_mechanism`| string | no       | ISO 14224 code. Omitted on cancelled tasks. |
| `detection_method` | string | no       | ISO 14224 code. Omitted on cancelled tasks. |

#### Oil history entry fields

| Field      | Type   | Required | Notes |
|------------|--------|----------|-------|
| `added_at` | string | yes      | ISO 8601 UTC. |
| `amount_l` | number | yes      | Volume added in litres. |
| `oil_type` | string | yes      | Free text. E.g. `"Mobilgard 410 NC"`. |
| `hours`    | number | no       | Asset hours meter reading at time of addition. Omitted if asset has no hours meter. |

---

### SQLite tables

See §18 for the full DDL. Tables added via `CREATE TABLE IF NOT EXISTS` on console startup.

#### `asset_records`

One row per asset. Upserted on every ingest of the asset file.

| Column       | Type | Constraints  | Notes |
|--------------|------|--------------|-------|
| `item_id`    | TEXT | PRIMARY KEY  | Stable UUID. |
| `asset_no`   | TEXT | NOT NULL     | TM-Master code. |
| `asset_name` | TEXT | NOT NULL     | Display name. |
| `last_round` | TEXT | nullable     | ISO 8601 UTC. |
| `code_range` | TEXT | NOT NULL     | 3-digit range prefix. |
| `ingested_at`| TEXT | NOT NULL     | ISO 8601 UTC. |

#### `asset_event_history`

One row per event history entry. Replaced in full for each `item_id` on ingest.

| Column             | Type    | Constraints               | Notes |
|--------------------|---------|---------------------------|-------|
| `id`               | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `item_id`          | TEXT    | NOT NULL                  | FK to `asset_records`. |
| `task_id`          | TEXT    | NOT NULL                  | |
| `title`            | TEXT    | NOT NULL                  | |
| `category`         | TEXT    | NOT NULL                  | |
| `outcome`          | TEXT    | NOT NULL                  | |
| `opened_at`        | TEXT    | NOT NULL                  | |
| `closed_at`        | TEXT    | NOT NULL                  | |
| `closed_by`        | TEXT    | NOT NULL                  | |
| `failure_mode`     | TEXT    | nullable                  | |
| `failure_mechanism`| TEXT    | nullable                  | |
| `detection_method` | TEXT    | nullable                  | |
| `ingested_at`      | TEXT    | NOT NULL                  | |

**Note:** `oil_history` is not given its own SQLite table in this version — oil entries are low-frequency and the asset file is the source of truth. A dedicated `asset_oil_history` table can be added when the oil log module is built.

---

### IPC Handlers

| Handler | Direction | Description |
|---------|-----------|-------------|
| `db:ingestAssetRecords` | renderer → main | Accepts `{ assets[] }` from a loaded asset file. Upserts `asset_records` rows; replaces `asset_event_history` rows for each `item_id` present in the payload. Returns `{ ok, upserted }`. |
| `db:getAssetRecord` | renderer → main | Accepts `{ item_id }`. Returns the asset record row plus all event history rows for that asset, ordered by `closed_at` ASC. |
| `db:getAssetByCode` | renderer → main | Accepts `{ asset_no }`. Returns the matching asset record. Useful for lookups from task equipment tags. |
| `db:appendAssetEvent` | renderer → main | Accepts `{ item_id, event }`. Appends one event history row. Called as part of the close task sequence. Returns `{ ok }`. |

---

### graph.js helpers

```javascript
async function loadAssetFile(codeRange)           // GET  data/assets/{codeRange}/{codeRange}-assets.json
async function saveAssetFile(codeRange, data)     // PUT  data/assets/{codeRange}/{codeRange}-assets.json
async function appendAssetEvent(codeRange, itemId, eventEntry)
  // Fetch-append-write: loads asset file, finds asset by item_id,
  // appends to event_history[], writes back. Called on task close.
```

---

### Asset record initialisation

Asset records are created lazily — a `{codeRange}-assets.json` file is created the first time a task for that code range is closed. The `item_id` for each asset is generated at first record creation and must remain stable. If an asset file already exists for that code range, the close workflow fetches it, finds the matching asset by `asset_no`, and appends to its `event_history`. If no matching asset exists in the file, a new asset object is added.

The `item_id` is distinct from `asset_no` — if TM-Master renumbers an asset, the `item_id` remains the same (manual reconciliation required via console if a renumber occurs).
