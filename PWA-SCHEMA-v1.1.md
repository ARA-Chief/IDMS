# IDMS Field PWA — Schema & Architecture Reference
**Version 1.9 — F/V Araho**

v1.9 *(2026-05-27)* — **Release marker: IDMS PWA v0.2.9.** Cuts a shipped release containing every schema delta since v1.6 (which shipped as v0.2.7). No new schema changes in this entry — the v1.9 tag exists so the login-footer string and any on-disk schema-version sentinel can reference a single PWA-schema version that bounds the v0.2.9 build's behaviour. Entries v1.7 and v1.8 (per-item comments on rounds entry, Phase 5 dual-write for factory observations, rounds-comment photo attachments, Closed Tasks visibility on the Maintenance & Tasks screen) are all included in this release. Companion Console release tag is v2.30 (`IDMS-SCHEMA-v2.20.md`).

**Bugfix — incinerator lamp stuck "running" from a stale Graph read (no schema change).** `loadIncinerator` in `index.html` fetched the `data/incinerator/events/` folder listing and each event file from the Graph `:/children` and `:/content` endpoints *without* `cache: 'no-store'`. The `:/content` responses are highly cacheable, so on tab resume / bfcache restore the browser could serve a stale listing or stale event file captured at a moment when a `session_start` existed but its matching `session_deletion` / `session_end` had not yet landed. The replay (`incinReplay`) then saw a phantom open session and lit the ER hub `incin-tile-lamp` (and the ON/OFF status text) even though the live event log had every session ended or deleted. This is the same stale-read class that PWA-SCHEMA v1.6 fixed for rounds aggregates (`reGet` / `reListChildren` → `cache: 'no-store'`); the incinerator reader never received that treatment. **Fix:** both `fetch` calls in `loadIncinerator` now pass `cache: 'no-store'`, so a screen-open or refresh-button reload always re-reads current state and the lamp derives from the true replay. No event writes were made to close sessions — the on-disk log already contained zero open sessions; the flag was purely a client-side cache artifact. (`loadVesselTanks` and `loadFuelStateSnapshot` share the same un-busted-cache pattern but affect only tank labels and the retained-volume hint, not the lamp; left as a known follow-up.)

Append further v1.9.x or v1.10 entries here as new work lands between releases.

---

v1.8 *(2026-05-25)* — **Phase 5 dual-write for factory observations; rounds-comment photo attachments; Closed Tasks visibility.** Three independent changes shipped together. Phase 5 closes the silent-corruption loop on OEE submissions by writing an immutable event file alongside the legacy `data/factory/logs/report-{date}-{user}.json` push — every observation submitted from the PWA now lands at `data/factory/observations/events/{iso}-{event_id}.json` *first*, with the legacy `observations[]` RMW only executing on event-write success. Rounds-comment modal gains photo attachment support (camera + gallery picker, dual-size upload, preview tiles, lightbox on tap). Tasks screen gains a "Closed (90 days)" filter option that lazy-loads `data/tasks/records/{yyyy}/` and renders closed-task records that the PWA previously had no UI to surface. No PWA-local schema changes; the comment object gains an optional `attachments[]` field which Console ingest already passes through transparently (`comments_json` is `JSON.stringify(e.comments)` with no per-field filtering — see IDMS-SCHEMA §22 and v2.29).

**Phase 5 dual-write for observations (`pushObservationToOneDrive` + new `pushObservationEventToOneDrive`).** `pushObservationToOneDrive(username, dateStr, observation)` now writes the event file *first* via `pushObservationEventToOneDrive(username, observation)`; the legacy `report-{date}-{user}.json` RMW only runs after the event PUT succeeds. If the event write throws, the legacy write is skipped and the caller's existing `queueObservation` → `flushObservationQueue` localStorage path retries both writes together on the next flush. Event envelope follows the ratified Console-side architecture (see IDMS-SCHEMA v2.29):

```js
{
  schema_version: 1,
  event_id:       observation.obs_id,   // reused as event_id for idempotent retry
  event_type:     'observation',
  actor:          username,
  timestamp:      new Date().toISOString(),
  payload:        observation
}
```

Path: `Documents/IDMS/data/factory/observations/events/{iso}-{event_id}.json` where `{iso}` is the timestamp with `:`, `.`, and `-` stripped (lex-sort = chrono-sort, must match the Console `_eventFilename` shape exactly). PUT uses `If-None-Match: *` so a 412 on retry is a no-op — the queue flush can re-run with the same `obs_id` without writing twice. All three observation submit paths converge on this helper unchanged: ad-hoc observation (`submitObservation`, line ~6752), OEE timer-start (line ~3344), and OEE timer-finish (`submitFactoryOeeObs`, line ~3385). The legacy `observations[]` push is retained in the report file for the dual-write window per `IDMS-Console/docs/phase-4-5-pwa-contract.md`; drop after one trip cycle of clean operation, Console drops the legacy dual-read in Phase 10.

**Rounds-comment photo attachments (`reCommentsModalHTML`, `reSubmitCommentFromModal`, new helpers).** Comment object schema extends to `{text, author, timestamp, attachments?}` where `attachments` is `[{filename, path, thumbnail_path}]` — same shape Tasks and Rough Log use, and the shape `IDMS-Console/docs/rounds-comments-pwa-contract.md` codifies. Photo files upload to the existing assets-pictures namespace `Documents/IDMS/data/assets/pictures/{item_id}/{filename}` and `…/thumb-{filename}` (full 1080×1024 + thumb 240×180 JPEG at quality 0.85) — reuses the existing `erTaskUploadImage(itemId, file)` helper so resize logic is shared with Tasks. New module-level `_RE_CMT_PENDING_PHOTOS` stages files between picker and submit; cleared on every modal open so switching items doesn't carry uncommitted photos over.

- `reCommentsModalHTML` rewritten — each existing comment renders a thumbnail grid below the text via new `reAttachmentsHTML(atts)`. New "Add photo" button + hidden `<input type="file" accept="image/*" multiple>` (mobile yields the standard camera-or-gallery picker; no `capture` attribute so the user can still pick from gallery for retrospective evidence). Live preview tiles with × removal via `reRenderPhotoPreview` / `reRemovePendingPhoto`. New error region (`#re-cmt-err`) preserves text + staged photos on upload failure so the user can retry without re-picking. Modal actions renamed **Cancel** / **OK** per spec.
- `reSubmitCommentFromModal` becomes async. Photo-only comments are allowed (text + photos both empty = treated as Cancel; either filled = valid submit). Uploads run sequentially via new `reUploadCommentPhotos(itemId, files)` so any failure aborts the batch deterministically without leaving partial pairs uploaded for *subsequent* photos. On all uploads succeeding, the new comment object is pushed to `RE.comments[iid]` with `attachments` populated (key omitted when empty) and the draft is saved via `reSaveDraft()`. Photos cap at 5 per comment (matches Tasks). The full submission still flows through `reConfirmSubmit` → `entries[i].comments[]` on the roundslog file at submit time; no change required there because `comments` already passed through unchanged.
- New `reLoadCommentThumbnails(rootEl)` fetches every `[data-thumb-path]:not([data-loaded])` `<img>` in the comments list via Graph with the active `graphToken`, blob-URL into the `<img>`, opacity fades 0→1 on success. Failure hides that thumbnail. Tap-wires each `[data-full-path]` for the lightbox via `reOpenLightbox(relPath)` — minimal fullscreen overlay, tap-anywhere to close, blob-URL cleaned up on cleanup. CSS for `.re-cmt-attachments`, `.re-cmt-thumb`, `.re-cmt-photo-row`/`btn`, `.re-cmt-photo-preview`, `.re-cmt-pp`, `.re-cmt-err`, `.re-cmt-lightbox` appended to the existing `roundsentry.js` stylesheet block.
- Wire format unchanged at the file level — the comment object inside `entries[i].comments[]` just gains an optional `attachments` array. Console-side §22 ingest preserves it through `JSON.stringify(e.comments)`; no Console migration needed. Pre-v1.8 comments stay valid.

**Closed Tasks visibility on the Maintenance & Tasks screen.** PWA tasks screen previously had no UI path to closed tasks at all — the status filter dropdown only carried `active / open / investigating / waiting_parts / waiting_opportunity / shipyard / other`, and `loadEngineTasks` only fetched `data/tasks/definitions/` (active task definitions). Closed task records live in a separate file pool (`data/tasks/records/{yyyy}/`) that the PWA never read.

- Status filter dropdown gains `<option value="closed">Closed (90 days)</option>`. `onchange="renderEngineTasksList()"` is replaced by `onchange="onErTaskFilterStatusChange()"` so the filter switch can trigger a lazy fetch of the records pool the first time the user picks "Closed".
- `ER_TASKS_STATE` extended with `closedRecords[], closedRecordsLoaded, closedRecordsLoading, closedExpanded`. Records pool is kept separate from `tasks[]` (different schemas — records carry `completed_at, closed_by_*, description_work, close_notes, equipment_hours, equipment_ids` JSON; active tasks carry `status, role, assigned_to, …`).
- New `loadEngineClosedRecords()` lists `data/tasks/records/{yyyy}/` for the year(s) overlapping the past 90 days (single year normally; near Jan 1 the list expands to `[thisYear, thisYear-1]` so a year-cross doesn't silently drop December), fetches every `*.json` in those folders, flattens `records[]`, filters by `completed_at >= now-90d`, sorts desc by `completed_at`. Failures on individual files are skipped without aborting the batch.
- New `renderEngineClosedRecordsList(listEl, countEl)` is the dedicated render path. Same row look as active-task rows plus a "Closed" status pill; tap-to-expand reveals Work done, Notes, Failure metadata grid using the existing `.er-task-detail-section / .er-task-detail-desc / .er-task-detail-grid` styles. Role filter applies; department filter does not (matches Console behaviour — `getTaskRecords` doesn't dept-filter on records either). Count row shows `N closed task(s) (past 90 days)`.
- `renderEngineTasksList()` dispatches to `renderEngineClosedRecordsList` when `statusFilter === 'closed'`; otherwise unchanged. New `toggleErClosedExpand(recordId)` mirrors `toggleErTaskExpand` for the closed pool.
- Refresh button (`renderEngineTasksList` doesn't refetch by itself) now calls new `refreshEngineTasks()` which dispatches per the current filter — re-fetches `closedRecords` in "Closed" mode (and force-reloads by clearing `closedRecordsLoaded` before the fetch), or `loadEngineTasks()` for any other filter. Replaces the prior `onclick="loadEngineTasks()"` which silently did nothing useful when on Closed.

**Stale comment fix.** A comment block in `submitErTaskCreate` (line ~5785) previously said "the missing record can be backfilled via Manual Entry" — Manual Entry was retired on the Console side in this release (see IDMS-SCHEMA v2.29). Updated to reference the new Close-button → Task Creation re-route so the recovery path is accurate.

**No behaviour change to existing PWA flows.** All three changes are additive: legacy observation submissions still produce the legacy file, comments without photos still work the same, the active-task list view is unaffected when the user doesn't pick "Closed". `RE.comments` draft serialisation is unchanged at the schema level — the new `attachments` key just gets serialised through with everything else.

**Cross-references.** IDMS-SCHEMA v2.29 covers the Console-side Phase 5 reader (events folder + dual-read fallback), the rounds-comment thumbnail render path, and the consolidated Maintenance & Tasks UI (Close-button re-route, Manual Entry retirement) which the PWA already mirrored in v1.7's `er-task-update-modal`. `IDMS-Console/docs/phase-4-5-pwa-contract.md` is the self-contained Phase 5 + Phase 4 spec; `IDMS-Console/docs/rounds-comments-pwa-contract.md` is the comment + attachments spec. Both documents stay accurate after this release — read them as the canonical contract; this entry is a changelog summary.

Files touched (PWA): `index.html` (dual-write helper, status-filter dropdown option, `ER_TASKS_STATE` extensions, `loadEngineClosedRecords`, `renderEngineClosedRecordsList`, `toggleErClosedExpand`, `onErTaskFilterStatusChange`, `refreshEngineTasks`, stale-comment fix), `roundsentry.js` (`_RE_CMT_PENDING_PHOTOS`, `reAttachmentsHTML`, `reCommentsModalHTML` rewrite, `reSubmitCommentFromModal` async path, `reHandleCommentFiles`, `reRenderPhotoPreview`, `reRemovePendingPhoto`, `reUploadCommentPhotos`, `reLoadCommentThumbnails`, `reOpenLightbox`, CSS additions).

---

v1.7 *(2026-05-24)* — **Per-item comments on rounds entry.** Additive field on the §22 roundslog payload — no schema_version bump (still 2), no Console migration required. Old logs without comments stay valid; consumers default an absent field to `[]`.

- New `RE.comments: { [item_id]: [{text, author, timestamp}] }` state in `roundsentry.js`. Persisted in the local draft alongside `values` / `secd` / `groupSel`.
- Item label cells (`.re-col-label`, `.re-latlon-label`, `.re-snd-label`) become clickable; tapping opens `reOpenCommentsModal(iid)`. Small badge appended to every label shows the comment count (or "+" when none).
- `reConfirmSubmit()` ships `comments: RE.comments[iid] || []` on every entry of the submitted roundslog. Empty array is written explicitly so downstream consumers can rely on the field being present.
- Console aggregates comments across all source files contributing to a round and appends in the reviewer modal. See IDMS-SCHEMA §22 for the wire shape and the Console-side rules. Append-only across both writers; prior comments are immutable.

v1.6 *(2026-05-23)* — **Rounds Groups rendering · honest sync indicator · paginated/cached Graph reads · keypad subfield cursor scoping fix · supersedes v1.5 `reLoadAggregates` round_number filter.** Shipped as IDMS PWA **v0.2.7** (login-footer string in `index.html`).

**Rounds aggregate read — rewrite (§20, §24 commentary supersedes v1.5).** `reLoadAggregates` no longer filters by `round_number`. The premise of the v1.5 fix (compare your value to the prior fills of the same numbered round) interacted badly with vessels running the same round twice per day — Prev-1 / Prev-2 ended up showing values 12 h and 24 h prior instead of the chronologically previous two rounds. The new shape:

```js
const items = await reListChildren(folder, '$orderby=name desc&$top=20');
```

Filenames embed scheduled time as `rounds-YYYY-MM-DD-HHMM.json` so a lexical-desc Graph sort is also chronological-desc. We then fetch a window of up to **6** newest aggregates into `RE.aggList` (newest-first). `RE.aggNew` / `RE.aggOld` are the first two of that list, used for plain items unchanged. The wider window is read per-row by group children (below).

**`reListChildren` paginates and short-circuits caching (§20).** Two cooperating fixes:

- Follows `@odata.nextLink` until the listing is exhausted. The previous implementation returned only `json.value` (Graph's first page, capped ~200) — once the year folder crossed that threshold the *newest* files fell off page 1 entirely under Graph's default `name asc` sort, and the PWA silently rendered stale Prev-1 / Prev-2 (or none at all). Callers that only want the newest N now pass an `$orderby=name desc&$top=N` query so the server narrows before paginating; the loop still follows nextLink as a defence in depth.
- Both `reGet` and `reListChildren` pass `cache: 'no-store'`. Browser HTTP cache + bfcache could otherwise serve a stale Graph response on tab resume without ever hitting the network.

**Honest sync indicator (§5, all dept hubs).** The "Synced / Not Synced / Syncing…" pill is now driven by a small network gauge rather than the lifecycle hint string callers used to pass. New state on `window`:

```js
var _netInFlight    = 0;     // in-flight network ops
var _netLastSuccess = 0;     // epoch ms
var _netLastFailure = 0;
```

Three helpers: `beginNetworkOp()` (increment + repaint), `endNetworkOp(ok)` (decrement + stamp + repaint), `hasQueuedWrites()` (scans `localStorage` for non-empty `fw_obs_queue_*` keys; drafts under `idms_re_draft_*` are *not* counted — those are in-progress work, not failed sync). Pill state derivation:

| State | Condition |
|---|---|
| `syncing` | `inFlight > 0`, or no op has completed yet this session |
| `offline` | `lastFailure > lastSuccess`, or any observation queue has items |
| `synced` | otherwise |

`renderSyncIndicator()` paints all four pill instances (`sync-indicator`, `er-sync-indicator`, `fa-sync-indicator`, `pu-sync-indicator` — the Factory and Purser pills were dead HTML pre-v1.6; live now). A `setInterval(renderSyncIndicator, 30 * 1000)` keeps the "N min ago" tooltip current and flips the pill amber when a write is queued without a fresh network event. Tooltip text: `Last synced HH:MM (N min ago)` / `Sync failed at HH:MM (…)` / `Changes queued. Last synced HH:MM (…)` / `Syncing now…` / `Not yet synced this session`. Set via `el.title` so hover (desktop) or long-press (mobile) reveals it.

Wired into the four real network paths: `loadConfig` (GitHub / OneDrive crewconfig fetch), `writeLogFile` (5-min incident-log autosync), and `reGet` / `rePut` / `reListChildren` (all OneDrive traffic from `roundsentry.js`). `roundsentry.js` accesses the gauge via thin `reNetBegin` / `reNetEnd` shims that no-op if the globals aren't present, so the module stays loadable standalone. `updateSyncIndicator(state)` retained as a no-op back-compat shim — existing explicit calls still compile, hint strings ignored because the gauge is authoritative.

**Rounds Groups — PWA rendering (§20, supersedes the v1.5 §20 item-type list).** New `RE.groupSel: { [parent_item_id]: section_id }` records the user's section pick per group-type round item. Persisted in drafts (§17) alongside `values` / `secd` / `cursorIdx`. Three pieces fit together:

1. **`reExpandGroups(baseFlat, config)`** post-processes `reFilterItems` output. For each `type === 'group'` round item with a section selected, the items inside that section are inserted into the flat list directly after the parent row. Each synthetic child carries a derived `item_id = parentId + ':' + childId` and four meta fields (`_parentItemId`, `_parentGroupId`, `_parentSectionId`, `_baseItemId`) that submission propagates to the log (see IDMS-SCHEMA §22 group linkage fields). `_active_rounds` / `_active_days` are forced to `undefined` on children — child filtering is inherited from the parent round item, not re-evaluated per child.
2. **`reBuildItems()`** is the canonical entry point. Called at `initRoundsEntry`, after draft restore, and from `reSetGroupSection` whenever a section pick changes. Rebuilds `RE.flatItems` and `RE.navItems` end-to-end. Cursor index is clamped if it lands past the new array length after a section was deselected and its children removed.
3. **`reGroupParentRowHTML(r, ni)`** is the new row renderer. The entry cell is a `<select class="re-group-sel">` populated with the referenced group's sections (filtered for `!offline`, and minus any section already picked by a *peer* group item on the same round — see "peer filter" below). Selecting a section calls `reSetGroupSection(parentIid, sectionId)`, which:
    - If values are already entered under this parent's namespace and the user is *switching* (not just picking for the first time), prompts a confirm dialog. Cancel snaps the dropdown back via re-render.
    - Deletes any `RE.values[k]` / `RE.secd[k]` where `k` starts with `parentIid + ':'`.
    - Updates `RE.groupSel`, calls `reBuildItems()`, pre-populates empty text values for any new text-type children, clamps cursor, re-renders, saves the draft.

**Peer filter for groups (§20).** Sections already picked by other group items referencing the same group in the same round are removed from this dropdown — prevents duplicate synthetic `item_id`s (and the silent data contamination that would cause in the aggregate). The user's own current selection is always retained in the dropdown so it still shows what they picked; clearing a peer to "—" makes the section reappear here automatically because `reSetGroupSection` re-renders the whole grid.

**Group section offline filter (§20).** Sections marked `offline: true` in the Console group editor are filtered out of `reGroupParentRowHTML`'s dropdown. If a previously-picked section is flipped offline mid-session it remains visible as the current selection (the filter chain explicitly keeps `s.section_id === selected`), so the user isn't surprised by their pick disappearing.

**Submission (§22).** `reConfirmSubmit` iterates `RE.flatItems` (the post-expansion list). Group parent items log with `value = RE.groupSel[iid] || null` (a `section_id` UUID). Synthetic child entries log with their synthetic `item_id` and the four linkage fields. Plain rows submit unchanged. Aggregator (`buildRoundsAggregate`, Console main.js:1544) groups by `item_id`; synthetic keys produce their own rows in the aggregate's `items{}` map with zero code change required there.

**Prev-1 / Prev-2 for group children — Stage 3 history scoping (§24).** Group child rows can't use the cheap two-aggregate lookup that plain items use: their synthetic key only exists in aggregates where the *same* parent picked the *same* section, which may not be the two most recent rounds. New helper `reChildAggValues(synthIid)` walks `RE.aggList` newest-first and returns up to the 2 most-recent non-null `display_value`s for the synthetic key — guaranteed to be from prior rounds with matching parent+section because the key encodes both. Plain items keep the existing `RE.aggNew` / `RE.aggOld` two-pointer lookup so their behaviour and bandwidth are unchanged.

**Group parent's own history columns** display `—` for now. The parent's "value" is a `section_id` UUID; surfacing the previously-picked section *label* there would be the natural next step.

**Keypad subfield input fix (§20).** `reActiveSubfieldInput()` now gates the tracked `RE.activeSubfield` on `tracked.iid === RE.navItems[RE.cursorIdx]?.item?.item_id`. The `document.activeElement` fallback similarly gates on owner-row matching the cursor row. Previously, tapping a lat/lon (or sounding / tk_percent) subfield left `RE.activeSubfield` armed forever — any subsequent navigation to a *numeric* item below sent every digit back into the stale subfield instead of the numeric value. Visible on every round that contained the Midnight Readings lat/lon item (every numeric below it silently rejected input); the same root cause produced an earlier user report of "values routing to one of the tank soundings." Cursor moves through `reBindEvents` (`scroll.click` → `reCursorTo(ni)`) so the gate always reflects the row the user just touched; in-row subfield switches (ft → in) keep working because `currentIid` stays constant within a row.

**Cross-references.** Schema and Console side: see IDMS-SCHEMA v2.23 (`roundsconfig.json groups[]` shape, `type: "group"` item, `roundslog` linkage fields, Console UI changes, aggregator no-op compatibility). The v1.5 `reLoadAggregates` round_number filter described above is the same one removed in this version — re-read v1.5 in historical context only.

---

v1.5 *(2026-05-22)* — **Purser module + rounds-entry resilience + dept-swap pattern.** Adds a new role-gated "Purser" department, draft persistence for in-progress rounds, two-stage SEC'D arming, a force-round option on rounds entry, a "Select Round" backfill picker on the Begin Rounds modal, Android keypad input fixes, and a global swipe-back guard.

**Role-gated Purser module (§5, §13, §14).** New top-level helper `userIsPurser()` returns `true` iff `currentUser.role` (case-insensitive trim) equals `'Purser'`. `showDeptPicker()` synthesizes a "Purser" tile when this returns true, regardless of `currentUser.departments` — Purser is intentionally *not* added to the departments array so it doesn't pollute dept-scoped config / equipment / rounds-section filtering. New screens registered: `screen-purser-home` (four tiles: Scale Calibration, Crew Sign Off, Profile — Rough Log was prototyped then removed), `screen-purser-signoff` (departing-crew list). `deptHomeScreen('Purser') → 'screen-purser-home'`. `enterDepartment('Purser')` short-circuits the standard DEPT_CONFIG / FMEA / equipment / observation-button / sync-timer load path (Purser has no per-dept config files) and just paints the hub. New global `PURSER_ACTIVE` boolean cleared on signOut / switchUser; `showScreen('screen-purser-home')` restores `currentDepartment = 'Purser'` when this flag is set so the dept-swap pattern (below) cleans up automatically.

**Dept-swap pattern.** Purser tiles that reuse Factory-flavoured workflows (Scale Calibration → rounds entry pinned to Factory + round 2) temporarily set `currentDepartment = 'Factory'` before invoking the shared entry function, then rely on `showScreen('screen-purser-home')` to restore `'Purser'` on return. Mirrors the same `currentDepartment` global the rest of the PWA uses to scope rounds / log writes / config keys.

**`initRoundsEntry(sourceScreen, opts)` (§20).** Second arg is new. `opts.forceRound: number` pins the round to a specific number and bypasses `reInferRound`; scheduled time is looked up from `cfg.schedule.round_times`. Falls back to `'—:—'` in the header if the schedule has no entry for the forced round, but submit still tags `round_number` correctly so the Console-side aggregator places it in the right bucket. Used by Purser → Scale Calibration (pinned to round 2) and by the new "Select Round (backfill)" picker on the Begin Rounds modal (any round, derived from schedule). New `RE.forceRound` state field — `null` when entering via the normal time-of-day inference path.

**"Select Round (backfill)" modal.** New modal `#modal-rounds-select` sits between the existing Begin Rounds modal and rounds entry. New helpers `openSelectRoundModal()` / `closeSelectRoundModal()` / `confirmRoundsEntryForce(roundNum)` plus `sourceScreenForRoundsModal()` that returns the right hub screen by `currentDepartment` (Factory / Engine Room / fallback). Picker loads rounds from cached `RE.config` when available, else fresh `reLoadRoundsConfig()` call. Each round renders as a button "Round N · HH:MM" with a "Now" badge on the currently-inferred round so the operator can distinguish backfill choice from normal start.

**Rounds draft persistence (§8, §17).** New `localStorage` key `idms_re_draft_{username}_{department}_{date}_r{roundNum}` holds an in-progress draft: `{ saved_at, round_number, scheduled, values, secd, cursorIdx }`. Three new helpers in `roundsentry.js`: `reSaveDraft()` (skips writing when both `values` and `secd` are empty), `reLoadDraft()`, `reClearDraft()`. Autosave armed on `initRoundsEntry` via `reArmAutosave()` (3 s interval) and on `visibilitychange:hidden` / `pagehide` / `beforeunload`. `initRoundsEntry` prompts to resume any matching draft on entry. Submit success calls `reClearDraft()`; submit failure calls `reSaveDraft()` explicitly and updates the modal copy to truthfully claim entries are preserved on this device.

**Two-stage SEC'D arming (§20).** New `RE.secdArmed` field holds the `item_id` SEC'D is currently armed for, or `null`. First press of SEC'D arms the button (CSS class `re-kp-secd-armed` paints it `var(--re-danger)` red, no item state change). Second press on the same item performs the actual SEC'D. Disarmed automatically by cursor change to a different item (`reCursorTo`) or any other keypad action (`reKpKey`, `reKpBs`, `reKpMinus`, `reKpDot`, `reKpEnter`). Prevents accidental securing of components. New helper `reSetSecdArmed(iid)` toggles the visual state on the keypad button (`#re-kp-secd-btn` — id added to the existing button markup).

**Android keypad subfield tracking (§20).** New `RE.activeSubfield: { iid, cls, idx }` records the last lat/lon-deg / lat/lon-min / sounding-ft / sounding-in / sounding-cm / tk-percent-cap input the user tapped. `reActiveSubfieldInput()` re-resolves this to a live DOM element by row + class + sibling index (survives grid re-renders). Replaces the previous reliance on `document.activeElement`, which broke on Android Chrome where tapping a keypad button steals focus from the input. Wired once at `initRoundsEntry` via new `reInstallSubfieldTracking()` (delegated `focus` capture / `click` / `touchstart` listeners on document) — global `mousedown` `preventDefault` on `.re-kp-btn` also prevents desktop focus theft. `touchstart` preventDefault deliberately omitted (would suppress synthesised `click` and kill the keypad on touch).

**Rounds item filtering (§20).** `reFilterItems` rewritten to group section items by source-order preceding heading first, then drop entire groups whose data items all filter out. Fixes "Sewage" / "Midnight readings lat/lon" headings appearing on non-midnight rounds when a heading's true group was empty but a later heading's group survived. Per-item filtering rules (`active_rounds`, `active_days`) unchanged.

**Rounds aggregate read (§24, Prev-1 / Prev-2 columns).** `reLoadAggregates` now matches aggregates to the *current* `RE.roundNum` rather than blindly taking the two most-recent files. Walks newest → oldest in batches of 6 (cap 30 files), filters by `aggregate.round_number === wanted`, falls back to chronological for legacy aggregates that lack the field. Fixes the case where a user fills only one round per day and was previously shown other-round aggregates as their "previous" history.

**Global swipe-back guard.** CSS `overscroll-behavior-x: none` on `html / body / .phone-frame` plus a `popstate` trap (seeds two history entries; re-pushes on every pop) plus a document-level `touchmove` blocker for horizontal swipes starting within 40 px of either viewport edge. Blocks browser back via edge swipe / hardware back button / browser back button / trackpad two-finger swipe. Does not block OS-level minimize / home gestures. Originally the largest source of data loss during rounds entry.

**Crew identity bridge (§6, new section).** Reading the Purser → Crew Sign Off list requires resolving `scheduleconfig.trips[].crew[].user_id` to a `crewconfig.crew[]` record. The IDs are in different namespaces:

| Source | Field | Notes |
|---|---|---|
| `scheduleconfig.json` | `trip.crew[].user_id` | UUID, e.g. `84ff7654-…` |
| `userconfig.json` | `users[].user_id` + `users[].username` | Bridges UUID ↔ username |
| `crewconfig.json` | `crew[].crew_id` + `crew[].username` | DIFFERENT UUID, joined by username |

`loadPurserCrewSignOff` loads all three configs in parallel, builds `userIdToUsername` and `usernameToCrew` lookup tables, plus a `nameToCrew` fallback for crew without system accounts (their `crewconfig.crew[].username` is `null` — common for non-tech crew). Resolution order: `user_id → username → crewRec`, fallback to `display_name → crewRec` by case-insensitive name match. Unresolved crew render in the list with a greyed-out "Unmapped" badge (no checkout button) instead of being silently dropped.

**Crew Sign Off persistence.** Modal is a line-for-line port of IDMS-Console `scOpenCheckInOutModal` (schedule.js:6687-7107, direction='out'). Schema identical so the Console can read what the PWA wrote. Persists to `crewconfig.json` via read-fresh / mutate / write-back keyed on `crew_id` (the stable identifier inside crewconfig). Save writes `completed: false`; Completed writes `completed: true` AND runs a line-for-line port of `applyDischargeSideEffects` (schedule.js:7034-7077): terminal reasons (`quit`/`terminated`) flip `crew.status = 'inactive'` + `availability.state = 'unavailable'` with history append; non-terminal reasons upsert a `dates_requested_off` entry with the matching uppercase reason token (`MEDICAL` / `REQUESTED` / `OFF ROTATION` / `OTHER`), idempotent on re-Complete. Active-trip resolution is best-effort: first trip in sequence order with `actual_close_date == null` AND `est_close_date >= today`; falls back to the latest `est_close_date` among open trips if all are overdue. Differs from Console's `scActiveTripNumber` (SQLite-backed) since the PWA can't see the trips DB; sufficient until Phase 2 of the OneDrive trips refactor lands an authoritative on-disk signal.

**Modal layout pattern.** Multi-field rows in the Crew Sign Off modal (Confirmed Available + Tickets Purchased; flights; lodging; Reason for Discharge + Available for Return) use `display:flex; flex-wrap:wrap` with `flex-basis` per child instead of fixed CSS grid columns, so fields stack on narrow phone modals without clipping off-screen. Airport codes use an HTML5 `<datalist id="pu-airports">` shared by all three IATA inputs (flight origin, flight destination, lodging location) for native typeahead — seeded from a 73-entry list mirrored from `IDMS-Console/src/renderer/js/crew.js CREW_AIRPORTS` (KEEP IN SYNC marker added in both files).

**Other tweaks.** Numeric round-entry inputs in the Console Manual Entry form (separate from this PWA but documented here for context) match the PWA's per-type input shapes (ft/in pair for standard soundings, single cm for metric, USG + live % for tk_percent, deg/min/hemi compound for lat/lon). `escHtml` alias added (`s => escapeHtml(s)`) so Purser-section call sites resolve cleanly — the codebase's real escaper is `escapeHtml` (~line 6298); recon initially mis-identified it as `escHtml`.

v1.4 — Tasks & Maintenance **+ New Task** Equipment field gains an asset autocomplete dropdown sourced from `config/assets.csv` on OneDrive. New module-level state: `ER_ASSETS_CACHE` (`[{ code, name }]`) and `ER_ASSETS_LOAD` (in-flight `Promise`). New functions in `index.html`: `erLoadAssets()` fetches `…/Documents/IDMS/config/assets.csv` via Graph (`Bearer graphToken`), parses with `erParseAssetsCsv()` (handles quoted fields, embedded commas, CRLF, UTF-8 BOM), and resolves to a cached `[{ code, name }]` list (re-used across modal opens). On modal open, `openErTaskCreateModal()` fires `erLoadAssets()` fire-and-forget so the cache is warm by the first keystroke. New input handlers: `erCreateEquipInput()` filters the cache on case-insensitive substring match against `code` *or* `name` and renders up to 8 suggestions in a new `<div id="er-create-equip-suggest">` panel (positioned `absolute; top:100%; left:0; right:54px; max-height:220px` inside the `er-form-row`); `erCreateEquipPick(code)` fills the input and calls the existing `erCreateAddEquip()` tag-add flow; `erCreateEquipKey(e)` handles Enter (pick first suggestion, falling back to manual add) and Escape (hide dropdown); `erCreateEquipHideSuggest()` closes the panel on blur (`setTimeout(…, 150)` to let a click register first). Input `placeholder` updated from "Type code and press Enter" to "Type code or name…"; `autocomplete="off"` added to suppress native autofill. Manual entry of an unknown code still works — Enter with no matches falls through to `erCreateAddEquip()` so PWA users can record codes not yet in `assets.csv` (e.g., during early ingestion). Data contract: reads `assets.csv` per IDMS-SCHEMA §9 (`Code`, `Name` columns); no PWA-side schema change.

v1.3 *(go-live — 2026-05-11)* — App version bumped to **v1.0** across all user-facing strings in `index.html` (Microsoft auth footer, IDMS login footer). **Rounds entry tablet display overhaul.** On tablet (≥ 768 px), `initRoundsEntry()` now calls `reExpandFrame()` which (a) adds class `re-rounds-expanded` to `<body>`, causing `.phone-frame` to expand `position: fixed; inset: 0; width: 100vw; height: 100dvh; border: none; border-radius: 0` via an injected `<style id="re-expand-style">` — giving the rounds screen the full display area — and (b) requests browser fullscreen via the Fullscreen API (vendor-prefixed, silently ignored if denied). Both are reverted by `reCollapseFrame()` on `reExit()`. **Side-panel layout on tablet:** the screen header (`re-header`) and keypad (`re-keypad`) are now co-located in a `<div class="re-side-panel">` (520 px wide) that sits to the right (or left) of the data grid, rather than the header spanning full width above both columns. On phone (< 768 px) the layout is unchanged: header full-width at top, keypad full-width at bottom. **Switch Sides button:** a labeled "⇄ Switch Sides" button is now rendered inside the header when on tablet, replacing the previous small arrow icon that lived inside the keypad. Calls the existing `reToggleKpSide()` — saves `userprefs-{username}.json` and re-renders. **Keypad button height doubled:** `.re-kp-btn` vertical padding increased from `14 px` to `28 px`. **Username tap target expanded:** on all three home screens (`screen-home`, `screen-factory-home`, `screen-engine-home`), the `user-info` div (name + role text) now carries the same `onclick` handler as the avatar, giving a much larger tap target for opening the user menu.

v1.2 — Rounds entry module (`roundsentry.js`) updated. **Year subfolders:** entry log files are now written to `data/rounds/logs/{username}/{YYYY}/roundslog-…` — one subfolder per calendar year, preventing unbounded OneDrive folder growth. **Payload-level round fields:** `round_number` and `scheduled_time` are now top-level fields in the §22 payload in addition to being echoed per-entry; the Console ingest reads from payload level. **Submit flow change:** incomplete round warning changed from blocking (OK only) to a modal with **OK / Cancel** — crew can submit a partial round. **Add Oil excluded from incomplete count:** `add_oil` type items are never counted as "not yet checked" in the submission warning. **Add Oil zero = null:** entering `0` for an `add_oil` item stores `null` in the aggregate `display_value` — no volume recorded if nothing was actually added. **Keypad layout updated:** row 1 = ← − ▲; row 2 = 7 8 9 ▼; row 3 = 4 5 6 SEC'D; row 4–5 = 1 2 3 [enter, spans 2 rows]; row 5 = 0 dcml [enter continues]. "`.`" key renamed to `dcml`. **First-keystroke-replaces:** cursor navigation (click or arrow key) sets a `freshCursor` flag on the active item; the next digit or decimal keypress replaces the existing value rather than appending it. `freshCursor` is cleared after the first keypress and on backspace/sign-toggle. New `RE` state field: `freshCursor` (boolean). Data contracts updated: §22 per IDMS-SCHEMA-v2.14.

v1.1 — Rounds entry module built (`roundsentry.js`). New screen `screen-roundsentry` added to screen registry (§5). `ACTIVE_MODULES` note updated — rounds entry operates across all departments via `active_rounds` / `active_days` item filtering rather than a per-department module flag (§3). New config files read by the PWA: `roundsconfig.json` and `userprefs-{username}.json` (§6). New `localStorage` key `fw_re_prefs_{username}` (§8). Section §19 (Planned Modules) updated — rounds entry promoted from planned to built. New §20 documents `roundsentry.js`: state model (`RE` object), round inference (§24 rule), item filtering by dept/active_rounds/active_days, 4-column entry grid, numeric keypad (phone: bottom, tablet: left/right per preference), SEC'D behaviour, colour mode toggle, gesture lockout (pull-to-refresh + swipe-back prevention), submit flow, and OneDrive write path. Data contracts: entry log written per IDMS-SCHEMA-v2.11 §22; history columns read from §23 aggregate files; paths and round inference per §24.

*This document is the authoritative reference for the field PWA's architecture, screen structure, authentication flow, state model, localStorage keys, data contracts, and planned modules. It is a companion to the main IDMS-SCHEMA document, which governs all shared file formats. Both documents must be kept in sync whenever either side changes.*

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Application Constants](#3-application-constants)
4. [Authentication Flow](#4-authentication-flow)
5. [Screen Registry](#5-screen-registry)
6. [Config Files Read by the PWA](#6-config-files-read-by-the-pwa)
7. [JavaScript State Model](#7-javascript-state-model)
8. [localStorage Key Registry](#8-localstorage-key-registry)
9. [Event Lifecycle](#9-event-lifecycle)
10. [Log File Write Behaviour](#10-log-file-write-behaviour)
11. [Observation Push (Factory)](#11-observation-push-factory)
12. [FMEA Integration (Factory)](#12-fmea-integration-factory)
13. [Department Behaviour Matrix](#13-department-behaviour-matrix)
14. [Permission Enforcement](#14-permission-enforcement)
15. [Multi-User Session Model](#15-multi-user-session-model)
16. [Report Screen](#16-report-screen)
17. [Offline Handling](#17-offline-handling)
18. [Schema Version Checking](#18-schema-version-checking)
19. [Planned Modules](#19-planned-modules)
20. [Rounds Entry Module (roundsentry.js)](#20-rounds-entry-module-roundsentryjs)

---

## 1. Overview

The **field PWA** is the crew-facing data-entry tool in the IDMS ecosystem. It runs in a tablet or phone browser and is the primary source of operational event data. It has no build system — the entire application is a single self-contained HTML file (`index.html`) with all CSS and JavaScript inline.

### Role in the system

| Component | Role |
|-----------|------|
| **Field PWA** (`index.html`) | Crew data entry on the vessel floor. Writes per-user log files to OneDrive via Microsoft Graph API. |
| **IDMS Console** (`IDMS-Console/`) | Electron desktop app used by officers and admin. Ingests PWA log files into SQLite, generates reports, manages config. |

The PWA writes; the console reads and aggregates. The PWA never reads the SQLite database. All shared data transits through OneDrive JSON files whose formats are governed by the main IDMS-SCHEMA document.

### Vessel context

| Field | Value |
|-------|-------|
| Vessel | F/V Araho |
| IMO | 9731963 |
| Call sign | WDH7704 |
| Service type | Factory Trawler |
| OneDrive base path | `Documents/IDMS` |

---

## 2. Architecture

### Single-file application

The entire PWA is one HTML file. There are no external JS modules, no bundler, no CSS preprocessor, and no framework. All styling, markup, and logic live in `index.html`. The only external dependency loaded at runtime is **MSAL Browser** (`msal-browser.min.js` v2.38.0), fetched from Microsoft's CDN.

This architecture is intentional: the file can be opened directly from a local path or served from any static host — including GitHub Pages — with no server infrastructure.

### Screen model

The UI is built as a set of full-screen `<div class="screen">` elements. Exactly one screen has the `active` class at any time. Navigation is handled by the `showScreen(id)` function, which removes `active` from all screens and adds it to the target. There is no routing library and no URL manipulation — the browser back button has no effect on navigation state.

### Storage

| Layer | Purpose |
|-------|---------|
| **In-memory JS variables** | Active session state: running timers, resolved events, current user, loaded config. Cleared on page reload. |
| **`localStorage`** | Persistence across page reloads and tab switches within a session. See §8 for the full key registry. |
| **OneDrive (via Graph API)** | Canonical permanent record. The PWA pushes log files here on resolve, on the 5-minute autosave timer, and on observation submit. |

---

## 3. Application Constants

These constants are declared in the `<script>` block near the top of `index.html`. They are the primary configuration knobs for the application — changing anything here requires a file edit and redeployment.

### MSAL & Auth

```javascript
var MSAL_CONFIG = {
  auth: {
    clientId:    '5f7c6099-c379-4cfa-ab6a-92bf33b812aa',
    authority:   'https://login.microsoftonline.com/816c3d02-39d9-4940-9b6f-08b4cf0321ce',
    redirectUri: window.location.origin + window.location.pathname
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

var MSAL_SCOPES = ['User.Read', 'Files.ReadWrite', 'offline_access'];
```

| Constant | Value | Notes |
|----------|-------|-------|
| `clientId` | `5f7c6099-...` | Azure app registration. See §17 of main schema. |
| `authority` | Login URL + tenant ID | Single-tenant: O'Hara Corporation only. |
| `redirectUri` | `window.location.origin + pathname` | Dynamic — works from any host path. |
| `MSAL_SCOPES` | `User.Read`, `Files.ReadWrite`, `offline_access` | `offline_access` enables refresh tokens in localStorage. |

### OneDrive path

```javascript
var ONEDRIVE_BASE = 'Documents/IDMS';
```

All Graph API file paths are constructed relative to this string. No trailing slash. This must match `bootstrap.json → onedrive_base` on the console.

### Config source

```javascript
var CONFIG_URL = 'https://raw.githubusercontent.com/ARA-Chief/IDMS/main/config/userconfig.json';
```

The PWA loads `userconfig.json` from this URL. During Phase 3 migration this was switched from a raw GitHub URL to a Microsoft Graph API call. The variable name and fetch mechanism remain; the URL now resolves to OneDrive via Graph.

`configURL(path)` is the helper function that constructs a full Graph API URL for a path relative to `ONEDRIVE_BASE`:

```javascript
function configURL(path) {
  return 'https://graph.microsoft.com/v1.0/me/drive/root:/' + ONEDRIVE_BASE + '/' + path + ':/content';
}
```

### Department file map

```javascript
var DEPT_FILE_MAP = {
  'Factory':     'factory',
  'Engine Room': 'engine',
  'Deck':        'deck'
};
```

Maps department display names to the lowercase path keys used in OneDrive folder paths and config filenames.

### Active modules

```javascript
var ACTIVE_MODULES = ['Factory'];
```

Only departments listed here have a working event-timing module. Crew members whose assigned department is **not** in this array are routed to `screen-inactive` when they select that department. Currently only Factory is built; Engine Room and Deck display a placeholder.

**Note:** The rounds entry module (`roundsentry.js`) is **not** gated by `ACTIVE_MODULES`. It is accessible to users of all departments via the rounds icon on the home screen, and filters visible items internally using `active_rounds`, `active_days`, and `dept_key` from `roundsconfig.json`. See §20.

---

## 4. Authentication Flow

The PWA uses a **two-stage login**:

```
Stage 1 — Microsoft Identity (MSAL)
   User taps "Sign in with Microsoft"
   → MSAL redirect flow to Azure AD
   → Returns with access token for Files.ReadWrite
   → Token cached in localStorage by MSAL

Stage 2 — IDMS Identity
   App fetches userconfig.json from OneDrive
   User enters username + password
   → Validated against userconfig.json in memory
   → User object stored in currentUser + localStorage
```

### Stage 1 detail: MSAL redirect

`initMsal()` runs on every page load. It calls `msalInstance.handleRedirectPromise()` to collect any pending redirect result. If an account is found in the MSAL cache, Stage 1 is skipped silently and the PWA proceeds to the IDMS login screen. If no account is cached, the user sees `screen-msauth` with a "Sign in with Microsoft" button.

MSAL caches its tokens and account state in `localStorage` under its own keys (not managed by the PWA). The refresh token (`offline_access` scope) allows silent re-auth after the 1-hour access token expires.

### Stage 2 detail: IDMS login

`submitLogin()` validates the entered credentials against the `users` array loaded from `userconfig.json`. The comparison is against plaintext passwords (security hardening is a pending phase — see §19). On success:

1. `currentUser` is populated with the matching user object.
2. The session is written to `localStorage('fw_session')`.
3. Single-department users are routed straight to their module via `routeAfterLogin()`. Multi-department users see `screen-dept` to pick a department.

On failure, `screen-login` shows an error message and the user can retry.

### Sign-out

`signOut()` clears the IDMS session (`fw_active`, `fw_user`, `fw_session`) and calls `msalSignOut()`, which triggers an MSAL redirect logout, clearing the Microsoft identity and returning to `screen-msauth`. Resolved incidents and user presets are preserved in `localStorage` across sign-outs.

`switchUser()` clears only the IDMS session (leaves the Microsoft identity) and returns to `screen-login`, allowing a different crew member to log in under the same Microsoft account (e.g., shared tablet use). The MSAL sign-in step is skipped.

---

## 5. Screen Registry

All screens are `<div class="screen" id="screen-{name}">` elements in the HTML. Only one is active at a time.

| Screen ID | Title | Access path | Notes |
|-----------|-------|-------------|-------|
| `screen-msauth` | Microsoft Sign-In | App load | Entry point when no MSAL account is cached. |
| `screen-login` | IDMS Login | After MSAL auth | Username + password entry. |
| `screen-dept` | Department Picker | After login | Shown only for multi-department users. |
| `screen-inactive` | Module Inactive | Dept selection | Shown when selected dept is not in `ACTIVE_MODULES`. |
| `screen-home` | Home | After dept entry | Main screen. Shows preset buttons, active timer count, nav icons. |
| `screen-equipment` | Equipment | Equipment icon | Scrollable list of equipment groups. |
| `screen-group` | Group | Tap a group | Equipment items within a group. |
| `screen-category` | Category | Tap equipment item | Category picker for selected equipment. |
| `screen-timer` | Active Timer | Start incident / tap active bar | Shows running timer for one incident; notes field. |
| `screen-resolve` | Resolve | Tap Resolve from timer | Time adjustment, notes, FMEA mode picker (Factory). |
| `screen-observation` | Log Observation | Observation icon (Factory) | Production rate observation form. Factory only. |
| `screen-review` | Event Log | Log icon on home | List of today's resolved events. Tap for detail. |
| `screen-event-detail` | Event Detail | Tap event in review | Full detail view for a single resolved event. |
| `screen-settings` | Settings | Settings icon on home | User presets editor. |
| `screen-report` | Report | Report icon on home | Loads today's OneDrive log files and renders a summary. |
| `screen-roundsentry` | Rounds Entry | Rounds icon on home (`initRoundsEntry()`) | Field rounds data entry. See §20. |

### Home screen (`screen-home`)

The home screen is the operational hub. Its layout:

- **Top bar** — user avatar + name, sign-out, switch-user controls.
- **Preset buttons** — up to 5 configurable quick-start buttons. Each tap immediately starts a timer for the preset's equipment + category. Managed via `screen-settings`.
- **"Other" button** — navigates to `screen-equipment` for manual equipment selection.
- **Active timer bar(s)** — each running incident shows a pulsing bar with equipment name, elapsed time, and a tap target to open `screen-timer`.
- **Bottom action icons** — Event log, Report, Observation (Factory only), Settings.

### Navigation flow

```
screen-msauth
  └─► screen-login
        └─► screen-dept  (multi-dept users only)
              └─► screen-home  ◄──────────────────────────────────┐
                    ├─► screen-equipment                           │
                    │     └─► screen-group                         │
                    │           └─► screen-category                │
                    │                 └─► (startTimer → back)      │
                    ├─► screen-timer                               │
                    │     └─► screen-resolve ──► (confirmResolve) ─┘
                    ├─► screen-observation ───► (submitObservation) ─► screen-home
                    ├─► screen-review
                    │     └─► screen-event-detail
                    ├─► screen-settings
                    ├─► screen-report
                    └─► screen-roundsentry ──► (submit) ──► screen-home
```

---

## 6. Config Files Read by the PWA

The PWA fetches config from OneDrive via the Graph API. All paths are relative to `ONEDRIVE_BASE`. For full field-level documentation of each file, refer to the section numbers in the main IDMS-SCHEMA document.

| File | OneDrive path | When loaded | Main schema ref | Notes |
|------|--------------|-------------|-----------------|-------|
| `userconfig.json` | `config/userconfig.json` | On every page load (via `CONFIG_URL`) | §3 | Users, vessel name, departments. Loaded before IDMS login. |
| `{dept}config.json` | `config/{dept}config.json` | On department entry | §4 | Equipment groups + items, categories, presets. One file per dept. |
| `{dept}shell.json` | `config/shells/{dept}shell.json` | On department entry | §5 | Timer thresholds, max concurrent timers, permissions. |
| `fmeaconfig.json` | `config/fmeaconfig.json` | On Factory entry | §38 | FMEA failure mode registry. Factory dept only. |
| `roundsconfig.json` | `config/roundsconfig.json` | On rounds entry init (`initRoundsEntry`) | v2.11 §20 | Rounds schedule, sections, items, item types. Loaded fresh on each rounds entry session. |
| `userprefs-{username}.json` | `config/userprefs-{username}.json` | On rounds entry init | v2.11 §21 | Per-user keypad side and colour mode preference. Absent file treated as defaults (`keypad_side: "right"`, `colour_mode: "dark"`). Written on preference change. |

### Fallback behaviour

All four files follow the same fetch pattern:

1. Attempt Graph API fetch with current MSAL token.
2. On success: update the in-memory state and write to `localStorage` cache.
3. On network failure: read from `localStorage` cache if available; warn the user if not.

If a config file is absent from OneDrive (HTTP 404), the PWA continues with defaults (empty equipment list, no presets). It does not block the user from operating.

### configURL helper

```javascript
function configURL(path) {
  // path is relative to ONEDRIVE_BASE, e.g. 'config/userconfig.json'
  return 'https://graph.microsoft.com/v1.0/me/drive/root:/'
       + ONEDRIVE_BASE + '/' + path + ':/content';
}
```

---

## 7. JavaScript State Model

All state lives in module-scope `var` declarations. There are no classes or state management libraries. State is rebuilt from `localStorage` on page load (see §8) and from OneDrive on department entry.

### Session-level state

| Variable | Type | Initial value | Description |
|----------|------|---------------|-------------|
| `msalInstance` | `PublicClientApplication` | `null` | MSAL client instance. Initialised by `initMsal()`. |
| `msalAccount` | `AccountInfo` | `null` | Signed-in Microsoft account. |
| `graphToken` | `string` | `null` | Current MSAL access token. Refreshed via `acquireTokenSilent` on each Graph call. |
| `currentUser` | `object` | `{ username:'', name:'', initials:'', role:'', departments:[] }` | IDMS user object. Populated on login. |
| `currentDepartment` | `string` | `''` | Active department display name (e.g. `'Factory'`). |

### Config state

| Variable | Type | Description |
|----------|------|-------------|
| `deptConfig` | `object \| null` | Loaded department config (`{dept}config.json`). Equipment groups, categories, presets. |
| `shellConfig` | `object \| null` | Loaded shell config (`{dept}shell.json`). Timer settings, permission arrays. |
| `FMEA_CFG` | `object \| null` | Loaded FMEA config (`fmeaconfig.json`). Factory only. `null` for non-Factory. |

### Incident state

| Variable | Type | Description |
|----------|------|-------------|
| `activeIncidents` | `array` | Running timer objects. Each entry is a resolved-incident-shape with `endTime: null`. Max count enforced by `shellConfig.timers.max_concurrent_timers`. |
| `resolvedIncidents` | `array` | Completed incidents for the current session / date. |
| `PRESETS` | `array` | User's preset buttons (5 slots). Each entry is `{ equipment, category, label }` or `null`. |

### Incident object (active)

An active incident is an object pushed onto `activeIncidents`. It matches the resolved incident schema (§11 of main IDMS-SCHEMA) but with `endTime: null` and `duration: null`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | integer | `Date.now()` at creation. Unique within session. |
| `equipment` | string | Equipment name at time of start. |
| `category` | string | Category at time of start. |
| `startTime` | string | ISO 8601 UTC. |
| `endTime` | `null` | Not yet resolved. |
| `duration` | `null` | Not yet resolved. |
| `durationLabel` | `null` | Not yet resolved. |
| `notes` | string | Updated via `saveNotes()`. Empty string until resolve. |
| `user` | string | `currentUser.username` at time of start. |
| `displayName` | string | `currentUser.name` at time of start. |

### UI navigation state

| Variable | Type | Description |
|----------|------|-------------|
| `categoryBackScreen` | `string` | Which screen the back button on `screen-category` returns to. Set by `selectEquipment()`. Either `'screen-equipment'` or `'screen-group'`. |
| `detailBackScreen` | `string` | Which screen the back button on `screen-event-detail` returns to. Default `'screen-review'`. |

---

## 8. localStorage Key Registry

All keys are prefixed `fw_` (field web) to avoid collision with MSAL's own keys.

| Key | Value type | Scope | Description |
|-----|-----------|-------|-------------|
| `fw_session` | `JSON { user, department }` | Login | Current session snapshot. Restored on page reload to skip login if still valid. |
| `fw_user` | `JSON user object` | Login | IDMS user object for the logged-in user. Cleared on sign-out. |
| `fw_active_{username}_{dept}` | `JSON array` | Per user × dept | Active incidents. Keyed by user + department to support multi-user scenarios on a shared device. |
| `fw_resolved` | `JSON array` | Session | All resolved incidents for the current session. Shared across users in the same browser session. |
| `fw_deleted_ids` | `JSON array` | Session | IDs of events the user has deleted locally. Applied as a filter on next sync to OneDrive. |
| `fw_presets_{username}_{dept}` | `JSON array (5 items)` | Per user × dept | User's saved preset button configurations. |
| `fw_deptcfg_{deptKey}` | `JSON object` | Per dept | Cached `{dept}config.json` for offline fallback. `deptKey` is the value from `DEPT_FILE_MAP` (e.g. `factory`). |
| `fw_shellcfg_{deptKey}` | `JSON object` | Per dept | Cached `{dept}shell.json` for offline fallback. |
| `fw_fmeacfg` | `JSON object` | Global | Cached `fmeaconfig.json` for offline fallback. Factory only. |
| `fw_log_{username}_{date}` | `JSON object` | Per user × date | Cached copy of the user's OneDrive log file for a given date. Used by the observation push as a read-before-write cache. |
| `fw_obs_queue_{username}` | `JSON array` | Per user | Offline queue for observations that failed to push to OneDrive. Flushed on next successful auth. |
| `fw_re_prefs_{username}` | `JSON object` | Per user | Cached copy of `userprefs-{username}.json` for the rounds entry module. Used as fallback when the OneDrive fetch fails. Keys: `keypad_side`, `colour_mode`. |

**MSAL keys** are also stored in `localStorage` under Microsoft-controlled prefixes (e.g. `msal.{clientId}.cache.*`). These are managed exclusively by the MSAL library and must not be read or modified by IDMS code.

---

## 9. Event Lifecycle

An "event" (also called an "incident") represents a period of equipment downtime or a maintenance category logged by a crew member.

### Lifecycle states

```
[not started]
     │  tap preset or select equipment + category
     ▼
  ACTIVE  ──── endTime: null ──── stored in activeIncidents[]
     │                            persisted to fw_active_{u}_{d}
     │  tap Resolve
     ▼
  RESOLVING  ── screen-resolve: adjust times, add notes, select FMEA mode
     │  tap Confirm
     ▼
  RESOLVED  ── endTime set, duration calculated
     │         moved to resolvedIncidents[]
     │         syncToOneDrive() called immediately
     │         persisted to fw_resolved
     ▼
  [synced to OneDrive log file]
```

### Creating an incident

`startTimer(equipment, category)`:
1. Checks active incident count against `shellConfig.timers.max_concurrent_timers`. If at max, shows `screen-concurrent-modal` (warn and allow override or cancel).
2. Creates the incident object with `id = Date.now()`, `startTime = new Date().toISOString()`.
3. Pushes to `activeIncidents`.
4. Calls `saveState()` to persist to `localStorage`.
5. Opens `screen-timer` for the new incident.

### Resolving an incident

`openResolve()` → `screen-resolve`:

The resolve screen allows the user to:
- **Adjust start time** — "Use logged time" (original) or "Round to nearest 5 min".
- **Adjust end time** — "Now" (default) or "Custom" time picker.
- **Add notes** — free text, carried from the timer screen if already entered.
- **Select FMEA mode** — Factory only. See §12.

`confirmResolve()`:
1. Computes `endTime` and `duration` from adjusted times.
2. Sets `durationLabel` (e.g. `"29m 00s"`).
3. Removes incident from `activeIncidents`.
4. Pushes completed object to `resolvedIncidents`.
5. Calls `saveState()` and `syncToOneDrive()`.
6. Returns to `screen-home`.

### Deleting an event

`deleteEvent(id)` (from `screen-review` or `screen-event-detail`):
1. Prompts for confirmation.
2. Removes from `resolvedIncidents` in memory.
3. Adds `id` to `fw_deleted_ids` in `localStorage`.
4. Calls `syncToOneDrive()` immediately — the next write will omit deleted IDs.

---

## 10. Log File Write Behaviour

### File path

```
Documents/IDMS/data/{deptKey}/logs/report-{YYYY-MM-DD}-{username}.json
```

The date in the filename is the **vessel-local date** when the file was first created (the login date). Events from a cross-midnight session remain in the original file.

### Write triggers

| Trigger | Condition |
|---------|-----------|
| `confirmResolve()` | Immediately on every resolve. |
| `deleteEvent()` | Immediately on every deletion. |
| `syncTimer` (autosave) | Every `shellConfig.session.autosave_interval_seconds` (default 300 s). |
| `enterDepartment()` | On department entry, to restore any unsaved state. |

### Write strategy — `syncToOneDrive()`

The PWA uses a **read-merge-write** strategy for Factory log files to preserve observations written by the observation push path (which operates independently):

1. Acquire a fresh MSAL token via `acquireTokenSilent`.
2. For each filename that has pending changes (active + resolved incidents, deleted IDs):
   a. **For Factory:** GET the current remote file. Merge remote `observations` array with local resolved incidents, applying the deleted-IDs filter to both.
   b. **For Engine Room / Deck:** Write directly without reading first (no observations array to preserve).
3. PUT the merged payload to OneDrive.
4. On success: clear `fw_deleted_ids`.
5. On failure: log error; next autosave will retry.

### Payload structure

The written JSON matches the log file schema in §11 of the main IDMS-SCHEMA document:

```json
{
  "schema_version": 2,
  "vessel":         "F/V Araho",
  "department":     "Factory",
  "user":           "tploch",
  "user_id":        "2fb9eb13-...",
  "displayName":    "Taylor Ploch",
  "role":           "Chief Engineer",
  "date":           "2026-05-04",
  "generated":      "2026-05-04T14:32:00.000Z",
  "active":         [],
  "resolved":       [ ...incident objects... ],
  "observations":   [ ...observation objects... ]
}
```

**`schema_version`**: `2` for Factory (includes `observations`), `1` for Engine Room and Deck.

**`active` array**: The active incidents at the time of the write. Included so that in-progress timers are not lost if the browser is closed — the console ingestion layer treats these as open events. On the next session load, active incidents are restored from `fw_active_{u}_{d}` in `localStorage`, not from OneDrive.

---

## 11. Observation Push (Factory)

Factory-department users see an observation icon on the home screen (hidden for other departments). Tapping it opens `screen-observation`.

### Purpose

Capture real-time production rate observations against a line section. These are pushed into the user's log file as `observations[]` entries and later ingested by the console into the `capacity_observations` SQLite table for the OEE module.

### Observation form fields

| Field | UI element | Notes |
|-------|-----------|-------|
| Section | `<select id="obs-section">` | Populated from `factoryconfig.production.line_sections`. |
| Observed rate | `<input type="number" id="obs-rate">` | Optional. If entered, shows the unit selector. |
| Rate unit | `<select id="obs-unit">` | Options: `mt/day`, `pans/min`, `cases/hr`. Shown only when a rate is entered. |
| Notes | `<textarea id="obs-notes">` | Optional. Max 300 characters. |

### Observation object written to log file

```json
{
  "obs_id":          "uuid-v4",
  "obs_timestamp":   "2026-05-04T09:42:00.000Z",
  "section_id":      "3e4a5f6b-7c8d-4e0f-a1b2-000000000001",
  "section_label":   "Plate Freezers",
  "asset_code":      null,
  "observed_rate":   48.5,
  "rate_unit":       "mt/day",
  "failure_mode_id": null,
  "notes":           "",
  "source":          "pwa",
  "oee_session_id":  null,
  "wind_speed_kt":   null,
  "sea_state_ft":    null
}
```

`source` is always `"pwa"` for observations submitted from the field PWA. The `oee_session_id`, `wind_speed_kt`, and `sea_state_ft` fields are reserved for console-side OEE sessions and are always `null` when written by the PWA.

### Write path for observations

`pushObservationToOneDrive(username, dateStr, observation)`:

1. Try to GET the current remote log file from OneDrive. If the GET fails, fall back to the `fw_log_{username}_{date}` cache.
2. If the file doesn't exist yet, initialise a blank log payload with `schema_version: 2`.
3. Ensure `observations` array exists on the payload.
4. Deduplication: skip push if an entry with the same `obs_id` is already present.
5. Append the new observation.
6. PUT the updated file to OneDrive.
7. Update the local cache in `fw_log_{username}_{date}`.

This path runs **independently of `syncToOneDrive()`** and targets only the observations array, not the events. Both paths use the same read-merge-write pattern to avoid clobbering each other.

### Offline queue

If `pushObservationToOneDrive` fails (no network or auth error), `queueObservation(username, dateStr, obs)` appends the observation to `fw_obs_queue_{username}`. On the next successful authentication, `flushObservationQueue(username)` replays all queued observations in order. Successfully flushed items are removed from the queue; failed items remain.

---

## 12. FMEA Integration (Factory)

The FMEA (Failure Mode and Effects Analysis) failure-mode picker is shown on `screen-resolve` only when:
- `currentDepartment === 'Factory'`
- `FMEA_CFG` is loaded and contains a non-empty `failure_modes` array

### Config loaded

`fmeaconfig.json` is fetched from `config/fmeaconfig.json` on every Factory department entry (`loadFmeaConfig()`). It is cached in `fw_fmeacfg` for offline use.

### Picker behaviour

`populateFmeaDropdown(incident)`:
- Filters `FMEA_CFG.failure_modes` to entries with `enabled !== false`.
- Populates the `<select id="resolve-fmea">` dropdown with `{ failure_mode_id, label }` pairs.
- Appends a fixed "Other / Unsure" option (`value: "other"`).
- Shows `resolve-fmea-block` (hidden for non-Factory or when FMEA config absent).

`onFmeaSelectChange()`:
- When `"other"` is selected, shows `resolve-fmea-other-wrap` (a free-text notes input).
- Otherwise hides it.

### Written to incident object

When `confirmResolve()` runs, two fields are added to the resolved incident object if the FMEA block was visible:

| Field | Type | Value |
|-------|------|-------|
| `failure_mode_id` | `string \| null` | UUID of the selected mode, `"other"`, or `null` if no selection made. |
| `failure_mode_other_notes` | `string` | Notes from the "other" text input. Empty string if not used. |

These fields are absent from Engine Room and Deck incident objects. The console ingestion layer treats absent fields as `null` / `""`.

---

## 13. Department Behaviour Matrix

| Behaviour | Factory | Engine Room | Deck |
|-----------|---------|-------------|------|
| Active module | ✅ Built | ⬜ Not built | ⬜ Not built |
| Event timing | ✅ | (planned) | (planned) |
| Observation push | ✅ | — | — |
| FMEA mode on resolve | ✅ | — | — |
| Log file `schema_version` | `2` | `1` | `1` |
| `observations[]` in log file | ✅ | — | — |
| Home observation icon | ✅ Visible | Hidden | Hidden |
| `fmeaconfig.json` load | ✅ | — | — |
| Dept key in paths | `factory` | `engine` | `deck` |

Departments not in `ACTIVE_MODULES` route to `screen-inactive` on selection and show a placeholder message. Their config files are not loaded and no log files are written.

---

## 14. Permission Enforcement

The PWA enforces a subset of the permission model defined in §14 of the main IDMS-SCHEMA.

### Permission tier source

Shell files contain a `permissions` object whose arrays reference permission tier strings (`"admin"`, `"standard"`, `"observer"`). The logged-in user's `permission_tier` (loaded from `userconfig.json`) is compared against these arrays.

```json
"permissions": {
  "can_delete_events": ["admin"],
  "can_edit_events":   ["admin"],
  "can_view_all_logs": ["admin", "standard"],
  "can_export_report": ["admin", "standard"]
}
```

### Enforced actions

| Action | Permission check |
|--------|-----------------|
| Delete an event | `can_delete_events` includes user's tier |
| Edit a resolved event's time/notes | `can_edit_events` includes user's tier |
| View all users' events in report screen | `can_view_all_logs` includes user's tier |

`applyRolePermissions()` is called on department entry. Currently a stub — permission checks are applied inline at the action point rather than via a central enforcement function.

### Observer tier

Users with `permission_tier: "observer"` see a read-only view. They can log in and view events but cannot start timers or submit observations.

### Retired users

Users with `status: "retired"` are blocked at the `submitLogin()` step. The login error message reads: *"This account is no longer active."*

---

## 15. Multi-User Session Model

A single tablet can be shared by multiple crew members across a shift. The PWA supports this via `switchUser()`.

### How it works

1. User A logs in. Their session is stored in `fw_session`.
2. User A taps their **avatar or username/role text** to open the user menu and selects "Switch User".
3. `switchUser()` is called:
   - Saves all active incidents for User A under `fw_active_{userA}_{dept}`.
   - Clears `fw_active`, `fw_user`, and `fw_session`.
   - Returns to `screen-login` (MSAL stays signed in — no re-auth needed).
4. User B logs in. Their active incidents are restored from `fw_active_{userB}_{dept}`.

### Isolation guarantees

- Active incidents are keyed per-user-per-department, so User B's login does not expose User A's running timers.
- Resolved incidents (`fw_resolved`) are **shared** within the browser session because a day's log file may contain events from multiple shift users. Both users' resolved events appear in the report screen.
- Presets are per-user-per-department (`fw_presets_{user}_{dept}`).

### Department change

When a user who belongs to multiple departments changes their active department (from `screen-dept`), `enterDepartment()` saves the current department's state and reloads config for the new department. Active incidents from the previous department remain in `fw_active_{user}_{prevDept}` and resume on next entry.

---

## 16. Report Screen

`screen-report` renders a read-only summary of the current day's events.

### Data source

The report screen fetches **all** log files for the current department and date from OneDrive (not just the logged-in user's file), subject to permission:

- `can_view_all_logs` tier: all users' log files for today are fetched and merged.
- Other tiers: only the logged-in user's own log file is shown.

This fetch uses `listFolder()` (Graph API `children`) to enumerate the department logs folder, filters to filenames matching today's date, then fetches and parses each.

### Displayed data

- **Summary strip**: total incident count, total downtime (seconds → formatted), unique users contributing.
- **By equipment**: top N equipment by total downtime.
- **By category**: top N categories by count.
- **Incident list**: all resolved events, sorted by `startTime`, showing equipment, category, duration, user, notes.

### Report screen loading states

| State | Display |
|-------|---------|
| Fetching | `report-loading` div shown; content hidden. |
| Error | `report-error` div shown with message; content hidden. |
| Loaded | `report-content` div shown; loading hidden. |

---

## 17. Offline Handling

The PWA has no service worker and is not registered as an installable PWA (no `manifest.json`). It requires a network connection to:
- Authenticate via MSAL on first load
- Fetch config files
- Push log files to OneDrive

### Resilience mechanisms

| Mechanism | Covers |
|-----------|--------|
| MSAL `localStorage` token cache | Tokens survive page reload; silent re-auth works without network for up to 1 hour (access token lifetime). `offline_access` scope enables refresh tokens, extending this. |
| Config `localStorage` cache | `fw_deptcfg_*`, `fw_shellcfg_*`, `fw_fmeacfg`. Config loaded from cache if OneDrive fetch fails. |
| `fw_active_{u}_{d}` | Active incidents survive page reload. Crew can keep timing events if the page reloads during a shift. |
| `fw_resolved` | Resolved incidents survive page reload. The next autosave cycle will push them when connectivity returns. |
| Observation offline queue (`fw_obs_queue_*`) | Observations queued when push fails. Flushed on reconnect. |
| Autosave retry | `syncToOneDrive()` runs every 5 minutes. A failed sync is retried on the next tick. |

### Known gaps

- A complete loss of network for >1 hour will cause MSAL silent re-auth to fail when the access token expires. The next `syncToOneDrive()` call will fail silently; resolved incidents remain in `fw_resolved` and will be pushed when connectivity is restored and the page is reloaded (triggering a fresh MSAL silent auth attempt).
- If the user clears browser storage between sessions, all cached config and queued observations are lost.

---

## 18. Schema Version Checking

The PWA compares its compiled-in `SCHEMA_VERSION` constant against the `schema_version` integer read from `userconfig.json` on every page load.

**Current value:** `2` (matches main IDMS-SCHEMA current schema version).

If `userconfig.schema_version > SCHEMA_VERSION`:
- The app shows a persistent banner: *"Configuration has been updated. Please reload to get the latest version."*
- The user can still operate, but may encounter unexpected behaviour if new required fields are missing.

If `userconfig.schema_version <= SCHEMA_VERSION`: no banner; normal operation.

**Rule:** whenever the main IDMS-SCHEMA increments the schema version, the `SCHEMA_VERSION` constant in `index.html` must be updated to match.

---

## 19. Planned Modules

The following capabilities are planned for future PWA phases. None are currently built.

### Engine Room module

Mirror of the Factory event-timing module. Will use `engineconfig.json` + `engineshell.json`. Log files will be `schema_version: 1` (no observations array). FMEA block will not be shown on resolve.

**Entry trigger:** `ACTIVE_MODULES` gains `'Engine Room'`. No other code changes required for the basic event log.

### Deck module

Same pattern as Engine Room. Uses `deckconfig.json` + `deckshell.json`.

### Rounds entry *(Built — v1.3)*

`roundsentry.js` is the field rounds data-entry module. See §20 for full documentation.

**Entry point:** Rounds icon on `screen-home` → `showScreen('screen-roundsentry'); initRoundsEntry()`

**Key behaviour (summary):**
- Reads `roundsconfig.json` + `userprefs-{username}.json` from OneDrive on init.
- Filters items by `dept_key`, `active_rounds`, and `active_days`.
- Infers current round number per the §24 rule; stores as payload-level `round_number`.
- Loads two most recent aggregate files from `data/rounds/{year}/` for history columns.
- Writes per-user entry log per v2.14 §22 on submit, to `data/rounds/logs/{username}/{YYYY}/`.
- Partial rounds can be submitted (OK / Cancel warning, not a block).
- `add_oil` items are excluded from the incomplete count and zero values are not stored.
- Saves `userprefs-{username}.json` on preference change.
- On tablet (≥ 768 px): expands `.phone-frame` to fill the full display and attempts browser fullscreen. Header and keypad are co-located in a 520 px side panel; keypad buttons are double height. A "Switch Sides" button in the header swaps the panel left/right.

### Tasks & Maintenance

Field view of assigned tasks. Will allow crew to mark tasks in-progress and submit completion records. Reads task definition files from `data/tasks/definitions/`. Writes to `data/tasks/active/{username}.json` and `data/tasks/records/`.

### Rough Log entry

Simple form allowing crew to submit manual rough log entries from the field. Writes to `data/roughlog/roughlog-{YYYY}.json` via read-merge-write (same pattern as observations). `source` field will be `"pwa"`.

### Service worker / installable PWA

No service worker exists today. A future phase may add:
- `manifest.json` — makes the app installable to a device home screen.
- `sw.js` — caches the app shell for offline load; background sync for queued log writes.

Adding a service worker will require care around the MSAL redirect flow (redirect URIs must exactly match the registered Azure URI).

### Security hardening

Current passwords are plaintext in `userconfig.json`. Planned work:
- Hash passwords with bcrypt (or a WebCrypto equivalent) before storage.
- Introduce a server-side session token to replace the localStorage session.
- Rate-limiting on login attempts.

---

---

## 20. Rounds Entry Module (roundsentry.js)

**File:** `roundsentry.js` (external script, loaded after `index.html` main `</script>`)  
**Screen:** `<div class="screen" id="screen-roundsentry">`  
**Entry point:** `initRoundsEntry()` — called by the rounds icon button on `screen-home`  
**Data contracts:** IDMS-SCHEMA-v2.14 §22 (write), §23 (history read), §24 (paths + round inference)

### Module state object

All state for the rounds module lives in a single `const RE = { … }` object in the `roundsentry.js` module scope.

| Field | Type | Description |
|-------|------|-------------|
| `config` | object \| null | Loaded `roundsconfig.json`. |
| `prefs` | object | Loaded `userprefs-{username}.json`. Defaults: `{ keypad_side: "right", colour_mode: "dark" }`. |
| `flatItems` | object[] | All section+item objects in display order, including headings. |
| `navItems` | object[] | Subset of `flatItems` — only items requiring user input (no headings). The cursor moves through this array. |
| `cursorIdx` | integer | Index into `navItems` of the currently active item. |
| `values` | object | `{ item_id: string \| null }`. User-entered values keyed by `item_id`. |
| `secd` | object | `{ item_id: boolean }`. Whether each item has been SEC'd. |
| `aggNew` | object \| null | Most recent aggregate file contents (history column 3). |
| `aggOld` | object \| null | Second-most-recent aggregate file contents (history column 2). |
| `roundNum` | integer \| null | Inferred current round number. |
| `scheduledTime` | string \| null | Corresponding scheduled time `"HH:MM"`. |
| `vessel` | string | From `roundsconfig.json`. |
| `submitting` | boolean | Prevents double-submit. |
| `isTablet` | boolean | `window.innerWidth >= 768`. Re-evaluated on resize. |
| `freshCursor` | boolean | Set to `true` when the cursor moves to a different row (click or arrow key). The next digit or decimal keypress replaces the existing value instead of appending. Cleared after the first keypress and on backspace or sign-toggle. |

### Init sequence

`initRoundsEntry()` runs on every navigation to `screen-roundsentry`:

1. Load `roundsconfig.json` and `userprefs-{username}.json` in parallel (`reGet`). If config load fails, display error and abort.
2. Infer round number using `reInferRound(config.schedule)` — implements §24 rule exactly.
3. Filter items: `reFilterItems(config, roundNum, dayOfWeek)` — prunes sections/items not matching the user's `dept_key`, `active_rounds`, and `active_days`. Headings with no following data items are also pruned.
4. Build `RE.flatItems` and `RE.navItems`. Initialise `RE.values` and `RE.secd`.
5. Render the screen shell and grid (`reRenderScreen()`).
6. In the background (non-blocking): list the two most recent aggregate files from `data/rounds/{year}/`, fetch and store in `RE.aggNew` / `RE.aggOld`. On completion, refresh history columns in the grid.

### Item filtering (`reFilterItems`)

An item is shown if **all** of the following are true:
- The item's `dept_key` is `null`, OR it matches one of `currentUser.departments` mapped to dept keys (`"Engine Room" → "engine"`, `"Factory" → "factory"`, `"Deck" → "deck"`).
- `active_rounds` is absent OR includes `RE.roundNum`.
- `active_days` is absent OR `null` OR includes the current day-of-week (1=Monday, 7=Sunday).
- `type !== "heading"` — headings are always included as visual separators, but a heading is pruned if it has no data items following it before the next heading or section end.

### Grid layout

The entry grid is a 4-column CSS grid rendered as rows within `#screen-roundsentry`.

| Column | Content |
|--------|---------|
| 1 | Item label (from `roundsconfig.json`) |
| 2 | Previous-previous aggregate round value (`RE.aggOld.items[item_id].display_value`) |
| 3 | Previous aggregate round value (`RE.aggNew.items[item_id].display_value`) |
| 4 | Current entry — editable, active |

- History values show `—` for absent, null, or SEC'd aggregate entries.
- Seven rows visible at a time; scrolls vertically for longer lists.
- The active row (current cursor position) is rendered brighter; the active cell (column 4) is distinctly highlighted.
- Section heading rows span all columns and are display-only.
- Cursor movement updates only the affected rows (surgical DOM update — no full re-render on keypress).

### Keypad layout

```
 ←    −    ▲
 7    8    9    ▼
 4    5    6   SEC'D
 1    2    3   ┐
 0   dcml  _   ┘ enter (spans rows 4–5)
```

- **Phone** (< 768 px): fixed to bottom, full width.
- **Tablet** (≥ 768 px): rendered inside `re-side-panel` (520 px wide) alongside the screen header. Panel sits to the right or left of the data grid per `RE.prefs.keypad_side`. A "⇄ Switch Sides" button in the header calls `reToggleKpSide()`, which toggles `keypad_side`, saves `userprefs-{username}.json`, and re-renders. Keypad button height is doubled vs. phone (28 px vertical padding).
- **Hidden** when active item is `custom` or `text` type.
- SEC'D button is visually subdued (grey background) to prevent accidental activation.
- `dcml` inserts a decimal point. If `freshCursor` is set, clears the field first (sets value to `"."`).
- `enter` spans grid rows 4 and 5 (CSS `grid-row: span 2`).
- `←` (backspace): if `freshCursor` is set, clears the field entirely; otherwise removes the last character.
- First-keystroke-replaces: when `RE.freshCursor` is `true`, the next digit or `dcml` press replaces the current value rather than appending. `freshCursor` is set by `reCursorTo()` when the cursor moves to a new row.

### SEC'D behaviour

`reSecD()` marks the current heading group as secured:

1. Find the most recent `heading` item above the active `navItem` within the same section. If none exists, treat all items before the first heading in the section as the group.
2. Mark all non-heading items in that group: `RE.secd[item_id] = true`, `RE.values[item_id] = null`.
3. Advance cursor to the first item of the next heading group, or to the first item of the next section, or to the submit prompt if no items remain.
4. SEC'd items count as complete for the purposes of the completion check.

### Colour mode

The rounds entry screen supports independent dark/light mode:

- Toggle button in the screen header (not on the keypad).
- Switching updates `RE.prefs.colour_mode`, applies `data-re-colour` attribute to `.re-root`, saves `userprefs-{username}.json`.
- Scoped via `#screen-roundsentry[data-re-colour="dark/light"]` CSS custom properties. Does not affect other PWA screens.

### Gesture lockout

Applied on `screen-roundsentry`, removed on exit:

| Gesture | Prevention |
|---------|-----------|
| Pull-to-refresh (swipe down at top of scroll container) | `touchmove` handler — `preventDefault()` when vertical swipe starts at `scrollTop === 0` and `dy > 8`. |
| Swipe-back navigation (horizontal swipe near left/right edge) | `touchmove` handler — `preventDefault()` when `|dx| > |dy|` and touch started within 20 px of the screen edge. |
| Swipe-up (home gesture) | Not intercepted — allowed through. |

### Submit flow

`add_oil` type items are **never** counted as incomplete — they represent optional oil additions and may legitimately be zero / unentered.

1. Count incomplete items: items where `item.type !== 'add_oil'` AND not SEC'd AND `reItemComplete()` returns false.
2. If `n > 0`: show modal — *"n items not yet checked. Submit anyway?"* with **Cancel** and **OK** buttons.
   - **Cancel**: dismiss modal, return to entry screen; no submission.
   - **OK**: proceed to step 3.
3. Show confirmation modal: **"Submit rounds?"** with OK / Cancel.
4. On OK: build §22 payload with `round_number` and `scheduled_time` at the **top level** (and echoed per-entry), call `rePut(path, payload)` to write to `data/rounds/logs/{username}/{YYYY}/roundslog-{username}-{YYYY-MM-DD}-{HHmm}.json` where `{HHmm}` is the UTC wall-clock time at submission.
5. On success: return to department home screen.
6. On failure: display inline error; keep data in `RE.values` / `RE.secd`; allow retry.

### Graph helpers (module-private)

| Function | Description |
|----------|-------------|
| `reGet(path)` | Graph API GET returning parsed JSON. 404 → `null`. |
| `rePut(path, data)` | Graph API PUT. Returns response JSON. |
| `reListChildren(path)` | Graph API list folder children. Returns `value[]` array. |
| `reRefreshToken()` | Acquires fresh MSAL token via `acquireTokenSilent`. Falls back to redirect on failure. |

All helpers use the module-global `graphToken` / `msalInstance` / `msalAccount` / `MSAL_SCOPES` from the PWA's existing auth layer.

---

*End of PWA-SCHEMA-v1.1*
