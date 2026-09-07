# IDMS Schema Specification
**Version 2.41 — F/V Araho**

v2.41 *(2026-09-07)* — **Development Plan specified (§43, new); §35 KSA Profiles superseded.** A *derived* training plan per crew member — computed at read time from what their work demands and what the journal says they hold, never stored — answering: which competency cards does your work demand, at what level, what do you hold, and what closes the gap. Demand comes from three rings, strongest first: tasks holding the member, the department's due work inside a window, and the department's whole card set; each ring joins task equipment codes to SOP and TASK cards by the same asset rule the Console already uses for competency currency (equal, or one level under), then follows `requires_ksa`. Two currencies are kept apart and never folded into one ladder: **practice currency** (did the work inside the chief's recency window — the existing pips, time-based) and **revision currency** (has read the current revision of a card — version-based, never time-based). The plan renders on three surfaces from one derivation — the member's own card (Console User Profile and a new PWA **Me** section: Profile, KSA card, Training), the chief's member sheet, and a new Console **KSA Plan** panel that holds the per-department configuration and the vessel view (competencies demanded by due work that nobody holds; held by exactly one person). The derivation lives in `utils/plan-derive.js`, **byte-identical with the Console's copy** like the reducers, enforced by `tools/test/console-derive.test.js`. Two new Console-published mirrors under `data/personnel/`: `ksa-demand.json` (every SOP and TASK card's asset, department and `requires_ksa`, with vocabulary defects listed rather than silently normalised) and `currency/{crew_id}.json` (per-member competency currency, so the phone can show it without SQLite). `ksa-config.json` gains a department-keyed `plan` block. Guardrails carried over from the Console's personnel-development decisions and restated as contract: no percentage complete, no ranking across members, nothing feeds pay or discipline; the chief's grid gains one safety flag only. The read-marker stream that arms revision currency (`data/personnel/exposure/{YYYY}/`) is specified here and **not built in this slice** — it needs the Navipedia export to give the phone a card to open. §35 is superseded in place: its supervisor score and per-skill counters contradict the exposure-not-proficiency decision and are dropped.

v2.40 *(2026-09-07)* — **§42.16 new: the contact book, and the supplier field that never worked.** The Console seeded 1,745 contacts from TM Master's contact export on 2026-09-06 and this spec never recorded it, so the phone had no book — and that was not only a missing screen. `procurementconfig.json`'s supplier list has never had a single entry in it, which meant `pcSupplierName()` returned the id it was given: every order and PO on the phone printed its supplier as a raw `CON-####`, and the New order form's supplier `<select>` offered exactly one option, "— none —", so **no order raised on the phone could name who it was going to.** Both are fixed by the book: names resolve from it, and the form's dropdown is now a search over it, because 1,745 options in a `<select>` is the same mistake as 14,487. The rules live in `utils/contacts-reduce.js`, **byte-identical with the Console's copy** the way `procurement-reduce.js` is, and enforced as such by `tools/test/console-derive.test.js`. The one rule worth stating twice: **the TM export is a baseline, not the truth** — add / edit / retire are `contact_created` / `contact_updated` / `contact_archived` / `contact_restored` events replayed over whatever baseline is current, **field by field, last write wins**, so a phone number corrected aboard survives the next export while the fields nobody touched still come from TM. Order history, spend and "last referenced" are TM's and no event may write them. Retiring never deletes: the order register still points at the card. The phone reads its order history off the baseline's own folded figures and its 25-order `recent` tail rather than fetching `order-register.json`, which is 2.7 MB to re-derive numbers already in hand — the supplier join is still made exactly once, in the seed, and nothing re-resolves a supplier from its name. New PWA screen **Contacts** (`procurement.html?view=contacts`) with its own hub tile, PWA 1.18. Two things measured against the real book and got wrong the first time, both now in `tools/test/contacts.test.js`: a comma is **not** a separator in the e-mail field (54 contacts are written `Surname, Given <addr>`, and splitting on it linked the surname to nothing) and a slash is **not** a separator in the phone field (93 numbers are written `207/594-4500`, and splitting on it dials 594-4500 — a wrong number rather than no number). 14 e-mail fields hold no address at all and 7 phone fields cannot be dialled; those are printed, not linked. Console-side Order history and Minimums remain Console-only, deliberately.

v2.39 *(2026-09-07)* — **§42.7a: the Console side is built, and the phone half is brought level with it.** The Console's Stock Location screen (`IDMS-Console/docs/stock-location.md`) landed the day after §42.7a and moved ahead of the phone in five places, four of which mattered. **A sheet is now filtered and capped on both surfaces**: Unlocalized Stock is 2,864 rows and Fwd Shop 583, and a phone asked to lay out 2,864 rows each carrying a number input stops responding before it draws anything — so a sheet over 25 rows gets a filter box, the render stops at 400, and the sheet **says** what it is not showing, a silent truncation being a sheet somebody signs for stock they never saw. **Unlocalized Stock is a space that can be audited**: it has no node in the stowage tree, and the phone's guard was written as "is this a real location", which locked the 2,864 addressless items out of the one action the screen exists for. **The item detail carries what the Console's third pane carries** — the state of the thing (critical, blocked in TM, added in IDMS, no stock figure in the export), category, unit of measure, the date on the last known price, and the last six movements, which is usually where the answer is when a count does not match. **Filing a count moves the focus to the next line**, and both search boxes redraw only their own list and put the caret back, so a filter can be typed without losing focus mid-word. Two differences stay and are now written down as deliberate rather than left to look like drift: the Console keeps a **tree pane** open beside the sheet where the phone drills down (a persistent tree on a 375px screen is a tree pane and no sheet), and **Print sheet** is Console-only (a phone is where you type a count, not where you print one). Also: Stock Location gets its **own tile** on the Procurement hub, beside Inventory rather than buried in the page's own sidebar, matching the Console's promotion of it to a nav entry — and the `?view=` gate that tile depends on was a second hand-written copy of the view list which had gone stale the moment Stock Location was added, so the tile would have opened the register; it reads `VIEWS` now. Separately, a **§42.14 policy-overlay bug** found while comparing the two Low stock views: the PWA's table printed the raw catalogue `min_qty`, so an item put on the list by an IDMS overlay showed a minimum of 0 beside a Suggest column working from the overlay's real figure — 13,885 items have no TM minimum, so an overlay is the only minimum most of the register will ever have, and this is the column that says why the row is there. It reads `effective()` now and marks an overlaid minimum `IDMS`, as the Console's row already did. **The rule, stated once:** a screen showing a policy-overlaid field reads it through `effective()`, never off the item. New suite `tools/test/views.test.js` renders the page's own `pcViewLow` and reads the number out of it, because this class of mistake raises no error and breaks no arithmetic test. PWA 1.17.

v2.38 *(2026-09-06)* — **§42.7a new: the count session, and the shared location sheet.** A `count` movement is a spot correction and always was; what the register could not say is that a *space* was swept. An item counted and found right moves nothing, so it files no movement, so it leaves no trace — a shelf walked end to end last Tuesday and a shelf nobody has opened in a year both read as "no count", and that is the one figure an audit turns on. Three events carry the sweep as its own thing: `count_session_opened` names a space and a scope (`here` for the bin, `deep` for it and everything under it) and records what the sheet held when it was opened; `count_session_closed` carries `confirmed[]`, the items seen and found right, which is the only evidence they were looked at; `count_session_abandoned` gives up the claim that the space was swept while leaving the counts already filed standing. **The arithmetic is untouched** — counts under a session are ordinary `count` movements carrying a `session_id`, a spot correction is the same movement with none, and deleting every session event changes no quantity. `expected` is read off the opening event rather than recomputed, so a transfer into the space an hour later cannot retrospectively turn a complete count into a partial one. Items gain `last_verified_at`, which moves for a count **or** a confirmation; `last_count_at` is unchanged, so nothing already reading it changes meaning. `locationSheet()` lives in the reducer rather than in either screen, because a sheet that differs by device is a sheet nobody can sign: it puts both the stock the book places in the space *and* the items whose home is there though the book says none are left — an emptied bin being exactly where a miscount hides — carries the book figure for **that space** rather than the shipwide total, prints unknown stock as unknown rather than as 0, and offers no count box on a deep row summing several bins, there being no single bin for the count to land in. New PWA screen **Stock Location** (`procurement.html?view=location`), PWA 1.16, whose space list is ordered by each space's last closed session. §42.10's cycle-counting paragraph is corrected while it is open: it claimed since v2.32 that the register sorts by `last_count_at` ascending, which it never has — the register is search-first, and least-recently-swept-first is the space list's ordering, not the register's. Console side not built.

v2.37 *(2026-09-06)* — **The two steps get their own names; §32a's known gap closed; `completed` removed from the last dropdown that offered it.** Reporting a job done and telling TM Master about it are two steps taken by two people, and neither client said so. Both called the first one *Close*. The Console's row button is now **Report Complete** (the engineer; writes the `task_records` row, task → `reported_complete`) and a record still sitting on `reported_complete` carries **Push to TM Master…** (the officer; the only path to `completed`), which opens the same approval screen the toolbar does, preselected on that job. The PWA's create form drops `value="completed"` — it offered a close-out option whose label explained that it did not mean completed, and `submitErTaskCreate` translated it to `reported_complete` on the way out; the value is the status now and `storedStatus` is gone. **§32a's known gap is closed**: `taskSubmitCreate` no longer writes `completed`, so nothing on either client can reach the terminal state except `recordPush`. Also corrected in the Console, and the reason the two steps were invisible: `TASK_UNION_SQL` hardcoded `'completed'` on every `task_records` row, so a record written but not yet pushed was filed in the archive — out of the active list, and so out of sight of the officer who still had to push it. The union reads the status off the task behind the record now, falling back to `'completed'` for imported history, which has no task behind it. That means a record can come back from a `status:'active'` query, so `getTasksUnified` gained a `source` filter and the Assigned Work board asks for `source:'task'` rather than dropping records after the fetch had already counted them.

v2.36 *(2026-09-05)* — **§32a new: what `completed` means; §32 status list corrected; §41.6 mirrors corrected.** A job is *reported complete* when the work is done and captured in IDMS, and *completed* when TM Master has it. Only a successful push writes the second, and no status dropdown on either client offers it any more — the Console's Update modal dropped `Close (Completed)` (it wrote no record), signing a job off lands it on `reported_complete`, and the PWA's close-out form now stores `reported_complete` while keeping `completed` as its own internal "closing now" flag for the `task_records` write. The effect is that the terminal state cannot be reached by forgetting to push, and a job the PMS has not been told about stays visible on Active Tasks and on the phone. §32's `status` row had listed `open / in_progress / completed / cancelled` since v2.3 and was three renames out of date; it now lists all nine and names the active/terminal split. §41.6's mirror paragraph said officer sign-off was the only path to `completed`; it is not — sign-off records the work and stops at `reported_complete`. §32a also records the one place the rule is not yet enforced: the Console's Close button (`taskSubmitCreate`) still writes `completed` directly.

v2.35 *(2026-09-05)* — **Procurement built in the Console (§42.12 rewritten from "not built").** `Operations → Procurement` in IDMS-Console 0.8.5, as two renderers of one contract rather than a second system that happens to agree: the same OneDrive event stream, the same TM Master catalogue, and `utils/procurement-reduce.js` mirrored byte-identical into `src/renderer/js/`. New ingest lane `sync-procurement.js` shaped exactly like `sync-notes.js` — raw events into `procurement_events`, whole derived cache rebuilt through the shared reducer, listing-minus-held rather than a cursor seek. New SQLite tables `procurement_items` / `_movements` / `_requisitions` / `_pos`, a `procurement` entry in `DIAG_REGISTRY` with a renderer-delegated rebuild, and Graph helpers including an ETag-guarded write of the `settings` block only. The register is filtered in SQL because 14,487 rows will not go through the renderer, and derived order/requisition lines carry a folded-in `item_name` since the Console holds no in-memory register. Approving a requisition and sending an order are Console-only, being officer actions; nothing is page-only. Adds `_procurement-harness.html`, a standalone page running the real screen, derive and reducer over a local catalogue with writes collected rather than sent.

v2.34 *(2026-09-05)* — **§42.15 new: the TM Master push-back lane, and what the history supports for minimums.** IDMS already exports service reports to TM Master and that lane is being extended into a general reconcile-and-push path; this module must not grow a second one, so its two write-shaped events are recorded as *input* to it — `item_change_proposed` is already a proposal in the ratified sense, and the superseded movement set (§42.14) is precisely the keying worklist a reconcile pass needs. The §42.13 reconciliation question resolves through that lane rather than inside this module. Also records an assessment of **deriving order minimums from history**, measured rather than assumed: 11,835 of 14,487 items (81.7%) show no movement across the three consumption years TM Master exports, and of the 2,652 that moved, the median three-year total is 3 units. The restock interval is a real 16 days (median gap across the 19 offloads in `scheduleconfig.json`), but **`est_delivery_days` is set on 1 item of 14,487**, and with a cycle that short the assumed lead time swings the answer four-fold. The 6,091 completed task records from 2017–2026 do not help: `items_used` is populated on 7 of them, and what was fitted lives in free text. Banding by evidence gives **448 items (3.1%) defensible today**, 408 of them new, and only 8 of the 58 critical-flagged items — critical spares are the slow movers consumption history cannot speak to. 67 of the 448 are already below their proposed minimum. Proposals are computed offline (`data/procurement/proposed-minimums.json`, read by nothing); publishing them as `item_policy_set` events is an officer's decision, not a computation. The standing argument for building it anyway is that issuing stock against a `task_id` is the structured parts-on-job capture `items_used` never got, and `po_sent`-to-first-receipt measures the lead times nobody recorded.

v2.33 *(2026-09-05)* — **Procurement wired to the real item master (§42.14, new; §42.5 superseded in place).** The vessel already has a register — 14,487 items and a 664-node stowage tree in TM Master, mirrored into the Engineering Vault at `50 Procurement/` — so the module stops inventing one. **TM Master is the system of record for what an item *is*; IDMS owns what it *does*.** A new builder, `tools/build-procurement-catalogue.py`, projects the Vault notes into `data/procurement/catalogue.json` (~1.8 MB, columnar and dictionary-encoded — the naïve shape is 4.6 MB) plus a lazily-fetched `catalogue-detail.json`; nothing writes to the Vault. The reducer gains `hydrateCatalogue()` and takes the catalogue as a **baseline**: quantities as at `baseline_at`, with movements applied only where `timestamp > baseline_at` — earlier ones stay in the ledger, marked, but move nothing, because the export already absorbed them. `in_stock: null` means unknown, not zero (2,181 items), and never raises a shortage. Because 13,885 of 14,487 items carry no minimum, IDMS keeps its **own policy overlay** — `min_qty`, `max_qty`, `reorder_qty`, `sfi_code`, `barcode`, `notes` via a new `item_policy_set` event, read through `effective()`, cleared back to TM Master by writing null. Edits to TM-owned fields become `item_change_proposed` events: recorded, shown, **never applied** — an officer changes TM Master and the next export carries it back. `on_order` now sums TM Master's outstanding (1,255 items) and this module's own open orders, kept apart in the derived state. The register screen is search-first with a deck browse and a 300-row cap, and line pickers are searches rather than 14,487-option dropdowns. The catalogue is cached in IndexedDB and re-fetched only on an eTag change. `procurementconfig.json` keeps only `settings`; its taxonomy arrays remain as a fallback for a vessel with no TM export.

v2.32 *(2026-09-05)* — **Procurement & Inventory specified and built in the PWA (§42, new).** Stores and ordering as one closed loop — hold, need, order, arrive — replacing the "To Order" list that has lived in Microsoft To-Do and, since PWA v1.10, as an Engine Room notes folder. Same architecture as §41: one append-only OneDrive event stream under `data/procurement/events/{YYYY}/`, a pure reducer (`utils/procurement-reduce.js`) mirrored byte-identical into the Console when its lane is built, and a standalone same-origin page (`procurement.html`) reached from a hub screen in `index.html`. **Procurement is a new top-level department**, role-gated (`permission_tier: "admin"`, `settings.approver_roles`, or `"Procurement"` in `departments[]`) until the crew records carry the department. Four governing rules: on-hand is never authored, only derived from movements and counts; one fact writes one event (there is no `po_received` — receipt is a `stock_movement` carrying `po_line_id`, and order progress is derived from it); items are archived, never deleted; and the taxonomy — storerooms, bins, categories, units, suppliers — is config owned elsewhere, read tolerantly, so no reshuffle of the storerooms can hide stock. Movements are one event type with a `kind` discriminator (receipt / issue / adjustment / transfer / count) and an always-positive `qty`, `direction` carrying the only sign in the system. Requisitions separate *we need this* from *we have ordered this*, support free-text lines for parts never yet aboard, and record per-line approval decisions in one event. Receiving supports partial, over- and no-PO receipts, is idempotent under interruption, and writes one movement per line. Low stock counts `on_hand + on_order` against `min_qty`, which is the specific defence against ordering the same part twice. Issuing a part to a job references `task_id` / `equipment_code` but **never** writes to `task_records`, TM Master or job history — §41's boundary, restated. New config file `config/procurementconfig.json` (locations, categories, units, suppliers, settings), registered in the §1 File Location Map; its `settings` block is the only part the PWA writes, ETag-guarded.

v2.31 *(2026-09-02)* — **Notes Hub specified (§41, new); §34 Messages superseded.** Adds the full contract for the Notes Hub: a shared, non-private, event-sourced notes surface — an in-house Microsoft To-Do — acting as the go-between for the PWA and the Console. One OneDrive append-only event stream under `data/notes/events/{YYYY}/` (envelope per `docs/architecture.md`, same pattern as the Phase 4/5 event logs), rendered by two implementations over three surfaces: a standalone page in this repo (same origin and MSAL registration as the PWA — also usable as a browser window kept open beside other work), a PWA screen sharing that same code, and a native Console screen fed from the SQLite derived cache by a new `notes` ingest lane. Notes carry a single-line title, optional photo(s), optional body, an optional SFI equipment tag, and an optional `steps[]` checklist; anyone can read, author (including department level, for now — mostly-global rules by design), comment (with photos, reusing the rounds-comment attachment conventions), assign, and promote. Promotion prefills the existing Task Creation screen and submits through each client's *existing ETag-guarded* definition-create path (v2.31 supersedes an earlier working plan for a proposal-inbox: both Console and PWA creates have been guarded since Phase 6 Stage 0, so no new write lane is needed). After promotion the note converts to a task-mirror wrapper — department-level notes can also import tasks directly as mirrors — and a mirror's strike fires the existing `reported_complete` action, never a second completion state: **notes never touch `task_records`, TM Master, or job history.** Deletion is a tombstone event (authors their own, department heads any; Archive is the default on notes carrying others' comments). Alerts are derived (assigned-to-me + department-head-flagged group alerts), acknowledged per user via `alert_acked` events, surfaced as one summary popup at login (both `routeAfterLogin` branches) and on sync diffs. Emergency checklist templates (Blackout Recovery, Boundary Isolation) instantiate under deterministic note ids (`{template_id}-{local date}`) so independently-offline devices converge on one note without de-duplication; a 60-minute reconciliation window handles boundary cases via Console-emitted `note_merged` events. Offline generation makes the service worker a stated prerequisite of the emergency stage (not of the hub's first release). The hub records who did what, when — it never authorizes, and it is explicitly not LOTO. §34 Messages is superseded in place (group alerts cover broadcast; comments cover threaded discussion; person-to-person direct messaging is dropped). §31 Rough Log gains a cross-reference for the display-time daily digest of completed assigned notes. New config file `config/notesconfig.json` (department heads, department folders, checklist templates), registered in the §1 File Location Map.

---

v2.30 *(2026-05-27)* — **Release marker: IDMS Console v0.2.9; Standard-tier nav access for Rounds Setup.** Cuts a shipped release containing every schema delta since v2.23 (which shipped as v0.2.7). Entries v2.24 through v2.29 (rounds-entry comments, ORB C/11 walker recompute, Phase 4 + Phase 5 event-log subsystems, Maintenance & Tasks consolidation, rounds-comment photo attachments, password masking, Skill Tags edit gating) are all included in this release. Companion PWA release tag is v1.9 (`PWA-SCHEMA-v1.1.md`).

**Standard-tier nav access expansion (no on-disk schema change).** `applyCrewNavVisibility` in `src/renderer/js/app.js` now shows the Config sidebar group to `permission_tier === 'standard'` users in addition to admin (purser tier still excluded). Within the Config group, the nav buttons for Vessel Setup (`data-screen="vessel"`), Crew Setup (`data-screen="crewsetup"`), and Settings (`data-screen="settings"`) are individually hidden for non-admin tiers — only Equipment Setup is visible to Standard. Inside `screen-equipment`, `renderEquipment` in `src/renderer/js/equipment.js` forces `EQ.activeTab = 'rounds'` for non-admin users and conditionally renders only the Rounds Setup tab button; the Group Assignment and Sub-Group Assignment tabs remain admin-only. Net effect for Standard tier: full access to Dashboard, Factory Production, Rough Log, Trip Analytics (view-only via existing `taIsAdmin` gating), Maintenance & Tasks, Tank Levels & Transfers, Oil Record Book, Bunker Pre-Load, Schedule, Training Matrix, User Profile, Factory Events, Report Generator, Rounds Log, and Equipment Setup → Rounds Setup. Crew List remains gated by `canSeeCrewList()` (admin OR operational role); Vessel Setup, Crew Setup, and Settings remain admin-only.

v2.31.1 *(2026-09-02)* — **Notes Hub: crew_id identity, General scope, sections, stars, documents, retention.** First round of live-use corrections and additions. **crew_id replaces username as the Notes Hub identity key** (§41.4a) — 97 of 112 `crewconfig.json` records carry `username: null`, so the roster collapsed onto the first null-username record and every personnel row rendered as the same person; `assignee_username` still rides along on assignment for the PWA alert check. Personnel lists now show active crew only, with inactive behind a collapsed header. Assignment is constrained to active crew of the note's own department and its placeholder stays "Assign to…" — most notes never need an assignee. New **General** scope above the departments for interdepartmental notes. **Sections** (the former department folders) become their own headers between Department and Personnel, added / renamed / removed from the Notes page under an ETag-guarded `notesconfig.json` write; removing one re-files its notes rather than deleting them. Notes are **dragged between any of those places** (one `note_edited`), can be **starred** (shared, sorts above everything, `note_starred`/`note_unstarred`), and starred notes accept a **manual order** (`note_reordered`, float `sort_index` so an insert is one event). Attachments gained **documents alongside photos** (§41.4b) — the `＋` on the add bar or a file dropped onto it, at creation time as well as after — stored byte-for-byte under `data/notes/files/{item_id}/` with a 4 MB refusal rather than a raw 413. New **attachment retention** (§41.14): 30 days after delete or completion, 10 after promotion, never for archived, earliest clock wins; eligibility is computed by the shared reducer and shown on the note, but **nothing deletes on a timer** — the purge is an officer action in the Console, per architecture.md, and that screen is the next slice. Also new: `note_unarchived`. Two §41.13 open items are closed.

v2.31.2 *(2026-09-02)* — **Notes Hub: vessel-confined crew, three-state assignment, several assignees.** `crewconfig.json` is the fleet's roster, so every crew list in the hub now filters on vessel by the shared `taskSameVessel` rule — two Alaska Spirit hands were appearing on Araho lists, one of them the record every personnel row had been collapsing onto. Assignment becomes one three-state control (§41.6a): **Unassigned note** (default), **Assignable** (offered to anyone; surfaces in the Notes Tray), then the **Assign to** list, which is a multi-select — a note may be carried by several people. A shared note is one note on several plates, never a copy each: it is pinned into each assignee's personal list, **pin outranking star**, and completing it anywhere completes it for everyone. Removing the last assignee leaves the note assignable rather than unassigned. New event `note_assignment_set`; `note_assigned` now adds a person and `note_unassigned` drops one (or all, with no crew_id). The reducer keeps `assignee` / `assignee_username` as first-assignee mirrors for existing readers and adds `assignee_usernames` as the membership test the PWA alert check uses. Dragging a note onto a person in the sidebar now **assigns** rather than re-files, since re-filing would take the note away from where the work lives. **Still to build (next slice):** the Console's Assigned Tasks board — Notes Tray beside a renamed Tasks Tray, notes on member cards, and drag-between-people with the Reassign / Add Personnel choice. Multi-assignee on *tasks* is a shared-file contract change and is specced separately before any code.

v2.31.3 *(2026-09-02)* — **Assigned Tasks board carries notes; several holders per task.** The board gains a **Notes Tray** beside the renamed **Tasks Tray**, and member cards now list every open task *and* note on that person (§41.6b). Dragging from one person to another asks **Reassign** or **Add Personnel** rather than guessing; the row `×` takes that one person off and leaves any others. The task assignment picker's people become **checkboxes** — several may hold one job — with *Unassigned* and *Locked* staying exclusive. Task multi-assignment is **additive** (§41.6c): new `tasks.assignees` (JSON array, DDL column plus a guarded ALTER) alongside the unchanged `assigned_to`, which is always written as the first holder; when the two disagree a writer that does not know the list has changed the holder, so the single field wins and the stale list is discarded — which is what keeps the PWA correct with no change to it. `getTasksUnified` exposes `assignees`; `taskAssigneeKeys` / `taskAssigneePatch` are the only readers and writers of the pair.

v2.31.4 *(2026-09-02)* — **Two-level organisation, note dragging, full names.** The folder band gains **groups**: a group sits at the level of Department notes and holds folders, giving two levels and no more (§41.4a). A note's `folder` becomes a path — `"Folder"`, `"Group"`, or `"Group/Folder"` — and `department_folders[{dept}]` now holds bare strings (unchanged, what every existing config contains) or `{type, name, folders[]}` objects; reading normalises both, and a groupless config is written back byte-identical. Groups and folders are added, renamed, removed and dragged into any order inside the band, with the Department-notes and Personnel headings as hard stops and a group refused inside a group. Renaming or moving re-paths the notes beneath, children included. **Dragging a note** now files it into a folder or group, and onto a person means hand-over for a personal note (ownership moves) or assignment for a department or global one. The Console screen gains note dragging, which it did not have at all. Personnel lists show **full names** in both clients — two Sams and two Taylors aboard mean a first name is not an identification.

v2.31.5 *(2026-09-02)* — **The shared window, and a signalled sign-in expiry.** A notes window left open for anyone to write in now records `actor: "browser"` — shown as **"Browser addition"** — instead of whoever last signed in (§41.4d): it says what is known, that the note came from that window, rather than naming the wrong person. Toggled from the footer, remembered per browser, and pinnable with `?shared=1`. `browser` is a reserved actor and never a crew member. Also: an expired Microsoft sign-in is now a stated condition rather than a red dot that retries forever — already-synced notes stay readable, a banner offers **Sign in again**, and writes refuse with that reason instead of a raw `AADSTS` code (§41.2).

v2.31.6 *(2026-09-05)* — **Note type gains Equipment; notes filed against the register.** The Notes Hub's assignment control becomes a **Note Type** control with three kinds (§41.6a): *Unassigned*, *Assignable* — which is where the **Assign to** crew list now lives — and **Equipment**, which attributes the note to one component of the asset register by its code. The panel below the radios changes with the choice: nothing, the crew list, or an equipment search box. `note_assignment_set` gains `mode: "equipment"` carrying an `equipment_code`, and the two person-less modes clear that code, so the control can never disagree with what the note says it is. The reducer's `assignment` gains a fourth value, `equipment`; a note created with an `equipment_code` and nobody on it reads as equipment-typed without needing a second event. The Notes page reads `config/assets.csv` directly for the picker and the code→name lookup — the first time the field PWA has read that file, which §9 now records; it is a read, cached per browser, and nothing writes to the register. A new collapsed **EQUIPMENT** band at the bottom of the Notes sidebar builds a tree from the dotted codes actually in use (with their ancestors), so a note filed against `601.001.003` is found by walking `601` → `601.001` → `601.001.003`; selecting a node lists that code *and everything under it*, and dragging a note onto a node files it there. Console-side this needed nothing new to *read*: the Maintenance > Equipment screen's **Notes** section already queries `notes.equipment_code`, so an equipment-typed note appears under its component as soon as the ingest lane runs (§41.6d).

v2.31.7 *(2026-09-05)* — **Promotion is for assignable notes only; the two Notes surfaces reconciled.** **Promote to Task** now appears only on an *assignable* note (§41.6). A task is work somebody carries; an unassigned note is a record nobody has taken on and an equipment note is a record about a machine, so offering the action on either was an invitation to a form that cannot be completed. The button is shown, not merely disabled, by note type — identically on both surfaces.

The Console's Notes screen and the notes page had drifted, and everything below closes a gap where the Console was the poorer of the two (§41.2a). Attachments: the Console could read photos and documents but **add neither** — it now has the same ＋ on the add bar (and file-drop onto it), the same **＋ Add photo or document** on a note, and the same **📷 Photo** on the comment box, writing through the identical conventions. Documents were being rendered as photo thumbnails, so a document appeared as an empty box with no name, no size and no way to open it; **Photos and Documents are now separate sections** and a document opens through Graph's pre-signed download URL. An archived note could be archived in the Console but never brought back — **Unarchive** was missing entirely. The detail panel named only the *first* assignee (`n.assignee` is a mirror, not the list), so everyone else carrying a note was invisible; it now names them all, in full, with the shared-note warning. Sidebar counts were wrong twice over: a crew row counted only notes that person *owned* while the view it opened also lists notes *assigned* to them, and `mine` tested the first-assignee mirror so a note you were second on lit nothing — both now use list membership, computed from one query instead of one IPC round trip per row. Also added to the Console: the row **star**, the assignment **pin**, drag-to-reorder for starred notes, the attachment-retention line in the detail panel (which is the one place comment attachments are loaded), and the component's name beside its code. New shared helpers `uploadBinary` and `attachmentDownloadUrl` in the Console's Graph layer.

v2.31.8 *(2026-09-05)* — **The equipment picker on both surfaces; ignore ranges honoured.** The Console's **Equipment** note type was selectable only on a note that already carried a code — everything else greyed out, so a note could not be filed against a machine from the Console at all. That was wrong on its own terms: the register is in SQLite and `db.searchAssets` already serves the Rough Log and the report screens, so "the register is behind a main-process call" was never a reason. The Console now has the same picker, with the same word-order-free matching (the IPC search is a single `LIKE`, so it is handed the longest word and the rest are ANDed in the renderer), the same current-selection chip and clear, and the same rule that choosing Equipment clears any assignees. §41.2a loses that row: the picker is no longer one-sided.

Separately, the notes page was offering components the Console has always refused. §9 says assets whose top-level code segment falls in an **ignore range** are never surfaced in autocomplete — the Console excludes them at the query (`department IS NOT 'ignore'`), but the page reads `assets.csv` directly and was applying no such rule, so **851 of the register's 3,896 rows** were offerable, including `100.001.001 F/V Araho` — the vessel itself. The page now reads `equipmentconfig.json` alongside the CSV and applies the ranges before caching, on the top-level integer segment only, bounds inclusive, exactly as the ingest does.

v2.31.9 *(2026-09-05)* — **Notes are renameable; promotion and demotion, both tombstoning.** Note **titles are editable in place** on both surfaces — one `note_edited` carrying the new title, the same correction pattern as everything else. A note is written in a hurry and read for weeks; its first line has to be correctable without deleting the note and losing its comments.

**Promotion supersedes the mirror model.** §41.6 said a promoted note became a live task mirror. It no longer does: the task becomes the record of that work and **the note is tombstoned** (`note_promoted` then `note_deleted`). Two records of one job drift apart, which is the thing this hub exists to prevent, and a mirror is two records. Promote is offered on **assignable** notes only (v2.31.7) and opens the Console's **New Service Report form in a lightbox** — the same `buildTaskCreationHtml` the tab renders, so there is one task-creation form, not a second one. Title, body, the comment transcript as a provenance block, and every attachment travel; attachments are **genuinely copied** under the task (§41.6, "copied, not referenced") because the note's files are on the note's retention clock and tombstoning starts it. A confirmation names what is about to stop existing.

**Demotion is the mirror image** (§41.6f). A task's edit modal gains **↓ Demote to Note**: an *assignable* note is created carrying the description as its body and everything task-specific as its first comment, and the task is deleted from the definitions file and the cache. Its confirmation names what does not survive — transition history, sign-off, any completed-work record.

**Task metadata in comments** (§41.6e, new). Any comment line shaped `Label: value` is read as task metadata and prefills the matching field on promotion; everything else is prose and is left alone. This is also the shape demotion *writes*, which is what makes the round trip lossless. A value the form has no option for is **stated in the lightbox** rather than dropped, because the transcript has had those lines stripped and it would otherwise vanish entirely.

**The equipment tag is now orthogonal to the note type** (closing the §41.13 open item). Assignable notes carry an optional equipment code, and switching between Assignable and Equipment no longer drops it — the type answers *who* a note is for, the code answers *what* it is about. Only Unassigned clears it, since its panel has nothing to show or change a code with; a note that reaches Unassigned still carrying one shows it as a removable chip rather than stranding it.

Append further v2.31.x or v2.32 entries here as new work lands between releases.

---

v2.29 *(2026-05-25)* — **Architecture refactor Phases 4 & 5; Maintenance & Tasks UI consolidation; rounds-comment attachments; minor security/UX hardening.** Closes the OEE data-loss incident (silent multi-writer corruption of `data/factory/logs/report-{date}-{user}.json`) by moving factory observations onto an append-only OneDrive event log. Asset event history follows the same pattern as a clean cutover (the legacy `event_history[]` inline array was never populated by Console renderer code). Closed Tasks gains filter parity with Active. The Close-button flow consolidates into Task Creation; Manual Entry is retired. Rounds comments now carry photo attachments. Schema version of every existing on-disk file is unchanged; all changes are additive at the file-format level and additive-with-cutover at the folder level.

**Architecture refactor Phase 5 — factory observations as immutable events.** New folder `data/factory/observations/events/{iso}-{event_id}.json`, one file per observation, append-only with `If-None-Match: *`. Event envelope follows `docs/architecture.md` exactly: `{schema_version: 1, event_id, event_type, timestamp, actor, payload}`. Three `event_type` values: `observation` (payload is the full `capacity_observations` row shape including `obs_id`, `obs_timestamp`, `section_id`, `oee_session_id`, `source`, etc.), `observation_correction` (payload `{target_obs_id, patch, before}` — edits append a new event, never mutate the original), `observation_deletion` (payload `{target_obs_id}`). Filename is `{iso}-{event_id}.json` with `:`, `.`, and `-` stripped from the timestamp so lex-sort = chrono-sort. The per-user log `data/factory/logs/report-{date}-{user}.json` is retained for `incidents` / `active` / `resolved` (single-writer per file — the correct-by-construction pattern); the `observations[]` array on that file is left in place during the dual-read window and removed in Phase 10.

- New renderer module `src/renderer/js/sync-factory-obs.js` exposes `window.factoryObsSync.{appendObservationEvent, appendObservationCorrection, appendObservationDeletion, syncFactoryObsFromOneDrive, rebuildFactoryObsFromOneDrive, migrateFactoryObsOnce}`. Walking the event folder is cursor-driven via the Phase 0 `ingest_cursors` table (`subsystem='factory_observations'`, `scope_key=''`).
- `production.js` paths rewritten: `submitOeeSession` (line ~3993) and the ad-hoc observation submit (line ~2032) now call `factoryObsSync.appendObservationEvent(obs)` — *not* the legacy `appendObservationsToLogFile` RMW. `editObservationOnDrive` / `deleteObservationOnDrive` rewritten to append correction / deletion events, then update `capacity_observations` in SQLite eagerly so the editing client sees consistent state without waiting for a sync pass. The dead `appendObservationsToLogFile` shim was removed once all callers were rewritten.
- `ingest.js` `pollNow()` adds a `factoryObsSync.syncFactoryObsFromOneDrive()` pass after the production-state poll. The legacy `ingestObservationsFromLog` dual-read on `payload.observations` survives the transition; both feed the same `capacity_observations` table via `_OBS_UPSERT_SQL` keyed on `obs_id`, so a duplicate from a stale legacy file is a no-op.
- One-shot migration `migrateFactoryObsOnce()` walks every `report-*.json`, splits each `observations[]` element into an event file (event_id reused from `obs_id` for idempotent retry; `If-None-Match: *` 412 = "already there"), then PUTs the report back with `observations: []`. Migration is gated by `electron-store` flag `migrations.factory_observations_v1`; flag is set only when zero per-file failures, so a partial-failure run is automatically retryable. Pre-flight `db:preMigrationBackup` snapshots `idms.db` → `idms.db.pre-factory-obs-v1.bak`.
- New IPC `db:resetCapacityObservations` (`DELETE FROM capacity_observations; DELETE FROM ingest_cursors WHERE subsystem='factory_observations'`) used by `rebuildFactoryObsFromOneDrive` and surfaced via Settings → Diagnostics → factory_observations → Rebuild.
- `DIAG_REGISTRY` entry registered for `factory_observations` with `rebuild` returning `{delegated_to: 'renderer', action: 'rebuildFactoryObsFromOneDrive'}` and `verify` returning `{sqlite_counts: {capacity_observations: <N>, by_source: {…}}, span: {earliest, latest}}`.
- Settings → Diagnostics → Rebuild dispatch fixed: `settings.js runDiagAction` now resolves the `delegated_to: 'renderer'` hint by looking up `window[action]` and awaiting it — previously it just rendered the hint JSON as status text. Same generic dispatch applies to existing trips / fuel_history rebuilds, which now actually execute.

**Architecture refactor Phase 4 — asset event history as OneDrive events.** New folder `data/assets/{code_range}/events/{iso}-{event_id}.json`. Event envelope same shape as Phase 5; `event_type` is the asset-event verb (`oil_change`, `repair`, `inspection`, `config_update`, …); payload is `{asset_id, asset_no, code_range, actor_name, data: {…}}`. SQLite `asset_event_history` becomes a derived cache; OneDrive is source of truth. The deprecated `appendAssetEventToFile(codeRange, assetNo, eventEntry)` helper in `graph.js` is retired (was unused PWA-contract scaffolding for the now-replaced RMW `assets[].event_history[]` inline array); the comment block points readers at `appendAssetEvent` instead.

- New renderer module `src/renderer/js/sync-asset-events.js` exposes `window.assetEventsSync.{appendAssetEvent, syncAssetEventsFromOneDrive, rebuildAssetEventsFromOneDrive, migrateAssetEventsOnce}`. Range list discovered each pass via `listAssetEventRanges()` (filters folder children under `data/assets/`); each range carries its own cursor (`subsystem='asset_events'`, `scope_key=<code_range>`).
- `graph.js` adds `assetEventsFolder(codeRange)`, `listAssetEventRanges()`, `listAssetEventsSince(codeRange, sinceFilename)`, `getAssetEventByName(codeRange, filename)`, `appendAssetEvent(codeRange, eventObj)` — all wrappers over the Phase 0 primitives.
- New IPCs `db:resetAssetEventHistory` (with cursor cleanup) and `db:getAssetEventHistoryForMigration` (returns every row with `data_json` for re-emission as events).
- Migration `migrateAssetEventsOnce()` short-circuits when `listAssetEventRanges()` is non-empty (other clients already started writing — let regular sync catch up), otherwise re-emits any `asset_event_history` rows as events keyed by their existing `event_id` for idempotent retry. In practice the table is empty on most installs (Console renderer never called `db:appendAssetEvent` directly under the legacy regime), so the migration sets the flag and exits.
- `DIAG_REGISTRY` entry registered for `asset_events` with verify returning `{sqlite_counts: {asset_event_history: <N>, by_range: {…}}, span}`. Rebuild dispatches `rebuildAssetEventsFromOneDrive` via the same renderer mechanism as Phase 5.
- Migration flag: `electron-store` `migrations.asset_events_v1`. Pre-flight backup tag: `asset-events-v1`.

**Phase 0 foundations clarification (no schema change).** `graphAppendEvent` / `graphListEventsSince` / `graphGetWithEtag` / `graphPutIfMatch` and the `ingest_cursors` table were verified-shipped in `graph.js` (lines 694–804) and `main.js` (lines 4242–4284, 4639–4673). The `cursor:*` and `diag:*` IPCs surface in `preload.js` as `window.idms.cursor.{get,set,list}` and `window.idms.diag.{listSubsystems, listIngestCursors, rebuildFromOneDrive, verifyAgainstOneDrive, preMigrationBackup}`. The `backupDbBeforeMigration(versionTag)` helper writes `idms.db.pre-{tag}.bak` to `userData` idempotently. Documented here because the memory referenced these as "not started" before this session.

**Closed Tasks — filter parity with Active.** `getTaskRecords` filter (main.js) extended to accept `department`, `role`, `priority`, `categories` in addition to the existing `task_id, equipment_id, date_from, date_to, user, search`. Department filter derives the code-range list from `equipment_assignments` and matches against the *first* entry of the JSON-stringified `equipment_ids` using two LIKE patterns per range — `["{rangeFrom}.%` (hierarchical, e.g. `["100.05.01"…]`) and `["{rangeFrom}"%` (bare, e.g. `["100"]`) — mirroring the `getTasks` convention. `categories` accepts an array and emits `category IN (?,?,…)`. Renderer-side: `TASKS.closed.filters` extended with `department`, `role`, `user` (mapped to `closed_by_user` in the IPC), `priority`, `categories`; `buildClosedTasksTabHtml` renders the same six dropdowns the Active tab renders — Status omitted (records are always closed), Assigned-To repurposed as "Closed By" because the relevant identity on a record is who closed it (`closed_by_user`), not who it was assigned to. New helpers `taskReadClosedFilters` / `taskResetClosedFilters` follow the same shape as the active-tab helpers; `bindClosedTasksTabEvents` wires the category multi-select dropdown and calls `populateRoleSelect` / `populateUserSelect` to fill dropdowns from the crew config (identical UX to Active). Default date range widened from 7 to 90 days in `defaultClosedDateRange()`; empty state now probes for the most-recent close and surfaces "Most recent closed task is {date}. Widen the date range to see it." when the filter is hiding everything.

**Task Creation — Status selector, close-record write, and Close-button re-route.** Task Creation tab is now the single canonical write path for the entire task lifecycle. New Status dropdown in `buildTaskCreationHtml` mirrors the PWA's: `open / investigating / waiting_parts / waiting_opportunity / shipyard / other / completed / cancelled`. Submit synthesizes a `transition` event in `task.events` whenever the status genuinely changed (`priorStatus !== status` for an edit, or `status !== 'open'` for a fresh create); from-state defaults to `'open'` for a fresh create or the prior status for an edit. When `status === 'completed' && priorStatus !== 'completed'`, the submit *also* builds a `task_records` row and writes it via `writeTaskEquipmentRecord(record, primaryEqId, year)` + `ingestTaskRecords` for the local SQLite mirror. Convention matches the PWA's `submitErTaskCreate` exactly: Description → `description_work`, Notes → `close_notes`, `equipment_hours` taken from the Equipment Hours Interval field (intentional symmetry with PWA — same field, dual-use). `cancelled` does not generate a record (matches PWA + Console's prior Cancel path). Rough Log entry source flips to `task_closure` when closing; the new task lands on the Closed Tasks tab on submit.

- **Close-button re-route.** The Close button on each active task row no longer opens the legacy Quick Close modal — it calls new `openCloseTaskInCreation(taskId)`, which pre-loads `TASKS.create.context` from the task, fans out `TASKS.create.assets / skillTags / isRecurring / files`, sets new flag `TASKS.create.startAsClose = true`, and `switchTaskTab('create')`s. `buildTaskCreationHtml` honours `startAsClose` by defaulting the Status dropdown to `completed`, the form title to "Close Task", and the submit button to "Close Task". The flag is cleared on Cancel, Submit success, and on +New Task so it never leaks. The submit path already handles `priorStatus !== 'completed' && status === 'completed'` as "close-existing-task" (writes the record + transition event); no separate code path required.
- **Manual Entry tab retired.** Removed from the tab bar in `renderTasksShell`. `switchTaskTab('manual')` redirects to `'active'` as a safety net for stale call sites. `buildManualEntryHtml` / `submitManualEntry` remain in the file as dead code, scheduled for removal in a later cleanup pass once the close-via-create flow has bedded in.
- **Quick Close modal retired.** `openQuickCloseModal` is now an alias for `openCloseTaskInCreation` so any cached reference falls through to the new path; the original body is renamed `_legacyOpenQuickCloseModal` and is not wired into any handler.

**Rounds comments — photo attachments (Console-side render).** The §22 comment object on `rounds_entries.comments_json` already passed `attachments` through verbatim (the ingest at `main.js` line ~1526 is `JSON.stringify(e.comments)` with no per-field filtering). Console-side `rvRenderCommentsModal` in `roundsviewer.js` now renders a thumbnail row under each existing comment (`<img data-thumb-path data-full-path>` markup matching Rough Log / Tasks), streams thumbnails via the shared `loadEventLogThumbnails` helper from `tasks.js`, and tap-on-thumbnail opens the existing `openAttachmentLightbox` for the 1080×1024 full image. The "Add comment" modal gains a click-or-drag photo zone (`.rv-cmt-photo-zone`), live preview tiles with × removal, an error region preserving text + staged photos on upload failure, and renamed actions **Cancel** / **Add comment**. Photo uploads reuse the existing global `taskUploadAttachments(itemId, files)` — same resize sizes (1080×1024 full + 240×180 thumb @ 0.85 JPEG), same target folder `data/assets/pictures/{item_id}/`. New comments include `attachments[]` only when at least one photo successfully uploaded; photo-only comments (empty text + 1+ photos) are allowed. CSS additions are scoped to `.rv-cmt-*` to avoid bleeding into anything else.

**Password input masking + Skill Tags edit gating.** Two small UX/security passes:

- `users.js` line ~289 and `crew.js` line ~633 — password `<input>` `type="text"` → `type="password"`. Added `autocomplete="new-password"` to suppress Chrome's saved-credentials autofill. The on-disk plaintext storage in `crewconfig.json` is unaffected and remains a tracked separate concern; this change covers input masking only.
- `crewsetup.js` Skill Tags tab — new `canEditSkillTags()` helper (`true` iff `permission_tier === 'admin'` OR `isPurserRole(user)`). When false: + Add Skill Tag button hidden behind a "Read-only — Purser or Admin to edit." hint; per-row Edit / Delete buttons replaced with a `read-only` label; `wireSkillTagsTab()` bails before attaching listeners and clears any in-flight `editingSkillTag`. Defense in depth — even if the buttons were somehow rendered through a re-render glitch, the listeners aren't wired.

**Misc cleanups.**

- `appendObservationsToLogFile` (production.js line ~2058) deleted — three-line shim with zero callers after the Phase 5 refactor.
- Settings → Diagnostics dispatch fix (covered above) is generic across all subsystems, so existing trips / fuel_history Rebuild buttons now execute instead of just rendering the hint JSON. Verify behaviour is unchanged.
- PWA contract documentation: new files `IDMS-Console/docs/phase-4-5-pwa-contract.md` (Phases 4 & 5 dual-write protocol, event envelope, folder layout, verification) and `IDMS-Console/docs/rounds-comments-pwa-contract.md` (comment shape with attachments, photo upload procedure, submission pseudocode, UX expectations). Each is self-contained so a future PWA session doesn't need to grep the Console repo.

Files touched (Console): `src/main/main.js` (DIAG_REGISTRY entries, `db:resetCapacityObservations`, `db:resetAssetEventHistory`, `db:getAssetEventHistoryForMigration`, `getTaskRecords` filter extensions), `src/preload/preload.js` (new IPC surfaces), `src/renderer/index.html` (load `sync-factory-obs.js` and `sync-asset-events.js`), `src/renderer/js/app.js` (startup hooks for Phases 4 & 5), `src/renderer/js/graph.js` (asset event primitives, retired `appendAssetEventToFile`), `src/renderer/js/sync-factory-obs.js` (NEW), `src/renderer/js/sync-asset-events.js` (NEW), `src/renderer/js/production.js` (OEE/ad-hoc submit + edit/delete rewritten, shim deleted), `src/renderer/js/ingest.js` (`syncFactoryObsFromOneDrive` in `pollNow`), `src/renderer/js/tasks.js` (Closed filters, Status selector, Close re-route, Manual Entry removal), `src/renderer/js/roundsviewer.js` (comment thumbnails + photo picker), `src/renderer/js/users.js`, `src/renderer/js/crew.js` (password masking), `src/renderer/js/crewsetup.js` (Skill Tags gating), `src/renderer/js/settings.js` (Diag rebuild dispatch), `docs/phase-4-5-pwa-contract.md` (NEW), `docs/rounds-comments-pwa-contract.md` (NEW). PWA-side companions cross-reference IDMS PWA-SCHEMA v1.8.

---

v2.28 *(2026-05-25)* — **Oil Record Book: C/11 sounded volumes become walker-derivable on recompute.** Resolves a workflow snag where inserting a missed C/D entry chronologically before a C/11 sounding left the sounding's per-tank row volumes stale, with no way to refresh them short of manual re-entry. The displayed C/11 row is a working draft figure, not a record of the physical sounding — the bound paper ORB remains the authoritative record of what was actually measured at the time. OneDrive `orb-{year}.json` format unchanged; behaviour change only.

**Walker anchor demotion for C/11.** `orbWalkTankVolume` previously treated every C/11 `c11_tank_rows[].volume` as a hard anchor on equal footing with L loadout values and H bunker per-row totals. C/11 row volumes are now demoted to *soft anchors*: they seed the walker only when no earlier hard anchor (L loadout, H bunker row, or stored C/D `ret.` field) exists in the cascade for that tank. The moment any earlier hard anchor is found, the walker walks past the C/11 row and applies deltas from `orbEntryTankDeltas` over every intervening entry. Hard anchors retain their existing precedence order; the only change is C/11's tier.

**Recompute paths updated.** `orbComputeRetainedForEntry` extended to compute `c11_tank_rows[i].volume` for every row of a C/11 entry, using the walker as above. Three triggers fire it, same as the C/D `ret.` cascade:

1. **Form save** — non-destructive: blank C/11 row volumes auto-fill, manually-entered values preserved.
2. **Per-row `Upd` button** on a C/11 entry — overwrites every row's `volume` with the walker-computed value; also recomputes `c11_total` (row sum) and `c11_manual_total` (signed delta vs prior C/11). Replaces the previous no-op behaviour where Upd on a C/11 row only re-summed `c11_total` from existing row values.
3. **`Update all ret. (draft)` button** — cascades through C/11 entries in chronological order, overwriting row volumes the same way it overwrites C/D `ret.` fields. L loadouts remain skipped (user-anchored).

The "manually-entered values preserved" carve-out only applies to the form-save path; Upd and Update All overwrite unconditionally, matching their existing C/D behaviour.

**First-C/11-of-year fallback.** When the walker finds no earlier hard anchor for a tank (typical at year start before the first L loadout is logged), the C/11 row's own stored `volume` continues to anchor itself — the walker returns the stored value unchanged. Once an L loadout is added before that C/11, the next Upd or Update All will switch the row to walker-derived. Operators should be aware that the first Update All after adding an early-year loadout may shift C/11 sounding values to match the loadout-plus-deltas line.

**`c11_manual_total` recompute.** `c11_manual_total` is recomputed alongside `c11_total` on every Upd or Update All pass: `c11_manual_total = c11_total − prior_c11_total` where prior is the most recent C/11 entry strictly before this one by `(date_iso, sequence_no)`. No clamp — negative values continue to flag disposal exceeding collection between soundings. Manual overrides to `c11_manual_total` are *not* preserved across Upd or Update All; if an operator needs a specific value, they re-enter it after the cascade.

**Net change column rendering.** Unchanged. C/11 entries still render their post-recompute row volumes in `var(--accent)` italic as a state line. The values shown will now reflect any chronological insertions made since the C/11 was last touched, which is the point of the change.

**Reconciliation panel.** Unaffected. Reconciliation continues to use only L entries as endpoints and sums non-L deltas between them; C/11 entries contribute no deltas (snapshot-only) and never appeared in reconciliation math. The integrity check that today's C/11-vs-ledger disagreement implicitly provided is *intentionally* removed by this change — the draft is a calculator, not an audit trail, and the workflow assumption is that entries are reviewed once and transcribed, not preserved as a parallel record.

**Operator-facing implications.**

- Inserting a missed C/D entry chronologically before a C/11 and running Update All will silently update the C/11 row volumes. No diff, no toast. This is intentional; the displayed value is a working draft figure.
- Editing a C/11 row volume by hand still works (form save preserves manual entries on blank-fill only — manually overwriting an existing value and saving will overwrite back on the next Upd or Update All).
- Operators who want to record what they physically sounded should do so in the paper ORB, not rely on the Console row value persisting unmodified.

Files: `oilrecord.js` — `orbWalkTankVolume` (soft-anchor tier added for C/11), `orbComputeRetainedForEntry` (C/11 row volume computation added), `orbUpdateEntryRetained` (C/11 branch extended via per-row diff helper `orbDiffC11Rows`), `orbUpdateAllDraftRetained` (no logic change — already cascades through all non-L entries; the C/11 branch in compute now does work where it previously didn't), `submitOrbEntry` (form-save handler extended with per-row non-destructive merge for `c11_tank_rows`).

---

v2.27 *(2026-05-24)* — **Oil Record Book: drafting-helper refit.** The ORB page in IDMS-Console pivoted from a sign/transcribe regulatory workflow to a calculator-assisted draft helper. This entry covers everything that changed between v2.25 and now. The OneDrive `orb-{year}.json` file format is unchanged at the top level (`schema_version` still 1); changes are additive to the entries array and field shapes.

**Workflow changes (Console UI).** Signing, signatures, the Transcribed tab, the Mark Transcribed button, the sequence-number / officer / status columns, and the row-selection checkboxes are all removed. New entries continue to be written with `status: 'draft'`, `transcribed_status: 'draft'`, `officer_sig: null`, and a monotonic `sequence_no` so the on-disk schema stays unchanged and old entries load cleanly — but the UI no longer reads those fields. The draft entries table is now `Date | Code | Items | Net change | Actions` with per-row actions `Edit · Upd · Del`.

**Per-entry net change column.** A new compact rendering of each entry's volume impact, computed inline from `orbEntryTankDeltas`. Fuel & diesel deltas aggregate into one `Fuel ±X USG` line (vessels have many small fuel tanks per bunker); everything else (lube, waste oil/sludge, bilge, water, uncategorized) renders per tank using the tank's abbreviation token. Unattributed deltas append as a final `Misc ±X USG`. C/11 auto-soundings are snapshots, not deltas — they render the per-tank current retained volumes in `var(--accent)` italic to read as a state line rather than a change line.

**Per-entry per-tank delta extraction (`orbEntryTankDeltas`).** Returns `{ tankDeltas: { [tank_token]: signedNumber }, unattributed: number, note?: string }`. The delta map is keyed by the canonical tank token (abbreviation when configured, else name) so name↔abbreviation drift across legacy entries collapses cleanly. Per-code semantics:

| Code & item | Tank A (−qty) | Tank B (+qty) | Notes |
|---|---|---|---|
| C/12 Sludge internal transfer | `c12_from_tank` OR `c12_from_other` (if matches a tank) | `c12_to_tank` | Internal — net zero |
| C/12 Sludge transfer to facility | `c12_from_tank` | — | Leaves the ship |
| C/12 Oil residue collected | `c12_collect_from` (if matches a tank) | `c12_collect_to` | Source typically free-text (drip pans, sumps); credit-only when source isn't tracked |
| C/12 Incineration | `c12_incin_source` | — | Oil destroyed |
| C/12 Evaporation | `c12_evap_source` | — | Water removed |
| C/12 legacy `c12_method` shape | `c12_tanks_emptied` | `c12_tank_dest` (if "To another tank") | Read-fallback for pre-v2.24 burn_log auto-drafts |
| D bilge → reception | `d_source_tank` | — | Leaves the ship |
| D bilge transfer | `d_source_tank` | `d_dest_tank` | Internal — net zero |
| D bilge water disposal (OWS) | `d_source_tank` OR `d_ows_source` (if matches a tank) | — | Free-text bilge wells fall through to `unattributed` |
| H bunkering | — | each `fuel_tanks_list[].tank_name` and `lube_tanks_list[].tank_name` at that row's `qty_tonnes` (in the user's selected volume unit despite the legacy key name) | Fuel/lube added |
| A, B, G | unattributed | unattributed | Free-text tank/qty fields |
| C/11, E, F, I | (no delta) | | Snapshot or non-quantified |

**Reconciliation panel — grouped by tank type.** When the draft list for a year contains ≥2 `L` (Tank Loadout) entries, the Console renders a reconciliation table below the entries table. Tanks bucket into category groups via `orbReconGroupFor(tankToken)`:

| Group | Categories |
|---|---|
| Fuel & Diesel | `fuel`, `fuel_oil`, `diesel`, `mgo`, `hfo`, `dfo`, `gasoline` |
| Lube | `lube`, `lubricating_oil`, `lube_oil` |
| Waste Oil / Sludge | `waste_oil`, `slop`, `holding` |
| Bilge | `bilge` |
| Water | `fresh_water`, `potable_water`, `water` |
| Misc | (fallback for uncategorized tanks or tanks not in vesselConfig) |

Each group renders a header, per-tank rows, and a subtotal (Oldest · Adjustments · Expected · Actual · Error). The table closes with an "Unattributed adjustments" row (free-text source on A/B/G/D-OWS) and a bold Grand total. Error colour-coding: green ≤ 0.005, amber ≤ 1.0, red beyond.

**Tank tokens — canonical form.** Across the entire ORB module, tank references are stored and displayed as `orbTankToken(t)` — the tank's `abbreviation` when set in vesselConfig (Vessel Setup → Liquid Cargo & Fuel Tanks → "Short name"), falling back to `name`. `orbCanonicalTank(val)` resolves any stored string (abbreviation, name, or legacy free-text) to the configured tank's canonical token; `orbSameTank(a, b)` is used everywhere two tank references are compared (walker, delta extractor, reconciliation grouping). Auto-draft paths (H bunker rows, C sludge transfers, C incineration, E OWS, D transfers, legacy C/12, legacy bilge D) all write `orbTankToken(tank)` so the on-disk values match what manual entries produce.

`orbCanonicalTank` resolves in three passes, first match wins:

1. **Exact** string match against token, name, or abbreviation.
2. **Case-insensitive exact** match after whitespace normalization.
3. **Case-insensitive after stripping a trailing tank-noun suffix** (`" tank"`, `" tk"`, `" tk."`, `" t."`) — so legacy auto-drafts that stored `"dirty oil tank"` resolve to the configured `"Dirty Oil"` token.

Fuzzy steps deliberately don't do partial / substring matching, which would risk collapsing `"Sludge Tk A"` and `"Sludge Tk B"` onto each other. Unresolved values (genuinely free-text bilge wells, etc.) flow through unchanged so they still show up in the Misc bucket without being silently rewritten. The migration (`orbMigrateYearEntries`) runs the resolver over every tank field on year-file load, so fuzzy-matched legacy values are persisted to disk as canonical tokens.

**Item-prose form layout (Code C/12 + Code D).** Each MARPOL item renders as one labelled row with inline inputs matching the printed ORB phrasing. Templates live in `C_ITEM_TEMPLATES` and `D_ITEM_TEMPLATES`; the same parts list drives both the form (`orbRenderItemRow`) and the narrative builder (`orbRenderTemplateNarrative`) so the editor and the printed line can never drift. Part types:

```js
{ text: '... {vl} ...' }                              // literal, {vl} expands to volume unit
{ input: 'field_key', type: 'text'|'tank_select'|'time'|'select',
  tankSet?, options?, placeholder?, width?,
  showIf?: f => boolean }                             // hide-when-false
{ either: [partA, partB], glue: ' or ' }              // tank dropdown + free-text alternative
```

`showIf` predicates gate visibility uniformly across the form, narrative, and "has any value" check (used to skip empty item lines). `either` parts render both alternatives side-by-side; the narrative collapses to whichever is filled (joined by glue if both).

**Code C — item structure** (replaces v2.23's `c12_method` flat shape):

| Item dropdown value | Form / narrative |
|---|---|
| `11 – Voyage/weekly sludge report` | Per-tank `[tank ▾][cap auto-fill][ret. manual]` rows, then 11.3 (auto-sum, editable) and 11.4 (signed auto-calc vs prior sounding, editable). Aliases legacy `11 – Weekly sounding`. |
| `12 – Sludge internal transfer` | 12 `[qty] from [tank ▾] or [other text]`, ret. + 12.2 `To [tank ▾]`, ret. Aliases `12 – Sludge transfer`. |
| `12 – Sludge transfer to facility` | 12 `[qty] from [tank ▾]`, ret. + 12.1 `Landed, [destination]` |
| `12 – Oil residue collected by manual operation` | 12 `[qty] collected from [tank ▾] or [other text]` + 12.4 `Transferred to [tank ▾]`, ret. Aliases `12 – Oil residue collected & transferred`. |
| `12 – Incineration of sludge` | 12 `[qty] from [tank ▾]`, ret. + 12.3 `Incinerated, [hrs] hrs, [start] to [stop]`. Aliases `12 – Incineration of oil residue`. |
| `12 – Evaporation of water` | 12 `[qty] water from [tank ▾]`, ret. + 12.4 `Evaporated to atmosphere` |

`C_ITEM_ALIASES` maps every legacy item label forward; `orbCItem(fields)` returns the short item identifier (`'11'`, `'12_internal'`, `'12_facility'`, `'12_collect'`, `'12_incin'`, `'12_evap'`) used in all the per-item branches.

**Code D — sub-type structure** (adds OWS, reshapes Reception):

| `sub_type` value | Item 13 | Item 14 | Item 15.x |
|---|---|---|---|
| `Oily bilge water to reception facility` | qty + source tank + **capacity** + **source-retained** | start/stop | **15.2** destination facility + location *(was 15.1 positions in v2.23)* |
| `Oily bilge water transfer` | qty + source tank | start/stop | 15.3 dest tank + dest-retained |
| `Bilge water disposal (OWS)` *(new)* | qty + `[tank ▾ from waste_oil/bilge/slop/holding] or [other text]` + capacity + source-retained (the last two are `showIf: f => !!f.d_source_tank` — they don't render for free-text sources because a bilge well doesn't have a meaningful capacity) | start/stop | **15.1** `[hemi N/S] [deg]° [min]', [hemi W/E] [deg]° [min]', start` × two rows (start + stop) |

Legacy reception `d_pos_start` / `d_pos_stop` (combined-text 15.1 positions) are preserved in the narrative and surfaced in a "Legacy 15.1 positions" annotation in the form so they aren't dropped on re-save. Legacy bilge-disposal entries with `quantity_m3` / `method` (pre-v2.24) are migrated to the modern `d_qty` / `sub_type` shape on year-file load.

**Tank Loadout (code `L`)** — unchanged from v2.25 except the lifecycle constraints simplified (signing is now globally removed). Loadouts still anchor the reconciliation; their per-tank values are never auto-overwritten by the Update buttons.

**`ret.` auto-calc + Update buttons.** A walker (`orbWalkTankVolume`) finds a tank's latest known volume by walking entries chronologically backward from a target entry: anchors include loadout values, C/11 snapshot rows, H bunker per-row `total_tonnes`, and stored `ret.` fields on prior C/D entries. Between anchors it applies deltas from `orbEntryTankDeltas` so a transfer-out with no stored ret. still propagates correctly. `orbComputeRetainedForEntry(entry, allEntries)` uses the walker to compute every applicable `ret.` field for the entry. Three triggers fire it:

1. **Form save** — non-destructive: blank ret. fields auto-fill, manual overrides preserved.
2. **Per-row `Upd` button** — overwrites the entry's ret. fields with computed values.
3. **`Update all ret. (draft)` button** in the panel head — cascades chronologically through every non-`L` draft entry. Loadouts skipped (user-anchored).

C/11 entries are handled by the same machinery: `out.c11_total` = sum of `c11_tank_rows[].volume`, `out.c11_manual_total` = current total − prior C/11 sounding's total (signed; no clamp — a negative value flags disposal exceeding collection between soundings).

**H bunker auto-total** — when the user enters a `qty added` or picks a tank in an H tank row, the row's `total onboard` auto-fills as `prior_known_volume(tank) + qty`. Manual edits to the total are clobbered by the next qty/tank change (matches the "total should always reflect the addition" requirement).

**Tooling: idempotent migration.** `orbMigrateYearEntries(year)` runs after every year-file load (gated on `vesselConfig` being available). Applies safe transformations:

1. Pre-v2.27 D bilge auto-drafts with `quantity_m3` / `method` / `time_start` → `d_qty` / `sub_type: 'Oily bilge water transfer'` / `d_time_start` so the delta extractor sees them.
2. Legacy C/12 item labels → current canonical values (already aliased at read; this persists the canonical value on disk).
3. Tank tokens canonicalized across every field that stores a tank reference (scalar fields, H per-tank rows, C/11 snapshot rows, L loadout rows).
4. Narrative + `items[]` rebuilt for any entry whose fields changed.

Fully idempotent — entries already matching the current schema are untouched and no save happens. Save errors are caught and logged; the next load retries.

**Tooling: dismissed auto-drafts.** New `dismissed_source_refs: []` array on the year file. When the user deletes an auto-drafted entry, its `source_ref` lands here; `orbIngestFromFuelState` skips refs in this list so deletions are sticky across machines / sessions.

**Refresh discipline.** `loadOrbTabData` reads directly from in-memory `ORB.yearData[year].entries` (not from a SQLite query). Every mutation path updates this array synchronously before saving — so the entry table and reconciliation panel can never lag a just-completed edit. SQLite remains a derived cache; OneDrive is the durable source of truth.

---

v2.25 *(2026-05-24)* — **Oil Record Book: Tank Loadout entry type + draft reconciliation.** Console-only addition to the ORB schema; the existing MARPOL codes A–I are untouched and the OneDrive `orb-{year}.json` file structure is unchanged.

**New entry code `L`** — "Tank Loadout (working draft only — not transcribed)". Stored in the same `orb_entries` table / `orb-{year}.json` `entries[]` array as MARPOL entries, distinguished by `code: "L"`. Field shape:

```json
{
  "code": "L",
  "fields": {
    "loadout_tank_rows": [
      { "tank_id": "...", "name": "Aft Diesel P", "volume": "1250.0" },
      { "tank_id": "...", "name": "Aft Diesel S", "volume": null },
      { "tank_id": "...", "name": "Waste Oil 1",  "volume": "812.5" }
    ]
  },
  "items": ["loadout"]
}
```

`volume` is a string in the user's selected `orb_settings.volume_unit` (USG or m³). `null` means "tank exists but value unknown for this loadout" — these tanks are skipped in reconciliation rather than treated as zero.

**Lifecycle constraints for code L:**
- Cannot be signed (`orbSignEntry` rejects with a toast).
- Cannot be marked transcribed (the signed-precondition naturally blocks this).
- Never emitted to the printed/transcribed ORB or the PDF export.
- Filtered out of the Transcribed tab by the existing `transcribed_status = 'transcribed'` SQL filter, since L can never reach that status.

**Reconciliation panel** — when the draft list for a year contains ≥2 `L` entries, the Console renders a per-tank reconciliation table below the entries table. Logic: take the oldest L (by `(date_iso, sequence_no)`) and the newest L; for every non-L entry strictly between them, compute per-tank deltas via `orbEntryTankDeltas(entry)`; compare `oldest + sum(deltas)` to `newest` per tank. Deltas that can't be tank-attributed (free-text tanks on A/B; free-text qty on G) accumulate in a separate "Unattributed adjustments" row so the user can see the gap.

**Per-code delta semantics encoded in `orbEntryTankDeltas`:**

| Code & item            | Tank A (− qty) | Tank B (+ qty) | Notes |
|---|---|---|---|
| C/12 Sludge transfer   | `c12_from_tank`    | `c12_to_tank`     | Internal — net zero |
| C/12 Oil residue coll. | `c12_collect_from` | `c12_collect_to`  | Internal — net zero |
| C/12 Incineration      | `c12_incin_source` | —                 | Oil destroyed |
| C/12 Evaporation       | `c12_evap_source`  | —                 | Water removed |
| D bilge → reception    | `d_source_tank`    | —                 | Leaves the ship |
| D bilge transfer       | `d_source_tank`    | `d_dest_tank`     | Internal — net zero |
| H bunkering            | —                  | each `fuel_tanks_list[].tank_name` and `lube_tanks_list[].tank_name` at that row's `qty_tonnes` (which is in the user's selected volume unit despite the legacy key name) | Fuel added |
| A, B, G                | unattributed       | unattributed      | Free-text tank/qty fields |
| C/11, E, F, I          | (no delta)         |                   | Snapshot or non-quantified |

**Schema version stays at 1.** The change is additive to the entries array; older code paths that don't know about code `L` will simply ignore those records (they don't match any MARPOL filter and don't appear in transcribed/PDF flows).

v2.24 *(2026-05-24)* — **Per-item `comments[]` thread on roundslog entries (§22).** Additive field; `schema_version` stays at 2.

Each entry inside `roundslog-*.json` may carry a `comments` array. Empty array allowed; absent field is treated as empty. Each comment is `{ text: string, author: string, timestamp: string (ISO 8601) }`. Append-only across two writers:

- **PWA** — user taps the item label during rounds entry; entries land in `RE.comments[item_id]` and ship inline on submit (PWA-SCHEMA v1.7).
- **Console** — reviewer opens any item from the Rounds Log detail panel and appends. The new comment is written into the *most-recently-submitted* contributing roundslog for that item (read-modify-write on the JSON; no ETag guard yet — Phase 9 will harden). Prior comments from any author are never modified or deleted.

**SQLite mirror.** New nullable column `rounds_entries.comments_json` (TEXT, JSON-encoded `comments[]`). Populated by `ingestRoundsLogV2` and updated in place by the new `rounds:updateEntryComments` IPC after the OneDrive write. Reads in `rounds:getRoundDetail` now include this column so the Console can render badges and modal threads without an extra Graph fetch per row.

**Multi-source rendering.** When a round was submitted by N users, the Console-side detail row collapses to a single visible row but retains `sources[]` (one per contributing roundslog file). The comments badge sums comment counts across all sources; the modal renders the union sorted by `timestamp`. Author and timestamp are *rendered* concatenated as `"— {author}, YYYY-MM-DD HH:MM"`; structurally they remain separate fields.

v2.23 *(2026-05-23)* — **Rounds Groups (reusable section templates) · section-level Offline flag · collapsible sections in Rounds Setup · roundslog group-linkage fields · supersedes v1.5 PWA `reLoadAggregates` round_number filter.** Shipped as IDMS Console **v0.2.7**.

**`roundsconfig.json` — new top-level `groups[]` array (§20).** A *group* is a reusable bag of sections used as a runtime template: a round item with `type: "group"` references one of these by `group_id`, and the field PWA renders a section-picker dropdown at entry time. The user picks one section; that section's items are then injected into the round below the parent row. Multiple round items can reference the same group — picks are scoped so the same section can't be chosen twice in one round (peer-filter detail under PWA-SCHEMA v1.6).

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "schedule": { … },
  "sections": [ … ],
  "groups": [
    {
      "group_id": "uuid",
      "label": "Calibrate scales",
      "sections": [
        {
          "section_id": "uuid",
          "label": "Pre-shift",
          "order": 1,
          "offline": false,
          "items": [ /* same item shape as a normal section.items[] */ ]
        }
      ]
    }
  ],
  "changelog": [ … ]
}
```

Notes on the group sub-tree:

- Group sections **do not** carry `dept_key` — the parent round item that references the group owns dept routing.
- Group section items **do not** carry `active_rounds` / `active_days` — round/day filtering is inherited from the parent round item.
- `group.sections[].offline: boolean` (default `false`) hides the section from the user-facing dropdown in the PWA. The section stays in the config so prior history isn't lost; flip it back to make it live again.
- Groups never contain `type: "group"` items (no nesting). Console disallows the type in the group editor; PWA defends in depth by skipping any nested-group child it encounters.

**New item type `group` on regular round items (§20).** Added to the existing `item_type` discriminator. Carries one field:

| Field | Type | Required | Notes |
|---|---|---|---|
| `group_id` | string | yes | UUID of one entry in `roundsconfig.groups[]`. |

`asset_code`, `unit`, `custom_options`, `add_oil_tank_id`, `sounding_*`, `tk_percent_*` are all `null`/omitted on a group item. `active_rounds` / `active_days` still apply: a group item respects round/day filtering just like any other item. The Console's Rounds Setup hides the `Active in:` editor row for the `group` type for visual cleanliness (the underlying data still serializes if previously set; field is no longer surface-editable). Type-change handler in `rounds.js` clears `group_id` on leaving the type and clears the other type-specific fields on entering it.

**Console UI — Rounds Setup additions.** Three new affordances on `screen-rounds`:

1. **Groups panel** between the Schedule panel and the sections list. Each row is `{ name input, item-count badge, Edit, ×Delete }`; `+ Add group` at the foot of the panel. Edit opens a sub-screen scoped to the group (heading: `Rounds — {group label}`); back button returns to the main view. Group editor reuses `buildSectionHTML` / `buildItemHTML` with an `inGroup` flag that suppresses the dept dropdown, `Active in:` row, and offers an `Offline` checkbox per section.
2. **Delete-group with referrer check.** Deleting a group while round items still reference it is refused; the alert lists up to 8 referrers (`sectionLabel → itemLabel`) so the operator can fix them first. `rdFindGroupReferrers` walks all main-config items looking for `type === 'group' && group_id === target`.
3. **Collapsible sections.** Each section header gains a `+`/`−` toggle, plus `Collapse all` / `Expand all` buttons in the toolbar. State persists in `localStorage` under `idms_rounds_collapsed_sections` (a JSON array of `section_id`s). Same Set is shared between the main view and the group editor since `section_id`s are globally unique UUIDs. Collapse is a DOM-only class toggle (`rounds-collapsed` on the section panel) — no re-render, so input focus survives expanding/collapsing peer sections.

**Scope abstraction (`rdScopeSections`).** All section/item mutation helpers (`rdFindSection`, `rdMoveSectionUp/Down`, `rdAddItem`, etc.) now operate on whichever scope is active. `RD.editingGroupId` (null in main view, group UUID in editor view) drives the choice — no duplicate add/move/delete code paths.

**`roundslog-*.json` — new linkage fields on group-child entries (§22).** The PWA submits one log entry per visible item, *including* synthesized children expanded from a selected group section. The parent group item itself logs with `value = section_id` (the user's pick). Each child carries four new identifying fields:

| Field | Type | Where present | Notes |
|---|---|---|---|
| `group_id` | string \| null | parent + children | The referenced `groups[].group_id`. |
| `parent_item_id` | string | children only | The `item_id` of the round item that referenced the group. |
| `parent_section_id` | string | children only | The `section_id` of the group's section the user picked. |
| `base_item_id` | string | children only | The original `item_id` of the child inside `groups[].sections[].items[]` (un-suffixed). |

The child's own `item_id` is a **synthetic** key of the form `{parent_item_id}:{base_item_id}` — guarantees uniqueness when the same group is referenced from multiple round items, and acts as the join key into the aggregate `items{}` so history columns automatically scope to "same parent picked the same section." See PWA-SCHEMA v1.6 for the rendering side.

**`rounds_entries` table (§18) — no schema change.** The four new payload fields above are *not* persisted to SQLite; `ingestRoundsLogV2` (main.js:1502) drops them at insert. Sufficient because `buildRoundsAggregate` (main.js:1544) groups by `item_id` alone — synthetic keys are stored verbatim and produce their own rows in the aggregate's `items{}` map without any code change. If a future Console report wants to drill into group context ("how often was section X picked under round item P"), the linkage fields remain available in the raw OneDrive log files.

**Aggregate `display_value` for group parents — known polish item.** The parent's `display_value` will be the picked `section_id` UUID, not a human-friendly label. `roundsviewer.js` / Rough Log / Manual Entry tab don't currently translate it. Tracked as a follow-up; the data shape is right, only the read-side rendering is missing.

**Console aggregator (§23) — no behavioural change required.** `buildRoundsAggregate` groups by `item_id`; synthetic keys produce their own entries in the resulting `items{}` map. `display_value` for child items follows the existing rule (most recently submitted non-null value, or sum for `add_oil`).

**Cross-references.**
- PWA rendering side: see PWA-SCHEMA v1.6 (section picker, synthetic-key submission, peer-section filtering, offline section filter, Prev-1/Prev-2 history via wider aggregate window).
- `reLoadAggregates` round_number filter (PWA-SCHEMA v1.5 / IDMS-SCHEMA v2.22 §24 commentary) is **superseded** — see PWA-SCHEMA v1.6. Aggregates are now indexed and fetched by chronology + scheduled-time only; group-aware history scoping is achieved via the synthetic-key design above rather than aggregate-level filtering.

---

v2.22 *(2026-05-22)* — **Manual Round Entry · Rounds Setup dept dropdown · Add Oil year window + asset join · Production chart cone clipping + label cleanup · PWA Purser write surface.**

**Rounds Log → Manual Entry tab (§22).** Console gains a third tab in Records → Rounds Log, sitting between "Rounds Overview" and "Add Oil Summary" (all three tabs now styled as pills via inline `rvEnsureStyles()` — previously unstyled text buttons that ran together visually). The new "Manual Entry" tab is a backfill UX for rounds that were missed in the field. Renders a modal with four meta-fields (Date · Department · Round · Submitted timestamp) and an editable item list, then on Submit:

1. Writes a per-user log to OneDrive at the SAME path the PWA uses — `Documents/IDMS/data/rounds/logs/{operator_username}/{YYYY}/roundslog-{operator}-{date}-{HHmm}.json` — where `{HHmm}` is derived from the operator's chosen submitted datetime. Operator username comes from `window.idmsCurrentUser.username` (per design decision 2026-05-22 — Console operator owns the entry; switch users via the user menu to attribute a backfill to someone else).
2. Calls existing IPC `rounds:ingestLog` to update `rounds_entries` immediately (Overview reflects without waiting for the next ingest poll).
3. Calls existing `buildAndWriteAggregate(date, round)` to rebuild the rolled-up aggregate file.

**New top-level field on per-user roundslog payload:** `manual_entry: true` (audit marker, distinguishes backfills from on-time PWA submissions). DB ingest path ignores it; preserved on disk only. All other payload fields match the PWA's existing shape (v2 schema_version, entries[] with the full item_type discriminator + per-type metadata fields). Per-type editable inputs in the form mirror the PWA's render shapes so the values written to disk are byte-identical: `tk_sounding` standard → "ft|in" pipe-string; `tk_sounding` metric → cm number; `tk_percent` → USG number with live % readout (computed from `tk_percent_capacity`); `latlon` → 6-pipe "LAT_DEG|LAT_MIN|LAT_HEMI|LON_DEG|LON_MIN|LON_HEMI"; `numeric`/`add_oil` → `type="number" inputmode="decimal"` right-aligned. Section filtering uses the same `dept_key + active_rounds + active_days` rules as the PWA (mirrored helper `rvDayOfWeekMonFirst` matches the PWA's Mon-first day-of-week convention).

**Rounds Setup → section dept dropdown (§22).** Previously hardcoded to `[engine, factory, deck]`. Now derived from `crewconfig.departments[]` at every Rounds Setup entry — `initRounds` fetches `loadCrewConfig()` in parallel with rounds + vessel configs. Each department's display label drives the dropdown text; the saved `dept_key` is derived via `rdDeptKey(label)` which preserves the three legacy mappings (`Factory→factory`, `Engine Room→engine`, `Deck→deck`) and slugifies any new department added via Crew Setup as `label.toLowerCase().replace(/\s+/g, '')` — matches the PWA's `reDeptKey` fallback convention so end-to-end filtering stays aligned. Sections with a saved `dept_key` that no longer matches any current department render a synthetic `⚠ {key} (not in Crew Setup)` option so the value isn't silently reset; operator can intentionally re-pick. Fallback to the legacy three-option list if crewconfig has no departments.

**Rounds Log → Add Oil Summary (§22).** Date window changed from a hardcoded last-30-days to a year picker (`RV.year`, defaults to current year — Prev / Next year buttons + direct year input). Backend SQL (`ipcMain.handle('rounds:getAddOilSummary')`) gains `LEFT JOIN assets a ON a.code = re.asset_code` and returns `asset_name` alongside `asset_code`. Renderer surfaces them in the Dest asset cell as a two-row layout — asset name on top (bold), asset code below (mono, muted). Graceful fallback: missing asset name → code-only cell; missing both → "—".

**Production chart cone clipping (§30, Dashboard + Dashboard Report + Trip Analytics).** Three chart venues share the same forecast cone shape; all three previously let `daysToMin` (slowest-rate projection, capped at 30 days) drive the chart's right edge, which stretched the x-axis weeks past the median ETA whenever a slow day pulled `minDailyMt` down. The right edge is now anchored to `Math.ceil(daysToAvg) + 1` (median rate + 1 day padding); the cone's lower bound naturally clips against the chart edge since the sample loop iterates over `projDays`. `daysToMin` still drives the `±Xd` spread text so the operator sees the true uncertainty value; only its POSITION is clamped to the visible chart with right-aligned text-anchor when it hits the edge. Files: `reports.js buildFactoryChartSvg` (used by Dashboard Zone 4 and Dashboard Report) and `production.js drawTripProductionChart` (Trip Analytics) — KEEP IN SYNC marker added.

**Production chart label cleanup.** Three label changes applied to both SVG (reports.js) and canvas (production.js) chart implementations:

1. **"Target NNN" text removed** from the dashed target reference line. The MT axis already labels the target value on the right side (top tick when targetMt is the y-axis ceiling) — the inline label was redundant. Dashed line itself retained.
2. **"Historical Avg." label added** at the right tip of the dashed grey historic projection line. Right-aligned with text-anchor=end when the line ends at the chart's right edge (canvas: textAlign='right'). Halo for legibility (white in SVG, panel bg `#1a1d23` in canvas).
3. **"Estimated Full" → "Estimated MM/DD"** at the orange ETA marker. Date computed as `dailyData[last].date + Math.round(daysToAvg)` days, formatted zero-padded MM/DD using local time (noon-anchored to dodge DST). Falls back to literal `"Estimated Full"` if the last day lacks a `date` field. Same halo treatment.

**Chart vertical layout.** Both chart implementations bumped vertical headroom between the "Production Day" axis label and the legend to prevent overlap: SVG `H: 260 → 268` (chart drawing area unchanged); canvas `PAD.bottom: 44 → 52` (canvas height fixed by CSS, chart drawing area shrinks 8 px — bars stay at their 38% proportion of `chartH`). Cumulative orange running-total labels (52, 114, 166, …) gain a halo so they punch through the underlying blue bars: SVG `stroke="#fff" stroke-width="2.5" paint-order="stroke"`; canvas `strokeText` with `lineJoin='round'` *before* `fillText`.

**Dashboard Report map image.** Vessel Track image (`<img src="${DASH.mapSnapshot}">`) gains `border-radius: 10px` so the captured map's square corners don't poke through the rounded frame and show black snapshot edges.

**Crew identity contract surfaced (§9 / new sub-section).** The PWA's Purser → Crew Sign Off feature reads and writes `crewconfig.crew[].checkpoints[]` — previously a Console-only write surface. Both apps now use this array; on-disk schema unchanged. The bridge from `scheduleconfig.trips[].crew[].user_id` to a crewconfig record goes via `userconfig.json users[]` (which carries both `user_id` and `username`), then `crewconfig.crew[].username`. Fallback when `crewconfig.crew[].username === null` (accountless crew — common for non-tech crew without PWA logins): case-insensitive match on `crewconfig.crew[].name` against `scheduleconfig.trip.crew[].display_name`. Console rotation planner's existing `crewById` lookup uses the same UUID join indirectly via `SC.crewList` enrichment; the PWA implements the bridge explicitly because it doesn't share `SC.crewList`'s preprocessing pass. `applyDischargeSideEffects` (schedule.js:7034-7077) is mirrored byte-for-byte inside the PWA's `openPurserCheckoutModal` — KEEP IN SYNC marker added on both sides. Long-term, this duplication is what the Phase-7 crewconfig split (admin roster in `crewconfig.json`, self-edits in `crew/{user}/profile.json`) eliminates.

**Best-effort active-trip resolver (PWA).** Console's `scActiveTripNumber` reads the SQLite trips table (`open_date && !close_date`) which the PWA can't see. PWA replacement: first trip (by `sequence`) where `actual_close_date === null` AND `est_close_date >= today`; falls back to the open trip with the latest `est_close_date` if all are overdue. Documented here because it WILL diverge from the Console's view if scheduleconfig.json's `actual_close_date` lags the SQLite trips table's `close_date` for a closed trip. Permanent fix is Phase 2 of the OneDrive trips refactor (event-log trip subsystem) which gives the PWA an authoritative on-disk signal.

---

v2.21 — Stability Assessment surfaced on Dashboard + Dashboard Report.

**Dashboard (§30).** New **Zone 8 — Stability Assessment** appended after Zone 7 (System Health). Renders a read-only mirror of the two-chart Stability Assessment block from Report Generator → Stability Report (`TRIM DETERMINATION` left / `MAX VCG` right) with the red diamond cursor positioned per the existing `TRIM_CHART` / `VCG_CHART` calibration constants in `stability.js`. Per-panel footer lines show `LCG · Disp` (left) and `Disp · VCG Corr` (right). A full-width muted caption directly below the chart row reads: *"Fore trim is positive and aft trim is negative. For reference only — see Stability Booklet 175-101-150D pages 17–18 for manual plots."* `db:getDashboardData` gains a `stability_assessment: { lcg_m, disp_mt, vcg_corr_m, trim_m, configured }` field, computed at handler time against current `fuelstate.json` / `vesselconfig.json` / `stability.json` using the same `stReport*` calc helpers already used by the Stability Report (no caching).

**Stability Calculations (§26).** New shared helper `renderStabilityAssessmentBlock(container, { lcg_m, disp_mt, vcg_corr_m, trim_m, configured })` extracted from `stability.js` so the Stability Report, the Dashboard (Zone 8), and the new Dashboard Report tail block all call the same function — eliminates rendering duplication and guarantees the diamond cursor / caption / footer formatting stay in lockstep across the three surfaces. Null state (`configured = false`) substitutes a muted "Stability not configured" placeholder for the two charts and suppresses the caption.

**Reports (§30, Report Generator — Dashboard Report).** `buildDashboardReportPreview` gains a final `.rpt-section` appended after the Recent Rough Log table that calls `renderStabilityAssessmentBlock` with the values computed by `stReportPrepareAsOf` for the report's selected date (so historical Dashboard Reports render against the lightship / tank state in effect on that date — see v2.19 historical reports infrastructure). Print pipeline change: none required — the two PNG chart assets under `src/renderer/assets/` are picked up by the existing `rptInlineAttachmentImages` pass at print time.

**Build prerequisites (§30).** New item 4 added: `renderStabilityAssessmentBlock` extraction from `stability.js` into a shared helper. Must land before Zone 8 is wired up and before the Dashboard Report tail block is appended.

---

v2.20 — Scheduling Engine, Phase 5 (rollup of the parent Scheduling Engine additions doc + the cross-role fill-in addendum + the rotation-groups & sticky-rows addendum + every implementation refinement that landed during the build-out). Plus a focused rewrite of the Crew Scheduling Report.

**Scope.** Folds three earlier draft documents — *IDMS-SCHEMA-scheduling-additions.md*, *IDMS-SCHEMA-fillin-roles-addendum.md*, and *IDMS-SCHEMA-rotation-groups-sticky-rows-addendum.md* — into the rolling spec, with implementation-derived corrections layered in. The Schedule module gains a Draft tab, a Rotation Rules tab, a Rotation Planner tab, and a Fill-in Pool tab. Crew records carry scheduling context (skills, availability, fill-in roles, share, priority, rotation eligibility). The Schedule and Schedule Draft grids gain a multi-column Staffing Summary, hover affordances, and cadence-aware cell highlighting. The Crew Scheduling Report is refocused on the single docking event.

### File version bumps

| File | Before | After | Migration |
|---|---|---|---|
| `crewconfig.json` | 2 | **3** | adds `skill_tags[]`, `priority_weight`, `availability{}`, `rotation_eligible`, `fill_in_available`, `fill_in_roles[]` (replaces deprecated `fill_in_vessels[]`), `crew_share`; populates defaults on existing records |
| `scheduleconfig.json` | 1 | **3** | adds `positions[].target_count`, `positions[].sticky_rows`, `positions[].role_id`, `positions[].required_cert_ids[]`, `positions[].required_skill_ids[]`, `positions[].on_target` / `on_max` / `off_target` / `off_min`; `distribution_metric{}`; `cadence_rules[]`; `season_tail_lock_trips`; `rotation_groups[].allow_fill_ins`; `rotation_groups[].role_slots[]` (for `seniority_ranked` pattern); `trips[].crew[].slot_idx` + mirror `slot_index` |
| `vesselconfig.json` | 1 | **2** | adds `skill_requirements[]` |
| `userconfig.json` | 1 | **2** | adds `resources_changelog[]`, `action_overrides{}` |
| `skilltagsconfig.json` | — | **1** | new file |
| `fillinpool.json` | — | **1** | new file |
| `schedule_draft.json` | — | **1** | new file (working copy; promoted into `scheduleconfig.json` via Schedule Draft → Promote) |
| `trainingmatrix.json` | (current) | (unchanged) | source of truth for departments + roles + cert types; consumed live by Schedule module on tab open |

### crewconfig.json v3 — per-crew fields

```jsonc
{
  "crew_id":            "uuid",
  "username":           "string|null",
  "name":               "Full Name",
  "role_id":            "purser|mate|master|chief_engineer|asst_engineer|oiler|...",
  "role_label":         "Purser",
  "department":         "Wheelhouse",    // legacy / display fallback only — see Department Resolution
  "departments":        ["Wheelhouse"],  // sidecar list; primary lives in role
  "status":             "active|inactive",
  "vessel":             "F/T ARAHO",
  "contact":            { "phone":"", "email":"", "preferred_airport":"" },
  "certificates":       [ { "cert_id":"stcw_basic", "date_issued":"2024-03-15", "date_expiry":"2027-03-15", "doc_ref":"..." } ],
  "skill_tags":         ["welding","first_aid_cpr"],
  "priority_weight":    50,
  "availability":       {
                          "state":"available|unavailable",
                          "since":"2026-06-10",
                          "reason":"medical|personal|administrative|between_vessels|other",
                          "note":"free text",
                          "set_by":"username",
                          "set_at":"ISO-8601",
                          "history":[ { ... } ]
                        },
  "rotation_eligible":  true,
  "fill_in_available":  false,
  "fill_in_roles":      [],
  "crew_share":         2.4
}
```

**Department Resolution.** Authoritative department for a crew member is derived from `trainingmatrix.roles[].department` keyed by `crew.role_id`. The stored `crew.department` is a fallback used only when the role isn't recognized (legacy data or training matrix not yet loaded). Helper `scCrewDept(crew)` in `schedule.js` performs the lookup. Renaming a department in *Crew Setup → Departments & Roles* propagates automatically to every crew with a role in that department — no per-crew edit needed.

**Crew Share Gating.** The `crew_share` field is visible/editable in the Crew Setup → Crew List per-crew form only when `idmsCurrentUser.permission_tier === 'admin'` OR `idmsCurrentUser.role` is one of: *Captain · Mate · Chief Engineer · Factory Manager · Purser · Purser/QC Manager*. Helper `crewCanSeeShare()` in `crew.js`. An unauthorized editor's save preserves whatever value was previously stored (sentinel `undefined` skips the field on write).

**Availability State Machine.** `state: "unavailable"` removes the crew from the rotation projection (the generator excludes them as a hard filter). They remain visible in the manual crew picker with a flagged indicator but disabled by default. Each transition appends a row to `availability.history[]`. Fairness target is pro-rated to exclude the unavailable window.

### scheduleconfig.json v3 — full shape

```jsonc
{
  "schema_version":          3,
  "vessel":                  "F/T ARAHO",                   // synced from vesselconfig.info.vessel_name on each Schedule load
  "schedule_year":           2026,
  "approved_at":             "ISO-8601",
  "approved_by":             "username",
  "last_updated":            "ISO-8601",
  "season_frame":            { "steam_north_date":"...", "steam_south_date":"...", "total_trips":18 },
  "alert_config":            { "drift_threshold_days":7, "broadcast_threshold_days":10, "cooldown_days":7, "pre_port_reminder_days":7, "long_trip_threshold_multiplier":1.25, "broadcast_recipients":"all_active" },
  "reminders":               { ... existing reminder cards ... },
  "fishery_adjustments":     {},
  "distribution_metric":     { "Engine Room":"days", "Deck":"trips", "Factory":"trips", "Galley":"trips", "Wheelhouse":"trips" },
  "season_tail_lock_trips":  2,
  "positions":               [ ... see below ... ],
  "rotation_groups":         [ ... see below ... ],
  "cadence_rules":           [ ... see below ... ],
  "time_off":                [ { "user_id":"...", "off_after_trip":"2605", "expected_reboard_trip":"2609", "return_condition":{...} } ],
  "trips":                   [ { "trip_number":"2608", "sequence":8, "fishery_target":"Gulf", "projected_port":"DUT", "est_close_date":"2026-05-26", "actual_close_date":null, "crew_status":"projected", "crew":[ ... ] } ],
  "vacation_requests":       [ { "user_id":"...", "username":"...", "windows":[ { "start":"...", "end":"...", "note":"..." } ] } ],
  "changelog":               [ { "version":N, "date":"YYYY-MM-DD", "note":"..." } ]
}
```

**positions[]** — each entry defines a per-trip slot template:

```jsonc
{
  "position_id":         "uuid-or-stable-id",
  "role_id":             "chief_engineer",
  "label":               "Chief",
  "department":          "Engine Room",
  "type":                "rotated|float|adhoc",
  "rotation_group":      "rg_chief",
  "target_count":        2,
  "sticky_rows":         true,                              // v2.20: true by default; UI column hidden, behavior implicit
  "required_cert_ids":   ["stcw_management"],
  "required_skill_ids":  ["welding"],
  "on_target":           7,
  "on_max":              11,
  "off_target":          2,
  "off_min":             2
}
```

Cadence column resolution: `cadence_rules[]` entry with matching scope/scope_id wins (rotation_group scope > position scope); falls back to the position's baseline columns; if none set, no enforcement.

**rotation_groups[]**:

```jsonc
{
  "group_id":              "rg_oiler",
  "label":                 "Oilers",
  "pattern":               "manual|2way_alternating|3way_rotation|seniority_ranked",
  "members":               ["crew_id_a","crew_id_b","crew_id_c","crew_id_d"],
  "role_slots":            ["captain","mate"],              // only when pattern = "seniority_ranked"
  "trips_on":              null,
  "max_days_on":           null,
  "return_mode":           "whichever_first|both_required|manual",
  "notifications_enabled": true,
  "allow_fill_ins":        true                              // v2.16 addendum — gates tier-2 cross-role
}
```

**cadence_rules[]**:

```jsonc
{
  "rule_id":      "uuid",
  "scope":        "position|rotation_group",
  "scope_id":     "chief|rg_oiler|...",
  "department":   "Engine Room",
  "unit":         "days|trips",
  "on_target":    120, "on_max": 140,
  "off_target":   60,  "off_min": 45,
  "notes":        "..."
}
```

**trips[].crew[]** — per-slot assignment:

```jsonc
{
  "position_id":   "chief",
  "slot_idx":      0,                                       // 0-based authoritative
  "slot_index":    1,                                       // 1-based spec mirror
  "user_id":       "uuid",
  "display_name":  "William Ostara",
  "fillin_tier":   1                                         // 1=primary, 2=cross-role
}
```

### schedule_draft.json v1 — working copy

```jsonc
{
  "schema_version":  1,
  "vessel":          "F/T ARAHO",
  "schedule_year":   2026,
  "based_on":        { "last_updated":"ISO-8601 of committed schedule when draft last hydrated" },
  "generated_at":    "ISO-8601",
  "generated_by":    "username (optionally suffixed ' (pulled)' when sourced via Pull from Schedule)",
  "trips":           [ { "trip_number":"...", "sequence":N, "fishery_target":"...", "projected_port":"...", "est_close_date":"...", "crew":[ {position_id, slot_idx, slot_index, user_id, display_name, fillin_tier} ] } ],
  "notes":           ""
}
```

The draft mirrors only the trip metadata + crew slots of `scheduleconfig.json`. Positions, rotation groups, cadence rules, distribution metric live in `scheduleconfig.json` and are read live during draft render/generate/validate. On hydrate (`scHydrateDraft`), closed trips are pulled fresh from the committed schedule (history can't drift); open/future trips preserve any draft-side edits to fishery, port, est_close_date, and crew[].

### vesselconfig.json v2 — additions

`skill_requirements[]` adds a per-vessel staffing-mix target separate from the per-position role match:

```jsonc
{
  "requirement_id":  "uuid",
  "skill_tag_id":    "welding",
  "scope":           "vessel|department",
  "department":      "Engine Room",
  "target_count":    2,
  "min_acceptable":  1,
  "notes":           "Operational repair capability for M/E and auxiliary systems."
}
```

Counted at validation. Drives `skill_shortfall_target` / `skill_shortfall_min` alerts.

### userconfig.json v2 — additions

- `users[].resources_changelog[]` — append-only audit trail. Entry: `{ changed_at, changed_by, added:[], removed:[], note }`. Rendered in the Users editor as a "Permission Audit Trail" panel.
- `users[].action_overrides{}` — reserved for future fine-grained `:view`/`:edit`/`:approve` per resource. Default `{}`. Not surfaced in phase 1.
- Permission grid auto-locks for `permission_tier === 'admin'`. Downgrade clears implicit grants and logs the delta as a single `resources_changelog[]` entry.

### skilltagsconfig.json v1 (new file)

```jsonc
{
  "schema_version": 1,
  "vessel": "F/T ARAHO",
  "skill_tags": [
    { "tag_id":"welding",         "label":"Welding",             "category":"engineering",  "description":"Arc, MIG, TIG capability." },
    { "tag_id":"refrigeration",   "label":"Refrigeration",       "category":"engineering",  "description":"Plate freezer, RSW, provision coolers." },
    { "tag_id":"fork_lift",       "label":"Fork Lift Operator",  "category":"operational",  "description":"Cold storage + offload." },
    { "tag_id":"first_aid_cpr",   "label":"First Aid / CPR",     "category":"safety",       "description":"Current First Aid + CPR." },
    { "tag_id":"ammonia_handler", "label":"Ammonia Refrigeration", "category":"regulatory", "description":"Cert for NH3-system handling." }
  ],
  "changelog": [ { "version":1, "date":"YYYY-MM-DD", "note":"..." } ]
}
```

Edited via *Crew Setup → Skill Tags* (5th tab).

### fillinpool.json v1 (new file)

External contractor registry, stored separately from `crewconfig.json` so the rotation algorithm never accidentally pulls a contractor into a primary slot.

```jsonc
{
  "schema_version": 1,
  "vessel": "F/T ARAHO",
  "fill_ins": [
    {
      "fill_in_id":         "uuid",
      "name":               "Jane Contractor",
      "company":            "Pacific Crew Services",
      "contact":            { "phone":"...", "email":"...", "preferred_airport":"SEA" },
      "skill_tags":         ["welding","first_aid_cpr"],
      "certificates":       [ { "cert_id":"stcw_basic", "valid_until":"2027-03-15", "doc_ref":"..." } ],
      "eligible_vessels":   ["F/T ARAHO","F/T DEFENDER"],
      "eligible_positions": ["chief","first","oiler_a"],
      "status":             "active|inactive",
      "notes":              "Available March through October.",
      "added_at":           "ISO-8601",
      "added_by":           "username"
    }
  ],
  "changelog": [ { "version":1, "date":"YYYY-MM-DD", "note":"..." } ]
}
```

The rotation algorithm does **not** consume `fillinpool.json`. Fill-ins appear only via the manual "Find Coverage" picker on a slot. When assigned, the slot is materialized into `scheduleconfig.trips[].crew[]` with `user_id` set to a synthesized form (`"fillin:{fill_in_id}"`).

### Schedule module — tabs

`schedule.js` renders six tabs in this order:

1. **Schedule** — committed-schedule grid. Read-mostly. Year + Departments filter row.
2. **Rotation Planner** — trip-by-trip arrival/departure view filtered by Year + Departments. Read-only.
3. **Schedule Draft** — working copy with Generate / Pull from Schedule / Reset / Save Draft / Promote.
4. **Alerts** — Season Frame + reminder cards.
5. **Rotation Rules** — distribution_metric, position slot counts, cadence_rules, rotation_groups, Generator Policy.
6. **Fill-in Pool** — CRUD for `fillinpool.json`.

### Schedule grid — render specifics

- **Multi-slot expansion**: positions with `target_count > 1` expand into one row per slot. Numbering is global per `pos.label`: three Processor positions (target_count 2 + 4 + 20 = 26 total) render as `Processor #1` … `Processor #26`, not three independent `#1` blocks.
- **Empty-row collapse**: multi-slot rows with zero assignments on any trip are suppressed from the committed Schedule grid. Single-target positions always render. The Schedule Draft grid always shows all slots.
- **Departments filter row**: shared `SC.deptFilter` across Schedule / Schedule Draft / Rotation Planner.
- **Per-cell tooltip**: hover any assigned cell → `name · role · dept · skills · certs (with expiry status)` via the native `title`. Computed by `scBuildCellTooltip(userId)`.
- **Cross-crew hover highlight**: each assigned cell carries `data-user-id` + class `sc-crew-hover`. A document-level mouseover handler (installed once via `window._scCrewHoverWired`) outlines every cell sharing the hovered user_id across all visible grids simultaneously.
- **Vessel-tolerant matching**: `scNormVessel(s)` strips `^F/[VT]\s+` and folds case so `"ARAHO"`, `"F/V Araho"`, `"F/T ARAHO"` all match.

### Schedule Draft — generator algorithm

Implemented in `scGenerateDraft(opts)`. `opts`: `{ mode: 'replace'|'vacant_only', tripScope: Set<trip_number>, deptScope: predicate(dept)→bool }`.

Positions iterate in **training-matrix role order** (higher-priority roles get first pick). For each position per trip (closed trips skipped):

**Eligibility filters (`eligibleBase`)** — hard:
1. Active status
2. `rotation_eligible !== false`
3. Vessel matches (tolerant)
4. `availability.state === 'available'`
5. Tier match: tier-1 (`crew.role_id === pos.role_id`) OR tier-2 (`crew.fill_in_available && pos.role_id ∈ crew.fill_in_roles`, gated by `rotation_groups[pos.rotation_group].allow_fill_ins !== false`)
6. Department (tier-1 only; tier-2 bypasses by definition); resolved via `scCrewDept`
7. Every `pos.required_cert_ids[]` held and not expired before `trip.est_close_date` (bypassable)
8. Every `pos.required_skill_ids[]` held (bypassable)
9. No vacation window covers the trip date
10. Not inside an `off_after_trip` … `expected_reboard_trip` block

**Cadence gate (`cadenceAllows`)** — hard limits (bypassable):
- On-streak ≥ `on_max` (currently on) → exclude
- Off-streak < `off_min` and > 0 (currently off) → exclude

**Sort key** (final priority order):

| key | direction | meaning |
|---|---|---|
| `tailLock` | desc | within last `season_tail_lock_trips` trips, prev-trip slot occupants get +1 |
| `cadence`  | desc | +2 if off ≥ `off_target` (rested); −2 if on ≥ `on_target` (tired); −1 within 1 of `on_max` |
| `tier`     | asc  | 1 (primary) before 2 (cross-role) |
| `tripCnt`  | asc  | total season trip count so far — fairness |
| `share`    | desc | `crew_share` — competing-contender tiebreak |
| `priority` | desc | `priority_weight` |
| `name`     | asc  | pure tiebreak |

**Pool**: tier-1 and tier-2 candidates combined in one sort (no strict fall-through). Roster = top `target_count - existing_carry_count` candidates. Last-resort fallback: re-pool ignoring cadence so slot fills rather than going vacant; validator surfaces the resulting overrun.

**Slot assignment** (after roster selected):
- `sticky_rows: true` (every position by v2.20 default): **two-pass placement**.
  - Pass 1 — **reclaimers**: every roster member who held this position on the immediately prior trip claims their previous `slot_idx`. Sort-order priority does not override slot identity.
  - Pass 2 — **newcomers** take the lowest open `slot_idx`, in roster sort order.
- `vacant_only` mode: in-scope slots with `user_id` set are carried verbatim; the roster picks only fill the remaining empty slots.

**Generated slot record**:
```json
{ "position_id":"...", "slot_idx":0, "slot_index":1, "user_id":"...", "display_name":"...", "fillin_tier":1 }
```

`fillin_tier: 2` triggers a `crossrole_fillin_assigned` alert on validation.

### Schedule Draft — UI

**Header bar**: `⚙ Generate` · `↺ Pull from Schedule` · `Reset to Empty` · `Save Draft` · `✓ Promote to Schedule`. A second `⚙ Generate now` button sits inline with the scope row.

**Generate scope**: Mode (`Replace all slots` vs `Fill vacant only`) · per-trip column checkboxes (`All future` / `None`) · Bypasses (*Disregard certificate requirements* · *Disregard skill requirements* · *Disregard cadence rules*) · Departments filter (scopes Generate and Promote end-to-end).

**Trip header**: trip checkbox · trip label · clickable fishery badge · clickable offload port · close date. Edits to fishery/port persist through hydrate and propagate on Promote.

**Cell rendering**:
- Cadence breach background: **yellow** past `on_target`, **red** past `on_max`. Tooltip prepends the breach reason ahead of the crew profile.
- Same `sc-crew-hover` cross-cell highlight as the Schedule grid.
- Click opens `scOpenDraftCrewPicker(td)` — operates on `SC.draft`, marks draft dirty.

**Staffing Summary** (below the grid, 4-column flex row):
1. **Active Trip — {trip_number}** — total aboard + per-department breakdown.
2. **{vessel} Pool (active & available)** — vessel-matched roster + per-department breakdown (dept list sourced live from `trainingmatrix.departments`, auto-refreshed on tab open).
3. **Role need vs pool size** — per role: need-per-trip, pool size, Δ (green surplus / amber zero-slack / orange shortfall). Rows ordered by training-matrix role priority.
4. **Call-Up Shortlist** — sequential simulation: candidate must hypothetically clear **all** selected trips (using `on_target` / `off_target` as the limits — stricter than the generator's `on_max` / `off_min`). All-or-nothing. Grouped by role, primary before cross-role.

### Picker behavior

Both pickers (`scOpenCrewPicker`, `scOpenDraftCrewPicker`) filter by: active · vessel match · availability available · `role_id === pos.role_id` · dept · certs · skills. A 👁 **See All (no role filter)** entry re-opens the picker with `bypassRole: true`. Empty-pool branches show the filter reason. A `+ Non-validated…` entry allows a name-only assignment for off-roster fill-ins.

### Rotation Rules tab — layout

- **Save bar** (top): `Rotation Rules · ● Unsaved · [Save Schedule] · Saved ✓`.
- **Distribution Metric** — one row per dept from `trainingmatrix.departments[]` (live, auto-refreshed on tab open). Orphan keys (in `distribution_metric` but not in trainingMatrix) render greyed with a Remove button.
- **Generator Policy** — `season_tail_lock_trips` numeric input (default 0).
- **Position Slot Counts** — columns: ▲▼ reorder · Position (role dropdown grouped by dept) · Department (derived) · Slots · On tgt · On max · Off tgt · Off min · Required Certs (chip multi-select) · Required Skills (chip multi-select) · Delete. STICKY column hidden; `sticky_rows: true` implicit.
- **Cadence Rules** — per-scope override editor.
- **Rotation Groups** — inline editable cards. `role_slots[]` input shown only for `seniority_ranked` pattern. `allow_fill_ins` toggle.
- **Position role-change safeguard**: changing `role_id` on a position with crew across trips prompts a confirmation showing slot-count before clobbering.

### Rotation Planner tab

Year selector + Departments filter (shared with Schedule + Schedule Draft). For the current schedule year: per-trip rows showing crew arriving (bold underline) and departing (parenthesized accent color). Past years: placeholder.

### Alert taxonomy — additions

| `trigger_type` | Severity | Trigger |
|---|---|---|
| `rotation_member_unavailable` | Info → Warning → Critical | Group member transitions to unavailable; daily ingest poll |
| `rotation_group_empty` | Critical | All members of a rotation_group unavailable simultaneously |
| `skill_shortfall_target` | Warning | `skill_requirements` count below `target_count` |
| `skill_shortfall_min` | Critical | `skill_requirements` count below `min_acceptable` |
| `cert_missing` | Regulatory | Required cert not on file for an assigned crew |
| `cert_expired` | Regulatory | Cert expired before trip open |
| `cert_expiry_in_trip` | Regulatory | Cert expires mid-trip |
| `cadence_overrun_on` | Severity-graded | Crew on-stretch exceeds `on_max` |
| `cadence_overrun_off` | Severity-graded | Crew off-stretch falls below `off_min` |
| `vacancy` | Warning → Critical | Position not fully filled per `target_count` |
| `unknown_crew` | Critical | Slot has display_name but user_id doesn't exist in crewconfig |
| `crossrole_fillin_assigned` | Info | A slot filled by a tier-2 cross-role fill-in |
| `position_vacancy_unack` | Blocking | Admin promotes a draft with unfilled positions w/o explicit ack (deferred — surfaces via alerts list) |

### Personnel menu placement

`index.html` Personnel section order: **Schedule · Training Matrix · User Profile · Crew List**. The Crew List entry (`#nav-crewlist`) routes through `openCrewListDirect()`:
- Gated by `canSeeCrewList()` — admin tier OR role in {Captain, Mate, Chief Engineer, Factory Manager, Purser, Purser/QC Manager}.
- Pins `CS.crewListOnly = true` so the full multi-tab view is hidden — only the crew list is visible.
- Full Crew Setup multi-tab view (Departments & Roles, Certificate Types, Requirements Matrix, Skill Tags, Crew List) remains reachable via *Config → Crew Setup* for admin users.

Crew List rendering: search box above the active list, active panel grouped by department (sub-headers, sorted alphabetically by last name within each group). Reorder arrows removed.

### Crew form (`crew.js`) — v2.20 sections

- **Scheduling** (everyone editing): skill tags multi-select · priority weight · rotation eligible · availability state (with conditional reason + note) · fill-in available (with conditional `fill_in_roles[]` multi-select).
- **Crew Share** (gated): single numeric input. Save preserves prior value when the editor lacked share visibility.

### Crew Scheduling Report — v2.20 rewrite

`buildCrewSchedulingPreview()` in `reports.js` was refocused on the single docking event. **Removed**: the Crew Totals and Requested Time Off panels (information lives on the live Schedule tab). **Kept**: the Schedule grid (page 1). **Narrowed**: the Rotation Planner section now shows only the row for the active trip (filtered to `scActiveTripNumber()` — falls back to the first non-closed trip when no active trip is detected). **Added**: two contact tables, each conditional on having any names:

- **Returning Crew** — crew on the *next* trip who were not on the active trip. Columns: NAME · EMAIL · PHONE · ORIGIN · DESTINATION. Origin = crew's `contact.preferred_airport`. Destination = active trip's offload port (`trip._port` or `projected_port`).
- **Departing Crew** — crew on the active trip who are not on the next trip. Columns: NAME · EMAIL · PHONE · ORIGIN · DESTINATION. Origin = active trip's offload port. Destination = crew's `contact.preferred_airport`.

Missing email / phone / preferred_airport renders as `<em>not on file</em>` so admins know which contact records need updates before the docking. If both tables would be empty (no rotation at this docking), a single line summarizes that fact instead of either table.

The report's print pipeline (`@page { size: landscape }`, scoped CSS variable overrides, blackening of inline `#fff`/`#ffffff` colors) is unchanged. A new `.rpt-contact-table` style block formats the contact tables consistently with other reports — pale-blue header row, alternating row tint.

### Migration notes — v2.20 rollup

Scripts (idempotent; safe to re-run):

| Script | Purpose |
|---|---|
| `scripts/migrate-scheduler-v2.16.js` | Initial Scheduling Engine migration |
| `scripts/migrate-v2.16-addenda.js` | Cross-role + Rotation-groups/sticky-rows addenda |
| `scripts/normalize-vessel-and-merge-crew.js` | Vessel name normalization → `F/T ARAHO`; idempotent merge of seeded crew into live |
| `scripts/purge-inactive-from-schedule.js` | Removes inactive crew from `rotation_groups[].members[]`; blanks them from open-trip crew slots (closed trips preserved) |
| `scripts/enable-sticky-everywhere.js` | Sets `sticky_rows: true` on every position; backfills `slot_idx`/`slot_index` using share-desc → alphabetical-asc seed order |
| `scripts/repair-schedule-positions.js` | Restores canonical position labels/depts when the role dropdown was used to rename `position_id`-bound rows with trip crew data |
| `scripts/collapse-oilers.js` | Specific fix — `oiler_a` + `oiler_b` → single `oiler` with `target_count: 2`; merges rotation groups |
| `scripts/backfill-trips-1-8.js` | Operational backfill — populates trips 2601–2608 from the master rotation sheet for non-Engine-Room positions |
| `scripts/seed-trip-2608-crew.js` | Adds master-sheet crew into crewconfig with proper roles + fill-in flags |

Default values for migrated records:

| File | Field | Default |
|---|---|---|
| `crewconfig → crew[]` | `skill_tags` | `[]` |
| | `priority_weight` | `50` |
| | `availability` | `{ state:'available', history:[ {state:'available', set_by:'migration', set_at:<NOW>, note:'Default state on schema migration to v3'} ] }` |
| | `fill_in_available` | `false` |
| | `fill_in_roles` | `[]` (replaces `fill_in_vessels: []` which is dropped) |
| | `rotation_eligible` | `true` |
| | `crew_share` | `null` |
| `scheduleconfig → positions[]` | `target_count` | `1` |
| | `sticky_rows` | `true` (v2.20 default) |
| | `required_cert_ids` | `[]` |
| | `required_skill_ids` | `[]` |
| `scheduleconfig` top-level | `distribution_metric` | `{ <each dept>: 'days' }` |
| | `cadence_rules` | `[]` |
| | `season_tail_lock_trips` | `0` |
| `scheduleconfig → rotation_groups[]` | `allow_fill_ins` | `true` (per the addendum default) |
| `vesselconfig` top-level | `skill_requirements` | `[]` |
| `userconfig → users[]` | `resources_changelog` | `[]` |
| | `action_overrides` | `{}` |

### Algorithm Notes — sort-key rationale

The sort-key order (`tailLock → cadence → tier → tripCnt → share → priority → name`) was arrived at iteratively. Two earlier mis-orderings that caused visible bugs and were corrected:

- **Share placed too high** — `share` previously sat second-highest (only below `tailLock`) for sticky positions. High-share crew always beat lower-share regardless of fatigue. Surplus pool wouldn't rotate. Demoting `share` below `cadence` and `tripCnt` lets fatigue and fairness dominate, restoring rotation in surplus conditions.
- **Strict tier fall-through** — pre-v2.20 the algorithm exhausted the entire tier-1 (primary-role) pool before consulting tier-2 (cross-role). This starved fill-ins of opportunity even when a tier-2 candidate was rested and a tier-1 was about to bust `on_max`. Merging into one pool with `tier` as a sort key (below `cadence`) lets a rested fill-in beat a tired primary.

### Algorithm Notes — sticky-rows behavior

Per the Sticky-Rows addendum B.2/B.3 with the v2.20 refinement:

- **Slot identity preservation is roster-independent** — Sticky decides which `slot_idx` a roster member gets, not whether they're on the roster at all. Cadence/fairness/cert/skill filters decide WHO is on the trip; sticky only assigns rows.
- **Reclaimers always win their slot** — A crew member on the immediately-prior trip in this position reclaims their `slot_idx` before any newcomer is placed. Sort-order priority doesn't override slot identity (pre-v2.20 bug: a newcomer with lower trip count could displace the incumbent into a different slot — fixed via two-pass placement).
- **Cross-position movement** — A crew member changing position vacates their old slot; the new position assigns a slot per the standard placement rules.

### Implementation file map

| Surface | File | Key functions |
|---|---|---|
| Schedule tab + grid | `src/renderer/js/schedule.js` | `renderSCGrid`, `scOpenCrewPicker`, `scBuildCellTooltip`, `scCrewDept`, `scNormVessel`, `scBuildSlotNumbers` |
| Schedule Draft tab | `src/renderer/js/schedule.js` | `renderSCDraft`, `scGenerateDraft`, `scValidateDraft`, `scPromoteDraft`, `scHydrateDraft`, `scOpenDraftCrewPicker`, `scOpenDraftFisheryPicker`, `scOpenDraftPortPicker` |
| Rotation Rules tab | `src/renderer/js/schedule.js` | `renderSCRotationRules` |
| Rotation Planner tab | `src/renderer/js/schedule.js` | `renderSCReference` |
| Fill-in Pool tab | `src/renderer/js/schedule.js` | `renderSCFillinPool` |
| Crew Setup tabs | `src/renderer/js/crewsetup.js` | `initCrewSetup`, `renderCrewSetupScreen`, `buildSkillTagsTab` (new), `csSaveMatrix` |
| Crew form | `src/renderer/js/crew.js` | `buildCrewEditPanel`, `wireCrewEditForm`, `saveCrewMember`, `crewCanSeeShare`, `crewLastName`, `crewMatchesSearch` |
| Vessel Setup skill reqs | `src/renderer/js/vessel.js` | `buildSkillRequirementsTab`, `wireSkillRequirementsTab` |
| Users audit | `src/renderer/js/users.js` | `buildResourceSection`, `buildResourcesChangelog`, `saveEditedUser` |
| OneDrive helpers | `src/renderer/js/graph.js` | `loadCrewConfig` (with `migrateCrewConfigV3`), `loadScheduleConfig` (with `migrateScheduleConfigV2`), `loadVesselConfig`, `loadUserConfig`, `loadSkillTagsConfig`, `saveSkillTagsConfig`, `loadFillinPool`, `saveFillinPool`, `loadScheduleDraft`, `saveScheduleDraft`, `deleteScheduleDraft` |
| Nav + gating | `src/renderer/js/app.js` | `applyCrewNavVisibility`, `openCrewListDirect`, `openOwnUserProfile`, `canSeeCrewList`, SCREENS registry |
| Crew Scheduling report | `src/renderer/js/reports.js` | `buildCrewSchedulingPreview` (refocused on single docking event) |

### Deferred / open

- **Action-level permissions** — `:view`/`:edit`/`:approve` per resource. `action_overrides{}` reserved, UI not surfaced.
- **Fleet-wide scheduling** — cross-vessel `fill_in_vessels[]` reintroduction deferred. Current `fill_in_roles[]` is single-vessel-bound.
- **Per-fishery / per-trip skill overrides** — `skill_requirements[]` is vessel/department-scoped only.
- **Pay-aware optimization** — fairness in trip count, not pay.
- **Multi-department crew membership** — single primary department per crew (resolved from role).
- **End-of-season look-ahead (Option B)** — availability-window-pro-rated targets for fairness (per parent A.1 tier 5). Not yet implemented; `tripCnt` is raw count.
- **Backtracking generator** — per-trip greedy with fallback; constraint-satisfaction backtracking not implemented.
- **Manual slot reorder UI** — admin can't drag a sticky-rows occupant between slots without going through the picker.

---

v2.19 — Historical reports infrastructure.

**`fuelstate.json` (§25).** Schema bumped **v4 → v5**: new `fuel_log` array stores correction entries for fuel-category tank manual edits (mirrors the correction-entry shape already used in `waste_log` / `lube_log`). Inline tank-QTY edits on the Fuel & Oil Transfers screen now **auto-save on blur** via the same `runTransferThenAutoSave` wrapper transfers already use — closes a divergence gap where direct tank edits required an explicit "Save to OneDrive" click and could be lost on app close. The `logManualCorrection` helper now covers fuel tanks (previously waste/lube only) and skips zero-delta no-ops so tabbing through a field doesn't litter the log. The "Save to OneDrive" button is retained as a manual force-sync fallback.

**SQLite — `fuel_state_history` table (new).** Append-only per-tank volume changes for historical reconstruction of tank state at any past instant. Written from `db:ingestFuelState` only when a tank's volume actually changes (or a new tank appears) — no-op ingests don't bloat the table. Indexed on `(timestamp)` and `(tank_id, timestamp)` for "as-of date" queries. Backs the new historical Fuel / Stability / Dashboard report views.

**SQLite — `vessel_config_snapshots` table (new).** Mirrors the existing `rounds_config_snapshots` pattern — captures `vesselconfig.json` on every successful save (deduped against the most recent snapshot by JSON equality so repeat saves with no changes don't duplicate). New IPC handler `vessel:saveConfigSnapshot` invoked by `saveVesselConfig()` in `vessel.js` after each successful Graph PUT (non-fatal — a snapshot hiccup never blocks a save). Enables future historical Stability reports to render against the tank layout / lightship / LCG / VCG / FSM values that were in effect on a past date rather than today's.

**SQLite — `fuel_transfers` table extended.** `log_type` column gains a new value `'fuel'` (was `'waste' | 'lube' | 'burn'`). `db:ingestFuelTransfers` accepts a new `fuel_log` parameter alongside `waste_log` and `lube_log` and writes one row per fuel-tank correction with `to_type='correction'`.

**New IPC handlers (read-only as-of queries).**
- `db:getFuelStateAsOf({ date })` — replays `fuel_state_history` to return per-tank latest volumes at or before end-of-day for the given `YYYY-MM-DD`. Tank metadata sourced from the vessel-config snapshot in effect on that date, with the live `fuel_state_snapshot` metadata as fallback.
- `db:getFuelStateHistoryEarliest()` — earliest `fuel_state_history.timestamp`. Used by report pickers as the "no data available before" cutoff.
- `db:getTripActiveOn({ date })` — resolves which trip was open on a given date (`open_date <= date AND (close_date IS NULL OR close_date >= date)`). Anchors historical Factory Production and Dashboard previews to the right trip.
- `db:getProductionEntriesEarliest()` — earliest `production_entries.entry_date`. Cutoff for the Factory Production date picker.

**Reports — date-pickered historical views (§30).** Dashboard, Fuel Report, Stability, Stability Workdown, and Factory Production previews each gain a day-level year/month/day picker bar (Historic Fuel Report gains a year-only picker). All pickers sit **outside** the printable `.rpt-page` card (consistent with Cathodic Protection's existing pattern) and include **Save / Print** and **Email** action buttons aligned right. Shared helpers in `reports.js`: `rptDatePickerHtml`, `rptYearPickerHtml`, `rptPickerActionsHtml`, `rptWireDatePicker`, `rptWireYearPicker`, `rptWirePickerActions`. Picker-less previews (Crew Scheduling, Training Compliance, HACCP) auto-receive a standalone actions bar via a post-render hook in `loadPane`. Per-report state persisted on `RPT.fuelDate` / `RPT.dashboardDate` / `RPT.stabilityDate` / `RPT.stabilityFullDate` / `RPT.factoryDate` / `RPT.fuelHistoricYear`. Stability previews load via a new `stReportPrepareAsOf` helper that temporarily overlays `STAB.fuelState.tanks` with `getFuelStateAsOf` results before re-running the existing `stReport*` calc helpers.

**Reports — email with PDF attachment.** The Email action no longer opens a bare `mailto:` draft. New IPC handler `report:emailWithPdf({ html, filename, recipients, subject, body })` (a) renders the print HTML to a PDF buffer via a hidden `BrowserWindow` + `webContents.printToPDF` (Letter, 0.4" margins, backgrounds on), (b) builds an RFC-5322 multipart MIME `.eml` draft with the PDF base64-encoded as `Content-Disposition: attachment` (and `X-Unsent: 1` so Outlook treats it as a draft), (c) writes the `.eml` to `%APPDATA%/idms-console/mail-drafts/` and opens it via `shell.openPath`. Cross-client: Outlook / Thunderbird / Apple Mail all open it as a new draft with the attachment pre-loaded.

**Trip Analytics — Trip History expanded daily-logs view (§27).** The expand-row daily-logs preview now mirrors the Edit form columns: `Date · Fuel Burned (USG) · Production (MT) · Lat (DD° MM.mmm' N/S) · Lon (DDD° MM.mmm' E/W)` (previously `Date · Fuel · Position`). Production column sourced from `trip_daily_logs.production_mt`; Lat / Lon split using the existing `taDDtoDM` helper so the format matches the inline edit form exactly.

**Historic Fuel Report (§30).** Refactored to use the shared `rptYearPickerHtml` (auto-load on year change, no separate Load button). Earliest available year derived from `getTrips()` at first render so the dropdown only lists years with real data; inline note reads "Trip data available from {YYYY}". Selection persists in `RPT.fuelHistoricYear`, clamped to the available range on revisit.

v2.18 — Cross-module hardening + reporting overhaul.

**Tasks & Maintenance (§32).** `task_records` table gains a `close_notes TEXT` column (ALTER TABLE migration on startup); the Close Notes field on the Manual Entry form is now persisted (previously silently dropped). Closed Tasks list defaults the From / To filters to the previous 7-day window (today−7 → today), computed lazily so the range stays current as the app stays open; Clear button resets to the same window. Every closed row gains an **Edit Record** action that opens a modal for correcting title, category, priority, completed_at, equipment_hours, description_work, items_used, failure_mode/mechanism/detection_method, follow_up + notes, and close_notes. New IPC handler `db:updateTaskRecord({ record_id, …editable fields })` enforces an allowlist and JSON-encodes equipment_ids / skill_tags before UPDATE. Manual-entry submission no longer double-encodes `equipment_ids` / `skill_tags`: backend `ingestTaskRecords` now accepts either an already-stringified value or an array via an `asJsonArray` normalizer (renderer already pre-stringifies). Hardened `tryParseJson()` (in `tasks.js`): when the fallback is an array, a successful `JSON.parse` whose result is not an array is coerced to the fallback — prevents `eqIds.map` crashes when a row stores `equipment_ids` as a stringified non-array. Closed-tasks click handler shows "No events recorded." instead of an indefinite spinner when the record has no `task_id` (manual entries). Newly-created tasks now write their attachment list onto the corresponding rough-log entry via `writeTaskRoughLogEntry({…, attachments})` (was previously dropped).

**Rough Log (§31).** Dashboard `recent_roughlog` query gains `LEFT JOIN assets a ON rl.equipment_id = a.code` so `asset_name` is available alongside the code; LIMIT bumped from 15 → 200 to support windowed filtering on the renderer side. The Dashboard's Recent Entries panel now filters to the 24-hour window ending at the previous midnight (yesterday's full day). Equipment column shows code (mono / accent) + asset name (small / muted). Attachment thumbnails (loaded via `loadEventLogThumbnails` against OneDrive blobs) render on both the Dashboard and the Dashboard Report; thumbnails are clickable to open the existing attachment lightbox.

**Reports (§30, Report Generator).** Each report now defaults its Description header to `"{Report Label} Report"` (with `Report` suffix suppressed when the label already contains it) — applied only when the user has left the Description field blank. `RPT.currentReportId` tracks the active report; `rptDefaultDesc(id)` resolves the default. **Dashboard Report Recent Rough Log** columns changed to Time / Author / Equipment / Entry with the same code-over-name pattern as the Rough Log page; falls back to category when no equipment_id. **Product Detail @ Midnight** table now lays out the top four sizes per species as four discrete columns (Size 1 – Size 4) sorted by canonical `RPT_SIZE_ORDER` (`XL JB LG L MD M SM S 2S 3S U MISC`), with `—` filling unused slots and the highest-percentage cell emphasized. **Crew Scheduling report** rewritten: re-renders the live `renderSCGrid` / `renderSCTotals` / `renderSCTimeOff` / `renderSCReference` into off-screen scratch divs, then wraps each captured block in a `.rpt-sc-scope` container that overrides CSS variables (`--bg-1/2`, `--text-1/2/3`, `--border`, `--accent`) to print-friendly values, recolors inline `color:#fff` / `#ffffff` → `#000`, strips the inner grey "Crew Totals" / "Requested Time Off" duplicate headers from the captured HTML, filters out inactive crew rows (matched by display name against `SC.crewList[c].status !== 'active'`), and compresses cell padding. Single `rptPage` (the print path only emits the first `.rpt-page`); a `page-break-before:always` divider forces **Rotation Planner** onto page 2. `@page { size: landscape }` injected via the report's `<style>` block, and the on-screen `.rpt-page` is widened to 1080 px when content includes `<div class="rpt-sc-landscape">` via a `:has()` selector. The grid's per-cell `min-width: 78px` is overridden to `auto` so it compresses to the landscape page width.

**Reports — print pipeline.** New `rptInlineAttachmentImages(pageEl)` clones the page and replaces every `<img data-thumb-path>` with a base64 `data:` URL via `getAttachmentUrl` → `fetch` → `FileReader.readAsDataURL`. `rptOutputPage` calls it for `print` and `pdf` actions so attachment thumbnails survive the move into the print iframe (parent-document blob URLs are invalid there). The on-screen preview still uses the cheaper blob URL.

**Dashboard (§30).** Zone 4 "Factory Production — Today" renamed **Top Species** and replaced with the same top-3 species + 4 size-column table used in the Dashboard Report, followed by the existing `buildProductionChartSvg` daily production chart. Zone 6 (Rough Log Recent Entries) — see §31 entry above. Zone 7 head renamed **System Health → Factory Health**; inner "Recent events" panel renamed **Factory Events**.

**Trip Analytics (§27).** **New Trip form** gains Departure Lat / Lon inputs that auto-populate from the selected port (`TA.config.ports[].lat/lon`) on `change`. Saved values persist into `TA.config.active_trip.start_lat` and `start_lon`. **Analytics Setup > Ports** lat/lon inputs converted from decimal degrees to the DD° MM.mmm′ N/S deg/min/hemi triple used on Current Trip Calculations and the PWA Rounds entry (helpers `taDDtoDM` / `taDMtoDD` reused). Saved values are still decimal degrees in `tripanalyticsconfig.json` (only the UI changed).

**Tanks & Transfers (§25).** All four Apply transfer buttons (fuel, waste, lube, water) now auto-save the resulting fuel state to OneDrive via a new `runTransferThenAutoSave(applyFn)` wrapper that checks the dirty flag transition (validation early-returns leave it unchanged, so the save only fires on a successful mutation).

**Factory Production (§37).** Overview stat strip rewritten: **Primary Constraint** = `bottleneck_mt_per_day × demonstrated_max_pct / 100` with subtitle "{section} · Demonstrated Max ({pct}%)"; **Trip Capacity Used** removed and replaced by **Available Max** showing the constraint section's theoretical max with subtitle "{section} · Theoretical Max". The trip production canvas chart gains mouse-hover behaviour: `drawTripProductionChart` records per-day hit-boxes (`canvas._barHits`) spanning the full column width (bar + X-axis label); `wireTripChartHover` attaches a `mousemove` listener that shows a tooltip (`Day N · YYYY-MM-DD · M.M MT`) and swaps the Species panel to that day. The old multi-day "Species History" listing is replaced by two side-by-side panels: **Species by Day** (one day at a time — default = most recent; updates to the hovered day; restores to default on `mouseleave`) and **Species by Trip** (MT-weighted aggregate via new `aggregateSpeciesAcrossTrip()` — each row's grade percentages sum to 100% based on MT contribution per size). Helpers added: `collectSpeciesByDay`, `aggregateSpeciesAcrossTrip`, `buildSpeciesRowsHtml`, `renderSpeciesByDayPanel`, `renderSpeciesByTripPanel`, `wireTripChartHover`.

**Window controls.** The three macOS-style traffic-light dots in the custom title bar are now wired through IPC. New main-process handlers `window:minimize`, `window:toggleMaximize`, `window:close` resolve the `BrowserWindow` via `BrowserWindow.fromWebContents(e.sender)`. Preload exposes `window.idms.window.{minimize, toggleMaximize, close}`. `app.js` now calls these instead of the broken `window.minimize?.()` / `window.close()` no-ops; the green dot's handler is added (was previously absent).

v2.17 — Trip History tab (§27) gains admin-only **↑ ↓ reorder controls** on each trip row. `trips` table gains `sort_order INTEGER` column (added via `ALTER TABLE` migration on startup; populated once from `open_date DESC` row rank for rows that have `NULL`). `db:getTripsWithTotals` ORDER BY changed from `open_date DESC` to `COALESCE(sort_order, 999999) ASC, open_date DESC`. New IPC handler `db:swapTripOrder` (`{ trip_id_a, trip_id_b }`) swaps the `sort_order` values of two trips in a transaction; re-renders the Trip History tab on success. ↑ button suppressed on first row; ↓ button suppressed on last row; reorder buttons are spacers (not buttons) when disabled. Row-expand click guard updated to ignore `.ta-reorder-btn` clicks. New handler exposed in `preload.js` as `swapTripOrder`.

v2.16 — Trip History tab (§27) expanded. **New columns:** Total Prod (MT) added between Fishery and Open; Avg Daily Burn (USG) added between Close and Total Fuel Burned; "Total Fuel (USG)" column renamed to "Total Fuel Burned (USG)". Column order: Trip # · Fishery · Total Prod (MT) · Open · Close · Avg Daily Burn (USG) · Total Fuel Burned (USG) · [actions]. **Admin topbar controls:** "+ New Trip" button (modal: trip number YYNN, open date, fishery) and "Close Active Trip" button (modal: close date, offload port; irreversible warning; only shown when an active trip exists). **Per-row delete:** × button alongside Edit; confirmation dialog; deletes trip + all daily logs + crew assignments in a single transaction; clears `TA.activeTrip` if the active trip is deleted. Active trip row highlighted with subtle background and "● Active" badge. **New IPC handlers:** `db:getTripsWithTotals` (replaces `db:getTrips` in the Trip History renderer — LEFT JOIN with `trip_daily_logs` to return aggregated `total_fuel_usg`, `total_production_mt`, `fuel_log_days`); `db:deleteTrip` (transactional delete of trips + daily logs + crew assignments). **Avg Daily Burn calculation:** seed/historical trips use `notes.gpd` (falling back to `fuel_total_usg / days_at_sea`); live trips use `total_fuel_usg / fuel_log_days`. Client-side `taParseNotes()` utility added to `tripanalytics.js` (mirrors `parseNotes()` in `main.js`).

v2.15 — Trip Analytics UI revised (§27). "Trip History" tab (old Tab 2, delegating to `initTripHistory`) removed — it was a null-destination stub offering no value. "Fuel Consumption" tab renamed to **Trip History** (internal key `fuel` unchanged) — this is the accurate description of what the tab shows. Tab count: 4 → 3 (`Current Trip Calculations · Trip History · Analytics Setup`). Trip History tab gains admin-only **Edit** button per trip row: opens an inline edit panel with Trip Details (fishery, open date, close date, offload port) and a Daily Logs table (editable Fuel Burned (USG), Production (MT), Lat, Lon per day). "Fuel Burned" is explicitly labelled as settling-tank draw (fuel consumed that day, not fuel onboard). Edit panel supports **+ Add day** (date picker, rejects duplicates) and per-row **× delete** (staged — rows dim to 35% opacity and are only deleted on Save, togglable before confirming). Save sequence: header update → staged deletes → daily log upserts (blank rows skipped). Three new IPC handlers: `db:updateTrip`, `db:updateTripDailyLog`, `db:deleteTripDailyLog` (see §27 IPC handlers).

v2.14 — Rounds module hardened (Console + PWA). **Year subfolders:** user entry log files are now stored under `data/rounds/logs/{username}/{YYYY}/` (year subfolder added); the Console `listRoundsLogFilesForUser` scans current and previous year. **`round_number` / `scheduled_time` at payload level:** in the §22 file these fields are canonical at the top-level payload and echoed into each entry for backward compatibility — the Console ingest now reads from payload level, not per-entry level. **Actual submission time:** `rounds_aggregates` overview now exposes `actual_time` (earliest `submitted` timestamp across all contributing users) displayed in the Rounds Log "Actual" column. **Rounds Log detail view** layout changed to Section / Item / Value / Unit / Delta -1 / Delta -2; contributing user names appear in the panel header alongside Round # and Date; row order follows Rounds Setup config order (using SQLite window-function `MIN(id) OVER (PARTITION BY section_id, item_id)`). **Sync column:** "OD Status" renamed to "Sync"; badge values: `complete` → "Synced", `failed` → "Failed", `pending` → "Pending"; rows with no `round_number` show "—" instead of a badge. **Add Oil zero = null:** `add_oil` items with a summed value of `0` or `0.00` produce `display_value: null` (`—`) in the detail view, delta columns, and Add Oil Summary — only actual volumes > 0 are recorded. **Add Oil excluded from incomplete count:** `add_oil` type items are never counted as "not yet checked" in the PWA submit-incomplete warning. **Weekly cleanup:** after a successful aggregate write, the Console deletes individual user OneDrive submission files older than 7 days (runs at most once per 24 hours per ingest session). New IPC handler `rounds:getSyncedSourceFiles`. New Graph helper `graphDelete` / `deleteRoundsUserFile`. **PWA keypad layout** updated: row 1 = ← − ▲; row 2 = 7 8 9 ▼; row 3 = 4 5 6 SEC'D; row 4 = 1 2 3 (enter, spans rows 4–5); row 5 = 0 dcml (enter continues). **First-keystroke-replaces:** navigating to a field (click or arrow key) sets a `freshCursor` flag; the next keypad digit/decimal replaces the existing value rather than appending. **Submit flow change (PWA):** incomplete rounds show an OK / Cancel modal — crew can submit a partial round; submission is no longer blocked.

v2.13 — Trip Analytics module expanded. Map upgraded to a full nautical-chart presentation: Leaflet panes give bathymetry / land / coastline / reefs / graticules / OpenSeaMap tile overlay deterministic z-order independent of async fetch order; antimeridian wrapping via `worldCopyJump` plus 3-world vector rendering and longitude-unwrapping for tracks; permanent map labels for vessel (from `vesselconfig.json → info.vessel_name`), departure port, and destination port; departure / destination markers now render in the topmost `ta-vessel` pane so they sit above land. CSP updated to allow `https://tiles.openseamap.org` and `https://*.tile.openstreetmap.org`. New high-resolution natural-earth assets bundled (`ne_10m_land`, `ne_10m_coastline`, `ne_10m_minor_islands`, `ne_10m_reefs`, `ne_10m_graticules_5`, `ne_10m_ports`, full `ne_10m_bathymetry_*` set). `tripanalyticsconfig.json` schema_version bumped to 2 (§40): `map.show_bathymetry` (boolean toggle for performance), `map.ocean_color`, `active_trip.fuel_onboard_trip_start_usg`, `active_trip.trip_start_at`. Three additional default Alaska ports auto-injected if missing: Adak (ADK), Kodiak (KOD), Togiak (TOG); Dutch Harbor / Seattle renamed with state suffix. Trip Metadata lat/lon now editable in degrees + decimal-minutes with N/S/E/W select; admin-only **Save Position (today)** button calls `db:upsertDailyPosition`. Offload Estimator gains **Fuel Onboard Trip Start (USG)**, **Fuel Onboard Now (USG)**, and **Daily Avg. Consumption (USG/day)** rows above Est. Fuel Upon Arrival; the trip-start fuel snapshot and timestamp are captured automatically when **Open New Trip** confirms, and both are admin-editable to correct mistakes. Daily burn calculation now prefers the trip-start derivation (`(start − now) / hours × 24`) and falls back to the fuel-log average when not available. **Generate Bunker Pre-Load** button now produces a real plan: builds rows by walking fuel tanks in `localeCompare(numeric)` order, filling each from current level to `capacity × max_fill_pct/100` until `desiredFuel − (currentOnboard − dailyBurn × steamDays)` is satisfied; sets `date = ETA + 1 day`; preserves PIC names / delivery rates from any existing `bunkerplan.json`; writes via `saveBunkerPlan()` then navigates. Lube Oil block removed from Tab 1 (diesel-only). Numeric inputs in Tab 1 now commit on blur or Enter (no per-keystroke re-renders); a `rerender()` helper preserves scroll position and focus on the editing field. Stale-map detection on tab re-entry rebuilds the map when its container has been re-rendered; `invalidateSize()` deferred one frame to handle 0×0 measurement during tab transitions. Bug fix: tripanalytics.js was reading `fuelstate.json` tank entries as `volume_usg` instead of `volume`, leaving Est. Fuel Upon Arrival blank.

v2.12 — Trip Planner dissolved and replaced by Trip Analytics module (§27 rewritten). New `tripanalyticsconfig.json` introduced (§40). Factory Production Setup tab gains `processing_start_time` field (§37.5.1, §37.13). Rotation Planner tab moved from Trip Planner to Schedule module as Tab 4 (§28). `tripplanner.js` retired; replaced by `tripanalytics.js`.

v2.11 — Rounds entry module built on the Field PWA (`roundsentry.js`). Per-user round log file format defined (§22): `roundslog-{username}-{YYYY-MM-DD}-{HHmm}.json` written to `data/rounds/logs/{username}/`. Rounds aggregate file format defined (§23): `rounds-{YYYY-MM-DD}-{HHmm}.json` written to `data/rounds/{year}/`. OneDrive path conventions and round number inference rule documented (§24). `userprefs-{username}.json` introduced at `config/userprefs-{username}.json` (§21) — stores per-user PWA preferences (`keypad_side`, `colour_mode`). `roundsconfig.json` item schema updated: new item types `add_oil` and `heading`; new item fields `active_days` (day-of-week filter, 1=Monday), `add_oil_tank_id` (tank source for oil additions). Console rounds ingestion rebuilt: `rounds:ingestLog` IPC handler ingests per-user log files from per-user subdirectories; `rounds:buildAggregate` computes §23 aggregates; `rounds:markAggregateWritten` / `rounds:markAggregateFailed` track OneDrive write status. Three new SQLite tables: `rounds_entries` (§22-compatible schema, no UNIQUE constraint — multi-user support), `rounds_aggregates` (with `onedrive_write_status` column: `pending` / `complete` / `failed`), `rounds_config_snapshots` (updated). Old `rounds_entries` schema migrated to `rounds_entries_legacy` on upgrade. Console rounds viewer added: `roundsviewer.js` with three panels — Overview (per-day/round summary), Round Detail (per-item per-user values), Add Oil Summary (fuel-module feed for Phase 5). New IPC handlers: `rounds:getOverview`, `rounds:getRoundDetail`, `rounds:getAddOilSummary`, `rounds:getDistinctDates`, `rounds:saveConfigSnapshot`. New Graph helpers: `listRoundsUserDirs`, `listRoundsLogFilesForUser`, `loadRoundsUserLogFile`, `writeRoundsAggregate`. Ingest poller updated: old flat-folder rounds block replaced with `pollRoundsLogs()` + `buildAndWriteAggregate()` + `retryPendingAggregates()`.

v2.10 — Daily Production Report (DPR) ingestion redesigned (§37.11). Microsoft Graph Mail API replaced with OneDrive folder polling driven by a Power Automate flow. The flow watches the user's inbox for "Daily Production Report" emails and saves their PDF attachments to `OneDrive/Daily Production Reports/{YYYY}/` (note: this folder is *outside* `Documents/IDMS/`). IDMS lists that folder, sorts by `lastModifiedDateTime`, downloads the most recent file, parses it with a pure-Node.js text extractor (no `pdfjs-dist` / `pdf-parse` dependency — broken in Electron's main process), and renames it to `DPR-{YYYY-MM-DD}.pdf` using the file's modification date (since midnight reports are dated the previous day inside the PDF). Three new `graph.js` helpers: `graphGetBinaryById`, `graphRenameItem`, plus `id` added to `graphListFolder` `$select`. New main-process IPC handler `pdf:parse` exposed as `window.idms.pdf.parse(buffer)`. The `production-state.json` `source` field changes from `"email"` to `"dpr"`. `email_subject_filter` and `email_source_address` fields in `factoryconfig.json → production` are deprecated (no longer used). MSAL `Mail.Read*` scopes no longer required — `User.Read` and `Files.ReadWrite` suffice. The renderer's DPR fetch now extracts richer per-species production data (trip number, trip day, daily/trip totals in MT and cases, full per-species grade breakdown). Overview "Refresh DPR" panel shows "Today's report not available" when the most recent file's modification date is not today. Bug fix: `ingest.js` `pollNow()` referenced undefined `loadTaskRecordFile` — corrected to `loadTaskEquipmentFile`.

v2.9 — OEE Report (§39) refined. Per-asset rate maps in `assembleOeeReportData` extended with an upstream-bottleneck cap (`equipmentAdjustedRateMap`): each sub-asset's MT/day is capped at the minimum rate of any same-section sub-asset with a lower `order` value, so a fast downstream item only loses what its slowest upstream feeder could have produced. Both incidents and OEE observations carry `adjusted_rate_mt_per_day` alongside `asset_rate_mt_per_day` in `chart_data`. The on-screen and PDF "Observations in Window" tables gain an **Adjusted Δ** column (suppressed to "—" when the cap doesn't change the value, in which case the Delta cell renders muted grey to keep the eye on Adjusted). Available Max calculation made series-aware: line-wide MT lost is no longer the additive sum of per-section losses (which double-counted across sections in series); instead the chart's available-max step function takes the per-section minimum of `(theoreticalRate − lostRate)` at each time slice, and the headline `available_max_mt` is integrated from that step function. Both incident and observation losses contribute per-section. `chart_data` gains `demonstrated_max_mt_per_hour`; both the canvas chart and the PDF SVG chart gain a dashed amber **Demonstrated Max** reference line and matching legend entry.

v2.8 — OEE (Overall Equipment Effectiveness) module added (§39). Per-user factory log file gains `observations` array (schema_version 2). `capacity-{YYYY-MM-DD}.json` retired as a write target (legacy read retained). `capacity_observations` SQLite table gains `failure_mode_id`, `oee_session_id`, `source_user` columns. New IPC handlers: `db:ingestObservationsFromLog`, `db:saveObservationsToLog`, `db:getOeeSessions`, `db:generateRosReportPdf`. Factory Production gains OEE tab (§39) and report generator. PWA gains observation push for factory users. Overview tab gains PWA observation overlay.

v2.7 — FMEA module added (§38). `fmeaconfig.json` introduced at `config/fmeaconfig.json`. Resolved incident object (§11) gains optional `failure_mode_id` and `failure_mode_other_notes` fields (Factory department only on the PWA). Three new SQLite tables: `fmea_failure_modes`, `fmea_occurrence_events`, `fmea_config_snapshots`. Seven new IPC handlers: `db:ingestFmeaConfig`, `db:saveFmeaConfigSnapshot`, `db:getFmeaFailureModes`, `db:getFmeaOccurrence`, `db:ingestFmeaOccurrenceEvents`, `db:getFmeaRpnSummary`, `db:upsertFmeaFailureMode`. graph.js helpers `loadFmeaConfig` / `saveFmeaConfig`. New `pollFmeaOccurrenceEvents()` pass in ingest.js (factory incidents + completed maintenance records). Factory Production gains a dedicated **FMEA tab** with a failure-mode registry, RPN display, occurrence-confidence indicators, and an add/edit modal whose Asset dropdown is filtered to the selected section's sub-assets. Sub-asset objects (§37) gain an `iso14224_equipment_class` field, settable in Setup and auto-populated into the FMEA modal on asset selection. Throughput-section MT/day calculation revised to bottleneck across series stages and sum within parallel stages (grouped by sub-asset `order`) instead of summing all sub-assets.

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
21. [userprefs-{username}.json](#21-userprefs-usernamejson)
22. [Rounds Entry Log File (per-user, per-round)](#22-rounds-entry-log-file-per-user-per-round)
23. [Rounds Aggregate File](#23-rounds-aggregate-file)
24. [Rounds OneDrive Paths & Round Number Inference](#24-rounds-onedrive-paths--round-number-inference)
25. [fuelstate.json](#25-fuelstatejson)
26. [Stability Calculations](#26-stability-calculations)
27. [Trip Analytics](#27-trip-analytics)
23. [Trip Planner (Retired)](#23-trip-planner)
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
38. [FMEA Module](#38-fmea-module)
39. [OEE Module](#39-oee-module)
40. [tripanalyticsconfig.json](#40-tripanalyticsconfigjson)
41. [Notes Hub](#41--notes-hub)
42. [Procurement & Inventory](#42--procurement--inventory)

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
│   ├── fmeaconfig.json             ← Factory production FMEA failure mode registry
│   ├── tripanalyticsconfig.json    ← Trip Analytics module config (ports, map colours, offload estimator, active trip)
│   ├── notesconfig.json            ← Notes Hub: department heads, department folders, checklist templates (§41)
│   ├── procurementconfig.json      ← Procurement: storerooms/bins, categories, units, suppliers, settings (§42)
│   ├── userprefs-{username}.json   ← Per-user PWA preferences (keypad side, colour mode) — one file per user
│   └── shells/
│       ├── factoryshell.json       ← Factory module behaviour
│       ├── engineshell.json        ← Engine Room module behaviour
│       └── deckshell.json          ← Deck module behaviour
│
├── data/
│   ├── factory/
│   │   ├── logs/                   ← report-{date}-{username}.json
│   │   ├── reports/                ← report-factory-{YYYY-MM-DD}.json
│   │   └── production/
│   │       ├── production-state.json
│   │       └── capacity-{YYYY-MM-DD}.json  ← LEGACY — read-only. Superseded by observations[] in per-user log files.
│   ├── engine/
│   │   ├── logs/
│   │   └── reports/
│   ├── deck/
│   │   ├── logs/
│   │   └── reports/
│   ├── rounds/
│   │   ├── logs/
│   │   │   └── {username}/
│   │   │       └── {YYYY}/         ← roundslog-{username}-{YYYY-MM-DD}-{HHmm}.json  (per-user entry logs, written by PWA)
│   │   ├── {YYYY}/                 ← rounds-{YYYY-MM-DD}-{HHmm}.json  (aggregates, written by console)
│   │   └── reports/                ← rounds-report-{YYYY-MM-DD}.json (future)
│   ├── roughlog/
│   │   └── roughlog-{YYYY}.json    ← Vessel-wide rough log, one file per calendar year
│   ├── tasks/
│   │   ├── definitions/            ← tasks-{codeRange}-{year}.json (task definition files per equip range per year)
│   │   ├── records/
│   │   │   └── {YYYY}/             ← {equipmentCodeTop}-{YYYY}.json (completed task records per equipment top per year)
│   │   └── active/                 ← {username}.json (per-user active task state)
│   ├── schedule/
│   │   └── notifications/          ← schedule-notification-{YYYY-MM-DD}.json (audit log mirrors)
│   ├── notes/
│   │   ├── events/
│   │   │   └── {YYYY}/             ← {iso}-{event_id}.json — Notes Hub append-only event stream (§41)
│   │   └── aggregates/
│   │       └── {YYYY}/             ← notes-aggregate-{YYYY}.json (Console-derived cold-start cache, ETag-republished)
│   ├── personnel/
│   │   ├── ksa-registry.json       ← every signable card the Vault holds, Console-published mirror (§43.3)
│   │   ├── ksa-demand.json         ← every SOP/TASK card's asset, department and requires_ksa — the demand table (§43.3)
│   │   ├── ksa-config.json         ← tracked-KSA list + per-department `plan` block (§43.4)
│   │   ├── currency/               ← {crew_id}.json — per-member competency currency snapshot, Console-published (§43.3)
│   │   ├── exposure/
│   │   │   └── {YYYY}/             ← {iso}-{event_id}.json — card read markers, append-only (§43.7; specified, not built)
│   │   └── records/                ← {stamp}-{type}-{id8}.json — append-only supervisory journal (IDMS-Console docs/personnel-development.md)
│   └── procurement/
│       ├── events/
│       │   └── {YYYY}/             ← {iso}-{event_id}.json — Procurement append-only event stream (§42)
│       ├── catalogue.json      ← TM Master item master + stowage tree, projected (§42.14). Generated.
│       ├── catalogue-detail.json ← specification / remarks / maker detail, fetched lazily (§42.14)
│       └── aggregates/
│           └── {YYYY}/             ← procurement-aggregate-{YYYY}.json (Console-derived cold-start cache, future)
│
└── console.lock                    ← Active console heartbeat file
```

**External OneDrive folders** (outside `Documents/IDMS/`, read by IDMS but written by other tools):

```
OneDrive root/
└── Daily Production Reports/
    └── {YYYY}/                     ← DPR PDFs dropped here by a Power Automate flow.
                                       Filenames standardized to `DPR-{YYYY-MM-DD}.pdf`
                                       on first read by IDMS. See §37.11.
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
      "roughlog":        "data/roughlog/",
      "tasks_definitions":   "data/tasks/definitions/",
      "tasks_records":       "data/tasks/records/",
      "tasks_active":        "data/tasks/active/",
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
    { "version": 8, "date": "2026-04-28", "note": "Added tasks_definitions, tasks_records, tasks_active to connections.data (Tasks & Maintenance module)." }
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
**Read by:** Console — ingested into the SQLite `assets` table on manual refresh from the Equipment Setup screen. Also read directly by the Notes page (§41.6d) for the equipment picker and the code→name lookup, cached per browser; that read was added in v2.31.6 and is the only place the field PWA touches this file. Read-only from both.

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

> **schema_version 2** (factory only) adds the `observations` array. schema_version 1 files (no `observations` field) remain valid — the console treats missing `observations` as an empty array. Engine Room and Deck log files remain at schema_version 1.

```json
{
  "schema_version": 2,
  "vessel": "F/V Araho",
  "department": "Factory",
  "user": "tploch",
  "user_id": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "displayName": "Tyler Ploch",
  "role": "Chief Engineer",
  "date": "2026-04-30",
  "generated": "2026-04-30T14:32:00.000Z",
  "active": [],
  "resolved": [
    {
      "id": 1713620000000,
      "equipment": "Plate Freezer #1",
      "category": "Mechanical fault",
      "startTime": "2026-04-30T09:15:00.000Z",
      "endTime":   "2026-04-30T09:44:00.000Z",
      "duration":  1740,
      "durationLabel": "29m 00s",
      "notes": "Hydraulic pressure low. Topped up fluid, pressure restored.",
      "user": "tploch",
      "displayName": "Tyler Ploch",
      "failure_mode_id": "uuid-of-fmea-mode",
      "failure_mode_other_notes": ""
    }
  ],
  "observations": [
    {
      "obs_id":          "uuid-v4",
      "obs_timestamp":   "2026-04-30T09:42:00.000Z",
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
| `failure_mode_id`         | string \| null | Optional. UUID of selected FMEA mode. `"other"` if "Other / unsure" selected. Absent in schema_version 1 files — treat as null. Factory only. |
| `failure_mode_other_notes`| string         | Notes entered when `failure_mode_id === "other"`. Empty string otherwise. Absent in schema_version 1 files — treat as empty string. Factory only. |

### Observation object fields

| Field | Type | Notes |
|-------|------|-------|
| `obs_id` | string (UUID v4) | Upsert key on ingest. |
| `obs_timestamp` | string | ISO 8601 UTC. When the observation was made. |
| `section_id` | string | References `section_id` in `factoryconfig.production.line_sections`. |
| `section_label` | string | Denormalised for display. |
| `asset_code` | string \| null | Optional. Asset register code if scoped to a specific asset. |
| `observed_rate` | number \| null | Null for qualitative-only observations. |
| `rate_unit` | string \| null | `"mt/day"` \| `"pans/min"` \| `"cases/hr"`. Null if no rate. |
| `failure_mode_id` | string \| null | Optional link to FMEA failure mode. |
| `notes` | string | Free text. |
| `source` | string | `"pwa"` \| `"manual"` \| `"oee"` |
| `oee_session_id` | string \| null | UUID grouping all observations from one OEE submission. Null for non-OEE. |
| `wind_speed_kt` | number \| null | Optional. |
| `sea_state_ft` | number \| null | Optional. |

> **Factory only.** The `observations` array is present only in factory department log files.

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
    { key: 'operations/trip_analytics', label: 'Trip Analytics',
      note: 'Admin permission additionally required to open trips, enter positions, and generate bunker pre-loads.' },
    { key: 'operations/schedule',       label: 'Schedule',
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
| `operations/trip_analytics` | Operations | Trip Analytics | Grants view access to all Trip Analytics tabs. Admin permission is additionally required to open trips, enter positions, and generate bunker pre-loads. |
| `operations/schedule` | Operations | Schedule | Grants view access to all Schedule tabs. Admin permission is additionally required to promote draft to approved, confirm crew assignments, and edit rotation groups. |

**Migration note (v2.12):** Existing users with `operations/trip_planner` in their `resources` array are automatically migrated to `operations/trip_analytics` at console startup by `migrateUserConfig()` in `users.js`. No manual config update required.
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
```

`user_id` columns in `log_files` and `events` were added via `ALTER TABLE` migration in Phase 4 and are nullable to support pre-UUID log files. The `assets` and `equipment_assignments` tables were added in Phase 5 via `CREATE TABLE IF NOT EXISTS` on startup. The `rounds_config_snapshots` and `rounds_entries` tables were added in Phase 5 (continued) via `CREATE TABLE IF NOT EXISTS` on startup. The `schedule_notifications` and `schedule_drift_log` tables were added in Phase 7 (Schedule module) via `CREATE TABLE IF NOT EXISTS` on startup. The `rough_log` table was added in v2.2 (Rough Log module) via `CREATE TABLE IF NOT EXISTS` on startup. The `tasks`, `task_records`, `task_active_state`, and `task_skill_tags` tables were added in v2.3 (Tasks & Maintenance module) via `CREATE TABLE IF NOT EXISTS` on startup. No SQLite schema changes in v2.4 — `tank_layout` is stored entirely within `vesselconfig.json` on OneDrive.

**`assets` column notes:**

| Column | Notes |
|---|---|
| `code` | Primary key. The `Code` field from `assets.csv`. |
| `name` | Human-readable asset name. |
| `department` | Computed at ingest. One of: a dept key (`engine`, `factory`, `deck`), a comma-separated list for multi-matches, `ignore`, or `NULL` (unassigned). |
| `ingested_at` | ISO 8601 UTC timestamp of last ingest. |

**`rounds_entries` column notes (v2.11 schema — §22-compatible):**

| Column | Notes |
|---|---|
| `source_file` | Full OneDrive path of the ingested log file. Used for deduplication — if any rows exist for a given `source_file`, the file is skipped on subsequent polls. |
| `vessel` | Vessel name from the log file top-level. |
| `username` | IDMS username of the submitting user. |
| `display_name` | Display name snapshot at submission time. |
| `round_number` | Inferred round number. |
| `scheduled_time` | Nominal `"HH:MM"` round time. |
| `submitted` | ISO 8601 UTC. Submission timestamp from the log file. Used for recency sorting in aggregate display-value computation. |
| `date` | `YYYY-MM-DD`. From the entry object. |
| `section_id` / `section_label` | Section UUID and label snapshot. |
| `item_id` / `item_label` | Item UUID and label snapshot. |
| `item_type` | Item type string. |
| `unit` | Unit string or `NULL`. |
| `asset_code` | Asset code or `NULL`. |
| `add_oil_tank_id` | Tank source UUID for `add_oil` items; `NULL` for all other types. |
| `value` | All values stored as `TEXT`. `NULL` when `secd = 1`. |
| `secd` | `1` if the item was SEC'd; `0` otherwise. |
| `ingested_at` | ISO 8601 UTC timestamp of ingest. |

**`rounds_entries` migration note:** If a `rounds_entries` table exists from a pre-v2.11 schema (identifiable by the absence of a `source_file` column), the console renames it to `rounds_entries_legacy` on startup and creates the new table. The legacy table is retained for reference; the old `db:ingestRoundsLog` handler continues to work against it.

**`rounds_aggregates` column notes:**

| Column | Notes |
|---|---|
| `date` / `round_number` | Composite unique key. `UNIQUE(date, round_number)`. |
| `scheduled_time` | Nominal `"HH:MM"`. Populated from `rounds_entries` at upsert time. |
| `onedrive_path` | Full OneDrive path of the written aggregate file. |
| `generated_at` | ISO 8601 UTC. Timestamp of the last aggregation run. |
| `contributing_users` | Comma-separated username list. `GROUP_CONCAT(DISTINCT username)` at upsert time. |
| `onedrive_write_status` | `"pending"` (not yet written), `"complete"` (successfully written), `"failed"` (last attempt failed — retry on next poll cycle). |

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
| `schedule.js`       | Personnel → Schedule (4 tabs: Schedule, Setup, Trip Reference, Rotation Planner) | Built       |
| `training.js`       | Personnel → Training & Certs                                              | Not Built   |
| `crewprofiles.js`   | Personnel → Crew Profiles                                                 | Not Built   |
| `messages.js`       | Personnel → Messages                                                      | Not Built   |
| `tripanalytics.js`  | Overview → Trip Analytics (3 tabs: Current Trip Calculations, Trip History, Analytics Setup) | Built       |
| `tripplanner.js`    | **RETIRED (v2.12)** — screen retained as empty stub; `data-retired="true"` | Retired     |
| `eventlogs.js`      | Records → Event Logs                                                      | Built       |
| `reports.js`        | Records → Reports                                                         | Built       |
| `vessel.js`         | Config → Vessel Setup (5 tabs: Particulars, Tanks, Machinery, Stability, Tank Layout) | Partial     |
| `tank.js`           | Embedded in Vessel Setup → Stability tab                                  | Built       |
| `stability.js`      | Embedded in Vessel Setup → Stability Calculations tab (to be moved)       | Partial     |
| `equipment.js`      | Config → Equipment Setup (2 tabs: Department Assignment, Group Assignment) | Built       |
| `rounds.js`         | Config → Rounds Setup                                                     | Built       |
| `roundsviewer.js`   | Operations → Rounds Log (Overview, Round Detail, Add Oil Summary panels)  | Built       |
| `users.js`          | Config → Users                                                            | Built       |
| `crewsetup.js`      | Config → Crew Setup                                                       | Built       |
| `crew.js`           | Embedded in Crew Setup → Crew List tab                                    | Built       |
| `trainingmatrix.js` | Embedded in Crew Setup → Requirements Matrix tab                          | Built       |
| `settings.js`       | Config → Settings                                                         | Built       |
| `overview.js`       | Retired — absorbed into `dashboard.js` Zone 7                             | Retired     |

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
| `active_rounds`    | integer[]         | no       | Array of round numbers (1-indexed) for which this item is active. Defaults to all rounds when not present. Omitted for `"heading"` type items. When `rounds_per_day` changes, the console adds new rounds as active and prunes removed rounds from all items. |
| `active_days`      | integer[]         | no       | Array of days-of-week (1=Monday … 7=Sunday) on which this item is shown. Defaults to all days when not present or `null`. Omitted for `"heading"` type items. The field PWA filters items on module load. |
| `custom_options`   | string[]          | no       | Required when `type` is `"custom"`. Ordered list of selectable options presented as a dropdown at data entry time. E.g. `["Normal", "Standby", "Fault", "Shutdown"]`. Must be `null` or omitted for all other types. |
| `add_oil_tank_id`  | string            | no       | Required when `type` is `"add_oil"`. UUID matching a lube oil or waste oil tank in `tankconfig.json` — identifies the tank being drawn from when oil is added. Must be `null` or omitted for all other types. |
| `notes`            | string            | yes      | Free text. Internal operator note visible during config editing. Does not appear on the printed sheet. May be empty string. |

---

### Item type reference

| Type       | Data cell content                       | Has `unit` | Has `custom_options` | Has `add_oil_tank_id` | Has `active_rounds` | Appears in log data |
|------------|-----------------------------------------|------------|----------------------|-----------------------|---------------------|---------------------|
| `numeric`  | Number input                            | Yes        | No                   | No                    | Yes                 | Yes — string value or `null` if not recorded  |
| `text`     | Free-text input (unvalidated)           | No         | No                   | No                    | Yes                 | Yes — string value or `null` if not recorded  |
| `custom`   | Dropdown from `custom_options` list     | No         | Yes                  | No                    | Yes                 | Yes — string value or `null` if not recorded  |
| `checkbox` | Checked / unchecked                     | No         | No                   | No                    | Yes                 | Yes — string value or `null` if not recorded  |
| `add_oil`  | Numeric volume entry (oil addition)     | Yes        | No                   | Yes                   | Yes                 | Yes — string (numeric as string) or `null`; SEC'd entries are `null` |
| `heading`  | Display separator only                  | No         | No                   | No                    | No                  | No — omitted from log entirely                |

`heading` items have no data column and no `active_rounds` field. They are purely a visual element on the generated sheet. Their `unit`, `asset_code`, `custom_options`, and `add_oil_tank_id` fields must be `null`. In the field PWA, the SEC'D button groups items under the nearest heading above the active row.

`text` items accept any free-form string with no validation. `custom` items constrain entry to the values listed in `custom_options` — the field PWA presents these as a dropdown. Both types store their log value as a string in the `value` column of `rounds_entries`.

`add_oil` items represent a lubricating oil addition event. The value is the volume added (stored as a string to preserve precision). On aggregation the console **sums** all non-null, non-SEC'd values across contributing users. The `add_oil_tank_id` field identifies the tank being drawn from and is propagated into `rounds_entries.add_oil_tank_id` at ingest, ready for consumption by the Phase 5 fuel/transfer module.

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
  - `type` — dropdown: `numeric`, `text`, `custom`, `checkbox`, `add_oil`, `heading`
  - `unit` — dropdown (valid unit values above); visible only when type is `numeric` or `add_oil`
  - `custom_options` — comma-separated text input; visible only when type is `custom`. Values are split on commas, trimmed, and stored as a string array. These become the selectable options in the field PWA dropdown at data entry time. Cleared automatically when type changes away from `custom`.
  - `add_oil_tank_id` — dropdown of lube/waste oil tanks from `tankconfig.json`; visible only when type is `add_oil`. Cleared automatically when type changes away from `add_oil`.
  - `asset_code` — text input; hidden for `heading` type. Validated on blur against the SQLite `assets` table. Displays the asset name on match; shows a warning on no-match (does not block save).
  - `active_rounds` — one checkbox per round (labelled by round number). All checked by default. Hidden for `heading` type. Allows per-item scheduling — e.g. an item that only applies to daytime rounds.
  - `active_days` — seven checkboxes labelled Mon–Sun. All checked by default. Hidden for `heading` type. Allows per-item day-of-week filtering — e.g. an item that only applies on weekdays.
  - Delete button — removes the item. No confirmation required.
- Items can be reordered within a section using up/down buttons (updates `order` values).
- Items **cannot** be moved between sections. Move via delete and re-add.

**Save behaviour**

- Saving writes `roundsconfig.json` to OneDrive via Graph API.
- A **[Refresh from OneDrive]** button re-fetches the live file and discards unsaved local changes (requires confirmation if there are unsaved changes).
- Unsaved changes are indicated by a status message in the toolbar.

---

## 21. userprefs-{username}.json

**Location:** `Documents/IDMS/config/userprefs-{username}.json`  
**Written by:** Field PWA (rounds entry module) — on preference change  
**Read by:** Field PWA (rounds entry module) — on load  

Per-user preference file for the rounds entry module. One file per IDMS user. Created automatically by `roundsentry.js` on first preference change; absent files are treated as defaults.

### Full example

```json
{
  "schema_version": 1,
  "username": "tploch",
  "keypad_side": "right",
  "colour_mode": "dark"
}
```

### Fields

| Field            | Type    | Default   | Notes                                                                                   |
|------------------|---------|-----------|-----------------------------------------------------------------------------------------|
| `schema_version` | integer | `1`       | Always `1`.                                                                             |
| `username`       | string  | —         | IDMS username. Must match the logged-in user. Written at save time.                     |
| `keypad_side`    | string  | `"right"` | `"left"` or `"right"`. Controls which side the keypad docks on tablet layout.          |
| `colour_mode`    | string  | `"dark"`  | `"dark"` or `"light"`. Scoped to the rounds entry screen only; does not affect other PWA screens. |

---

## 22. Rounds Entry Log File (per-user, per-round)

**Location:** `Documents/IDMS/data/rounds/logs/{username}/{YYYY}/roundslog-{username}-{YYYY-MM-DD}-{HHmm}.json`  
**Written by:** Field PWA (`roundsentry.js`) on submit  
**Read by:** Console (`rounds:ingestLog` IPC handler via `pollRoundsLogs()`)

One file per user per round submission. `{HHmm}` is the UTC wall-clock time at the moment of submission (not the scheduled round time). `{YYYY}` is the four-digit year of the submission date. A user who submits the same round twice produces two files with different `{HHmm}` values; the console deduplicates by `source_file` — the second file is skipped if the first is already ingested. Files older than 7 days whose rounds have been successfully aggregated are automatically deleted by the Console cleanup pass.

### Full example

```json
{
  "schema_version": 2,
  "vessel": "F/V Araho",
  "username": "tploch",
  "display_name": "Tyler Ploch",
  "submitted": "2026-05-04T06:14:22.000Z",

  "entries": [
    {
      "round_number":   1,
      "scheduled_time": "06:00",
      "date":           "2026-05-04",
      "section_id":     "a1b2c3d4-0001-4000-8000-000000000001",
      "section_label":  "MAIN ENGINE",
      "item_id":        "b2c3d4e5-0001-4000-8000-000000000001",
      "item_label":     "COOLANT PRESS IN",
      "item_type":      "numeric",
      "unit":           "PSI",
      "asset_code":     "601.001.001.001",
      "add_oil_tank_id": null,
      "value":          "48.5",
      "secd":           false
    },
    {
      "round_number":   1,
      "scheduled_time": "06:00",
      "date":           "2026-05-04",
      "section_id":     "a1b2c3d4-0001-4000-8000-000000000001",
      "section_label":  "MAIN ENGINE",
      "item_id":        "b2c3d4e5-0007-4000-8000-000000000001",
      "item_label":     "CRANK CASE OIL",
      "item_type":      "add_oil",
      "unit":           "L",
      "asset_code":     "601.001.001.001",
      "add_oil_tank_id": "a1b2c3d4-tank-lube-sump-001",
      "value":          "2.50",
      "secd":           false
    },
    {
      "round_number":   1,
      "scheduled_time": "06:00",
      "date":           "2026-05-04",
      "section_id":     "a1b2c3d4-0002-4000-8000-000000000001",
      "section_label":  "REFER SYSTEM",
      "item_id":        "b2c3d4e5-0010-4000-8000-000000000001",
      "item_label":     "CONDENSER PRESS",
      "item_type":      "numeric",
      "unit":           "PSI",
      "asset_code":     "602.001.001.001",
      "add_oil_tank_id": null,
      "value":          null,
      "secd":           true
    }
  ]
}
```

### Top-level fields

| Field            | Type     | Notes                                                                                 |
|------------------|----------|---------------------------------------------------------------------------------------|
| `schema_version` | integer  | Always `2` for this format. Version `1` was the legacy per-date format (retired).    |
| `vessel`         | string   | Vessel name. Copied from `roundsconfig.json → vessel` at submission time.            |
| `username`       | string   | IDMS username of the submitting user.                                                 |
| `display_name`   | string   | Full display name. Copied from the user's session object at submission time.         |
| `submitted`      | string   | ISO 8601 UTC. Exact moment of submission. Used for deduplication and recency sorting. |
| `round_number`   | integer \| null | **Canonical round number for this submission.** Inferred by `reInferRound` at submit time; see §24. The Console reads this field at the payload level, not from individual entries. |
| `scheduled_time` | string \| null | **Canonical scheduled time** (`"HH:MM"`) corresponding to `round_number`. Set at the payload level; echoed into entries for backward compatibility. |
| `entries`        | object[] | Flat array of all items the user interacted with — one entry per non-heading item.   |

### entry object fields

| Field            | Type          | Notes                                                                                                       |
|------------------|---------------|-------------------------------------------------------------------------------------------------------------|
| `round_number`   | integer \| null | Echo of the payload-level `round_number`. Present for backward compatibility; Console ingest now reads from payload level. |
| `scheduled_time` | string \| null | Echo of the payload-level `scheduled_time`. Present for backward compatibility.                            |
| `date`           | string         | `YYYY-MM-DD`. Vessel-local calendar date the entry relates to.                                             |
| `section_id`     | string         | UUID from `roundsconfig.json`.                                                                              |
| `section_label`  | string         | Section label at time of submission. Snapshot — preserved if config later changes.                         |
| `item_id`        | string         | UUID from `roundsconfig.json`.                                                                              |
| `item_label`     | string         | Item label at time of submission. Snapshot.                                                                 |
| `item_type`      | string         | One of `"numeric"`, `"text"`, `"custom"`, `"checkbox"`, `"add_oil"`.                                      |
| `unit`           | string \| null | Unit from config. `null` for items with no unit.                                                            |
| `asset_code`     | string \| null | From config. `null` if not applicable.                                                                      |
| `add_oil_tank_id`| string \| null | From config. Non-null only for `add_oil` type items.                                                        |
| `value`          | string \| null | All values are stored as strings for uniformity. `null` when `secd` is `true`. For `add_oil` items, a numeric string (e.g. `"2.50"`). For `checkbox`, `"true"` or `"false"`. |
| `secd`           | boolean        | `true` if the item was marked secured (SEC'D) rather than individually entered. When `true`, `value` is `null`. |

**Key design rules:**
- All non-heading items that were visible to the user appear in `entries`, including SEC'd items (`secd: true, value: null`). Items filtered out by `active_rounds` or `active_days` are never included.
- `value` is always a string or `null`. The console casts to the appropriate type on ingest.
- `text` items with no input are stored as `value: ""` (empty string), not `null` — they count as complete.
- SEC'd items are excluded from aggregate display values but are stored in SQLite for audit purposes.

---

## 23. Rounds Aggregate File

**Location:** `Documents/IDMS/data/rounds/{year}/rounds-{YYYY-MM-DD}-{HHmm}.json`  
**Written by:** Console (`buildAndWriteAggregate()` in `ingest.js`, via `writeRoundsAggregate()` Graph helper)  
**Read by:** Field PWA (`roundsentry.js`) — the two most recent files per year are fetched to populate history columns  

One file per calendar date per round. `{HHmm}` is the scheduled round time (e.g. `0600` for a 06:00 round), not the actual submission time. The file is overwritten on each aggregation run — it always reflects the latest state of all ingested user logs for that round.

### Full example

```json
{
  "schema_version": 2,
  "date": "2026-05-04",
  "round_number": 2,
  "scheduled_time": "06:00",
  "generated_at": "2026-05-04T06:28:44.000Z",

  "contributing_users": [
    { "username": "tploch",   "display_name": "Tyler Ploch" },
    { "username": "spotchik", "display_name": "Steve Potchik" }
  ],

  "items": {
    "b2c3d4e5-0001-4000-8000-000000000001": {
      "item_label":     "COOLANT PRESS IN",
      "item_type":      "numeric",
      "section_id":     "a1b2c3d4-0001-4000-8000-000000000001",
      "section_label":  "MAIN ENGINE",
      "unit":           "PSI",
      "asset_code":     "601.001.001.001",
      "add_oil_tank_id": null,
      "values": {
        "tploch":   "48.5",
        "spotchik": "47.0"
      },
      "display_value": "48.5"
    },
    "b2c3d4e5-0007-4000-8000-000000000001": {
      "item_label":     "CRANK CASE OIL",
      "item_type":      "add_oil",
      "section_id":     "a1b2c3d4-0001-4000-8000-000000000001",
      "section_label":  "MAIN ENGINE",
      "unit":           "L",
      "asset_code":     "601.001.001.001",
      "add_oil_tank_id": "a1b2c3d4-tank-lube-sump-001",
      "values": {
        "tploch":   "2.50",
        "spotchik": "1.00"
      },
      "display_value": "3.50"
    }
  }
}
```

### Top-level fields

| Field                | Type     | Notes                                                                                       |
|----------------------|----------|---------------------------------------------------------------------------------------------|
| `schema_version`     | integer  | Always `2`.                                                                                  |
| `date`               | string   | `YYYY-MM-DD`.                                                                                |
| `round_number`       | integer  | 1-indexed round number.                                                                      |
| `scheduled_time`     | string   | Nominal `"HH:MM"` from config.                                                               |
| `generated_at`       | string   | ISO 8601 UTC. Timestamp when this file was last written.                                    |
| `contributing_users` | object[] | One entry per user whose non-SEC'd entries contributed to this aggregate.                   |
| `items`              | object   | Keyed by `item_id`. One entry per non-SEC'd, non-heading item from the source log files.    |

### contributing_user object fields

| Field          | Type   | Notes                                         |
|----------------|--------|-----------------------------------------------|
| `username`     | string | IDMS username.                                |
| `display_name` | string | Display name at time of last aggregation run. |

### item aggregate object fields

| Field            | Type          | Notes                                                                                                      |
|------------------|---------------|-------------------------------------------------------------------------------------------------------------|
| `item_label`     | string         | Label snapshot from the most recently ingested log file for this item.                                     |
| `item_type`      | string         | Item type.                                                                                                  |
| `section_id`     | string         | Parent section UUID.                                                                                        |
| `section_label`  | string         | Parent section label snapshot.                                                                              |
| `unit`           | string \| null | Unit, or `null`.                                                                                            |
| `asset_code`     | string \| null | Asset code, or `null`.                                                                                      |
| `add_oil_tank_id`| string \| null | Tank source UUID for `add_oil` items; `null` for all other types.                                          |
| `values`         | object         | Per-user value map: `{ username: value_string }`. Only non-null, non-SEC'd entries are included.           |
| `display_value`  | string \| null | Computed aggregate value. For `add_oil`: sum of all `values` formatted to 2 decimal places. For all other types: the value from the most recently submitted log (highest `submitted` timestamp). `null` if no non-null values. |

**History column display rule (field PWA):** When loading aggregate files for the history columns (columns 2 and 3 of the entry grid), the PWA displays `display_value` for each item. If a history aggregate file shows `secd: true` for an item (legacy format) or if `display_value` is absent from `items`, the history cell shows `—`.

---

## 24. Rounds OneDrive Paths & Round Number Inference

### OneDrive path conventions

| File | Path pattern | `{HHmm}` meaning |
|------|--------------|------------------|
| User entry log | `data/rounds/logs/{username}/{YYYY}/roundslog-{username}-{YYYY-MM-DD}-{HHmm}.json` | UTC wall-clock time at submission |
| Round aggregate | `data/rounds/{year}/rounds-{YYYY-MM-DD}-{HHmm}.json` | Scheduled round time, zero-padded (e.g. `0600`) |

The two `{HHmm}` values are different: the log filename records *when* the user submitted; the aggregate filename records *which round* it covers (the scheduled time). This means an 06:00 round submitted at 06:14 produces:
- Log: `data/rounds/logs/tploch/2026/roundslog-tploch-2026-05-04-0614.json`
- Aggregate: `data/rounds/2026/rounds-2026-05-04-0600.json`

The Console scans both the current year and the previous year when polling for new user log files, so submissions made just after midnight on 1 January are not missed.

### Round number inference rule (field PWA — `reInferRound`)

The field PWA infers the current round number on module load using the following algorithm. The goal is to identify which round the crew should be entering *right now*.

1. Get the current UTC time as `HH:MM`.
2. Find the most recently passed scheduled round time — i.e., the largest `schedule.round_times[].time` value ≤ current time.
3. **Exception:** if the *next* round's scheduled time is within 60 minutes from now, use the next round instead (pre-populate for upcoming round).
4. If no round has passed yet today (current time is before the first scheduled round), use round 1.

**Edge cases:**
- Midnight wrap: times are compared as strings in `HH:MM` order. If the current time is before the first scheduled time (e.g., current = `05:30`, first round = `06:00`), step 4 applies and round 1 is used.
- The exception in step 3 means a round scheduled at 06:00 will be pre-populated from 05:00 onwards (one hour before). This is the intended "early start" window.

The inferred `round_number` and corresponding `scheduled_time` are stored in module state and embedded in each entry object at submission time.

---

## 25. fuelstate.json

**Location:** `Documents/IDMS/data/fuel/fuelstate.json`
**Edited by:** Console (via Operations → Fuel & Oil Transfers screen)
**Read by:** Console only

Stores the current volume for every tracked tank (fuel, lube oil, waste oil) and a running burn/transfer log. This is an **operational state file** — not a config. It is updated every time the operator applies a transfer or edits a tank volume and saves. The field PWA does not read this file.

### Full example (current — schema v5)

```json
{
  "schema_version": 5,
  "vessel": "F/V Araho",
  "last_updated": "2026-05-16T22:18:28.003Z",
  "updated_by": "wostara",

  "burn_plan": {
    "tank_a_id": "a1b2c3d4-0007-4000-8000-000000000007",
    "tank_b_id": "a1b2c3d4-0008-4000-8000-000000000008"
  },

  "tanks": [
    { "tank_id": "a1b2c3d4-0001-4000-8000-000000000001", "volume": 320 },
    { "tank_id": "a1b2c3d4-0007-4000-8000-000000000007", "volume": 10921 }
  ],

  "burn_log": [
    {
      "id": 1713620000000,
      "timestamp": "2026-04-13T22:49:00.000Z",
      "from_tank_id": "a1b2c3d4-0008-4000-8000-000000000008",
      "to_tank_id":   "a1b2c3d4-0013-4000-8000-000000000013",
      "quantity": 2800
    }
  ],

  "waste_log": [ /* see "Transfer log entry fields" below */ ],
  "lube_log":  [ /* see "Transfer log entry fields" below */ ],
  "water_log": [ /* added v3 — water-tank transfers, same shape */ ],
  "blackgrey_log": [ /* added v4 — black & grey water transfers */ ],
  "fuel_log": [
    {
      "id": 1778969899144,
      "timestamp": "2026-05-16T22:18:19.144Z",
      "from_tank_id": "a1b2c3d4-0001-4000-8000-000000000001",
      "from_description": null,
      "to_type": "correction",
      "to_tank_id": null,
      "quantity": -8481,
      "qty_remaining": 320,
      "correction_by": "William Ostara"
    }
  ]
}
```

### Migration history

| Version | Change |
|---------|--------|
| v1 | Initial schema — `burn_log`, `waste_log`, `lube_log` |
| v2 | Added `qty_remaining` to waste/lube log entries; added `to_type` to lube entries; added `incin_data` to waste entries; correction entries now store delta in `quantity` and new total in `qty_remaining`; removed `qty_processed` / `qty_remains` from `ows_data` |
| v3 | Added `water_log` for water-tank transfer tracking |
| v4 | Added `blackgrey_log` for black & grey water transfer tracking |
| v5 | Added `fuel_log` for fuel-category manual correction tracking (same correction-entry shape as waste / lube). Inline tank QTY edits now auto-save on blur and write a `fuel_log` audit entry — no more silent OneDrive divergence on direct edits |

Migrations are idempotent and additive — running the migration chain on an older file only fills in missing fields and arrays; existing data is never rewritten. Each migration is logged to the console as `[Fuel] Migrated fuelstate vN → vN+1`.

### `fuel_log` entry fields (v5)

Manual corrections to a **fuel-category** tank's volume from the Tank Inventory panel produce one `fuel_log` entry per blur-committed edit (zero-delta edits are skipped). Shape mirrors the `correction` variant of `waste_log` / `lube_log`.

| Field           | Type    | Required | Notes                                                                          |
|-----------------|---------|----------|--------------------------------------------------------------------------------|
| `id`            | integer | yes      | `Date.now()` at edit time. Unique within the file.                             |
| `timestamp`     | string  | yes      | ISO 8601 UTC. Time of the manual edit.                                         |
| `from_tank_id`  | string  | yes      | UUID of the fuel tank that was edited.                                         |
| `from_description` | null | yes      | Always `null` for fuel corrections (reserved for parity with `waste_log`).     |
| `to_type`       | string  | yes      | Always `"correction"`.                                                          |
| `to_tank_id`    | null    | yes      | Always `null` — corrections have no destination.                                |
| `quantity`      | number  | yes      | Signed delta in USG (`newVolume − oldVolume`). Negative when volume decreased. |
| `qty_remaining` | number  | yes      | New tank volume after the edit. Equals the value typed by the operator.        |
| `correction_by` | string  | yes      | Operator display name (`window.idmsCurrentUser.name || .username`).             |

### Top-level fields

| Field            | Type     | Required | Notes                                                                  |
|------------------|----------|----------|------------------------------------------------------------------------|
| `schema_version` | integer  | yes      | Current version `5`. See migration history below for v1–v5.            |
| `vessel`         | string   | yes      | Copied from `vesselconfig.json → vessel` at time of first save.        |
| `last_updated`   | string   | yes      | ISO 8601 UTC. Timestamp of the most recent save. `null` if never saved.|
| `updated_by`     | string   | yes      | Username of the user who last saved. `null` if not yet saved.          |
| `burn_plan`      | object   | yes      | Active draw-tank configuration. See burn plan object fields below.     |
| `tanks`          | object[] | yes      | One entry per tracked tank. See tank state object fields below.        |
| `burn_log`       | object[] | yes      | Ordered array of fuel burn-plan transfer entries (TO Settling Tank).   |
| `waste_log`      | object[] | yes      | Waste-oil transfer / overboard / OWS / incineration / correction entries (v1+). |
| `lube_log`       | object[] | yes      | Lube-oil tank-to-tank, tank-to-equipment, and correction entries (v1+).|
| `water_log`      | object[] | yes      | Fresh / technical water transfer entries (added v3).                   |
| `blackgrey_log`  | object[] | yes      | Black / grey water transfer entries (added v4).                        |
| `fuel_log`       | object[] | yes      | Manual fuel-tank correction entries (added v5). See field table below. |

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

### SQLite table — `fuel_state_snapshot`

Added in v2.12. Stores the most recently ingested snapshot of `fuelstate.json` in SQLite so that `dashboard.js` and any other future modules can read fuel state without a Graph API call at render time. Only one snapshot is retained — every ingest fully replaces the previous rows.

```sql
CREATE TABLE IF NOT EXISTS fuel_state_snapshot (
  tank_id       TEXT    NOT NULL,
  volume        REAL    NOT NULL DEFAULT 0,
  category      TEXT    NOT NULL,
  abbreviation  TEXT,
  capacity      REAL,
  ingested_at   TEXT    NOT NULL
);
```

| Column        | Notes                                                                                                   |
|---------------|---------------------------------------------------------------------------------------------------------|
| `tank_id`     | UUID from `vesselconfig.json → tanks[].tank_id`. Primary lookup key.                                   |
| `volume`      | Current volume in USG as stored in `fuelstate.json → tanks[].volume`. May be negative (fuel tanks only).|
| `category`    | Denormalised from `vesselconfig.json → tanks[].category` at ingest time. One of `"fuel"`, `"lube_oil"`, `"waste_oil"`. |
| `abbreviation`| Denormalised from `vesselconfig.json → tanks[].abbreviation`. Used for display labels.                  |
| `capacity`    | Denormalised from `vesselconfig.json → tanks[].capacity` in USG. Used for fill-bar percentage.          |
| `ingested_at` | ISO 8601 UTC. Timestamp of the ingest run that wrote this row.                                          |

There is no primary key constraint — the table is fully rebuilt on every ingest via `DELETE FROM fuel_state_snapshot` followed by a bulk insert in a single transaction. No UNIQUE constraint is required.

### SQLite table — `fuel_state_history`

Added in v2.19. Append-only log of per-tank volume changes. Backs historical Fuel / Stability / Dashboard report previews — querying "the latest row per `tank_id` where `timestamp <= end-of-day`" reconstructs tank state at any past instant.

```sql
CREATE TABLE IF NOT EXISTS fuel_state_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp    TEXT    NOT NULL,
  tank_id      TEXT    NOT NULL,
  volume       REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fsh_timestamp ON fuel_state_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_fsh_tank_time ON fuel_state_history(tank_id, timestamp);
```

| Column      | Notes                                                                                                |
|-------------|------------------------------------------------------------------------------------------------------|
| `id`        | Autoincrement, ordering tiebreak for rows that share a `timestamp`.                                  |
| `timestamp` | ISO 8601 UTC. Equals `ingestFuelState.now` at write time (i.e. the moment the snapshot ingest ran). |
| `tank_id`   | UUID matching `vesselconfig.json → tanks[].tank_id`.                                                 |
| `volume`    | Tank volume at this moment, in USG. May be negative for fuel tanks (meter calibration).             |

**Write rule (in `db:ingestFuelState`).** Before the transactional `DELETE FROM fuel_state_snapshot` runs, the existing per-tank volumes are read into a map. For each new tank entry, a `fuel_state_history` row is appended **only if** the tank is new or its volume differs from the previous snapshot. No-op ingests (operator saves without changing any tank) write zero history rows — keeps the table audit-meaningful and growth bounded.

**Size expectations.** ~20 tanks × ≤20 changes/day ≈ 100–400 rows/day ≈ 2–10 MB/year at ~60 bytes/row. SQLite handles this comfortably into the tens of GB; no rotation or archival required.

**Read API.** `db:getFuelStateAsOf({ date })` and `db:getFuelStateHistoryEarliest()` — see "New IPC handlers" in the v2.19 changelog entry.

### SQLite table — `vessel_config_snapshots`

Added in v2.19. Mirrors the existing `rounds_config_snapshots` pattern. Captures `vesselconfig.json` on every successful save so historical Stability reports can render against the tank layout / LCG / VCG / FSM / lightship values that were in effect on a past date.

```sql
CREATE TABLE IF NOT EXISTS vessel_config_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at     TEXT    NOT NULL,
  schema_version  INTEGER,
  config_json     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vcs_captured_at ON vessel_config_snapshots(captured_at);
```

| Column           | Notes                                                                                                          |
|------------------|----------------------------------------------------------------------------------------------------------------|
| `id`             | Autoincrement.                                                                                                 |
| `captured_at`    | ISO 8601 UTC. `new Date().toISOString()` at the moment of the IPC call.                                        |
| `schema_version` | Mirrors the `schema_version` field inside `config_json` for quick filtering. Nullable for forward-compat.       |
| `config_json`    | Full `vesselconfig.json` serialised via `JSON.stringify(config)`.                                              |

**Write rule (in `vessel:saveConfigSnapshot`).** Before insert, the handler reads the most recent snapshot's `config_json` and compares strings — if identical, the insert is skipped and `{ ok: true, skipped: true }` is returned. So opening the Vessel Setup screen and clicking Save without editing anything will not duplicate rows.

**Hook.** Called from `saveVesselConfig()` in `vessel.js` immediately after a successful `graphPut(vesselconfig.json)`. Failures are caught and logged non-fatally — a snapshot hiccup never blocks the user's OneDrive save.

**Read API.** `db:getFuelStateAsOf` consults this table for tank metadata (category / abbreviation / capacity) at the requested date, falling back to the live `fuel_state_snapshot` metadata if no snapshot exists for that date yet.

### SQLite table — `fuel_transfers` (extended in v2.19)

The `log_type` column accepts a new value `'fuel'` in addition to the existing `'waste' | 'lube' | 'burn'`. `db:ingestFuelTransfers` accepts a new `fuel_log` parameter alongside `waste_log` and `lube_log`; each `fuel_log` entry is inserted with `log_type='fuel'`, `to_type='correction'` and the `qty_remaining` / `quantity` / `correction_by` fields populated directly from the `fuelstate.json` `fuel_log` entry. Existing rows are unaffected — no migration required for older databases.

### IPC handler — `db:ingestFuelState`

**Called by:** `ingest.js` poll cycle (every `ingest_poll_interval_seconds`) and on demand when `fuel.js` saves `fuelstate.json`.

**Arguments:** `{ fuelState, vesselConfig }` — both objects parsed from OneDrive in the renderer before the IPC call.

**Behaviour:**

1. Builds a lookup map from `vesselConfig.tanks`: `tank_id → { category, abbreviation, capacity }`.
2. Opens a SQLite transaction.
3. `DELETE FROM fuel_state_snapshot`.
4. For each entry in `fuelState.tanks`: inserts one row using the lookup map to populate `category`, `abbreviation`, `capacity`. Tanks not found in `vesselConfig.tanks` are skipped with a console warning.
5. Commits. Returns `{ ok: true, rows: N }`.

**Renderer call site (ingest.js):**

```javascript
async function pollFuelState() {
  const [fuelState, vesselConfig] = await Promise.all([
    loadFuelState(),       // existing graph.js helper
    loadVesselConfig()     // existing graph.js helper
  ]);
  if (!fuelState || !vesselConfig) return;
  await window.idms.db.ingestFuelState({ fuelState, vesselConfig });
}
```

`pollFuelState()` is added to the main `pollNow()` sequence in `ingest.js` alongside the existing per-department and rounds poll blocks.

**Hook in `fuel.js`:** After a successful `saveFuelState()` call, `fuel.js` calls `db:ingestFuelState` with the just-saved state and the cached `vesselConfig`. This ensures the SQLite snapshot is never more than one operation stale when the user is actively recording transfers.

### Convenience query — `db:getFuelStateSummary`

Returns the data needed by the dashboard fuel zones in a single call. No arguments.

```javascript
// Returns:
{
  fuel_onboard_usg:   number,   // SUM(volume) WHERE category = 'fuel'
  lube_oil_usg:       number,   // SUM(volume) WHERE category = 'lube_oil'
  waste_oil_usg:      number,   // SUM(volume) WHERE category = 'waste_oil'
  tank_rows:          array,    // all rows ordered by abbreviation (natural sort)
  ingested_at:        string    // MAX(ingested_at) across all rows
}
```

`tank_rows` entries: `{ tank_id, volume, category, abbreviation, capacity }` — enough for the tank layout canvas fill bars and the inventory sub-panel.

---

## 26. Stability Calculations  *(added v1.8)*

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

#### Shared `renderStabilityAssessmentBlock` helper (added v2.21)

The Stability Assessment block (two-chart row + caption) is rendered by a shared helper so the Stability Report (Report Generator), the Dashboard (Overview → Dashboard, Zone 8 — see §30), and the **Dashboard Report tail block** all produce identical output.

```javascript
renderStabilityAssessmentBlock(container, {
  lcg_m, disp_mt, vcg_corr_m, trim_m, configured
})
```

The helper renders:

1. A `STABILITY ASSESSMENT` section header.
2. Two side-by-side chart panels (`TRIM DETERMINATION` left, `MAX VCG` right) with the red diamond cursor positioned per the `TRIM_CHART` / `VCG_CHART` calibration constants above.
3. A per-panel footer line: `LCG = {N.NNN} m  |  Disp = {N,NNN.N} MT` (left) and `Disp = {N,NNN.N} MT  |  VCG Corr = {N.NNN} m` (right).
4. A full-width muted caption immediately below the two-chart row:

   > Fore trim is positive and aft trim is negative. For reference only — see Stability Booklet 175-101-150D pages 17–18 for manual plots.

When `configured = false` (no lightship in `stability.json`), the helper substitutes a muted `"Stability not configured — open Vessel Setup → Stability Calculations to enter lightship & variable weights"` placeholder in place of the two charts and suppresses the caption.

**Dashboard Report tail block.** `reports.js → buildDashboardReportPreview` appends a final `.rpt-section` after the Recent Rough Log table that calls `renderStabilityAssessmentBlock(section, RPT.stability_assessment)` with the values computed by `stReportPrepareAsOf` for the report's selected date (so historical Dashboard Reports render against the lightship / tank state in effect on that date — see v2.19 historical reports infrastructure). Print pipeline already inlines PNG assets via `rptInlineAttachmentImages`; the two stability chart PNGs are picked up by the same mechanism (they live under `src/renderer/assets/` and are resolved to `data:` URLs at print time).

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

## 27. Trip Analytics

**Added in:** IDMS Console v2.12 (replaces Trip Planner)
**Screen:** Overview → Trip Analytics (after Rough Log, in Overview sidebar group)
**Module file:** `tripanalytics.js`
**Tabs:** Current Trip Calculations · Trip History · Analytics Setup
**Resource key:** `operations/trip_analytics`

The Trip Analytics module is the operational lifecycle manager for fishing trips. It is the single source of truth for trip metadata, daily positions, fuel burn, and production tracking. Downstream modules (Schedule, Fuel Log, Bunker Pre-Load) read from this data.

> **Migration note (v2.12)**  
> `tripplanner.js` is retired. Its Rotation Planner tab (formerly Tab 3) has been moved to the Schedule module as Tab 4. All Trip Planner data structures (SQLite tables, OneDrive files) are unchanged — only the renderer and nav location changed. The `operations/trip_planner` resource key is automatically migrated to `operations/trip_analytics` at startup (see §15).

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
| `sort_order`     | INTEGER | nullable             | Display position in Trip History list. Lower numbers appear first. Null rows sort last. Populated on startup from `open_date DESC` rank for legacy rows; swapped in pairs by `db:swapTripOrder` when admin uses ↑ ↓ controls. |

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

| Key                          | Group       | Label          | Access scope |
|------------------------------|-------------|----------------|--------------|
| `operations/trip_analytics`  | Operations  | Trip Analytics | Grants view access to all three Trip Analytics tabs. Admin permission is additionally required to open trips, enter positions, generate bunker pre-loads, and use the Trip History edit panel. |

---

### Trip lifecycle

| Action                | Permission          | Notes |
|-----------------------|---------------------|-------|
| Open trip             | admin only          | Writes `trips` row + `trip_crew_assignments`; updates `consoleconfig.json`; writes `trips.json`. |
| Enter/edit position   | admin or standard   | Upserts `trip_daily_logs` via `db:upsertDailyPosition`. No OneDrive write. |
| Close trip            | admin only          | Sets `status='closed'`, `close_date`, `closed_by`; updates `consoleconfig.json`; writes `trips.json`. Irreversible. |
| Record departure      | admin only          | Sets `offboard_date` on a `trip_crew_assignments` row. |
| Add mid-trip crew     | admin only          | Inserts new `trip_crew_assignments` row with today as `board_date`. |
| View all tabs         | `operations/trip_analytics` resource or admin | |

---

### IPC handlers

| Handler                      | Description |
|------------------------------|-------------|
| `db:openTrip`                | Inserts `trips` row + `trip_crew_assignments` rows in a single transaction. Returns `{ ok, trip_id }`. |
| `db:closeTrip`               | Updates `trips` row (`status`, `close_date`, `closed_by`, `offload_port`). Returns `{ ok, trip }`. |
| `db:getActiveTrip`           | Returns the single row with `status='active'`, or `null`. |
| `db:getTrips`                | Returns all trips ordered by `open_date DESC`. |
| `db:getTripDailyLogs`        | Returns all `trip_daily_logs` rows for a given `trip_id`, ordered by `log_date ASC`. |
| `db:getTripDailyLogsWithGaps` | Returns one row per calendar day between `open_date` and `close_date` (or today for active trips). Days without a `trip_daily_logs` entry are returned as synthetic gap rows: `{ trip_id, log_date, lat: null, lon: null, fuel_burned_usg: null, production_mt: null, gap: 1 }`. Real rows carry `gap: 0`. Args: `{ trip_id, open_date, close_date }`. |
| `db:upsertDailyPosition`     | Inserts or updates `lat`, `lon`, `position_entered_by` for a given `trip_id` + `log_date`. |
| `db:getTripCrew`             | Returns all `trip_crew_assignments` rows for a given `trip_id`. |
| `db:updateCrewOffboard`      | Sets `offboard_date` for a given assignment `id`. |
| `db:addCrewMidTrip`          | Inserts a new assignment row for an active trip. |
| `db:upsertTripFuelBurn`      | Inserts or updates `fuel_burned_usg` for `trip_id` + `log_date`. Called by ingest cycle. |
| `db:upsertTripProduction`    | Inserts or updates `production_mt` for `trip_id` + `log_date`. Called by ingest cycle. |
| `db:updateTrip`              | Manual correction of `trips` header fields. Accepts `{ trip_id, fields }` where `fields` is a subset of `{ fishery_target, open_date, close_date, offload_port, status, notes }`. Field whitelist enforced in handler. Returns `{ ok, trip }`. Admin only (enforced in renderer). |
| `db:updateTripDailyLog`      | Full upsert of a `trip_daily_logs` row for a given `trip_id` + `log_date`. Accepts `{ trip_id, log_date, fuel_burned_usg, production_mt, lat, lon }`. All value fields nullable. Uses `ON CONFLICT` to update existing rows. Admin only (enforced in renderer). |
| `db:deleteTripDailyLog`      | Deletes the `trip_daily_logs` row matching `{ trip_id, log_date }`. Admin only (enforced in renderer). |
| `db:getTripsWithTotals`      | Returns all trips ordered `COALESCE(sort_order, 999999) ASC, open_date DESC` with LEFT JOIN aggregates from `trip_daily_logs`: `total_fuel_usg`, `total_production_mt`, `fuel_log_days` (days with a non-null fuel value). Used by Trip History tab instead of `db:getTrips`. |
| `db:deleteTrip`              | Transactional delete of a trip and all its `trip_daily_logs` and `trip_crew_assignments` rows. Args: `{ trip_id }`. Returns `{ ok }`. Admin only (enforced in renderer). |
| `db:swapTripOrder`           | Swaps the `sort_order` values of two trips in a single transaction. Args: `{ trip_id_a, trip_id_b }`. Returns `{ ok }`. Used by ↑ ↓ reorder controls in Trip History. Admin only (enforced in renderer). |
| `db:getTripFuelAvgByFishery` | Returns `{ avg_daily_usg, sample_days }` for all closed trips matching a fishery target. Used by Fuel Management tab comparison line. |
| `db:getTripHistory`          | Returns paginated closed trips with optional filters (`year`, `fishery`, `search`, `page`, `pageSize`). Returns `{ rows, total, pages }`. Historical trips use notes-parsed `days_at_sea`; live trips derive it from `COUNT(DISTINCT log_date)`. |
| `db:getSeasonSummary`        | Returns one row per year with aggregated totals: `trips`, `days_at_sea`, `fuel_usg`, `prod_mt`, `avg_gpd`. Covers all closed trips. |
| `db:getFisheryComposition`   | Returns one row per `(year, fishery_target)` pair with `trip_count`. Used by Season Analytics tab fishery breakdown table. |
| `db:getFuelEfficiencyByYear` | Returns one row per year with `avg_gpd` (average gallons per sea-day across all closed trips in that year). Used by Season Analytics bar chart. |

---

### Trip Analytics UI behaviour

#### Tab 1 — Current Trip Calculations

- **Trip header card:** locked to the active trip (from `tripanalyticsconfig.json → active_trip`); shows trip number, fishery, open date, and days elapsed. Admin-only **Open New Trip** button triggers a modal (trip number entry with YYNN format validation, duplicate check, departure port select); on confirm writes `trips` row and updates `tripanalyticsconfig.json → active_trip.departure_port_id`.
- **Map panel (320 px):** Leaflet.js map with GeoJSON land polygons (`ne_110m_land.geojson` bundled asset). Confirmed track segments (solid, coloured by `map.track_confirmed_colour`); gap segments (dashed, coloured by `map.track_gap_colour`); position dots with date tooltips; departure and destination port markers; great-circle arc to destination. Gracefully degrades if GeoJSON asset is absent.
- **Trip metadata grid:** open date, days elapsed, departure port (from `tripanalyticsconfig.json → active_trip.departure_port_id`), destination port select (ports from `tripanalyticsconfig.json → ports`), estimated arrival (haversine NM ÷ steam speed input → steam days + today). Latest known **Latitude** and **Longitude** are editable inline as degrees + decimal-minutes + N/S/E/W select (the standard nautical format); admin-only **Save Position (today)** button calls `db:upsertDailyPosition` with today's date and the converted decimal-degrees value.
- **Production summary:** processing start (from `factoryconfig.json → production.processing_start_time`), latest entry, average daily MT (from `production_entries`), editable target MT (from `tripanalyticsconfig.json → production.production_target_mt`), estimated complete date, estimated offload date.
- **Offload Estimator (diesel only as of v2.13):** four-row fuel summary above the desired-fuel input — **Fuel Onboard Trip Start (USG)** (admin-editable, captured at trip open), **Trip Start Time** (admin-editable `datetime-local`, captured at trip open), **Fuel Onboard Now (USG)** (sum of `fuelstate.json` fuel-category tanks), **Daily Avg. Consumption (USG/day)** (`(start − now) / hoursElapsed × 24`, falls back to `trip_daily_logs.fuel_burned_usg` average if either start value is missing). Then: **Est. Fuel Upon Arrival**, **Desired Fuel for Next Trip** input, **Bunkers Required**. Admin-only **Generate Bunker Pre-Load** button — produces a complete bunker plan, writes it to `data/fuel/bunkerplan.json`, and navigates to the Bunker Pre-Load screen. (The Lube Oil tank table that existed in v2.12 was removed in v2.13.)

#### Bunker Pre-Load generator (v2.13)

When the **Generate Bunker Pre-Load** button is clicked:

1. Validates a destination port and steaming speed are set.
2. Computes `steamDays = haversineNM(lastPos, destPort) / steamSpeedKts / 24`.
3. Sums current fuel onboard from `fuelstate.json` across all `category: 'fuel'` tanks (handling both legacy `volume_usg` and current `volume` field names).
4. Picks an effective daily burn — trip-start derived (`(fuelStart − fuelNow) / hoursSinceStart × 24`) when available, else the `trip_daily_logs.fuel_burned_usg` mean.
5. Computes `bunkersTotal = max(0, round(desiredFuel − (currentOnboard − dailyBurn × steamDays)))`.
6. Sorts vessel fuel tanks by name with `localeCompare(undefined, { numeric: true, sensitivity: 'base' })` so `Tank 2` precedes `Tank 10`.
7. Walks the sorted list filling each tank from its current level up to `capacity × max_fill_pct/100`, decrementing `bunkersTotal` until exhausted; tanks not needed produce no row.
8. Sets `date = today + ceil(steamDays) + 1` (ETA + 1 day) and `transfer_location = destPort.name`.
9. Loads any existing `bunkerplan.json` to preserve PIC names, delivery rates, delivering facility, and bunker type.
10. Shows a confirmation dialog with the full breakdown (steam time, fuel onboard, avg burn, fuel on arrival, bunkers required, tanks filled). On confirm calls `saveBunkerPlan()` then navigates to the Bunker Pre-Load screen.

#### Tab 2 — Trip History

All trips table (internal key: `fuel`). All users see an expandable read-only view; admin users additionally see an **Edit** button column.

**Table columns:** Trip # · Fishery · Total Prod (MT) · Open · Close · Avg Daily Burn (USG) · Total Fuel Burned (USG) · [actions]. Active trip row has a subtle background highlight and a "● Active" badge next to the trip number. All fuel and production totals come from `db:getTripsWithTotals`. Avg Daily Burn: seed trips use `notes.gpd` (falling back to `fuel_total_usg / days_at_sea`); live trips use `total_fuel_usg / fuel_log_days`.

**Topbar controls (admin only):**
- **+ New Trip** — modal: trip number (4-digit YYNN, validated), open date, fishery select. Calls `db:openTrip`. Re-renders tab on success.
- **Close Active Trip** — only shown when an active trip exists. Modal: close date (required), offload port (optional). Irreversible-action styling. Calls `db:closeTrip`. Clears `TA.activeTrip` and re-renders on success.

**Per-row actions (admin only):** **↑ ↓ reorder buttons** (first row has no ↑; last row has no ↓ — disabled positions render as spacers). Clicking ↑ or ↓ calls `db:swapTripOrder` with the adjacent trip IDs and re-renders. **Edit button** (opens edit panel — see below). **× delete button** — triggers a confirmation dialog; if the active trip is deleted, `TA.activeTrip` is cleared; calls `db:deleteTrip`.

**Read-only expand:** clicking a live-trip row expands a detail sub-table via `db:getTripDailyLogsWithGaps`: date, fuel burned (USG), position. Gap days (no `trip_daily_logs` entry) render at opacity 0.45. Seed/historical trips (`opened_by = 'seed_import'`) show a single aggregate row with no expand control.

**Edit panel (admin only):** opens below the trip row. Contains two sections:

- *Trip Details* — editable fields: Fishery (select: YF / Mack / Gulf / POP / STEAM / none), Open Date, Close Date, Offload Port. Saved via `db:updateTrip`.
- *Daily Logs* — editable table: **Fuel Burned (USG)** (settling-tank draw = fuel consumed that day, not fuel onboard), **Production (MT)**, **Lat**, **Lon**. Lat and Lon are entered as degrees + decimal-minutes + N/S/E/W hemisphere select (matching the Tab 1 position entry format); converted to/from decimal degrees via `taDDtoDM()` / `taDMtoDD()` on render/save. Saved via `db:updateTripDailyLog` per row (blank rows skipped). Delete control (×) per row: staged at 35% opacity, only committed to `db:deleteTripDailyLog` on Save (toggleable before confirming). **+ Add day** control: date picker appended below the table; duplicate dates rejected with red outline flash.

Save sequence: header update → staged deletes → daily log upserts. Errors surface inline without closing the panel. On success, panel transitions to read-only detail view after 800 ms.

**Data source:** SQLite `trips` + `trip_daily_logs` tables. `fuel_burned_usg` written daily by `ingest.js` from `fuelstate.json → burn_log` settling-tank transfers. `production_mt` written daily by `ingest.js` from ICMS production files. Both are editable via the edit panel. OneDrive mirror at `data/trips/trips.json` and `data/trips/daily/`.

#### Tab 3 — Analytics Setup

- **Production settings:** editable target MT (saved to `tripanalyticsconfig.json → production.target_mt`).
- **Map configuration:** text inputs for track confirmed colour, track gap colour, arc colour (hex); live colour swatch preview.
- **Ports table:** editable reference list (port_id, name, lat, lon). Add/delete rows. Inline validation (unique port_id, lat −90 to 90, lon −180 to 180).
- **Save to OneDrive / Refresh from OneDrive** buttons with status feedback.

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

**Added in:** IDMS Console v2.0 (complete rewrite of v1.9 stub); Rotation Planner tab added v2.12  
**Screen:** Personnel → Schedule
**Access:** `operations/schedule` resource key, or admin permission tier.
**Module file:** `schedule.js`

The Schedule module renders four tabs via the standard `cs-tab-bar` / `cs-tab` / `cs-tab-content` CSS pattern shared with Crew Setup, Vessel Setup, and Trip Analytics.

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

### Tab 4 — Rotation Planner

**Added in:** v2.12 (moved from Trip Planner module Tab 3)

The Rotation Planner gives crew managers a live view of who is currently aboard for the active trip, and lets admins record departures and add mid-trip joiners.

**Aboard table** — rows from `db:getTripCrew` where `offboard_date IS NULL`. Columns: Name, Role, Board Date, Days Aboard. For admin users, each row has a **Departed** button that triggers a departure confirmation modal (date picker defaulting to today); on confirm calls `db:updateCrewOffboard`.

**Departed table** — rows from `db:getTripCrew` where `offboard_date IS NOT NULL`. Columns: Name, Role, Board Date, Depart Date.

**Trip selector** — a dropdown above the tables lists all trips from `db:getTrips` (newest first); selecting a different trip reloads both tables for that trip. Active trip is pre-selected on initial render.

**Add mid-trip crew form** (admin only) — triggered by an **Add Crew Member** button. Form fields:
- Crew Member — `<select>` populated from `SC.crewList` (loaded from `crewconfig.json` by `initSchedule()`); groups by department.
- Board Date — `<input type="date">` defaulting to today.

On submit calls `db:addCrewMidTrip` with `{ trip_id, user_id, username, display_name, role, board_date }` and refreshes the Aboard table.

**Permissions:** Viewing is available to any user with the `operations/schedule` resource or admin tier. Departed / Add Mid-Trip actions require admin tier.

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
**Layout:** Single scrollable page — no tabs
**Resource key:** None — visible to all authenticated users

The Dashboard is the primary at-a-glance surface for the console. It aggregates data from across the system into one scrollable page, ordered from broadest operational context (trip/vessel) down to most recent activity (rough log). It reads exclusively from SQLite and the in-memory config cache — no Graph API calls at render time.

`overview.js` is retired and absorbed into this module. All content previously rendered by `overview.js` is preserved in Zone 6 (System Health) below.

---

### Data prerequisites

The following must be available in SQLite before the dashboard renders correctly:

| Data | Source | Ingest mechanism |
|------|--------|-----------------|
| Active trip + daily logs | `trips`, `trip_daily_logs` | `db:getActiveTrip`, `db:getTripDailyLogs` — existing |
| Trip analytics config | `tripanalyticsconfig.json` (in-memory) | Loaded by `tripanalytics.js` on first entry; cached on `window.TA` |
| Production entries | `production_entries` | Existing factory ingest cycle |
| Fuel state snapshot | `fuel_state_snapshot` | New — `db:ingestFuelState` (§25 addendum) |
| Vessel config | `vesselconfig.json` (in-memory) | Loaded by `vessel.js`; also available via `loadVesselConfig()` |
| Rough log entries | `rough_log` | Existing roughlog ingest cycle |
| Events (today) | `events` | Existing department log ingest cycle |

If `fuel_state_snapshot` is empty (first launch before any fuel ingest), Zone 5 renders a "Fuel data not yet available — open Fuel & Oil Transfers to sync" placeholder rather than blank numbers.

---

### Zone 1 — Trip Header Bar

**Position:** Top of page, full width
**Height:** Single compact card (~64px)
**Data source:** `db:getActiveTrip` + `tripanalyticsconfig.json` (in-memory, `window.TA?.config`)

A single horizontal band that frames all content below it. Renders in one of two states:

**Active trip state:**
```
TRIP 2601  ·  YF  ·  Day 14  ·  Dutch Harbor → Adak  ·  312 nm  ·  ETA Fri 09 May
```

| Element | Source |
|---------|--------|
| Trip number | `trips.trip_number` |
| Fishery badge | `trips.fishery_target` — coloured pill: YF=blue, Mack=green, Gulf=amber, POP=teal |
| Day count | `CURRENT_DATE − trips.open_date` in days |
| Departure port | `tripanalyticsconfig.json → active_trip.departure_port_id` resolved to port name |
| Destination port | Currently selected destination from `tripanalyticsconfig.json` (the same dropdown value used by Trip Analytics Tab 1) |
| Distance (NM) | Haversine from last recorded position to destination port lat/lon |
| ETA | `distance_nm / steam_speed_kts / 24` added to today — steam speed read from `tripanalyticsconfig.json` |

**No active trip state:**
Muted grey card: `NO ACTIVE TRIP — open Trip Analytics to begin a new trip`. Card is always rendered; the page does not collapse this zone when no trip is active.

---

### Zone 2 — Map + Vital Numbers

**Position:** Below Zone 1
**Layout:** Two columns — map left (~55% width), vitals grid right (~45% width)

#### Map panel

A read-only embedded instance of the Leaflet map already implemented in `tripanalytics.js`. Renders at a fixed height of approximately 340px.

**Rendering:** Reuses the existing `taInitOrUpdateMap()` function with a separate container element (`#db-map-container`). The same stale-map detection logic applies — on every navigation to the dashboard, `taInitOrUpdateMap()` checks whether the cached map container still matches the live DOM node; if not, the map is destroyed and rebuilt. `invalidateSize()` is deferred one frame on entry to handle 0×0 measurement during tab transitions.

**Map features (read-only — identical to Trip Analytics Tab 1):**
- Confirmed track polylines (solid, `map.track_color`)
- Gap segments (dashed, `map.track_gap_color`)
- Position dots with date tooltips
- Departure and destination port markers with permanent labels
- Great-circle arc to destination (`map.great_circle_color`)
- Vessel marker at last known position (`map.vessel_color`)
- Bathymetry layers if `map.show_bathymetry = true`

**No position data:** If `trip_daily_logs` contains no rows with non-null lat/lon, the map renders with only the port markers visible and a centred label: `"No positions recorded for this trip"`.

**No active trip:** Map panel renders a static centred view of the North Pacific with no markers and a label: `"No active trip"`.

**Controls:** None. No zoom controls, no position entry. This is a display widget. The full interactive map with position entry is in Trip Analytics Tab 1.

#### Vital numbers grid

Eight stat cells in a 2×4 grid (two columns of four rows). Same card visual language as the existing four summary cards at the top of the current `overview.js` content, but smaller.

| Cell | Value | Data source | Null state |
|------|-------|-------------|------------|
| Days at Sea | Integer | `CURRENT_DATE − trips.open_date` | `—` |
| Distance to Port | `NNN nm` | Haversine(last position → destination) | `—` |
| ETA | `Day Mon DD` | Same calculation as Zone 1 | `—` |
| Fuel Onboard | `NNN,NNN usg` | `db:getFuelStateSummary → fuel_onboard_usg` | `— (not synced)` |
| Daily Avg. Burn | `N,NNN usg/day` | `(fuel_start − fuel_now) / hours_elapsed × 24`; falls back to `trip_daily_logs.fuel_burned_usg` mean if trip-start snapshot is unavailable | `—` |
| Est. Fuel on Arrival | `NNN,NNN usg` | `fuel_now − (daily_avg_burn × steam_days)` | `—` |
| Trip Production | `NNN.N mt` | `SUM(trip_daily_logs.production_mt)` for active trip | `—` |
| Today's Production | `NNN.N mt` | `trip_daily_logs` row for `CURRENT_DATE` | `—` |

Cells for Fuel Onboard, Daily Avg. Burn, and Est. Fuel on Arrival are tappable — clicking navigates to Operations → Fuel & Oil Transfers.
Cells for Trip Production and Today's Production are tappable — clicking navigates to Overview → Factory Production.

---

### Zone 3 — Production Completion Estimates

**Position:** Below Zone 2
**Layout:** Single full-width card
**Data source:** `tripanalyticsconfig.json → production.production_target_mt` + `SUM(trip_daily_logs.production_mt)` + rolling 7-day average from `production_entries`

Answers the two most operationally important forward-looking questions for a factory trawler: *when are we done?* and *when can we offload?*

**Content:**

```
PRODUCTION PROGRESS

[████████████░░░░░░░░] 183.4 / 350 mt  (52%)

7-day avg: 14.2 mt/day    Trip avg: 13.1 mt/day

Est. completion:   Tue 12 May  (in 11 days)
Est. offload:      Thu 14 May  (in 13 days)
```

| Element | Calculation |
|---------|-------------|
| Progress bar | `current_mt / target_mt × 100` — clamped to 100% |
| MT to date | `SUM(trip_daily_logs.production_mt)` for active trip |
| Target MT | `tripanalyticsconfig.json → production.production_target_mt` |
| 7-day avg | Average `production_mt` from the last 7 `trip_daily_logs` rows with non-null production |
| Trip avg | `current_mt / days_with_production_data` |
| Est. completion | `CURRENT_DATE + ceil((target_mt − current_mt) / avg_daily_mt)` — uses 7-day avg preferentially |
| Est. offload | `est_completion + ceil(distance_to_port / steam_speed_kts / 24)` |

**Null states:**
- If `production_target_mt` is null: renders `"No production target set"` with a link that navigates to Trip Analytics → Analytics Setup. The progress bar and date estimates are suppressed.
- If no production data exists yet for the trip: progress bar shows 0%, date estimates show `"—"`.
- If no active trip: entire zone renders a muted `"No active trip"` placeholder card. Zone is never hidden.

---

### Zone 4 — Factory Production Widget

**Position:** Below Zone 3
**Layout:** Single full-width card with two sub-sections
**Data source:** `production_entries` (today) + DPR ingest metadata

A condensed read-only view of today's factory production. Not a re-implementation of Factory Production — a lightweight summary drawn from the same SQLite data.

#### Sub-section A — DPR Status

A single status row above the production table:

```
DPR  ·  Last ingested: Today 06:14  ·  Report date: 2026-05-05  ✓ Current
```

| State | Display |
|-------|---------|
| Today's DPR available | Green check — `"Report date: {date}  ✓ Current"` |
| Most recent DPR is from a prior day | Amber warning — `"Most recent: {date}  ⚠ Not today"` |
| No DPR ever ingested | Grey — `"No DPR data available"` |

#### Sub-section B — Species Breakdown Table

Today's per-species production from `production_entries`, matching the same columns rendered on the Factory Production Overview tab:

| Species | Daily MT | Trip MT |
|---------|----------|---------|
| Yellowfin | 18.2 | 97.4 |
| … | … | … |
| **Total** | **18.2** | **183.4** |

- Rows ordered by daily MT descending.
- Maximum 8 species rows rendered. If more than 8 species are present, remaining rows are collapsed under a `"+ N more"` expander.
- A `"View Full Production →"` link in the card footer navigates to Overview → Factory Production.

---

### Zone 5 — Fuel & Tank Layout

**Position:** Below Zone 4
**Layout:** Two columns — fuel summary left (~40% width), tank layout canvas right (~60% width)
**Data source:** `db:getFuelStateSummary` + `vesselconfig.json → tank_layout` + `vesselconfig.json → tanks`

#### Left sub-panel — Fuel Summary

Four rows mirroring the Offload Estimator summary in Trip Analytics Tab 1, plus the active burn plan tanks:

| Row | Value |
|-----|-------|
| Fuel Onboard Now | `fuel_state_snapshot` sum of `category = 'fuel'` |
| Trip Start Fuel | `tripanalyticsconfig.json → active_trip.fuel_onboard_trip_start_usg` |
| Daily Avg. Consumption | Same formula as Zone 2 vital cell |
| Est. Fuel Upon Arrival | Same formula as Zone 2 vital cell |
| Active Draw Tanks | `fuelstate.json → burn_plan.tank_a_id` / `tank_b_id` resolved to abbreviations |

Read-only. No inputs. A `"Manage Transfers →"` link navigates to Operations → Fuel & Oil Transfers.

Below the fuel rows, a compact two-row lube oil summary:

| Row | Value |
|-----|-------|
| Lube Oil Total | `fuel_state_snapshot` sum of `category = 'lube_oil'` |
| Waste Oil Total | `fuel_state_snapshot` sum of `category = 'waste_oil'` |

#### Right sub-panel — Tank Layout Canvas

The hull preview canvas implemented in `vessel.js` → Tank Layout tab, rendered here at reduced scale as a read-only display widget.

**Rendering:** Calls `renderHullCanvas(container, tankLayout, tanks, fuelState, { readOnly: true, scale: 0.75 })` — the existing canvas rendering function is refactored to accept a container argument and a `readOnly` flag rather than always writing to the Vessel Setup DOM node. The `scale` parameter reduces the canvas dimensions proportionally. All existing rendering logic (fill bars, colour-by-category, volume labels, word-wrapped tank names, second-pass label rendering) is unchanged.

**Prerequisite:** `renderHullCanvas` must be extracted from `vessel.js` into a shared utility (`canvasUtils.js` or similar) so both `vessel.js` and `dashboard.js` can call it without code duplication. This is a build prerequisite for this zone.

If `vesselconfig.json → tank_layout` is absent or empty, the right sub-panel renders a muted `"Tank layout not configured — set up in Vessel Setup"` placeholder.

---

### Zone 6 — Rough Log (Recent Entries)

**Position:** Below Zone 5
**Layout:** Single full-width card
**Data source:** `rough_log` SQLite table, `ORDER BY timestamp DESC LIMIT 15`

The 15 most recent rough log entries, read-only. Same column layout as the Rough Log module main table.

| Column | Source |
|--------|--------|
| Time | `rough_log.time_label` |
| Dept. | `rough_log.department` — coloured badge matching Rough Log module colours |
| Category | `rough_log.category` |
| Author | `rough_log.display_name` |
| Entry | `rough_log.body` — truncated to ~120 characters with ellipsis if longer |

No pagination. 15 rows is the hard limit; anyone needing more navigates to Overview → Rough Log.

**`+ New Entry` button:** Rendered in the zone header (right-aligned). Fires the identical new-entry modal used by `roughlog.js` — same form fields, same validation, same `db:saveRoughLogEntry` + OneDrive write sequence. This is the permanent home for the `+ New Entry` button currently shown in the top-right corner of the page header.

---

### Zone 7 — System Health

**Position:** Bottom of page, full width
**Layout:** Four stat cards (full-width row) above the OneDrive Ingestion Status table

This is the existing `overview.js` content, preserved intact and demoted to the bottom of the dashboard. No changes to the data or rendering logic — only its position on the page changes.

**Stat cards (existing):**
- Events Today
- Total Downtime (all departments)
- Active Timers
- Last Ingested + next poll countdown

**OneDrive Ingestion Status table (existing):**
Per-user log file sync status with green/grey dot, username, department, event count, last synced time. "Polling every 2 min" label top-right. Same table currently rendered by `overview.js`.

**Recent Events and System Alerts** sections (existing, below the table) are retained unchanged.

---

### Zone 8 — Stability Assessment

**Position:** Below Zone 7 (final zone on the page)
**Layout:** Two columns — Trim Determination chart left (~50% width), Max VCG chart right (~50% width); summary line below each chart
**Data source:** Same in-memory stability calc the Report Generator → Stability Report uses. See §26.

A read-only mirror of the **Stability Assessment** block rendered by Report Generator → Stability Report. Uses the identical chart assets (`stab-trim-chart.png`, `stab-vcg-chart.png`) and identical calibration constants (`TRIM_CHART`, `VCG_CHART` — §26) so the red diamond cursor position is consistent across surfaces.

**Per-panel content (matches §26):**

| Panel | Header | Sub-header | Footer line |
|---|---|---|---|
| Left | `TRIM DETERMINATION` | `TOTAL DISPLACEMENT (MT)` | `LCG = {N.NNN} m  |  Disp = {N,NNN.N} MT` |
| Right | `MAX VCG` | `VCG CORRECTED` | `Disp = {N,NNN.N} MT  |  VCG Corr = {N.NNN} m` |

The pair sits inside a single `STABILITY ASSESSMENT` card header to match the Stability Report visual grouping.

**Caption (rendered directly below the two-chart row, full-width, muted text):**

> Fore trim is positive and aft trim is negative. For reference only — see Stability Booklet 175-101-150D pages 17–18 for manual plots.

**Rendering:** Calls a new shared helper `renderStabilityAssessmentBlock(container, { lcg, disp_mt, vcg_corr, trim_m })` extracted from `stability.js` so both `dashboard.js` and `reports.js` (Stability Report **and** Dashboard Report) call the same function without code duplication. This is a build prerequisite for this zone (see below).

**Null states:**
- If `stability.json` has never been saved (no `lightship` block): card renders a muted `"Stability not configured — open Vessel Setup → Stability Calculations to enter lightship & variable weights"` placeholder in place of both charts. Caption is suppressed.
- If `fuel_state_snapshot` is empty: charts render with no cursor diamond and the footer lines show `LCG = —`, `Disp = —`, `VCG Corr = —`. Caption is retained.

**`db:getDashboardData` addition:** the aggregator returns an additional `stability_assessment` object:

```javascript
stability_assessment: {
  lcg_m:        number | null,    // §26 formula N
  disp_mt:      number | null,    // §26 formula K
  vcg_corr_m:   number | null,    // §26 formula O
  trim_m:       number | null,    // signed; positive = fore trim, negative = aft trim
  configured:   boolean           // false when stability.json has no lightship
}
```

Values are computed at IPC handler time against the current `fuelstate.json` / `vesselconfig.json` / `stability.json` — no caching. Same calc helpers `stReport*` already used by the Stability Report (see v2.19 §30 entry).

---

### IPC handlers

| Handler | Description |
|---------|-------------|
| `db:ingestFuelState` | Rebuilds `fuel_state_snapshot` from `fuelstate.json` + `vesselconfig.json`. See §25 addendum. |
| `db:getFuelStateSummary` | Returns `{ fuel_onboard_usg, lube_oil_usg, waste_oil_usg, tank_rows, ingested_at }`. See §25 addendum. |
| `db:getDashboardData` | Convenience aggregator. Single IPC call that returns all Zone 1–8 data in one round trip. See below. |

#### `db:getDashboardData`

A single composite handler that batches all dashboard queries to minimise IPC round trips. No arguments.

**Returns:**

```javascript
{
  // Zone 1 + 2 vitals
  active_trip:        object | null,    // db:getActiveTrip result
  last_position:      object | null,    // most recent trip_daily_logs row with non-null lat/lon
  fuel_summary:       object,           // db:getFuelStateSummary result

  // Zone 3
  production_by_day:  array,            // trip_daily_logs rows for active trip, ordered by log_date ASC
  today_production:   object | null,    // trip_daily_logs row for CURRENT_DATE

  // Zone 4
  today_species:      array,            // production_entries rows for CURRENT_DATE, ordered by production_mt DESC
  dpr_last_ingested:  string | null,    // MAX(ingested_at) from production_entries for CURRENT_DATE

  // Zone 6
  recent_roughlog:    array,            // rough_log rows ORDER BY timestamp DESC LIMIT 15

  // Zone 7 (existing overview data — same queries as overview.js)
  events_today:       integer,
  total_downtime_sec: integer,
  active_timers:      integer,
  last_ingested_at:   string | null,
  user_log_status:    array,

  // Zone 8 — see Zone 8 above for field semantics
  stability_assessment: object
}
```

The dashboard calls `db:getDashboardData` on every navigation to the screen and on every completed ingest poll cycle (via an existing `ingest-complete` IPC event already fired by `ingest.js`). Map rendering and `tripanalyticsconfig.json` values are read from in-memory state (`window.TA?.config`) without an IPC call.

---

### Render sequence

On every navigation to the dashboard:

1. Call `db:getDashboardData` — populate all zones synchronously from the returned object.
2. Call `taInitOrUpdateMap('#db-map-container')` — initialise or refresh the map from `window.TA?.config` and the `last_position` from step 1. This is the only potentially slow step and must not block zone 1–7 rendering.
3. Subscribe to `ingest-complete` IPC event — on receipt, re-call `db:getDashboardData` and re-render all zones except the map (map track updates are deferred to the next full navigation).

On navigation away from the dashboard:

- Unsubscribe from `ingest-complete`.
- Do not destroy the Leaflet map instance — leave it in the DOM and rely on `taInitOrUpdateMap()` stale detection on next entry.

---

### Build prerequisites

Before `dashboard.js` can be built, the following work must be completed in order:

1. **`db:ingestFuelState` + `fuel_state_snapshot` table** (§25 addendum) — required for Zones 2 and 5.
2. **`renderHullCanvas` extraction** — refactor the hull canvas renderer in `vessel.js` into a shared utility callable by `dashboard.js` without duplicating rendering code. Required for Zone 5 right sub-panel.
3. **`overview.js` teardown** — remove `overview.js` as a standalone module. Its content moves to Zone 7 of `dashboard.js`. The sidebar nav entry "Dashboard" replaces the current implicit overview landing. This must happen before `dashboard.js` is wired up to avoid two modules rendering the same ingestion status table simultaneously.
4. **`renderStabilityAssessmentBlock` extraction** — refactor the two-chart Stability Assessment renderer in `stability.js` into a shared helper callable by `dashboard.js` and `reports.js` (Stability Report **and** Dashboard Report tail block) without duplicating chart positioning logic. Required for Zone 8.

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

**Notes Hub digest (v2.31):** the Rough Log *display and export* may prepend one synthesized line per department per day summarizing assigned notes completed that day (§41.10). This is computed at render/export time from the notes event stream — it is **not** a written `roughlog-{YYYY}.json` entry and does not appear in the auto-populating sources table above.

---

## §32 — Tasks & Maintenance

**Status:** Built (v2.3)
**File:** `tasks.js`
**Location:** Operations → Tasks & Maintenance
**Tabs:** All Tasks · Due & Assigned · Create Task · Manual Entry

---

### Overview

The Tasks & Maintenance module manages planned and unplanned maintenance work orders for vessel equipment. Tasks are created by admin users (Create Task tab), completed by crew members, and their completion records are stored permanently. Recurring tasks automatically create the next instance on completion. Manual entries allow one-off completion records without a pre-created task.

---

### OneDrive files

#### Task Definition File

**Location:** `Documents/IDMS/data/tasks/definitions/tasks-{codeRange}-{year}.json`

One file per equipment code range per year. The `codeRange` is the 3-digit top-level equipment code (e.g. `601` for Main Engine group). Files are created when the first task for that code range and year is saved.

**Written by:** Console (Create Task tab on task save)  
**Read by:** Console (ingest cycle; All Tasks and Due & Assigned tabs on load)

```json
{
  "schema_version": 1,
  "code_range": "601",
  "year": 2026,
  "tasks": [
    {
      "task_id":       "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "title":         "Change main engine oil",
      "equipment_ids": ["601.001.001.001", "601.001.001.002"],
      "category":      "LUB",
      "priority":      "Normal",
      "role":          "Chief Engineer",
      "assigned_to":   "tploch",
      "description":   "Drain and refill HT circuit with Mobilgard 410 NC.",
      "skill_tags":    ["lubrication", "engine_maintenance"],
      "status":        "open",
      "recurring":     true,
      "interval":      "3M",
      "interval_hours": null,
      "due_date":      "2026-07-15",
      "created_at":    "2026-04-28T14:00:00.000Z",
      "created_by":    "tploch",
      "notes":         ""
    }
  ]
}
```

##### Task definition object fields

| Field           | Type     | Required | Notes |
|-----------------|----------|----------|-------|
| `task_id`       | string   | yes      | UUID v4. Generated at creation. Primary key. |
| `title`         | string   | yes      | Short description of the work. Free text. |
| `equipment_ids` | string[] | yes      | Array of asset codes from `assets.csv`. One or more. |
| `category`      | string   | yes      | One of the 9 valid category codes (see Category reference below). |
| `priority`      | string   | yes      | One of `Critical`, `High`, `Normal`, `Low`. Default: `Normal`. |
| `role`          | string   | no       | Role label (e.g. `"Chief Engineer"`). Filters the Due & Assigned tab. |
| `assigned_to`   | string   | no       | Username of a specific assignee. Takes precedence over `role` for assignment matching. |
| `description`   | string   | no       | Detailed work instructions. Free text. |
| `skill_tags`    | string[] | no       | Skill category keys. Planned for KSA profile integration. |
| `status`        | string   | yes      | One of `open`, `investigating`, `waiting_parts`, `waiting_opportunity`, `shipyard`, `other`, `reported_complete`, `completed`, `cancelled`. Active = everything through `reported_complete`; terminal = `completed`, `cancelled`. **`completed` means TM Master has it** — see §32a. |
| `recurring`     | boolean  | yes      | If `true`, a new task instance is created when this task is completed. |
| `interval`      | string   | no       | Required when `recurring` is `true`. One of the valid interval values (see below). |
| `interval_hours`| integer  | no       | Required when `interval` is `CUSTOM`. Duration in hours. |
| `due_date`      | string   | no       | `YYYY-MM-DD`. When the task is due. |
| `created_at`    | string   | yes      | ISO 8601 UTC. |
| `created_by`    | string   | yes      | Username. |
| `notes`         | string   | no       | Internal admin note. Free text. |

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

---

#### Completed Task Record File

**Location:** `Documents/IDMS/data/tasks/records/{year}/{equipmentCodeTop}-{year}.json`

One file per equipment code top-level prefix (first 3 digits of any asset code in the completed task) per year. `equipmentCodeTop` is the 3-digit code, e.g. `601`.

**Written by:** Console (on task completion via Due & Assigned tab or Manual Entry tab)  
**Read by:** Console (ingest cycle; All Tasks tab)

```json
{
  "schema_version": 1,
  "code_range": "601",
  "year": 2026,
  "records": [
    {
      "record_id":     "yyyyyyyy-yyyy-4yyy-zyyy-yyyyyyyyyyyy",
      "task_id":       "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "equipment_ids": ["601.001.001.001"],
      "title":         "Change main engine oil",
      "category":      "LUB",
      "completed_by":  "tploch",
      "completed_at":  "2026-05-01T08:30:00.000Z",
      "hours_spent":   2.5,
      "parts_used":    "20 USG Mobilgard 410 NC",
      "notes":         "Filter also replaced.",
      "follow_up":     null
    }
  ]
}
```

##### Completed record object fields

| Field           | Type     | Required | Notes |
|-----------------|----------|----------|-------|
| `record_id`     | string   | yes      | UUID v4. Generated at completion. Primary key. |
| `task_id`       | string   | no       | UUID of the parent task. `null` for Manual Entry completions (no pre-created task). |
| `equipment_ids` | string[] | yes      | Asset codes from the task or manual entry. |
| `title`         | string   | yes      | Work description. Copied from the task title or entered manually. |
| `category`      | string   | yes      | Category code from the parent task or manually selected. |
| `completed_by`  | string   | yes      | Username of the user who completed the work. |
| `completed_at`  | string   | yes      | ISO 8601 UTC. Timestamp of completion. |
| `hours_spent`   | number   | no       | Time spent on the job in hours. |
| `parts_used`    | string   | no       | Free text. Parts, lubricants, and materials consumed. |
| `notes`         | string   | no       | Work notes and observations. Free text. |
| `follow_up`     | string   | no       | Any follow-up action required. Free text. `null` if none. |

---

#### Active User State File

**Location:** `Documents/IDMS/data/tasks/active/{username}.json`

One file per console user. Records which tasks the user has moved to `in_progress` (started but not yet completed). Used by the Due & Assigned tab to show the current user's active task states without querying all task definition files.

**Written by:** Console (when user changes a task status to `in_progress`)  
**Read by:** Console (ingest cycle; Due & Assigned tab on load)

```json
{
  "schema_version": 1,
  "username": "tploch",
  "updated_at": "2026-04-28T14:00:00.000Z",
  "active": [
    {
      "task_id":    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "state":      "in_progress",
      "updated_at": "2026-04-28T14:00:00.000Z"
    }
  ]
}
```

##### Active state fields

| Field        | Type     | Required | Notes |
|--------------|----------|----------|-------|
| `task_id`    | string   | yes      | UUID matching a task in a definition file. |
| `state`      | string   | yes      | `in_progress`. Only active (non-terminal) states are stored here. |
| `updated_at` | string   | yes      | ISO 8601 UTC. When this state was last set. |

---

### Task status lifecycle

```
  open ──→ in_progress ──→ completed
    │                         ↑
    └─────────────────────────┘ (skip in_progress via Manual Entry)
    │
    └──→ cancelled
```

| Status        | Meaning |
|---------------|---------|
| `open`        | Task exists; not started. Visible in All Tasks and Due & Assigned. |
| `in_progress` | User has started but not completed. Stored in active state file. |
| `completed`   | Completion record written. If recurring, next instance created automatically. |
| `cancelled`   | Task closed without completion. No record written. |

When a recurring task is completed, the console:
1. Writes the completion record to the equipment record file.
2. Sets the task `status` to `completed` in the definition file.
3. Creates a new task object in the same definition file with `status: 'open'`, a new `task_id`, a new `due_date` computed from `completed_at + interval`, and all other fields copied from the completed task.
4. Displays a confirmation banner to the user showing the new due date before creating the next instance.

---

### SQLite Tables

All four tables are created via `CREATE TABLE IF NOT EXISTS` in the console startup sequence.

#### `tasks`

One row per task definition. Ingested from definition files; updated on every poll if the definition file has changed.

| Column          | Type    | Constraints  | Notes |
|-----------------|---------|--------------|-------|
| `task_id`       | TEXT    | PRIMARY KEY  | UUID v4. |
| `title`         | TEXT    | NOT NULL     | |
| `equipment_ids` | TEXT    | NOT NULL     | JSON array string. `["601.001.001.001"]` |
| `category`      | TEXT    | NOT NULL     | 3-letter category code. |
| `priority`      | TEXT    | NOT NULL DEFAULT 'Normal' | |
| `role`          | TEXT    | nullable     | |
| `assigned_to`   | TEXT    | nullable     | Username. |
| `description`   | TEXT    | nullable     | |
| `skill_tags`    | TEXT    | nullable     | JSON array string. |
| `status`        | TEXT    | NOT NULL DEFAULT 'open' | |
| `recurring`     | INTEGER | NOT NULL DEFAULT 0 | Boolean. |
| `interval`      | TEXT    | nullable     | |
| `interval_hours`| INTEGER | nullable     | |
| `due_date`      | TEXT    | nullable     | `YYYY-MM-DD`. |
| `created_at`    | TEXT    | NOT NULL     | ISO 8601 UTC. |
| `created_by`    | TEXT    | NOT NULL     | |
| `notes`         | TEXT    | nullable     | |
| `code_range`    | TEXT    | NOT NULL     | 3-digit equipment code prefix. |
| `year`          | INTEGER | NOT NULL     | Calendar year of the definition file. |
| `ingested_at`   | TEXT    | NOT NULL     | ISO 8601 UTC. |

#### `task_records`

One row per completed task record. Ingested from equipment record files; idempotent via `INSERT OR REPLACE`.

| Column          | Type    | Constraints  | Notes |
|-----------------|---------|--------------|-------|
| `record_id`     | TEXT    | PRIMARY KEY  | UUID v4. |
| `task_id`       | TEXT    | nullable     | `null` for standalone manual entries. |
| `equipment_ids` | TEXT    | NOT NULL     | JSON array string. |
| `title`         | TEXT    | NOT NULL     | |
| `category`      | TEXT    | NOT NULL     | |
| `completed_by`  | TEXT    | NOT NULL     | |
| `completed_at`  | TEXT    | NOT NULL     | ISO 8601 UTC. |
| `hours_spent`   | REAL    | nullable     | |
| `parts_used`    | TEXT    | nullable     | |
| `notes`         | TEXT    | nullable     | |
| `follow_up`     | TEXT    | nullable     | |
| `code_range`    | TEXT    | NOT NULL     | |
| `year`          | INTEGER | NOT NULL     | |
| `ingested_at`   | TEXT    | NOT NULL     | |

#### `task_active_state`

One row per (username, task_id) pair. Ingested from active state files on every poll.

| Column       | Type | Constraints                  | Notes |
|--------------|------|------------------------------|-------|
| `username`   | TEXT | NOT NULL, PRIMARY KEY (part) | |
| `task_id`    | TEXT | NOT NULL, PRIMARY KEY (part) | Composite PK with username. |
| `state`      | TEXT | NOT NULL                     | `in_progress`. |
| `updated_at` | TEXT | NOT NULL                     | ISO 8601 UTC. |
| `ingested_at`| TEXT | NOT NULL                     | |

#### `task_skill_tags`

Lookup table for known skill tags. Populated at ingest from tags encountered in task definitions.

| Column  | Type | Constraints  | Notes |
|---------|------|--------------|-------|
| `tag`   | TEXT | PRIMARY KEY  | Machine-readable key. E.g. `"lubrication"`. |
| `label` | TEXT | NOT NULL     | Human-readable display label. |

---

### IPC Handlers

| Handler | Direction | Description |
|---------|-----------|-------------|
| `db:ingestTasks` | renderer → main | Accepts `{ tasks[] }`. Inserts/replaces task rows. Returns `{ ok, upserted }`. |
| `db:ingestTaskRecords` | renderer → main | Accepts `{ records[] }`. Inserts/replaces record rows. Returns `{ ok, upserted }`. |
| `db:ingestActiveState` | renderer → main | Accepts `{ username, active[] }`. Replaces all active state rows for that user. Returns `{ ok }`. |
| `db:getTasks` | renderer → main | Accepts filter object (see below). Returns `{ rows, total }`. |
| `db:getTaskRecords` | renderer → main | Accepts filter object. Returns `{ rows, total }`. |
| `db:getActiveState` | renderer → main | No arguments. Returns all rows from `task_active_state`. |
| `db:completeTask` | renderer → main | Accepts `{ task_id, record }`. Sets `status='completed'` on the task (if task_id is non-null); inserts the record. Returns `{ ok, pending_next }` where `pending_next` is `true` if the task is recurring. |
| `db:confirmNextTask` | renderer → main | Accepts `{ task_id, next_task }`. Inserts the next recurring task instance. Returns `{ ok }`. |
| `db:getSkillTags` | renderer → main | No arguments. Returns all rows from `task_skill_tags`. |

#### `db:getTasks` filter object

| Field       | Type     | Notes |
|-------------|----------|-------|
| `status`    | string[] | Array of status values to include. Omit for all statuses. |
| `category`  | string   | Exact match on `category`. Omit for all. |
| `priority`  | string   | Exact match on `priority`. Omit for all. |
| `assigned_to` | string | Exact match on `assigned_to`. Omit for all. |
| `role`      | string   | Exact match on `role`. Omit for all. |
| `due_before`| string   | `YYYY-MM-DD`. Returns tasks where `due_date <= due_before`. |
| `search`    | string   | Substring search against `title`. |
| `limit`     | integer  | Page size. Default `50`. |
| `offset`    | integer  | Pagination offset. Default `0`. |

---

### graph.js helpers

```javascript
async function listTaskDefinitionFiles()                          // LIST data/tasks/definitions/
async function loadTaskDefinitionFile(filename)                   // GET  data/tasks/definitions/{filename}
async function saveTaskDefinitionFile(filename, data)             // PUT  data/tasks/definitions/{filename}
async function listTaskRecordFiles(year)                          // LIST data/tasks/records/{year}/
async function loadTaskEquipmentFile(year, filename)              // GET  data/tasks/records/{year}/{filename}
async function saveTaskEquipmentFile(year, filename, data)        // PUT  data/tasks/records/{year}/{filename}
async function listTaskActiveStateFiles()                         // LIST data/tasks/active/
async function loadTaskActiveStateFile(username)                  // GET  data/tasks/active/{username}.json
```

Definition filenames follow the pattern `tasks-{codeRange}-{year}.json`. Equipment record filenames follow `{equipmentCodeTop}-{year}.json`.

---

### Console UI behaviour

The Tasks & Maintenance screen (Operations → Tasks & Maintenance) is a four-tab screen using the standard `cs-tab-bar` / `cs-tab` pattern.

---

#### Tab 1 — All Tasks

Displays all tasks from SQLite with pagination and filtering.

**Filters:**

| Filter   | Type           | Notes |
|----------|----------------|-------|
| Status   | Select         | Options: Active (open + in_progress), All, Open, In Progress, Complete, Cancelled. Default: Active. |
| Category | Select         | All categories plus individual codes. Default: All. |
| Priority | Select         | All, Critical, High, Normal, Low. Default: All. |
| Search   | Text input     | Matches against `title`. |

**Results table columns:** Priority badge · Title · Equipment (asset tags) · Category · Due Date · Assigned · Status badge

Each row is expandable (click anywhere on the row) to reveal a detail panel showing `description`, `notes`, `skill_tags`, and a completion history pulled from `task_records`. Pagination: 20 rows per page.

---

#### Tab 2 — Due & Assigned

Displays open and in-progress tasks filtered to the current user's role and direct assignments. The tab refreshes active state from OneDrive every time it is opened (not just on first load) to reflect task status changes made on other sessions.

**Grouping:**

1. **Overdue** — tasks where `due_date < today`.
2. **Due Today** — tasks where `due_date = today`.
3. **Upcoming** — tasks where `due_date > today`, sorted ascending.
4. **Assigned to Me** — tasks with `assigned_to = current_username`, regardless of due date.

For each task, a **[Mark In Progress]** button sets `status = 'in_progress'` and writes to the active state file. A **[Complete]** button opens an inline completion form.

**Inline completion form fields:** Hours spent · Parts used · Notes · Follow-up (optional). Submitting writes the completion record to OneDrive and updates the task status in the definition file. For recurring tasks, a confirmation banner appears showing the new instance's due date before it is created.

---

#### Tab 3 — Create Task

Form for creating new task definitions. Admin or standard permission required.

**Fields:**

| Field         | Type           | Notes |
|---------------|----------------|-------|
| Title         | Text input     | Required. |
| Equipment     | Asset search + tag list | Multi-select. Type-ahead search against `assets.csv`. Selected assets shown as removable tags displaying code + name. |
| Category      | Select         | 9 options (see category reference above). |
| Priority      | Select         | Critical / High / Normal / Low. Default: Normal. |
| Role          | Text input     | Optional. Role label for assignment filtering. |
| Assigned To   | Text input     | Optional. Specific username. |
| Description   | Textarea       | Optional. Work instructions. |
| Skill Tags    | Multi-select dropdown | Optional. Tags from `task_skill_tags`. |
| Recurring     | Checkbox       | Enables interval fields when checked. |
| Interval      | Select         | Visible when Recurring is checked. |
| Interval Hours| Number input   | Visible when Interval is `CUSTOM`. |
| Due Date      | Date input     | Optional. |

On submit: generates a `task_id` (UUID), determines the `code_range` from the first equipment code, writes/updates the definition file on OneDrive, then ingests into SQLite.

---

#### Tab 4 — Manual Entry

Allows recording a completion without a pre-created task. Useful for ad-hoc work not covered by the task list.

**Fields:**

| Field        | Type           | Notes |
|--------------|----------------|-------|
| Title        | Text input     | Required. Work description. |
| Equipment    | Asset search + tag list | Multi-select. Same pattern as Create Task tab. |
| Category     | Select         | 9 options. |
| Date         | Date input     | Defaults to today. |
| Time         | Time input     | Defaults to current vessel local time. |
| Hours Spent  | Number input   | Optional. |
| Parts Used   | Text input     | Optional. |
| Notes        | Textarea       | Optional. |
| Follow-up    | Text input     | Optional. |

On submit: generates a `record_id` (UUID), sets `task_id = null`, writes the record to the equipment record file on OneDrive, then ingests into SQLite. No task status is modified.

---

## §32a — What `completed` means

**Status:** Settled and built, 2026-09-05. Two-step naming and the last gap closed, 2026-09-06.
**Console:** `src/main/main.js` (`closeTask`), `src/main/tm-push.js` (`recordPush`, `PUSHABLE`), `src/renderer/js/tasks.js`.
**PWA:** `index.html` — `ER_TASK_STATUSES`, `ER_TASK_UPDATE_STATUSES`, `submitErTaskCreate`.
**Console prose:** `IDMS-Console/docs/tm-write-path-roundtrip.md` §5a.

---

> **A job is *reported complete* when the work is done and captured in IDMS.
> It is *completed* when TM Master has it.**

`reported_complete` is an **active** status. `completed` and `cancelled` are the only terminal ones. A job that has been signed off but not yet pushed to TM Master therefore stays on Active Tasks and on the phone's task list — which is the honest answer, because as far as the company's system of record is concerned it is not finished.

### Who may write which status

| Writer | Writes | Notes |
|---|---|---|
| PWA — Update modal | active statuses only | `ER_TASK_UPDATE_STATUSES`. No terminal status, ever. Locked 2026-07-27. |
| PWA — Create form | `reported_complete` | The option's value *is* the status (2026-09-06). It writes the `task_records` row, which is what puts the job in the officer's queue. |
| Console — Update modal | active statuses + `cancelled` | `Close (Completed)` removed 2026-09-05: that modal writes no record. |
| Console — Report Complete / Task Creation form | `reported_complete` | Writes the `task_records` row. |
| Console — Manual Entry | `reported_complete` | Via `closeTask`, plus a definitions-file patch. |
| Console — TM Master push | `completed` | `recordPush` only. The single writer of the terminal state. |

The point of the table is that `completed` **cannot be reached by forgetting to push**. No status dropdown on either client offers it, and as of 2026-09-06 no form value on either client is spelled `completed` either — the last one was the PWA's close-out option, whose label had to explain that it did not mean completed.

### The two steps, and who takes them (2026-09-06)

| Where | Button | Who | What it does |
|---|---|---|---|
| Console — a live task row | **Report Complete** | the engineer who did the work | writes the record; task → `reported_complete` |
| Console — a crew report with no record yet | **Report Complete** | whoever writes it up | same form, same record |
| Console — a record still on `reported_complete` | **Push to TM Master…** | the reviewing officer | fills TM's Job done form; on approval → `completed` |
| PWA — Update modal | **Report Complete** | the crew member | status only; no record, so the officer still writes it up |
| PWA — Create form | **Report Complete** | the crew member | creates an already-done job *and* its record |

Both clients now use one phrase for the first step. Nothing anywhere finishes a job in one press, because there is no point at which one person both does the work and tells the PMS about it.

**The Console's list had to be corrected to show this.** `TASK_UNION_SQL` hardcoded `'completed'` on every `task_records` row, on the old assumption that a record *is* a finished job. Under two steps a record can be halfway — written, not pushed — and those rows were being filed in the archive, out of the active list and so out of sight of the officer who still had to push them. The union reads the status off the task behind the record now, falling back to `'completed'` for imported history, which has no task behind it at all. Pinned by the "unified status" section of `npm run test:tm-ingest`.

### The push queue

`PUSHABLE` draws records whose task is `reported_complete` **or** `completed`, plus records with no task at all (manual entries). The second is backlog: ten records carried `completed` from before this rule, and excluding them would strand them permanently — unreachable by the very thing that would correct their status. A task `cancelled` while its record sat in the queue is skipped.

Because a phone close-out now stores `reported_complete`, work reported from the PWA arrives in the officer's push queue instead of leaving the board looking already filed.

### The gap this section recorded, closed 2026-09-06

`taskSubmitCreate` in the Console's `tasks.js` wrote `status: 'completed'` while the option above it was labelled *"Close out — record the work (TM Master still to be told)"* — a label doing work the value contradicted. `closeTask` and `taskSubmitManualEntry` had been moved to `reported_complete`; that path had not. The option is gone rather than relabelled, on both clients, and `recordPush` is now the only writer of the terminal state anywhere in IDMS.

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

**Status:** SUPERSEDED by §41 Notes Hub *(v2.31, 2026-09-02)* — never built; do not build.

The Notes Hub absorbs this module's purpose so the vessel grows one messaging-shaped system, not two:

- **Department / vessel broadcast** → department-head-flagged **group alerts** on department-level notes (§41.7).
- **Threaded discussion** → **comments** on notes, open to any crew member, with photo attachments (§41.5).
- **Direct person-to-person messaging** → **dropped**. Assigning a note to someone (§41.6) covers the "this needs your attention" case; anything conversational happens in person or off-system.

The `data/messages/` folder is never created. The polling delivery model and the `active + aboard` notification proxy described here carry forward into the §41 alert rules.

---

## §35 — KSA Profiles

**Status:** SUPERSEDED by §43 Development Plan *(v2.41, 2026-09-07)* — never built; do not build.

This section predated the Console's KSA / Development screen and the decisions recorded in `IDMS-Console/docs/personnel-development.md`, which it contradicts on three points:

- **`supervisor_score` and per-skill `task_completions` are dropped.** Exposure is never proficiency; there is no per-person score anywhere in the system, by decision. Verified competence is the four-level sign-off ladder in the personnel journal, and nothing else.
- **`skill_id` against `skilltagsconfig.json` is dropped as the competency key.** The Vault's card ids (`KSA-*`, `SKG-*`, `SKD-*`) are the vocabulary, mirrored to `data/personnel/ksa-registry.json`. Task `skill_tags` stay as descriptive labels and never drive the plan.
- **Storage inside `crewconfig.json` is dropped.** Nothing personnel-development lands in the crew registry — explicit decision. The journal is `data/personnel/records/`.

What this section wanted — a per-member view of competence and what to do next — is §43.

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

The Factory Production module tracks daily midnight-MT production figures, capacity observations from factory equipment, and line section theoretical throughput. It is a 5-tab screen: **Overview**, **Today**, **Observations**, **OEE**, and **Setup**.

---

### 37.2 OneDrive file locations

All paths are relative to `Documents/IDMS/` (the `ONEDRIVE_BASE` constant in `graph.js`).

| File | Path | Description |
|------|------|-------------|
| Production state | `data/factory/production/production-state.json` | Trip-scoped daily MT entries |
| ~~Capacity log~~ | ~~`data/factory/production/capacity-{YYYY-MM-DD}.json`~~ | **LEGACY** — read-only. Observations now written to per-user log files. |
| Factory config | `config/factoryconfig.json` | Vessel config; `production` section (schema_version 2) |
| FMEA config | `config/fmeaconfig.json` | Vessel FMEA failure mode registry |

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
      "source":      "dpr",
      "fetched_at":  "2026-04-29T00:05:00Z",
      "notes":       "Trip ARA2607 Day 5"
    }
  ]
}
```

**Field notes:**
- `trip_number` — matches `trips.trip_number` in SQLite
- `source` — `"dpr"` (parsed from PDF in `Daily Production Reports/{YYYY}/`) | `"email"` (legacy, pre-v2.10) | `"manual"`
- `notes` — for `"dpr"` source, populated as `"Trip {tripNumber} Day {tripDay}"` extracted from the PDF
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
    "processing_start_time":   null,
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
| ~~`email_subject_filter`~~ | string | **DEPRECATED in v2.10.** Was used by the old Graph Mail API DPR fetch. The current flow uses Power Automate to filter by subject and drop PDFs into OneDrive. Field is retained in config for backward compatibility but ignored by the renderer. |
| ~~`email_source_address`~~ | string \| null | **DEPRECATED in v2.10.** Was used to point Graph Mail API requests at a shared mailbox. The current flow reads from the signed-in user's own OneDrive `Daily Production Reports/{YYYY}/` folder. Field is retained for backward compatibility but ignored. |
| `bottleneck_mt_per_day` | number \| null | Auto-calculated: minimum `theoretical_mt_per_day` across all enabled sections (null sections excluded). Written back on each Setup save. |
| `processing_start_time` | string (ISO 8601 UTC) \| null | The UTC datetime at which factory production began on the current trip. Set by an admin via the **Processing Start Time** `datetime-local` input in the Production Settings card. The input accepts vessel-local wall time; the console converts to UTC using the vessel timezone via `prodVesselLocalToUtc()` before storing. Used by Trip Analytics Tab 1 (Current Trip Calculations) to compute the production summary. |

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
  observed_rate    REAL,
  rate_unit        TEXT,
  operator         TEXT NOT NULL DEFAULT '',
  wind_speed_kt    REAL,
  sea_state_ft     REAL,
  notes            TEXT DEFAULT '',
  source           TEXT NOT NULL DEFAULT 'pwa',
  failure_mode_id  TEXT,
  oee_session_id   TEXT,
  source_user      TEXT,
  ingested_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cap_obs_date    ON capacity_observations(obs_date);
CREATE INDEX IF NOT EXISTS idx_cap_obs_section ON capacity_observations(section_id, obs_date);
CREATE INDEX IF NOT EXISTS idx_cap_obs_oee     ON capacity_observations(oee_session_id);
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
| `db:getCapacityObservations` | `{ obs_date?, section_id? }` | `capacity_observations[]`. Accepts additional optional filters: `source_user`, `source`, `oee_session_id`, `from_timestamp`, `to_timestamp`. |
| `db:saveProductionConfig` | `{ snapshot_date, trip_number?, config_json }` | `{ ok }` |
| `db:getLatestProductionConfig` | — | Most recent `production_config_snapshots` row, or null |
| `db:ingestObservationsFromLog` | `{ user, observations[] }` | `{ ok, count }` |
| `db:saveObservationsToLog` | `{ user, observations[] }` | `{ ok, count }` |
| `db:getOeeSessions` | `{ trip_number? }` | `oee_session[]` ordered by `session_start DESC` |
| `db:generateRosReportPdf` | `{ report_data }` | `{ ok, path }` |

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

// Observations & OEE
ingestObservationsFromLog: (payload) => ipcRenderer.invoke('db:ingestObservationsFromLog', payload),
saveObservationsToLog:     (payload) => ipcRenderer.invoke('db:saveObservationsToLog', payload),
getOeeSessions:            (opts)    => ipcRenderer.invoke('db:getOeeSessions', opts),
generateRosReportPdf:      (payload) => ipcRenderer.invoke('db:generateRosReportPdf', payload),
```

---

### 37.9 graph.js helpers

Added to `src/renderer/js/graph.js`:

| Function | Description |
|----------|-------------|
| `saveDeptConfig(deptKey, cfg)` | Writes `config/{deptKey}config.json` to OneDrive |
| `loadProductionState()` | Reads `data/factory/production/production-state.json` |
| `saveProductionState(state)` | Writes `production-state.json` |
| `loadCapacityLog(dateStr)` | Reads `capacity-{dateStr}.json` (legacy read) |
| `saveCapacityLog(dateStr, data)` | Writes `capacity-{dateStr}.json` (legacy; no longer used for new observations) |
| ~~`graphMailFetch(url)`~~ | **DEPRECATED in v2.10.** GET against any Graph API URL with Bearer auth. Was used by the old DPR email fetch; no longer called by any module. Retained in source for now but slated for removal. |
| `graphListFolder(folderPath)` | Lists items in a OneDrive folder. v2.10: `$select` widened to `id,name,lastModifiedDateTime,size`. Returns `[]` on 404. |
| `graphGetBinaryById(itemId)` | **NEW in v2.10.** Downloads a file's raw bytes by drive-item ID via `GET /me/drive/items/{itemId}/content`. Returns an `ArrayBuffer`. |
| `graphRenameItem(itemId, newName)` | **NEW in v2.10.** Renames a OneDrive item via `PATCH /me/drive/items/{itemId}` with body `{ "name": newName }`. Used by the DPR ingestion to standardize PDF filenames to `DPR-{YYYY-MM-DD}.pdf`. |
| `loadUserLogFile(username, dateStr)` | Reads `data/factory/logs/report-{dateStr}-{username}.json`. Returns null on 404. |
| `saveUserLogFile(username, dateStr, data)` | Writes `data/factory/logs/report-{dateStr}-{username}.json`. |
| `loadFmeaConfig()` | Reads `config/fmeaconfig.json`. Returns null on 404. |
| `saveFmeaConfig(cfg)` | Writes `config/fmeaconfig.json`. |

---

### 37.10 Ingest poller additions

`pollNow()` in `ingest.js` calls `pollProductionData(todayStr)` each cycle.

- Polls `production-state.json` → `db:ingestProductionState`
- Polls `capacity-{today}.json` → `db:ingestCapacityLog`
- On first poll after midnight (date change): also polls `capacity-{yesterday}.json`
- 404 responses silently skipped (file not yet created)

---

### 37.11 DPR ingestion (v2.10)

On the Overview tab, admin/standard users see a **Refresh DPR** panel (button label changed from "Fetch latest email" in v2.10).

#### 37.11.1 Architecture overview

The Microsoft Graph Mail API is **not used**. Instead, a Power Automate flow running under the signed-in user's M365 account watches the user's inbox for "Daily Production Report" emails and writes their PDF attachments to OneDrive. IDMS reads OneDrive via the existing `Files.ReadWrite` scope. This avoids requiring `Mail.Read*` scopes (which require admin consent in many tenants) and decouples IDMS from email delivery latency.

```
┌─────────────────┐   email arrives   ┌──────────────────┐   PDF attachment   ┌────────────────────────────┐
│ Inbox of signed-│─────────────────▶│  Power Automate  │─────────────────▶│ OneDrive: Daily Production │
│ in user account │                  │  flow (cloud)    │                  │ Reports/{YYYY}/{name}.pdf  │
└─────────────────┘                  └──────────────────┘                  └────────────────────────────┘
                                                                                         │
                                                                            list + sort  │
                                                                                         ▼
                                                                          ┌──────────────────────────┐
                                                                          │ IDMS Console (renderer): │
                                                                          │  graphListFolder         │
                                                                          │  graphGetBinaryById      │
                                                                          │  window.idms.pdf.parse   │
                                                                          │  parseDPRText            │
                                                                          │  graphRenameItem         │
                                                                          └──────────────────────────┘
```

#### 37.11.2 Power Automate flow

The flow runs in the signed-in user's M365 tenant at flow.microsoft.com. Required template: **"Save Office 365 email attachments to OneDrive for Business"** (or a custom flow with equivalent steps).

**Trigger:** *When a new email arrives (V3)* — Office 365 Outlook connector
- Subject Filter: `Daily Production Report`
- Include Attachments: `Yes`
- Only with attachments: `Yes`

**Action loop:** *Apply to each attachment* with an inner *Condition* on the attachment name containing `Araho Daily Production`, then *Create file* (OneDrive for Business connector):
- Folder Path: `Daily Production Reports/@{formatDateTime(utcNow(),'yyyy')}`
- File Name: `@{items('Apply_to_each_Attachment_on_the_email')?['name']}` (the original attachment filename — IDMS standardizes it on read)
- File Content: `@{items('Apply_to_each_Attachment_on_the_email')?['contentBytes']}`

The flow JSON is stored in the user's M365 environment, not in this repository.

#### 37.11.3 OneDrive folder layout (external to `Documents/IDMS/`)

```
OneDrive root/
└── Daily Production Reports/
    ├── 2025/
    │   └── (prior year archive)
    └── 2026/
        ├── Araho Daily Production (05-02).pdf   ← original purser-named file (transient)
        ├── DPR-2026-05-03.pdf                   ← after IDMS standardization
        └── DPR-2026-05-04.pdf
```

The folder is *outside* `Documents/IDMS/` because it serves as a long-term archive of source documents, not application state. IDMS treats it read-mostly: it lists, downloads, and renames; it does not delete.

#### 37.11.4 Renderer fetch flow (`production.js → fetchFromEmail`)

The function is still named `fetchFromEmail` for git diff stability, but no longer touches email APIs.

1. List `Daily Production Reports/{currentYear}` via `graphListFolder` (returns items with `id`, `name`, `lastModifiedDateTime`, `size`).
2. Empty folder → state `notfound`.
3. Sort by `lastModifiedDateTime` descending; take `files[0]`.
4. `graphGetBinaryById(latest.id)` → `ArrayBuffer`.
5. `window.idms.pdf.parse(buffer)` → `{ ok, text }` via the `pdf:parse` IPC handler in main.js.
6. `parseDPRText(text)` extracts structured fields (see §37.11.6).
7. Compute `isoDate` from `latest.lastModifiedDateTime` (UTC). The midnight DPR is dated the previous day inside the PDF, so the file's modification date is the canonical "report-as-of" date.
8. If `latest.name !== "DPR-{isoDate}.pdf"`, fire-and-forget `graphRenameItem` to standardize. Failures log to console only.
9. Compare `isoDate` to `prodLocalDateStr(PROD.timezone)` — if different, set `isToday: false` so the UI shows a "Today's report not available" notice.
10. Populate `PROD.emailResult` and re-render the panel.

#### 37.11.5 Pure-Node PDF text extractor (`main.js`)

`pdf-parse` (and its dependency `pdfjs-dist`) is broken in Electron's main process: `pdfjs-dist` requires `DOMMatrix`, `ImageData`, `Path2D`, and `process.getBuiltinModule` (Node ≥22.3). Even with all globals patched, the export resolves as a non-callable, so the package was abandoned in v2.10.

The replacement is a pure-Node extractor in `src/main/main.js`:

| Function | Purpose |
|----------|---------|
| `extractPdfText(buffer)` | Top-level: walks the PDF byte-by-byte finding `stream`/`endstream` blocks, FlateDecode-inflates them with Node's built-in `zlib`, and accumulates lines. |
| `extractTextFromContentStream(content, out)` | Finds `BT`/`ET` text-block pairs and feeds each to `collectStringsFromBlock`. |
| `collectStringsFromBlock(block)` | Parses balanced `(...)` strings (handling escaped parens/backslashes) and `[...]` array operators (`Tj` / `TJ`). |
| `unescapePdfString(s)` | Decodes PDF string escapes (octal, `\n`, `\r`, `\t`, `\b`, `\f`, escaped parens/backslashes). |

The handler is registered as `ipcMain.handle('pdf:parse', ...)` and exposed to the renderer via `preload.js` as `window.idms.pdf.parse(buffer)`. Returns `{ ok: true, text }` or `{ ok: false, error }`.

This extractor is sufficient for text-based PDFs whose content streams use `Tj`/`TJ` with `(...)` literal strings (the format produced by Crystal Reports, Word, Excel, and most ERP systems). It will not handle hex strings (`<48656C>` Tj), CMap-mapped fonts, or scanned/image PDFs — none of which apply to the DPR.

#### 37.11.6 `parseDPRText(text)` (in `production.js`)

Extracts a structured object from the PDF text. Regex patterns:

| Field | Pattern |
|-------|---------|
| `tripNumber` | `/Trip Number:\s*(\S+)/` |
| `tripDay` | `/Trip Day:\s*(\d+)/` |
| `area` | `/Area:\s*(\d+)/` |
| `weather` | `/Weather:\s*(.+?)(?=\s+Date:)/` |
| `date` (PDF internal — *not* used as canonical) | `/Date:\s*([\d\/]+)/` |
| `dailyTotalCases`, `dailyTotalMT` | `/Daily Total:\s*([\d,]+)\s*\/\s*([\d.]+)/` |
| `tripTotalCases`, `tripTotalMT` | `/Trip Total:\s*([\d,]+)\s*\/\s*([\d.]+)/` |
| Species header line | `/^(\d{3}-\d{2}-\w{2,3})\s+(.+)$/` |
| Per-grade row | `/^([\d.]+)\s+([\d.]+)\s+(\S+)\s+([\d,]+)\s+([\d.]+)\s+(\d+)%\s+([\d,]+)\s+([\d.]+)\s+(\d+)%$/` |
| Species TOTAL row | `/^([\d.]+)\s+TOTAL\s+([\d,]+)\s+([\d.]+)\s+(\d+)%\s+([\d,]+)\s+([\d.]+)\s+(\d+)%$/` |

Returned shape:

```js
{
  tripNumber: "ARA2607",
  tripDay: 5,
  area: 543,
  weather: "15 kts",
  date: "5/2/2026",                  // PDF internal — informational only
  dailyTotalCases: 4227,
  dailyTotalMT: 80.3130,
  tripTotalCases: 17219,
  tripTotalMT: 327.1610,
  species: [
    {
      processCode: "110-08-G1",
      name: "Pacific Cod - J-Cut #1",
      grades: [
        { pack: 19.0, avgGross: 20.380, size: "3L", dailyCases: 83, dailyMT: 1.5770, dailyPct: 53, tripCases: 247, tripMT: 4.6930, tripPct: 43 },
        ...
      ],
      total: { avgGross: 20.356, dailyCases: 156, dailyMT: 2.9640, dailyPct: 4, tripCases: 571, tripMT: 10.8490, tripPct: 3 }
    },
    ...
  ]
}
```

#### 37.11.7 `PROD.emailResult` shape (post-parse)

```js
{
  date:        "2026-05-03",          // file modification date (UTC), the canonical DPR-as-of date
  isToday:     true,                   // false if file mod date != today (in PROD.timezone)
  midnight_mt: 80.3130,                // alias for dailyTotalMT, retained for save-path compatibility
  dailyCases:  4227,
  tripMT:      327.1610,
  tripCases:   17219,
  tripNumber:  "ARA2607",
  tripDay:     5,
  area:        543,                    // fishing area — passed through from parseDPRText
  weather:     "15 kts",              // weather string — passed through from parseDPRText
  species:     [ ... ]                 // full structured array from parseDPRText
}
```

#### 37.11.8 State machine

`idle` → `fetching` → `found` | `notfound` | `error` → (on save) `saving` → `idle`

**`found` rendering** (Overview panel):

Header rows:
- If `!isToday`: yellow notice — `Today's report not available. Showing {date}.`
- Report Date: `{date}`
- Trip: `{tripNumber} — Day {tripDay}`
- Area: `{area}`
- Weather: `{weather}`
- Daily Total: `{midnight_mt.toFixed(2)} MT ({dailyCases.toLocaleString()} cases)` — bolded
- Trip Total: `{tripMT.toFixed(2)} MT ({tripCases.toLocaleString()} cases)`

Species breakdown (computed from `emailResult.species`):

Rank species by `total.dailyPct` descending. Render the top 3 with their size distribution. Label: `#1`, `#2`, `#3`.

For each ranked species:
- **Species line:** `#{rank}  {name}  ({total.dailyPct}%)`
- **Size line:** Take the species' `grades[]`, filter to those with `dailyPct > 0`, sort by `dailyPct` descending and take the top 4 (the "central" sizes — tail grades near 0% are dropped). Re-sort that top-4 subset by canonical size order (largest → smallest: XL, 3L, 2L, L, M, S, XS) for left-to-right display. Render as a pipe-separated row:

  ```
  3L  25%  |  2L  39%  |  L  25%  |  M  12%
  ```

  The highest `dailyPct` value among the displayed grades is **bolded** (or highlighted) as a quick visual reference.

- Buttons: *Save to trip log* / *Cancel*

**Error / not-found cases:**
- Empty folder for current year: state `notfound` → "No matching email found for today." (panel string retained from v2.9; covers both no-flow-yet and no-DPR-this-year).
- PDF parse failure (no Date or Daily Total match): state `error` → message `"Could not parse DPR content."`.
- Network / Graph errors: state `error` → exception message verbatim.

#### 37.11.9 Save path

Unchanged from v2.9 except `source` value:

1. Load `production-state.json` (or initialize empty).
2. Find or append entry for `r.date` (which is now the file modification date).
3. Write entry: `{ entry_date, midnight_mt, source: "dpr", fetched_at, notes: "Trip {tripNumber} Day {tripDay}" }`.
4. `saveProductionState(state)` → OneDrive.
5. `db:ingestProductionState` → SQLite.
6. Refresh local `PROD.entries` and re-render screen.

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
- **PWA observation overlay:** PWA-sourced observations for the current date are plotted as an additive overlay on the canvas chart. Rate observations appear as orange filled circles at the correct time/rate position. Qualitative observations (no rate) appear as orange diamonds at the x-axis. Hover tooltip shows: `[PWA] {section_label} — {observed_rate} {rate_unit} — {operator} — {time}`. Legend entry: `● PWA Observation`.

**Tab: Today**
- Canvas 24-hour chart: orange background bars = theoretical ceiling per hour; blue dots = observed rates per hour bucket; solid green dashed line = daily average; orange dashed line = bottleneck/24
- Observation list below chart

**Tab: Observations**
- Filter bar: section dropdown, date-from, date-to, source dropdown, user dropdown, clear button
- Table: date, time, section, rate, unit, source user, notes
- Source badges: `[PWA]` (amber) for `source: "pwa"`, `[OEE]` (blue) for `source: "oee"`, no badge for `source: "manual"`.
- When source filter = OEE, rows are grouped by `oee_session_id` with a collapsible session header.
- `source_user` column shows the submitting user's display name.
- Add Observation form (admin/standard only): section, rate (optional), unit, timestamp, wind, sea state, notes
- Submitting: uses `appendObservationsToLogFile` pattern (OneDrive read → merge → write to per-user log file) rather than writing to legacy capacity files.

**Tab: OEE**
- Batch observation entry interface for structured reliability observation studies. Users add observation rows (time, section, asset code, FMEA failure mode, rate, notes) in a dynamic table, then submit as a named session. All rows in a session share a `oee_session_id` UUID generated at submit time and immutable thereafter. Submitted sessions are listed in a session panel; selecting a session shows its observations read-only with a "Generate Report for this Session" shortcut. See §39 for full documentation.

**Report generator**
- Modal accessible from the OEE tab. Accepts a time window (from/to datetime), source filter, section filter, and incident inclusion toggle. Generates from `capacity_observations` and resolved incidents within the window. Console view includes: header block, summary stat strip, timeline (coloured markers by source, incident span bars), observations table, incidents table, section summary table with utilisation %. PDF export via puppeteer (main process only — never import puppeteer in renderer). See §39 for full documentation.

**Tab: Setup**
- Collapsible cards: Production Settings, Email Settings, Line Sections (one card per section)
- **Production Settings card:** Target Species dropdown (auto-populates Species Baseline Avg MT/day from historical logs on selection), Trip Capacity, Species Baseline Avg MT/day (editable override), **Processing Start Time** (`datetime-local` input accepting vessel-local wall time; stored as UTC in `factoryconfig.json → production.processing_start_time`; admin-only edit, read-only display for non-admins), global Pan Specification block (Pan Volume, Gross Weight, Target Overpack %; derived Density and Net Weight displayed read-only)
- **Line section card:** shows section type badge, current theoretical MT/day, Group / Sub-group asset scope selectors, sub-asset list with inline add/remove
- **Sub-asset row fields:** label, asset code autocomplete, Arrangement dropdown (Series / Parallel / Series_Parallel), Order, Sub-order (visible for series_parallel only), Ranking (visible for series_parallel only), **ISO 14224 Equipment Class dropdown** (validated list — feeds the FMEA modal as a default; see §38), plus type-specific fields (see §37.5.3)
- Save button writes `factoryconfig.json` to OneDrive, recalculates theoretical MT and bottleneck, saves config snapshot to SQLite
- Bottleneck indicator: displays limiting section label and MT/day value
- All writes are admin-only; standard/observer see read-only view

**Tab: FMEA** — see §38. Sourced from `fmeaconfig.json`; failure-mode registry is scoped to factory line sections only. FMEA card is read-only for operational data — it is an analytics view, not a data entry point.

**Throughput-section MT/day calculation (revised v2.7).** For sections of `type: "throughput"`, MT/day is no longer the sum of all sub-asset throughputs. Sub-assets are grouped by `order` (each distinct `order` is a series stage); within a stage their capacities sum (parallel redundancy); across stages the section is bottlenecked by the slowest stage. Sub-assets with no `order` and `arrangement: "parallel"` share an implicit single stage; series sub-assets without `order` each become their own stage.

**Error guards:**
- If `factoryconfig.production` is absent: display "not configured" banner
- If 403 on mail API: display specific "Access denied" message
- Null `bottleneck_mt_per_day`: display `—`
- Null `theoretical_mt_per_day` for header/belt/packing sections: display `—`, excluded from bottleneck calculation
- Autocomplete dropdowns: `position: absolute` — ancestor elements must not carry `overflow: hidden` (would clip the dropdown regardless of z-index)

---

## §38 — FMEA Module

**Status:** Built (v2.7)
**File:** `src/renderer/js/production.js` (FMEA card embedded in Factory Production Setup tab)
**Screen key:** `factory-production` (Setup tab)
**Nav group:** Factory
**Permission gate:** `factory/production` — admin for writes, standard/observer read-only

---

### 38.1 Overview

Level 2 Failure Mode and Effects Analysis scoped to the **factory production line only**. Not vessel-wide. The feature does not generate tasks, integrate with TM-Master, or touch any module outside Factory Production.

Each failure mode carries Severity (S), Occurrence (O), and Detection (D) ratings on the standard 1–10 scale; RPN = S × O × D. Severity and Detection are manually rated by the Chief Engineer / admin. **Occurrence is empirical** — computed from the frequency at which each mode is tagged on resolved factory incidents and completed maintenance records over a rolling window of the last N trips (default N = 5; configurable per vessel).

The registry source-of-truth is `fmeaconfig.json` on OneDrive. SQLite mirrors the registry plus a derived `fmea_occurrence_events` table built from log files by the ingest poller. RPN and Occurrence are recomputed live at query time; values written into `fmeaconfig.json` are denormalised snapshots only. FMEA card is read-only for operational data — it is an analytics view, not a data entry point.

ISO 14224 hybrid taxonomy: vessel-specific labels with optional ISO equipment class and failure codes. No hard deletes — use `enabled = 0`. Graceful degradation: if `fmeaconfig.json` is absent, FMEA tab renders empty state with an "Initialise FMEA Registry" button.

---

### 38.2 OneDrive file location

`Documents/IDMS/config/fmeaconfig.json` — independent per vessel, admin-only for writes. The PWA reads it (cached as `fw_fmeacfg`) for the failure-mode dropdown on incident resolve; the PWA never writes it.

---

### 38.3 fmeaconfig.json

**Location:** `Documents/IDMS/config/fmeaconfig.json`

**Access:** Admin-only for writes. Standard / Observer tiers see the FMEA tab read-only. The PWA reads it (cached as `fw_fmeacfg`) for the failure-mode dropdown on incident resolve; the PWA never writes it.

```json
{
  "schema_version": 1,
  "vessel": "F/V Araho",
  "occurrence_window_trips": 5,
  "failure_modes": [
    {
      "mode_id": "uuid-v4",
      "section_id": "3e4a5f6b-7c8d-4e0f-a1b2-000000000001",
      "section_label": "Plate Freezers",
      "asset_code": "310.001.001.001",
      "label": "Hydraulic seal leak",
      "effects": "Freezer pressure loss; section throughput reduced or halted.",
      "current_controls": "Daily visual inspection during rounds.",
      "severity": 7,
      "occurrence": null,
      "detection": 5,
      "rpn": null,
      "occurrence_override": null,
      "occurrence_override_note": "",
      "avg_duration_seconds": null,
      "avg_mt_impact_per_event": null,
      "iso14224_equipment_class": "HE",
      "iso14224_failure_code": "ELP",
      "enabled": true,
      "created_at": "2026-04-30T10:00:00.000Z",
      "updated_at": "2026-04-30T10:00:00.000Z"
    }
  ],
  "changelog": [
    { "version": 1, "date": "2026-04-30", "note": "Initial FMEA registry." }
  ],
  "last_saved_at": "2026-05-01T18:42:00.000Z"
}
```

#### Top-level fields

| Field | Type | Notes |
|-------|------|-------|
| `schema_version` | integer | Increment when the structure changes. Currently `1`. |
| `vessel` | string | Vessel display name. |
| `occurrence_window_trips` | integer | Number of most-recent trips used for Occurrence calculation. Default `5`. Configurable per vessel. |
| `failure_modes` | array | All failure-mode entries for this vessel's production line. |
| `changelog` | array | Free-form change history for the registry. |
| `last_saved_at` | string | ISO 8601 UTC timestamp of the last save. Written by the console on save. |

#### Failure-mode object fields

| Field | Type | Notes |
|-------|------|-------|
| `mode_id` | string (UUID v4) | Stable identifier. Generated by the console; never changes once created. |
| `section_id` | string (UUID) | References a `section_id` in `factoryconfig.json → production.line_sections`. Must match one of the 7 pre-configured Araho UUIDs. |
| `section_label` | string | Denormalised label for display without joining to factoryconfig. |
| `asset_code` | string \| null | Asset register code. Primary linkage between failure modes, incident logs, and maintenance records. May be null when the mode applies to the section as a whole rather than a specific asset. |
| `label` | string | Human-readable failure-mode name. Vessel-specific. Max 100 chars. E.g. `"Hydraulic seal leak"`. |
| `effects` | string | Description of what happens when the mode occurs. Free text. |
| `current_controls` | string | Existing detection / prevention controls. Free text. |
| `severity` | integer \| null | Manual rating 1–10. |
| `occurrence` | integer \| null | **Computed, not authoritative.** Derived from incident + maintenance event frequency over `occurrence_window_trips`. Written to this field on each save for reference but always recomputed fresh from SQLite when displayed. |
| `detection` | integer \| null | Manual rating 1–10. |
| `rpn` | integer \| null | Computed: `severity × occurrence × detection`. Null if any input is null. Written on save only. |
| `occurrence_override` | integer \| null | If non-null, this value is used as Occurrence instead of the computed value. Admin only. |
| `occurrence_override_note` | string | Required when `occurrence_override` is set. Documents why the override was applied. |
| `avg_duration_seconds` | number \| null | **Computed, not authoritative.** Average duration of tagged incidents over the occurrence window. Written on save; always recomputed at query time. Null for modes with no events or when no duration data is available. |
| `avg_mt_impact_per_event` | number \| null | **Computed, not authoritative.** `avg_duration_seconds / 86400 × theoretical_mt_per_day`. Null for header/belt/packing sections (no formula) or when avg_duration_seconds is null. Written on save. |
| `iso14224_equipment_class` | string \| null | ISO 14224 equipment class code (validated dropdown — see §38.9). |
| `iso14224_failure_code` | string \| null | ISO 14224 failure mode code (validated dropdown — see §38.9). |
| `enabled` | boolean | If false, mode is excluded from RPN rankings and Occurrence calculations. Disabled (soft-deleted) modes are retained in the file. |
| `created_at` | string | ISO 8601 UTC. |
| `updated_at` | string | ISO 8601 UTC. Updated on every save. |

---

### 38.4 SQLite tables

```sql
CREATE TABLE IF NOT EXISTS fmea_failure_modes (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  mode_id                  TEXT NOT NULL UNIQUE,
  section_id               TEXT NOT NULL,
  section_label            TEXT NOT NULL,
  asset_code               TEXT,
  label                    TEXT NOT NULL,
  effects                  TEXT NOT NULL DEFAULT '',
  current_controls         TEXT NOT NULL DEFAULT '',
  severity                 INTEGER,
  detection                INTEGER,
  occurrence_override      INTEGER,
  occurrence_override_note TEXT NOT NULL DEFAULT '',
  avg_duration_seconds     REAL,
  avg_mt_impact_per_event  REAL,
  iso14224_equipment_class TEXT,
  iso14224_failure_code    TEXT,
  enabled                  INTEGER NOT NULL DEFAULT 1,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  ingested_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fmea_modes_section  ON fmea_failure_modes(section_id);
CREATE INDEX IF NOT EXISTS idx_fmea_modes_asset    ON fmea_failure_modes(asset_code);

CREATE TABLE IF NOT EXISTS fmea_occurrence_events (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id                 TEXT NOT NULL UNIQUE,
  source                   TEXT NOT NULL,    -- 'incident' | 'maintenance'
  mode_id                  TEXT,
  asset_code               TEXT,
  failure_mode_other_notes TEXT NOT NULL DEFAULT '',
  duration_seconds         REAL,
  trip_number              INTEGER,
  event_date               TEXT NOT NULL,    -- YYYY-MM-DD
  ingested_at              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fmea_events_mode   ON fmea_occurrence_events(mode_id);
CREATE INDEX IF NOT EXISTS idx_fmea_events_asset  ON fmea_occurrence_events(asset_code);
CREATE INDEX IF NOT EXISTS idx_fmea_events_trip   ON fmea_occurrence_events(trip_number);

CREATE TABLE IF NOT EXISTS fmea_config_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  trip_number   INTEGER,
  config_json   TEXT NOT NULL,
  saved_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`occurrence` and `rpn` are **never stored** in `fmea_failure_modes` — they are always computed at query time. The values stored in `fmeaconfig.json` are denormalised snapshots for reference only.

**`fmea_occurrence_events.event_id` derivation:**

| Source | Pattern |
|--------|---------|
| Resolved incident | `{log_filename}:{incident_id}` |
| Completed maintenance record | `{task_id}:{completed_at}` |

Used as the upsert key — re-ingestion of the same source row updates the existing event.

### 38.5 IPC handlers (main process)

All handlers are synchronous (`better-sqlite3`).

| Handler | Payload | Returns |
|---------|---------|---------|
| `db:ingestFmeaConfig` | `{ failure_modes[] }` | `{ ok, count }` |
| `db:saveFmeaConfigSnapshot` | `{ snapshot_date, trip_number?, config_json }` | `{ ok }` |
| `db:getFmeaFailureModes` | `{ section_id? }` | array of rows from `fmea_failure_modes` where `enabled = 1`, ordered by `section_id ASC, label ASC` |
| `db:getFmeaOccurrence` | `{ mode_id, window_trips?, theoretical_mt_per_day? }` | `{ occurrence_rating, raw_count, window_trips, trips_with_data, avg_duration_seconds, avg_mt_impact }` |
| `db:ingestFmeaOccurrenceEvents` | `{ events[] }` — each event may include `duration_seconds` | `{ ok, count }` |
| `db:getFmeaRpnSummary` | `{ section_id?, section_theoretical_rates? }` where `section_theoretical_rates` is `{ [section_id]: mt_per_day }` | array of `{ mode_id, section_id, section_label, label, asset_code, severity, occurrence, detection, rpn, raw_count, window_trips, trips_with_data, occurrence_override, occurrence_override_note, avg_duration_seconds, avg_mt_impact, iso14224_equipment_class, iso14224_failure_code, effects, current_controls }` sorted by RPN desc |
| `db:upsertFmeaFailureMode` | failure-mode object (without `mode_id` for new entries) | `{ ok, mode_id }` — generates a UUID v4 if absent |

**Behaviour notes:**
- `db:ingestFmeaConfig` upserts on `mode_id`. **Does not delete** rows absent from the payload — soft-removal is via `enabled = 0`.
- `db:ingestFmeaOccurrenceEvents` looks up `trip_number` from the `trips` table by `event_date` if not supplied on the payload.
- Occurrence computation uses the relative-decile algorithm with a fixed-scale fallback when fewer than 3 modes have any events (see §38.9).
- **CRITICAL — `db:upsertFmeaFailureMode`:** this handler writes registry configuration only (label, effects, severity, detection, etc.). It **never** writes to `fmea_occurrence_events`. Occurrence events are ingested exclusively via `db:ingestFmeaOccurrenceEvents`.
- `theoretical_mt_per_day` for `db:getFmeaOccurrence` and `section_theoretical_rates` for `db:getFmeaRpnSummary` are **passed from the renderer** using `factoryconfig.production.line_sections` values. The handler never looks them up internally.

---

### 38.6 preload.js bindings

Exposed under `window.idms.db`:

```javascript
ingestFmeaConfig:           (payload) => ipcRenderer.invoke('db:ingestFmeaConfig', payload),
saveFmeaConfigSnapshot:     (payload) => ipcRenderer.invoke('db:saveFmeaConfigSnapshot', payload),
getFmeaFailureModes:        (opts)    => ipcRenderer.invoke('db:getFmeaFailureModes', opts),
getFmeaOccurrence:          (opts)    => ipcRenderer.invoke('db:getFmeaOccurrence', opts),
ingestFmeaOccurrenceEvents: (payload) => ipcRenderer.invoke('db:ingestFmeaOccurrenceEvents', payload),
getFmeaRpnSummary:          (opts)    => ipcRenderer.invoke('db:getFmeaRpnSummary', opts),
upsertFmeaFailureMode:      (payload) => ipcRenderer.invoke('db:upsertFmeaFailureMode', payload),
```

---

### 38.7 graph.js helpers

| Function | Description |
|----------|-------------|
| `loadFmeaConfig()` | Reads `config/fmeaconfig.json` from OneDrive. Returns parsed object or null on 404. |
| `saveFmeaConfig(cfg)` | Writes `config/fmeaconfig.json` to OneDrive. |

---

### 38.8 Ingest poller additions

`pollFmeaOccurrenceEvents()` runs as a separate pass during each `pollNow()` cycle in `ingest.js`, after the production data poll. Independent of the existing factory incident ingest (does not modify it).

1. Call `loadFmeaConfig()`. If null (file absent or fetch error), skip silently.
2. Build an `asset_code → mode_id` map from the loaded config (enabled modes only) for maintenance fallback lookup.
3. **Pass 1 — factory incident logs.** Scan today's factory log files (using `listLogFilesForDate('factory', date)` + `loadLogFile` helpers). For each resolved incident where `failure_mode_id` is non-null, build an event row. `"other"` selections are recorded with `mode_id = null` and `failure_mode_other_notes` preserved. Untagged incidents are skipped.
   - **Duration normalisation:** `duration_seconds = inc.duration_seconds ?? inc.duration ?? null`
4. **Pass 2 — completed maintenance records.** Scan the current year's task record files. For each completed record where `equipment_ids` contains a code present in the asset→mode map, build an event with `source = "maintenance"`. When no `failure_mode_id` is present, `category + title` are concatenated into `failure_mode_other_notes`.
5. Upsert all events via `db:ingestFmeaOccurrenceEvents`. The handler derives `trip_number` from the `trips` table by `event_date` when not supplied.

---

### 38.9 Occurrence scale algorithm

The Occurrence rating uses a **relative scale** — each mode's raw event count is ranked against all other enabled failure modes on the same vessel over the same window.

1. Compute raw event counts for all enabled modes over the last N trips.
2. Rank by count (ascending). Assign ratings 1–10 by percentile bucket:
   - 0 events → `1` (always, regardless of percentile).
   - Top 10% by count → `10`.
   - Bottom decile (excluding 0-event modes) → `2`.
   - Linear interpolation across deciles 2–9 for the rest.
3. **Fixed-scale fallback** when fewer than 3 modes have any events:
   - 0 events → `1`
   - 1 event → `3`
   - 2–3 events → `5`
   - 4–6 events → `7`
   - 7+ events → `9`

   This prevents a single event making a mode appear as "10" by percentile alone in a sparse dataset.
4. If `occurrence_override` is set for a mode, the override value is returned directly — no computation.

Occurrence ratings shift between trips as the window slides; this is by design. Confidence indicators:
- `trips_with_data < 2`: grey `(low data)` tag — "Fewer than 2 trips have occurrence data. This rating may not be stable."
- `raw_count = 0`: display `O: 1` with dash indicator — no badge, no count shown.
- `occurrence_override` set: display override value in amber with lock icon; tooltip shows override note.
- Otherwise: rating followed by `(n=X, NT)` where N = raw count and T = window size in trips.

**ISO 14224 reference codes** — fixed validated dropdown (subset of ISO 14224). Equipment classes: CE, COM, CR, EL, HE, HYD, INS, PI, PU, REF, TUR, VAL, VES, CON, FRZ, SEP, FIL. Failure codes: AIR, BRD, ELP, ELU, ERO, FCO, FOF, FOD, HIO, INL, LOO, NOI, OHE, PDE, PLU, SER, STD, UST, VIB, CON, LCP, OTH. Each option rendered as `{code} — {full designation}`; stored value is code only.

---

### 38.10 Avg duration and MT impact

`db:getFmeaOccurrence` and `db:getFmeaRpnSummary` compute average event duration and production impact alongside occurrence ratings.

**avg_duration_seconds** — mean of `duration_seconds` across all occurrence events for the mode within the window, excluding null values. Null if no events have duration data.

**avg_mt_impact** formula (for `plate_freezer` and `throughput` sections):
```
avg_mt_impact = avg_duration_seconds / 86400 × theoretical_mt_per_day
```
Null for `header`, `belt`, and `packing` sections (no theoretical MT formula). Also null if `avg_duration_seconds` is null or `theoretical_mt_per_day` is null.

**`theoretical_mt_per_day` is always passed from the renderer** — it is read from `factoryconfig.production.line_sections` by `production.js` and passed in the IPC payload. The IPC handler never looks it up independently. The renderer builds `section_theoretical_rates: { [section_id]: theoretical_mt_per_day }` from the loaded factory config before calling `db:getFmeaRpnSummary`.

On "Save FMEA Config", the console fetches `avg_duration_seconds` and `avg_mt_impact_per_event` for each mode from the current SQLite state and writes them as denormalised snapshots into `fmeaconfig.json` failure mode objects. They are always recomputed at display time.

---

### 38.11 UI behaviour

**FMEA tab** (Factory Production module: Overview · Today · Observations · OEE · **FMEA** · Setup)

- **Section filter bar** — dropdown filtering by line section (default "All sections"); `+ Add failure mode` button (admin only) opens the modal.
- **Failure-mode table columns:** Section · Asset Code · Label · Effects (truncated) · S · O · D · RPN · Avg Duration · Avg MT Impact · ISO Class · ISO Code · Actions (admin only).
- **O column** — computed Occurrence with grey badge `(n=X, NT)`. Override: amber value with lock icon and override note tooltip.
- **RPN column** — ≥ 200 red, 100–199 amber, < 100 green, null grey dash.
- **Avg Duration** — formatted as `Xh Ym` or `Ym Zs`. Null displays as `—`.
- **Avg MT Impact** — formatted as `X.X MT`. Null displays as `—`. Tooltip shows formula inputs.
- **Actions:** edit (pencil) opens modal; eye icon toggles enabled/disabled with confirmation. No hard delete.
- **Stat strip** (below table): Highest RPN mode (label + value), count of modes with RPN ≥ 200, current window in trips.
- **Save FMEA Config button** (admin only): rebuilds `fmeaconfig.json` from SQLite (including `avg_duration_seconds` and `avg_mt_impact_per_event`), writes to OneDrive, saves snapshot, re-ingests, refreshes table.

**Add / Edit modal fields:** Section (required), Asset (filtered to selected section's sub-assets), Label (required, max 100 chars), Effects, Current controls, Severity 1–10 (required), Detection 1–10 (required), ISO 14224 Equipment Class, ISO 14224 Failure Code, Occurrence override (admin only), Override note (required when override set), Enabled toggle.

Modal saves go through `db:upsertFmeaFailureMode` immediately. **OneDrive is only written on the explicit "Save FMEA Config" action.**

**Overview tab** — read-only **FMEA — Top Risks** widget: top 5 modes by RPN with S/O/D/RPN, header chip showing total mode count and count ≥ 200. Empty state links to FMEA tab.

**PWA (factory only)** — `fmeaconfig.json` cached as `fw_fmeacfg`. On incident resolve, failure-mode dropdown appears (filtered by equipment `asset_code`; falls back to all enabled modes for the section). Always includes `Other / unsure`. Selecting `Other / unsure` reveals a required brief description field. `failure_mode_id` and `failure_mode_other_notes` written into the resolved incident object (§11). If `fmeaconfig.json` is unavailable, dropdown is skipped — incident resolution must never be blocked by FMEA unavailability.

---

## §39 — Overall Equipment Effectiveness (OEE)

**Status:** Built (v2.8)
**File:** `src/renderer/js/production.js` (OEE tab embedded in Factory Production)
**Screen key:** `factory-production` (OEE tab)
**Nav group:** Factory
**Permission gate:** `factory/production` — admin/standard for entry and report generation, observer read-only

---

### 39.1 Overview

A **Overall Equipment Effectiveness (OEE)** is a bounded time window of direct observation producing a reliability snapshot of the factory production line. Purpose: captures unreported failures and efficiency losses; compares structured observation against the continuous log baseline; enables time-bounded report generation. "Overall Equipment Effectiveness" (OEE) is the preferred term of art.

---

### 39.2 Data storage

Observations are stored in the `observations[]` array in per-user factory log files (schema_version 2). `capacity-{date}.json` is retired as a write target; legacy files remain readable. All observations are aggregated into `capacity_observations` SQLite via the ingest poller. OneDrive read → merge → write pattern is required — never overwrite a log file from local state alone.

---

### 39.3 Observation object

Full field reference: see §11 (Observation object fields).

Key fields specific to OEE:
- `source: "oee"` — all rows in a OEE session carry this value.
- `oee_session_id` — UUID grouping all observations from one OEE submission. Null for non-OEE sources.
- `failure_mode_id` — optional link to FMEA failure mode (§38).

---

### 39.4 OEE session

A OEE session is a batch of observations sharing a `oee_session_id` UUID. The UUID is generated at submit time and is immutable after submission. All rows in the session carry `source: "oee"`. Session metadata (start/end timestamps, section count, observation count) is derived from the observations themselves — there is no separate session header record.

Sessions returned by `db:getOeeSessions` include:
- `oee_session_id` — UUID
- `session_start` — earliest `obs_timestamp` in the session
- `session_end` — latest `obs_timestamp` in the session
- `observation_count` — count of rows
- `sections` — array of `section_label` values (from GROUP_CONCAT)

---

### 39.5 PWA observation push

**Factory department only** — Engine Room and Deck users see no change.

- **"Log Observation" action** on the factory department home screen (icon button in topbar, hidden for non-factory departments).
- **Form fields:** Section (dropdown from `factoryconfig.production.line_sections`), Rate (number, optional), Rate unit (conditional — hidden when no rate entered), Notes (textarea), Wind speed (knots, optional), Sea state (feet, optional).
- **Submit:** builds observation object with `source: "pwa"`, `oee_session_id: null`, UUID generated locally.
- **Online path:** `pushObservationToOneDrive` — loads remote log file (with localStorage cache fallback), initialises at schema_version 2 if absent, upserts by `obs_id`, writes back, updates cache.
- **Offline queue:** on push failure, observation is appended to `fw_obs_queue_{username}` in localStorage. Queue is flushed on next successful write via `flushObservationQueue(username)`.
- **Cache key:** `fw_log_{username}_{date}` for the local log file mirror.

---

### 39.6 `capacity_observations` additions

Columns added in v2.8 (safe migration via ALTER TABLE when absent; table rebuild if `observed_rate` has NOT NULL constraint):

| Column | Type | Notes |
|--------|------|-------|
| `failure_mode_id` | TEXT | Optional FMEA failure mode link. |
| `oee_session_id` | TEXT | UUID grouping a OEE session. Null for non-OEE. |
| `source_user` | TEXT | Username of the submitting user. |

Index added: `CREATE INDEX IF NOT EXISTS idx_cap_obs_oee ON capacity_observations(oee_session_id);`

`observed_rate` and `rate_unit` changed from NOT NULL to nullable to support qualitative (rate-free) observations.

---

### 39.7 IPC handlers

| Channel | Payload / args | Returns |
|---------|---------------|---------|
| `db:ingestObservationsFromLog` | `{ user, observations[] }` | `{ ok, count }` — upserts by `obs_id`; derives `obs_date` from `obs_timestamp` when absent |
| `db:saveObservationsToLog` | `{ user, observations[] }` | `{ ok, count }` — alias for `ingestObservationsFromLog` |
| `db:getCapacityObservations` | `{ obs_date?, section_id?, source_user?, source?, oee_session_id?, from_timestamp?, to_timestamp? }` | `capacity_observations[]` — dynamic WHERE clause |
| `db:getOeeSessions` | `{ trip_number? }` | `oee_session[]` ordered by `session_start DESC` |
| `db:generateRosReportPdf` | `{ report_data }` | `{ ok, path }` — main process only; lazy require puppeteer; Save dialog for final path |

---

### 39.8 graph.js helpers

| Function | Description |
|----------|-------------|
| `loadUserLogFile(username, dateStr)` | Reads `data/factory/logs/report-{dateStr}-{username}.json`. Returns null on 404. |
| `saveUserLogFile(username, dateStr, data)` | Writes `data/factory/logs/report-{dateStr}-{username}.json`. |

---

### 39.9 Report generator

**Modal** accessible from the OEE tab and via "Generate Report for this Session" on a read-only session view.

**Modal fields:** Time window (from/to datetime), source filter (`pwa` | `oee` | `manual` | all), section filter, incident inclusion toggle.

**Data assembly:**
1. Query `capacity_observations` within the window (filtered by source and section).
2. If incident inclusion enabled: fetch all factory events (`db:getEvents({ dept: 'Factory', limit: 2000 })`), filter client-side by timestamp range.
3. Compute section theoretical rates from `factoryconfig.production.line_sections`.
4. Utilisation % per section: `sum(observed_rate × window_hours) / (theoretical_mt_per_day × report_window_hours) × 100`. Null for header/belt/packing sections.

**Console report sections:**
- Header block: vessel, date range, report generated-at, source filter applied.
- Summary stat strip: total observations, OEE sessions, incidents included, avg observed rate.
- Timeline: sorted by timestamp; coloured markers by source (orange=PWA, blue=OEE, grey=manual); incident span bars.
- Observations table: timestamp, section, rate, unit, source badge, user, notes.
- Incidents table: start, end, duration, equipment, category, FMEA mode, notes.
- Section summary table: section, theoretical MT/day, observation count, avg observed rate, utilisation %.

**PDF export:**
- Main process only — never `require('puppeteer')` in the renderer.
- Lazy `require('puppeteer')` with graceful error if not installed.
- `puppeteer.launch({ headless: 'new' })`, `page.setContent(html)`, `page.pdf({ format: 'A4', printBackground: false, displayHeaderFooter: true })`.
- PDF layout: white/print background; header/footer every page; timeline rendered as sorted table.
- Temp file in `os.tmpdir()`, then `dialog.showSaveDialog` for final path; temp cleaned up after copy.

---

### 39.10 UI behaviour

**OEE tab layout:**
- Left panel: session list (ordered by `session_start DESC`). Each row: date, time window, observation count, sections covered. Clicking selects the session.
- Right panel: draft entry table (when no session selected) or read-only session view.

**Draft entry table:**
- Dynamic table of observation rows. Each row: timestamp (default now), section dropdown, asset code (optional free text), FMEA failure mode dropdown (optional, filtered by section), rate (optional), rate unit (conditional), notes.
- `+ Add Row` button appends empty row. Rows can be removed individually.
- **Submit:** validates at least one row; generates `oee_session_id` UUID; sets `source: "oee"` on all rows; calls `appendObservationsToLogFile` for the current user and date; ingests to SQLite via `db:ingestObservationsFromLog`; reloads session list; shows newly submitted session.

**Read-only session view:**
- Non-editable table of all observations in the session.
- "Generate Report for this Session" pre-populates the report modal with `from = session_start`, `to = session_end`, `oee_session_id` filter.

**Overview tab PWA observation overlay:**
- Rate observations: orange filled circles at the correct time/rate position.
- Qualitative observations (no rate): orange diamonds at the x-axis.
- Hover tooltip: `[PWA] {section_label} — {observed_rate} {rate_unit} — {source_user} — {time}`.
- Legend entry: `● PWA Observation`.

**Observations tab enhancements:**
- Source badges: `[PWA]` (amber) for `source: "pwa"`, `[OEE]` (blue) for `source: "oee"`, no badge for `source: "manual"`.
- Filter bar gains source and user dropdowns.
- When source filter = `oee`, rows are grouped by `oee_session_id` with a collapsible session header.
- `source_user` column shows the submitting user's display name.
- Manual console submissions use `appendObservationsToLogFile` pattern (OneDrive read → merge → write) rather than writing directly to legacy capacity files.

---

## §40 — tripanalyticsconfig.json

**Added in:** v2.12 (schema_version 1) — extended in v2.13 (schema_version 2)
**Location:** `Documents/IDMS/config/tripanalyticsconfig.json`
**Edited by:** Admin (via Trip Analytics → Analytics Setup tab and inline edits in Tab 1)
**Read by:** Console (`tripanalytics.js`, `graph.js` helpers)

Stores Trip Analytics module configuration: port reference list, map display colours and feature toggles, offload estimator settings, production targets, and live state for the active trip (departure port, fuel snapshot at trip start, trip start timestamp).

### Full example

```json
{
  "schema_version": 2,
  "vessel": "F/V Araho",
  "last_updated": "2026-05-05T00:00:00.000Z",

  "active_trip": {
    "departure_port_id":            "DUT",
    "fuel_onboard_trip_start_usg":  82150,
    "trip_start_at":                "2026-04-22T15:30:00.000Z"
  },

  "production": {
    "production_target_mt": null
  },

  "map": {
    "tile_provider":      "vector",
    "show_bathymetry":    true,
    "ocean_color":        "#5b89b3",
    "land_color":         "#c8b89a",
    "track_color":        "#4a90d9",
    "track_gap_color":    "#a0b8d0",
    "great_circle_color": "#e8913a",
    "vessel_color":       "#e84a4a",
    "dot_color":          "#4a90d9"
  },

  "ports": [
    { "port_id": "DUT", "name": "Dutch Harbor, AK", "lat": 53.8957, "lon": -166.5422 },
    { "port_id": "ADK", "name": "Adak, AK",         "lat": 51.8800, "lon": -176.6580 },
    { "port_id": "KOD", "name": "Kodiak, AK",       "lat": 57.7900, "lon": -152.4072 },
    { "port_id": "TOG", "name": "Togiak, AK",       "lat": 59.0539, "lon": -160.3717 },
    { "port_id": "SEA", "name": "Seattle, WA",      "lat": 47.6558, "lon": -122.3968 }
  ]
}
```

### Top-level field table

| Field            | Type    | Notes |
|------------------|---------|-------|
| `schema_version` | integer | `2` as of v2.13. Increment on structural change. |
| `vessel`         | string  | Vessel name. |
| `last_updated`   | string  | ISO 8601 UTC timestamp of last write. |
| `active_trip`    | object  | Active trip pointers and fuel/time snapshots. |
| `production`     | object  | Production estimator settings. |
| `map`            | object  | Map display colours and feature toggles. |
| `ports`          | array   | Port reference list used by the module (separate from `portsconfig.json`). |

### `active_trip` object

| Field                          | Type           | Notes |
|--------------------------------|----------------|-------|
| `departure_port_id`            | string \| null | `port_id` from the `ports` array below. Set when a new trip is opened via **Open New Trip**; cleared to `null` on trip close. |
| `fuel_onboard_trip_start_usg`  | number \| null | (v2.13) Total fuel-category tank volume (USG) snapshotted from `fuelstate.json` at the moment **Open New Trip** was confirmed. Admin-editable on Tab 1 to correct mistakes. Used to derive trip-to-date average daily burn. |
| `trip_start_at`                | string \| null | (v2.13) ISO 8601 UTC timestamp captured when **Open New Trip** was confirmed. Admin-editable on Tab 1 via a `datetime-local` input. The denominator for trip-to-date average daily burn (`hoursElapsed = now − trip_start_at`). |

### `production` object

| Field                  | Type           | Notes |
|------------------------|----------------|-------|
| `production_target_mt` | number \| null | Admin-editable full-trip production target in metric tonnes. Shown in the production summary on Tab 1 and editable from Tab 4 Analytics Setup. |

### `map` object

| Field                | Type    | Default       | Notes |
|----------------------|---------|---------------|-------|
| `tile_provider`      | string  | `"vector"`    | Reserved for future tile-source switching. Not currently consumed. |
| `show_bathymetry`    | boolean | `true`        | (v2.13) When `false`, the 11 `ne_10m_bathymetry_*` GeoJSON layers are skipped at map init. Disable for better performance on slower machines. The map remains usable; the ocean fill takes over for depth shading. |
| `ocean_color`        | string  | `"#5b89b3"`   | (v2.13) Hex colour applied as the map container background — visible wherever no bathymetry / land polygon paints. Read at map init only; changing requires a Save (which destroys + rebuilds the map on next entry to Tab 1). |
| `land_color`         | string  | `"#c8b89a"`   | Fill colour for `ne_10m_land` and `ne_10m_minor_islands` polygons. |
| `track_color`        | string  | `"#4a90d9"`   | Confirmed track polylines and midnight-position dots. |
| `track_gap_color`    | string  | `"#a0b8d0"`   | Dashed polylines spanning days with no recorded position. |
| `great_circle_color` | string  | `"#e8913a"`   | Great-circle arc to the destination port and the destination marker fill. |
| `vessel_color`       | string  | `"#e84a4a"`   | Vessel position marker fill. |
| `dot_color`          | string  | `"#4a90d9"`   | Midnight-position dot fill (currently shared with `track_color` if not set). |

### Map rendering notes (v2.13)

The map is built on Leaflet 1.9.4 with the following behaviours:

- **Layer z-order via panes.** Ten custom panes are created at map init with explicit `z-index` values, so layer order is independent of the order async fetches complete. From back to front: `ta-bathy` (210), `ta-land` (220), `ta-coastline` (230), `ta-reefs` (240), `ta-graticules` (250), `ta-ne-ports` (260), `ta-seamap` (280, OpenSeaMap tiles), `ta-tracks` (410, polylines + arc), `ta-markers` (600, position dots), `ta-vessel` (620, departure / destination / current vessel — always above land).
- **Antimeridian wrapping.** `worldCopyJump: true` is enabled; in addition each vector layer is rendered at −360°, 0°, and +360° lon offsets via an `addWrapped()` helper so polygons appear continuous across the date line. Trip tracks, gap segments, and great-circle arcs run through `taUnwrapLons()` first, which keeps consecutive points within ±180° of each other so a date-line crossing draws as a short hop instead of looping the world.
- **Permanent map labels.** Vessel marker carries a permanent tooltip with the vessel name from `vesselconfig.json → info.vessel_name`; departure and destination markers carry their port name. All three use a shared `.ta-map-label` style (semi-transparent white pill, 10 px bold, thin border, drop shadow) injected once into `<head>` via a `<style>` tag.
- **Stale-map detection.** When the user navigates away and back, `taInitOrUpdateMap()` checks whether the cached `TA.map.getContainer()` still matches the live `#ta-map-container` DOM node. If not, the map is destroyed and rebuilt against the new container. `invalidateSize()` is also deferred one frame on every entry to handle 0×0 measurement during tab transitions.

### `ports` array — port object fields

| Field     | Type   | Required | Notes |
|-----------|--------|----------|-------|
| `port_id` | string | yes      | Short uppercase identifier (e.g. `"DUT"`). Must be unique within the array. |
| `name`    | string | yes      | Human-readable port name. |
| `lat`     | number | yes      | Decimal degrees, −90 to 90. |
| `lon`     | number | yes      | Decimal degrees, −180 to 180. |

### OneDrive path

```
Documents/IDMS/config/tripanalyticsconfig.json
```

### graph.js helpers

| Function | Description |
|---|---|
| `loadTripAnalyticsConfig()` | `graphGet(ONEDRIVE_BASE + '/config/tripanalyticsconfig.json')` — returns parsed config or `null` if not found. |
| `saveTripAnalyticsConfig(cfg)` | `graphPut(ONEDRIVE_BASE + '/config/tripanalyticsconfig.json', cfg)` — writes the full config object. |

### Analytics Setup UI

The Analytics Setup tab (`renderTASetup()`) provides an admin interface for editing `tripanalyticsconfig.json`:

- **Production card:** single editable field — Target MT (numeric input). Changes are local until the Save button is clicked.
- **Map Configuration card:** **Show Bathymetry** checkbox (toggle for the 11 bathy layers; disable for performance), plus seven hex colour inputs (`ocean_color`, `land_color`, `track_color`, `track_gap_color`, `great_circle_color`, `vessel_color`, `dot_color`) each with a live `<span>` swatch preview that updates on `input` event.
- **Ports card:** a table with one editable row per port (port_id, name, lat, lon). An **Add Port** button appends a blank row. Each row has a **Delete** button (row is removed from DOM immediately). Inline validation highlights cells red: duplicate `port_id`, lat out of −90–90 range, lon out of −180–180 range.
- **Save to OneDrive:** calls `saveTripAnalyticsConfig()` with the current in-memory config; tears down `TA.map` so the next entry to Tab 1 rebuilds with the new bathymetry / ocean colour. Shows status: "Saved. Map will rebuild on next view."
- **Refresh from OneDrive:** reloads config from `loadTripAnalyticsConfig()` and re-renders the tab. Prompts a confirmation dialog if unsaved local changes exist.

All write actions are admin-only. Non-admin users see the Setup tab in read-only mode.

---

## §41 — Notes Hub

**Status:** Not built — spec ratified 2026-09-02 (v2.31). Supersedes §34 Messages.
**Files:** standalone page + PWA screen (this repo, shared implementation); `src/renderer/js/notes.js` + `sync-notes.js` (Console)
**Location:** Console: Personnel → Notes (also feeds Operations → Assigned Tasks). PWA: hub tile on each department home. Standalone: same-origin page, usable as a browser window kept open beside other work.

### 41.1 Overview

A shared, non-private notes surface — an in-house Microsoft To-Do — acting as the go-between for the PWA and the Console. Designed for handover: anyone can read anyone's notes. Three governing rules, stated once and enforced everywhere:

1. **Notes never touch `task_records`, TM Master, or job history.** Assigned notes are lightweight do-items with a one-line daily trace (§41.10); tasks remain the auditable maintenance record. Real PM work must not migrate into notes to dodge the task ceremony.
2. **The hub records who did what, when — it never authorizes.** It is explicitly not LOTO and cannot become LOTO without explicitly authored steps; LOTO, permits, and procedure live in the vault's authored SOP world. A future authored LOTO system may *feed* template steps in; the hub never substitutes for one.
3. **Mostly-global permissions, officer oversight is social.** Anyone reads, authors (including department level, for now), comments, assigns, and promotes. Every event carries its actor, so oversight has the data it needs. An authorship setup page is a future option, not a commitment.

### 41.2 Surfaces — two implementations, three views

| Surface | Implementation | Data path |
|---|---|---|
| Standalone browser page | New page in this repo, same origin + MSAL registration as the PWA | Graph direct, event replay + poll |
| ↳ *opened from the Console* | **Notes → ⧉ Open in a window** hands the page's URL to the default browser (`notes_url` in `notesconfig.json`, defaulting to the published address). Both surfaces read and write the same event stream, so they stay in step on their sync cycles. | |
| PWA screen | **Same code** as the standalone page (shared modules) | Graph direct, event replay + poll |
| Console: Personnel → Notes | Native renderer screen (`notes.js`), like every other Console module | SQLite derived cache via `sync-notes.js` ingest lane |

The Console is deliberately native, not an embedded webview: it already needs a notes ingest lane for the Assigned Tasks board and the Rough Log digest, and embedding the hosted page would require a second MSAL session inside Electron. Two renderers, one file contract.

**Sign-in expiry.** Azure issues a single-page app a refresh token that lives about a day, and MSAL's fallback — a hidden-iframe renewal against the Microsoft session cookie — fails wherever third-party cookies are blocked. So a window left open overnight *will* eventually need a person. The page treats that as a state rather than an error: notes already synced stay readable from the local cache, a banner above the list says the sign-in expired and what that means, and **Sign in again** re-authenticates in a popup and resumes syncing on the spot, with the place you were on preserved. Writes refuse with that reason rather than a raw `AADSTS` code, and nothing typed is discarded. This is the one thing that cannot be engineered away — a token has to expire — so it is signposted instead.

**Built to be left open.** The standalone page is meant to sit in a window of its own all day beside the Console, so it reopens on the department and place it was last on (per user, since a shared tablet has more than one), names that place in the window title with a count of what is waiting for you, and narrows into a side panel: below 780 px the sidebar folds into a ☰ overlay that closes itself once you pick somewhere, and the detail panel slides over rather than squeezing the list. Restoring a place that has since gone — a department removed, a crew member off this vessel — falls back rather than landing on an empty list.

### 41.2a Two renderers, one screen — what may differ, and what may not

The notes page and the Console's Notes screen are two implementations of this section, and they are meant to stay recognisably the *same screen*. Where one grows an affordance the other follows. This is not tidiness: a crew member is told "put it in Notes", and being told that an action exists only on the other surface is how a feature stops being used.

Everything a note *is* renders the same on both: type and assignees, folder, star, pin, equipment code and its name, checklist, photos, documents, comments, archive state, and the attachment-retention line. Every action a note supports is available on both — create with attachments, complete, strike a step, assign, comment with a photo, star, reorder starred, drag to re-file, archive, unarchive, delete.

Two things are deliberately one-sided, and each says so where it sits:

| Only on | What | Why |
|---|---|---|
| notes page | The **shared-window author toggle** (§41.4d) | A window left open for anyone has no signed-in person to name. The Console is an officer's signed-in application; there is nobody else it could be. |
| Console | The **EQUIPMENT band's** richer counterpart, Maintenance → Equipment → **Notes** (§41.6d) | The Console has the whole register, the component tree and TM's own parenthood; the band on the page is the reachable-from-here version of the same idea. |

The equipment picker was on this list until v2.31.8, justified as "the register is behind a main-process call in the Console". It is not — `db.searchAssets` had been serving other Console screens the whole time, and the greyed-out radio meant a note simply could not be filed against a machine from the Console. **A convenience argument is not a reason to leave an action off one surface.** If a thing is worth doing in Notes it is worth doing in both, and the bar for adding a row to that table is that the surfaces genuinely differ in what they *are*, not in what was quicker to build.

Two known limits, stated rather than hidden: the Console's *row* retention line is computed from the note's own attachments only, because the derived row carries a comment count and not the comments — the detail panel, which loads them, is correct; and the Console's list is fed by the ingest lane, so a note written on the page appears there on the next sync rather than instantly.

### 41.3 OneDrive files

```
data/notes/
├── events/
│   └── {YYYY}/                 ← {iso}-{event_id}.json — single append-only stream, all event types
├── files/
│   └── {item_id}/              ← documents byte-for-byte; item_id = note_id or comment_id (§41.4b)
└── aggregates/
    └── {YYYY}/                 ← notes-aggregate-{YYYY}.json — Console-derived cold-start cache

data/assets/pictures/{item_id}/  ← note and comment photos, the shared attachment convention
data/tasks/files/{task_id}/      ← documents COPIED onto a task at promotion (§41.6)

config/notesconfig.json          ← department heads, department folders, checklist templates
```

- **One stream, not per-note folders.** All event types share `data/notes/events/{YYYY}/`, exactly like the Phase 5 factory-observation log: filenames `{iso}-{event_id}.json` with `:`, `.`, `-` stripped from the timestamp so lex-sort = chrono-sort; writes are `If-None-Match: *` (412 = already there = success for idempotent retry). Per-note grouping happens in derived state, keyed by `note_id` in payloads.
- **Photos** reuse the established attachment convention: `data/assets/pictures/{note_id}/` (note photos) and `data/assets/pictures/{comment_id}/` (comment photos), same resize sizes as rounds comments and tasks (1080×1024 full + 240×180 thumb @ 0.85 JPEG), uploaded via the shared resize/upload helper. Client-side downscale is mandatory — Graph's simple PUT caps at 4 MB.
- **Aggregates** are optional derived artifacts, republished by the Console under an ETag with a regression guard (same discipline as rounds aggregates), so web clients cold-start from one GET plus the event tail after their cursor rather than walking a year of events. First release may ship without them; the cursor-driven replay is authoritative either way.

### 41.4 Event envelope and types

Envelope per `docs/architecture.md`, identical to Phases 4/5: `{schema_version: 1, event_id, event_type, timestamp, actor, payload}`. `actor` is the IDMS username. Events are immutable; edits append, never mutate.

**Replay order.** The event filename is the sort key (lex = chrono), but the reducer applies **creations first, then every other event in stream order**. Filenames carry each writing device's own UTC clock, so a comment or a struck step can legitimately sort *ahead* of the note it belongs to — two devices seconds apart, or offline devices reconnecting (§41.9). A single pass would find no note and drop that event permanently. Mutations still apply to one another in stream order, which is where last-writer-wins actually matters.

| `event_type` | Payload | Notes |
|---|---|---|
| `note_created` | `{note_id, title, body?, scope, folder?, equipment_code?, assignment?, steps?, template_id?, origin, group_alert?, attachments?}` | `scope` = `{level: "general"\|"department"\|"crew", department?, owner_crew_id?}` — see §41.4a. `origin` = `manual` \| `template` \| `emergency_offline` \| `task_demote` (§41.6f). `assignment` states the note type outright; without it a creation carrying an `equipment_code` is equipment-typed, which is what lets an importer say what it plainly meant in one event. `steps[]` = `[{step_id, text, equipment_code?}]`. `group_alert: true` settable only by the department head (§41.7). `attachments[]` = §41.4b. |
| `note_edited` | `{note_id, patch, before}` | Same correction pattern as `observation_correction`. Carries a renamed `title` (editable in place on both surfaces, v2.31.9), a re-filed `folder`, an added or cleared `equipment_code`, and appended `attachments`. |
| `note_completed` / `note_uncompleted` | `{note_id}` | First `note_completed` sets state; subsequent ones from other actors are preserved and rendered as confirmations, never dropped. |
| `step_struck` / `step_unstruck` | `{note_id, step_id}` | Multiple strikes of the same step by different actors are all preserved — "struck by A 03:12, confirmed by B 03:14". This is the emergency-checklist timeline. |
| `note_assigned` | `{note_id, assignee_crew_id, assignee_username?}` | **Adds** one person — a note may be carried by several (§41.6a). Assigner is the envelope `actor`. `assignee_crew_id` is authoritative (§41.4a); `assignee_username` rides along only when that person is also an IDMS login, and the set of those is what the PWA's alert check matches on. |
| `note_unassigned` | `{note_id, assignee_crew_id?}` | With a crew_id, drops that one person; without, clears everyone. |
| `note_assignment_set` | `{note_id, mode: "unassigned"\|"assignable"\|"equipment", equipment_code?}` | The three person-less note types (§41.6a). Ignored while anyone is assigned — naming a person always wins, so the clients clear the plate first. `mode: "equipment"` carries the `equipment_code` it files the note against; `unassigned` and `assignable` clear any code the note was carrying, because the radio is the note's answer to what it is. |
| `note_starred` / `note_unstarred` | `{note_id}` | Shared, not per-user: a star marks a note important for everyone, matching the hub's non-private premise. Starred notes sort above the rest in every view. |
| `note_reordered` | `{note_id, sort_index}` | Manual ordering, **starred notes only** — everything else stays newest-first. `sort_index` is a float so inserting between two neighbours costs one event instead of reindexing the list. |
| `note_unarchived` | `{note_id}` | Returns an archived note to its list, and restarts any attachment retention clock (§41.14). |
| `comment_added` | `{note_id, comment_id, text?, attachments?}` | Photo-only comments (empty text, 1+ photos) allowed, matching rounds comments. |
| `note_promoted` | `{note_id, task_id}` | Written after the task definition create succeeds (§41.6). Converts the note into a task mirror. |
| `task_imported` | `{note_id, task_id, title, scope, folder?}` | Department-level only: creates a mirror wrapper for an existing task (§41.6). `scope` is carried explicitly — the reducer is context-free. |
| `note_archived` | `{note_id}` | Hidden from default views, retained in stream and Completed/Archive views. |
| `note_deleted` | `{note_id}` | Tombstone. Authors may delete their own notes; department heads any note. UI offers **Archive** as the default when the note carries other people's comments. |
| `note_merged` | `{from_note_id, into_note_id, template_id}` | Console-emitted reconciliation only (§41.8). Viewers fold the `from` stream into the `into` note. |
| `alert_acked` | `{targets: [note_id \| task_id, …]}` | Per-user acknowledgement; the acking user is the envelope `actor` (§41.7). |

### 41.4a Scope, and why crew_id is the identity key

```
scope = { level: "general" }                                      ← interdepartmental
scope = { level: "department", department: "engine" }             ← one department
scope = { level: "crew", department: "engine", owner_crew_id: … } ← one crew member
```

**General** sits above the departments and is the repository for interdepartmental communication — anything that is not one department's business. It has no `department`, so it is the same list whichever department tab is selected.

**`crew_id` is the identity key throughout — never `username`.** 97 of the 112 records in `crewconfig.json` carry `username: null`, because most of the crew have no IDMS login; a username can therefore neither address nor distinguish a crew member, and a lookup keyed on one silently collapses the whole roster onto the first null-username record. Event `actor` remains a username (only people who can log in write events), and `assignee_username` rides along on assignment when it exists, so the PWA's alert check — which knows the signed-in user by username alone — keeps working. Notes written before this rule carry `scope.owner_username`, which readers still honour.

**Groups and folders** occupy the band between Department notes and the Personnel heading, one arrangement per department, stored in `notesconfig.json` under `department_folders[{dept}]`. There are exactly **two levels**: a *group* sits at the level of Department notes and may hold folders; a *folder* is either top-level or inside one group. A note records where it lives as a single path string in `folder`:

```
"Shipyard Prep"           top-level folder
"Overhauls"               the group itself — notes may sit directly in one
"Overhauls/Main Engine"   a folder inside that group
```

The stored array holds either a bare string (a top-level folder — what every config written before groups contains) or `{type, name, folders[]}`. Reading normalises both, so nothing is migrated, and a config that never uses groups is written back byte-identical. A `/` is refused in a name, since it is the path separator.

Groups and folders are added, renamed, removed and **dragged into any order within the band** — the two headings are hard stops, and a group cannot be dropped inside a group, because two levels is the whole design. Renaming or moving carries the notes with it (one `note_edited` each, re-pathing children too); removing moves its notes back to Department notes. Nothing is ever deleted. All config writes are ETag-guarded from both clients.

**Dragging a note** onto a sidebar row files it there. Onto a folder or group it takes that path. Onto a person it means one of two things, settled by what the note is rather than by asking: a **personal note is handed over** — it already lives on somebody's list, so dragging it to another list moves its ownership — while a **department or global note is assigned**, which is the only reading that does not take it away from everyone else.

### 41.4d The shared window

A window left open on a bulkhead is an invitation: anyone walking past may add a note, and whoever signed in hours ago is the wrong name to put on it. **Shared mode** answers that — every event the window writes carries `actor: "browser"`, rendered everywhere as **"Browser addition"**. It records what is actually known: that the note came from that window, not who typed it. Signing a note with the wrong person is worse than not signing it.

The Microsoft sign-in still stands behind the window, because OneDrive needs a token; what changes is the authorship written into the note, not the plumbing. In shared mode there is no "me" — nothing is highlighted as yours, the alert count is empty, and the window opens on the department rather than a personal list.

The mode is a footer control reading *Writing as **Browser addition** — sign as me* (and the reverse), remembered per browser, and `?shared=1` on the URL pins a window to it so a shortcut on a shared machine opens straight in. `browser` is a reserved actor: it is not a crew member, never appears in a personnel list, and can never be assigned work.

### 41.4b Attachment object

```jsonc
{
  "kind": "image" | "file",
  "filename": "seal-datasheet.pdf",
  "path": "data/notes/files/{item_id}/seal-datasheet.pdf",
  "thumbnail_path": "data/assets/pictures/{item_id}/thumb-x.jpg",  // images only, else null
  "size": 20480,
  "content_type": "application/pdf"                                // files only
}
```

Images keep the task/rounds-comment convention exactly (1080×1024 full + 240×180 thumb @ 0.85 JPEG under `data/assets/pictures/{item_id}/`), so the Console's existing thumbnail and lightbox helpers render note photos unchanged. Everything else is stored byte-for-byte under `data/notes/files/{item_id}/`. `item_id` is the `note_id` for note attachments and the `comment_id` for comment attachments.

A document cannot be downscaled the way a photo can, so files over Graph's 4 MB simple-upload ceiling are refused with a plain-English reason rather than a raw 413; the upload-session path is future work. Attachments may be added when the note is created — the `＋` on the add bar, or dropping a file onto it — as well as afterwards.

### 41.4c Ordering

Within any view: **starred first**, then newest first. Among starred notes a manual order is honoured when set (`sort_index`, dragged), and starred notes without one fall back to newest-first behind those that have one. Unstarred notes are always chronological — dragging one onto another is a no-op, and the UI does not pretend otherwise.

### 41.5 Comments

Any crew member may comment on any note, with photos. Render newest-last under the note, author and date always visible. Comments are what keep a note a living thing between watches; they are also why deletion defaults to Archive once others have written. On promotion (§41.6) the full comment transcript travels into the task as a provenance block.

### 41.6 Task integration — promotion and mirrors

**Promotion.** **Promote to Task** is offered on an *assignable* note only — any scope, but only that kind (§41.6a). A task is work somebody carries: an *unassigned* note is a record nobody has taken on, and an *equipment* note is a record about a machine. Neither has the one thing task creation needs, so the action is **absent** on them rather than present and failing. Making a note assignable is the step that says it is work, and it is one click above the button. The action prefills the client's existing Task Creation screen:

| Note field | Task Creation field |
|---|---|
| `title` | Job name |
| `body` + provenance block | Description |
| `equipment_code` | Equipment picker (pre-selected; an assignable note keeps its tag, §41.6a). A code named in a comment wins over the note's own tag — it is the more recent statement. If neither exists the picker blocks submit as it already does. |
| `Label: value` lines in comments | The matching form field (§41.6e) |
| note + comment photos | Attachments (copied, not referenced) |

The provenance block is plain text appended to the description: `From note {note_id} — {author}, {date}.` followed by the comment transcript, one line per comment: `{author} ({date}): {text} [photo]`. Copied at promote time, so later deletion of the note cannot hollow out the task's history.

The form is the Console's **New Service Report** — the same `buildTaskCreationHtml` the tab renders, opened in a lightbox over the Notes screen so promoting a note does not cost you your place in the list. One task-creation form, not a second one. The lightbox does not close on a backdrop click: the form can hold several minutes of typing and a stray click is not consent to lose it.

Submit travels **each client's existing ETag-guarded definition-create path** — Console `mutateTaskDefinitionFile`, PWA `erTaskCreateInDefinitionsFile` (both guarded since Phase 6 Stage 0). There is no new write lane and no proposal inbox (v2.31 planning note: an inbox was considered and dropped once both create paths were confirmed guarded). The task is created `open`, assigned or not, per the normal screen.

**On success the note is tombstoned** — `note_promoted {note_id, task_id}`, then `note_deleted`. *(v2.31.9: this supersedes the mirror model this section previously specified. A mirror is two records of one job, and two records drift — the failure §41.1 names first. The task is now the record, and the note's tombstone keeps who wrote what without keeping a second copy of the work.)*

**Attachments are copied, not referenced.** Every photo and document on the note and on its comments is fetched and re-uploaded under the task — images to `data/assets/pictures/{task_id}/` with their thumbnails, documents to `data/tasks/files/{task_id}/`. Referencing them would leave the task pointing at files on the *note's* retention clock (§41.14), which tombstoning has just started. The copy runs before the form opens, so a slow or failed copy is surfaced before anyone types rather than between Save and the task existing; the promoting client therefore fixes the `task_id` in advance and hands it to the form.

**Promotion is confirmed, and the confirmation says what stops existing** — that this note is deleted, how many attachments travel, and which metadata was found in its comments. A note becoming a task and back again should be rare; neither direction is a gesture that should happen by accident (§41.6f).

**Availability.** Promote is offered on **assignable** notes only (§41.6a): a task is work somebody carries, and an unassigned note or one filed against a machine has nobody on it. The notes page shows the button and says the report is written in the Console, where the form lives; putting a third copy of task creation on that page is a separate decision, not a side effect of this one.

**Mirrors.** Mirrors now come only from department-level `task_imported`, not from promotion. A mirror renders the task's live status read-only and strikes through when the task reaches a terminal state. Tapping "complete" on a mirror fires the **existing `reported_complete` action** through the existing path — the mirror stores no completion state of its own, ever. Officer sign-off in the Console records the work and also lands on `reported_complete`; a successful push to TM Master is the only path to `completed` (§32a, settled 2026-09-05). This is the single seam between the hub and the guarded task machinery, and it introduces no new state.

**Assigned Tasks board (Console).** The board lists tasks and *assigned* notes, visually distinct (note rows carry a note glyph, no TM fields). Unassigned notes never appear. Completing a note row from the board appends `note_completed` — it does not touch any task table.

### 41.6a Note type — three kinds, several people

One control, headed **Note Type**, with three kinds. The panel *below* the radios changes with the choice, because each kind needs a different question answered — and two of them need none at all:

| Kind | Panel below | Meaning | Where it shows |
|---|---|---|---|
| **Unassigned note** (default) | nothing | Nobody's, and not offered to anyone. | Its own list only. |
| **Assignable** | the **Assign to** crew list | Open to whoever picks it up; ticking one or more people is the fourth, derived state — **Assigned**. | Its own list, the **Notes Tray** on the Assigned Tasks board, and — once anyone is ticked — each assignee's personal list (pinned) and their card on that board. |
| **Equipment** | an equipment search box | Filed against one component of the asset register by its `code` (§41.6d). | Its own list, the **EQUIPMENT** band of the Notes sidebar, and the **Notes** section of that component in Console → Maintenance → Equipment. |

**The equipment tag is orthogonal to all three.** The type answers *who* a note is for; `equipment_code` answers *what* it is about. Assignable notes carry an optional tag — which is how a promoted note reaches its service report with the equipment already filled in (§41.6) — and moving between Assignable and Equipment keeps it. Only **Unassigned** clears it, because that panel has nothing to show or change a code with; a note that arrives at Unassigned still carrying one shows it as a removable chip rather than stranding it somewhere nothing can reach. Clearing on purpose is the ✕ on the picker, and dragging a note onto a *person* has never touched it.

The reducer's `assignment` therefore carries four values — `unassigned`, `assignable`, `assigned`, `equipment` — of which only the first, second and fourth are ever *chosen*: `assigned` is what ticking a person makes of `assignable`. The radios read `assigned` as **Assignable**, which is where the crew list lives.

Naming a person always wins: `note_assignment_set` is ignored while anyone is assigned, and the clients clear the plate before switching to a person-less state, so the control can never disagree with itself. Removing the last assignee leaves the note **assignable** rather than silently unassigned — it was offered work a moment ago, and dropping it off the board entirely is not what removing one name means.

**A shared note is one note, not a copy each.** It appears in every assignee's personal list — pinned above their own notes — but there is a single `note_id` and a single completion. Completing it anywhere completes it for everyone, and the panel says so when more than one person is on it. This is the same mirroring rule §41.6 applies to imported tasks, for the same reason: two records of one job drift.

**Pin outranks star.** Ordering within a personal list is *pinned* (assigned to that person) → *starred* → newest first. The pin is not a user action; it is what being assigned looks like on your own list.

**The crew list is confined to this vessel.** `crewconfig.json` is the fleet's roster — it carries Alaska Spirit hands who cannot do work here — so every crew list in the hub filters on vessel with the same rule the Assigned Tasks board and Crew List use (`taskSameVessel`: a blank on either side passes, so an unrecorded vessel is never hidden by silence). The assignment pool is further narrowed to *active* crew of the note's own department.

### 41.6b The Assigned Tasks board — two trays, one gesture

The Console's Assigned Tasks board carries notes as well as tasks:

- **Tasks Tray** (formerly "Unassigned") — open tasks on nobody's card.
- **Notes Tray** — notes marked *Assignable* that nobody has picked up.
- **Member cards** — every open task **and** note assigned to that person. A note assigned to several people appears on each of their cards; it is one note, so completing it anywhere completes it everywhere.

**Dragging** moves work: onto a card to hand it over, onto the matching tray to release it. Dragging from one person's card onto another's cannot know which of two things is meant, so it asks: **Reassign** (take it off the first) or **Add Personnel** (both carry it). The `×` on a row takes *that person* off, leaving anyone else on it — "not mine", not "nobody's". Tasks and notes each refuse the other's tray rather than silently doing nothing.

**Clicking** opens the full picker. For a task that is the assignment modal, where people are now **checkboxes** — several may hold one job — while *Unassigned* and *Locked* remain radio options exclusive with them and each other. For a note it opens the Notes screen, where the note type, comments and attachments live.

### 41.6c Multi-assignee on tasks — the shared-file contract

`assigned_to` on a task definition is a **single** field that the PWA, TM Master imports and every existing reader speak. Multi-assignment is therefore **additive**, not a replacement:

| Field | Meaning |
|---|---|
| `assigned_to` | The first holder. Authoritative, unchanged, written on every assignment. |
| `assignees[]` | Every holder, as assign keys. Absent or empty means "whatever `assigned_to` says". |

Both are written together, `assigned_to` always being `assignees[0]`, so the two agreeing is the normal state. **Disagreement is how a foreign write is detected**: if `assigned_to` names somebody who is not first in the list — including being cleared to null — a writer that does not know about `assignees` has changed the holder since, and the single field wins while the stale list is discarded. That covers a PWA reassignment and a PWA release alike, and it means the PWA needs no change to stay correct. A PWA that later wants to *show* several holders reads `assignees` when it agrees with `assigned_to`; writing it is optional and can follow under the dual-write protocol.

### 41.6d Equipment notes — one register, three surfaces

A note filed against equipment answers "what is this about?" the same way a task does, with a code from `config/assets.csv` (§9) — the TM Master component register, dotted-decimal, 3,857 rows, and the one identifier that never changes for a physical asset.

**The picker.** Choosing **Equipment** opens a search box over the register on **both surfaces**: type a code fragment or part of a name, pick a row, and the note carries that `code`. Every typed word must appear somewhere in the code or the name, **in any order** — nobody remembers a component the way TM Master wrote it, and a plain substring match finds nothing for "trawl gearbox".

Each surface reaches the register the way it already reaches everything else:

| | Source | Matching |
|---|---|---|
| Notes page | `config/assets.csv` (§9) fetched directly, trimmed to `code → name` in `localStorage`, re-read on a miss or when the cached copy is over a week old | All words ANDed in the page |
| Console | `db.searchAssets`, the same IPC the Rough Log and the report screens use, over the ingested `assets` table | One `LIKE` on the longest word, the rest ANDed in the renderer |

**Ignore ranges are honoured by both.** §9 gives `equipmentconfig.json` an `ignore` block, and an asset whose **top-level integer code segment** falls in one of those ranges (bounds inclusive) is not IDMS work — the register's top block is the vessel itself, its drawings and its courses. The Console excludes them at the query; the page reads the config alongside the CSV and applies the ranges *before caching*, so the cached list is already the offerable list. On the live register that is 851 of 3,896 rows, `100.001.001 F/V Araho` among them.

When the register cannot be read, the page says so and still accepts a code typed in full — an unreachable reference file must not make a note unfileable.

**Exclusive by choice, not by accident.** Selecting Equipment clears any assignees (the same clear the other two modes already do), and selecting either person-less mode clears the `equipment_code`. Dragging a note onto a *person* is a separate gesture and leaves the code alone: a pump note handed to an oiler is still a pump note, and the detail panel keeps saying so.

**The EQUIPMENT band.** The Notes sidebar carries a band below Personnel, collapsed by default, built from the codes actually in use in that department (plus General-scope notes) *and their ancestors* — so `601.001.003` is reachable by walking `601` → `601.001` → `601.001.003` even when no note is filed at the two upper levels. Selecting a node lists notes at that code **and everything beneath it**, which is what a tree node means; the count on a node follows the same rule. Nodes are drop targets: dragging a note onto one files it against that code. Names come from the cached register; a code with no name still renders, because a missing lookup must not hide a note.

**The Console needs nothing new to read them.** Maintenance → Equipment already has a **Notes** section querying `notes.equipment_code` (with *include sub-components* honouring both TM's `parent_code` tree and the code prefix), fed by the `notes` ingest lane, which has carried `equipment_code` since the lane was written. An equipment-typed note appears under its component on the next sync.

### 41.6e Task metadata in comments

Crew already write `Priority: High` into a comment when they mean it. Promotion reads that rather than asking anyone to learn a new place to put it.

**The rule.** Any comment line shaped `Label: value` where the label is one this table knows is task metadata. Everything else is prose and is left alone. Later comments win over earlier ones, and later lines win within one comment — the last thing anyone wrote about a note is the current answer.

| Label (case-insensitive) | Task field |
|---|---|
| `Priority` | `priority` |
| `Category`, `Type`, `Job type` | `job_type` |
| `Equipment`, `Equipment code`, `Asset`, `Code` | `equipment_code` |
| `Role` | `role` |
| `Assigned to`, `Assignee` | `assigned_to` |
| `Department`, `Dept` | `department` |
| `Failure mode`, `Failure` | `failure_mode` |
| `Hours`, `Equipment hours` | `interval_hours` |
| `Interval` | `interval` |
| `Status` | `status` |

**Unknown labels are ignored, never guessed at.** A wrong guess prefills a service report with something nobody said. The label must also be short and alphabetic, which is what keeps `Ran it up at 14:30`, `see https://…` and `Spoke to the chief: he says wait` as prose.

**The prose survives, the labels do not.** The transcript copied into the task's description has its metadata lines removed, so the form fields and the description do not say the same thing twice. That is exactly why a value the form cannot accept — a role that is not in the roster, say — is **named in the lightbox** instead of dropped: it has already been taken out of the transcript, so silence there would lose it altogether.

This is also the shape §41.6f *writes*, which is what makes a demote-then-promote round trip lossless.

### 41.6f Demotion — a task becomes a note again

A task's edit modal carries **↓ Demote to Note**, the mirror image of promotion and tombstoning on its own side.

The new note is **assignable** — it was work somebody was meant to do, and it still is — with the task's `job_name` as its title, its `description` as the body, and its first equipment code as the note's tag. Everything task-specific goes into the **first comment**, in the `Label: value` shape of §41.6e: category, priority, department, role, holder, equipment, failure mode, interval, equipment hours, status, plus any further equipment, supervisor notes and skill tags as plain lines. The task is then deleted from the definitions file and from the derived cache.

**What does not come back**, and the confirmation says so: the task's transition history, any officer sign-off, and any `task_records` row already written from it. A note cannot hold those, and demoting a *closed* task throws away the record of it being done — which the confirmation calls out separately.

**A failure after the note exists is never silent.** The note is created first, because losing a task entirely is worse than briefly having both; its creation is an appended event and events are not retracted. So if the task deletion then fails, the client says plainly that both now exist and which one to remove by hand. Reporting a partial state is the only honest option available at that point.

**Both directions are confirmed on purpose.** A note going back and forth accumulates a comment per trip, and nothing about this system wants that traffic — these are conversions, not a toggle.

### 41.7 Alerts

Alerts are **derived, never authored** — computed at read time from three sources: notes assigned to me and not completed; tasks newly assigned to me (vs. my last ack); department-level notes with `group_alert: true` (settable only by the department head). Dismissal appends `alert_acked` with the dismissed ids, so it syncs across the user's devices.

- **Login popup:** one summary popup listing N items, shown after user selection in **both** `routeAfterLogin` branches (single-department users skip the department picker — do not hook the picker screen). Never N popups.
- **Sync popup:** on each sync cycle, diff derived alerts against acked ids; pop only when something is new.
- **Everything else is a badge.** New comments on my notes, activity on notes I authored — badge counts on the hub tile, no popup. This is deliberate alarm-fatigue discipline; do not widen popup criteria without revisiting it.

Notification eligibility carries forward the §34 proxy: recipient `status = active` and aboard.

### 41.8 Checklist templates, deterministic instances, reconciliation

`notesconfig.json` declares checklist templates (e.g., Blackout Recovery, Boundary Isolation), editable by department heads in Console → Config. Instantiation is deliberate — a clearly-labelled action, not automatic.

**Deterministic instance identity.** A template instance's `note_id` is `{template_id}-{local YYYY-MM-DD}` — derived from the template and the local date, never the device. Every device that instantiates the template offline generates the *same* note by construction, so reconnecting devices' queued events already reference one note and replay simply interleaves them. (Same idempotency principle as the Phase 5 event filenames.)

**Reconciliation window.** For the cases deterministic ids cannot cover (an incident spanning midnight; a second same-day incident with no sync between): the Console ingest lane, on seeing two instances of the same `template_id` whose `note_created` timestamps differ by ≤ 60 minutes, emits `note_merged` into the earlier id. Instances outside the window stand as separate incidents. Pathological overlaps are resolved by a department head merging or archiving by hand — tombstones make that safe. Device timestamps order the display; **correctness never depends on clock accuracy.**

### 41.9 Offline emergency mode *(later stage — not in the hub's first release)*

"Generate the checklist on your own phone with no internet at all" requires a four-part package, shipped together as its own stage:

1. **Service worker + cached app shell** — the §19 (PWA-SCHEMA) lift, with its MSAL redirect-URI care; installed to home screens. Prerequisite for opening the app offline at all. Also unlocks future notification work — one lift, two payoffs.
2. **Templates cached locally**, refreshed on normal syncs, so checklists are always resident.
3. **IndexedDB offline queue** for events *and staged photos* (photos exceed localStorage quotas).
4. **Emergency mode proper:** MSAL cannot mint tokens offline, so the app runs on the last-logged-in cached identity with an honest banner ("offline — recording locally as {name}"); on reconnect it refreshes the token first, then flushes the queue through the normal append paths. This is the existing observation-queue pattern promoted to a first-class mode.

Until this stage ships, the hub is online-only, and template instantiation simply requires connectivity like everything else.

### 41.10 Rough Log daily digest

One synthesized line per department per day summarizing assigned notes completed that day (count + titles), prepended at Rough Log **display and export time** — computed from the event stream, never written to `roughlog-{YYYY}.json`. See the §31 cross-reference. Rationale: multiple open clients writing a daily entry would race; a view cannot.

### 41.11 notesconfig.json

```jsonc
{
  "schema_version": 1,
  "department_heads": { "engine": ["wostara"], "factory": [], "deck": [] },
  "department_folders": { "engine": ["Shipyard Prep", "Standing Items"] },
  "templates": [
    {
      "template_id": "blackout-recovery",
      "title": "Blackout Recovery",
      "department": "engine",
      "steps": [ { "step_id": "br-01", "text": "…", "equipment_code": "…" } ],
      "reference": "vault SOP / procedure this checklist derives from (display-only)"
    }
  ]
}
```

Edited in Console → Config (department-head or admin tier) **and from the Notes page itself** — the `＋` beside the Sections header adds one, and each section row carries rename and remove. Both writers take the ETag-guarded RMW (read with ETag → mutate → `If-Match`, retry once on 412, `If-None-Match: *` when the file does not exist yet); neither ever writes blind. `department_heads` drives the `group_alert` and delete-any-note permissions; it is authorization *within the hub only* and grants nothing elsewhere.

### 41.12 Console ingest and SQLite

New `sync-notes.js` lane in the standard 2-minute poll, cursor-driven (`ingest_cursors` subsystem `notes`, `scope_key` = year). The lane mirrors raw events first, then re-derives the whole cache through the **shared reducer** (`notes-reduce.js`, canonical copy in the IDMS repo at `utils/notes-reduce.js`, mirrored byte-identical like `crew-display.js`) — deliberately whole-table on change, so there is no incremental application logic to drift from the page's. Tables (cache only, OneDrive is truth):

| Table | Purpose |
|---|---|
| `notes_events` | Raw event mirror: `event_file` (PK, the filename = sort key), `event_id`, `event_type`, `note_id`, `actor`, `timestamp`, `year`, `payload_json` |
| `notes` | One derived row per note: title/body/scope/folder/assignee/equipment_code, `origin`, `template_id`, `task_id` (mirrors), completed/archived/deleted/group_alert flags, `steps_json`, `attachments_json`, `completions_json`, `comment_count` |
| `note_comments` | Derived comments with `attachments_json` |
| `note_alert_acks` | Per-user acked ids, derived from `alert_acked` events |

Rebuild/verify registered in `DIAG_REGISTRY` (`notes`) like every other subsystem; rebuild clears events + derived + cursors and replays from OneDrive.

### 41.14 Attachment retention

Attachments outlive their note by a grace period, then become **eligible for purge**. The clock depends on how the note left circulation:

| Note state | Grace | Why |
|---|---|---|
| Deleted | 30 days | Recovery window for a mistaken delete. |
| Completed | 30 days | The work is done; the evidence is not needed indefinitely. |
| Promoted to task | 10 days | The documents are copied onto the task at promote time (§41.6), so this is purely insurance against a failed sync. |
| **Archived** | **never** | Archiving is the deliberate "keep this" action. An archived note keeps its files indefinitely, whatever else is true of it. |

When more than one clock applies, the **earliest** due date wins. Un-completing or un-archiving clears the corresponding stamp, so the clock restarts rather than carrying a stale deadline. Both clients show the remaining time on the note (`files kept 5d (completed)`), and the delete confirmation says how long attachments survive.

**Eligibility is not deletion.** `docs/architecture.md` reserves deletion for a human action, and a background timer quietly destroying evidence is exactly what that rule exists to prevent. The reducer computes *what is due*; a Console screen lists it and an officer purges — one click, with the list in front of them. No timer deletes anything on its own.

### 41.13 Open items

- ~~**[OPEN]** Placement of department-head folders relative to the department personnel folder.~~ **Settled (v2.31.1):** they are *sections*, their own headers between Department and Personnel, per §41.4a.
- ~~**[OPEN]** Who may author notes at department level.~~ **Settled (v2.31.1):** anyone, deliberately — mostly-global rules keep the first release clean, and an authorship setup page stays a future option rather than a commitment.
- **[OPEN]** Whether aggregates ship in the first release or replay-only suffices at initial volumes (41.3).
- **[NEXT SLICE]** The Console-side attachment purge screen required by §41.14 — the reducer already computes eligibility; nothing purges yet.
- ~~**[OPEN]** Whether switching a note to **Assignable** should keep its `equipment_code` instead of clearing it (§41.6a).~~ **Settled (v2.31.9):** it keeps it. The tag is orthogonal to the type — the type says who a note is for, the code says what it is about — and only Unassigned clears it. Settled by the same decision that made promotion prefill the equipment picker.
- **[OPEN]** The promotion lightbox is Console-only. The notes page shows the button and points at the Console, because the PWA's task-creation form lives in `index.html` and a copy on the notes page would be a *third* implementation to keep in step. Extracting one shared form is the way to close this, not copying a second.
- Emergency mode (41.9) is staged after the hub's first online-only release; the service worker work is tracked with PWA-SCHEMA §19.

---

## §42 — Procurement & Inventory

**Status:** Spec ratified 2026-09-05 (v2.32). PWA built; Console lane not built.
**Files:** `procurement.html` + `utils/procurement-reduce.js` (this repo); Procurement hub screen in `index.html`; `src/renderer/js/procurement.js` + `sync-procurement.js` (Console — future).
**Location:** PWA: **Procurement**, a role-gated top-level department. Console: Operations → Procurement (future).

### 42.1 Overview

Stores and ordering for the vessel, as one closed loop: what we hold, what we need, what we ordered, what arrived. It replaces the "To Order" list that has been living in Microsoft To-Do (and, since v1.10, as an Engine Room notes folder — see §41), which records an intention to buy something and nothing else: not whether it was ordered, not whether it arrived, not whether we already had one on the shelf behind it.

Four governing rules, stated once and enforced everywhere:

1. **On-hand quantity is never authored — it is always derived.** No event writes a stock level. Every event records a *movement* (received, issued, adjusted, transferred) or a *count*, and the level is their sum. This is what makes the register auditable: every unit on the shelf traces to the event that put it there, and a wrong number is corrected by recording the correction, never by overwriting the history that produced it.

2. **One fact, one event.** Receiving against a purchase order writes one movement carrying `po_line_id`; the order line's progress is *derived* from the movements that reference it, never stored a second time. Same reasoning as §41's rule that a task mirror holds no completion state of its own — two stores of one fact will diverge, and then neither can be trusted.

3. **Items are archived, never deleted.** A part that leaves the register still owns the movements, receipts and orders that mention it. Deletion would orphan the history that justifies the spend.

4. **The taxonomy is config, and it belongs to somebody else.** Storerooms, bins, categories, part numbering and the supplier list live in `procurementconfig.json` (§42.5), which this module *reads*. Items reference taxonomy entries by id, and an id the config does not explain renders as itself rather than disappearing. That tolerance is deliberate: the physical structure is being worked out separately and will change shape more than once, and no reshuffle of the storerooms may ever hide stock.

### 42.2 Surfaces

| Surface | Implementation | Data path |
|---|---|---|
| PWA — Procurement department | `procurement.html`, same origin and MSAL registration as `index.html` (the §41 Notes pattern) | Graph direct, event replay + poll |
| ↳ department hub | `screen-proc-home` in `index.html` — tiles route into `procurement.html?view=…` | — |
| Console: Operations → Procurement | Native renderer screen (future) | SQLite derived cache via a `procurement` ingest lane |

The module is its own page for the same three reasons Notes is: `index.html` is already ~11k lines and every screen added to it is paid for by everyone on every load; a storekeeper wants the register open in a window all day while working the shelves; and a page of its own can be worked on without contending for the single file every other module also lives in.

**Procurement is a real department, not a synthetic one.** Unlike Purser (role-gated hub, no config of its own), Procurement appears in the department picker on its own terms, carries `procurementconfig.json`, and owns an event stream. It was *gated* by role rather than by `departments[]` membership, for want of a Procurement department to put anyone in; since 2026-09-07 it is gated by department after all — `settings.access_departments`, shipping as the engine room (§42.11).

### 42.3 OneDrive files

```
data/procurement/
├── events/
│   └── {YYYY}/                 ← {iso}-{event_id}.json — single append-only stream, all event types
└── aggregates/
    └── {YYYY}/                 ← procurement-aggregate-{YYYY}.json — Console-derived cold-start cache (future)

config/procurementconfig.json   ← locations, categories, units, suppliers, approval and reorder settings
```

One stream, all event types, exactly as §41.3 and the Phase 5 observation log: filenames `{iso}-{event_id}.json` with `:`, `.` and `-` stripped from the timestamp so lex-sort is chrono-sort, written `If-None-Match: *` so a retry 412s into a no-op. Per-item and per-order grouping happens in derived state, keyed by `item_id` / `req_id` / `po_id` in the payloads.

**Why the stream and not a state file.** `fuelstate.json` (§25) is the counter-example worth naming: it holds current tank volumes and a correction log beside them, and every direct edit has to be reconciled against the transfers that also move the number. Stock has more writers than tanks do — anyone can take a part off a shelf — and there is no moment when they are all ashore. An append-only stream lets two people receive from the same pallet at the same time on different phones without a lock and without a lost update, which is the actual working condition on a receiving day.

### 42.4 Event envelope and types

Envelope is the standard one (`docs/architecture.md`, identical to §41.4):

```json
{
  "schema_version": 1,
  "event_id":   "uuid",
  "event_type": "stock_movement",
  "actor":      "wostara",
  "timestamp":  "2026-09-05T18:22:04.117Z",
  "payload":    { }
}
```

| Event | Payload | Notes |
|---|---|---|
| `item_created` | `{item_id, name, unit, category_id?, part_number?, sfi_code?, barcode?, min_qty?, max_qty?, reorder_qty?, default_location_id?, suppliers?, notes?}` | `item_id`, `name` and `unit` are the only required fields. Everything else can be filled in later, from the shelf. |
| `item_updated` | `{item_id, …changed fields only}` | Sparse patch. Absent key = unchanged; explicit `null` = cleared. |
| `item_policy_set` | `{item_id, min_qty?, max_qty?, reorder_qty?, sfi_code?, barcode?, notes?}` | IDMS's own reorder policy over a mirrored item (§42.14). Sparse: an absent key is unchanged, an explicit `null` clears back to whatever TM Master says. Never a name, a supplier or a part number — those are TM Master's to state. |
| `item_change_proposed` | `{item_id, proposal_id, fields, reason?}` | A correction to a field TM Master owns. Recorded against the item and shown with its author, **never applied** (§42.14). An officer makes the change in TM Master and the next export carries it back. |
| `item_archived` / `item_unarchived` | `{item_id, reason?}` | Hides from pickers and the default register view; stock history and order references survive (rule 3). Archiving an item still holding stock is allowed but warned. |
| `stock_movement` | see §42.7 | The only event that changes a quantity. `kind` discriminates receipt / issue / adjustment / transfer / count. |
| `count_session_opened` | `{session_id, location_id, scope?, expected_items?, note?}` | Opens a sweep of one space (§42.7a). Moves nothing. `scope` is `"here"` (default) or `"deep"`. |
| `count_session_closed` | `{session_id, confirmed?, expected_items?, note?}` | Closes it. `confirmed` is the `item_id`s seen and found correct — they file no movement, so this is the only record they were looked at. |
| `count_session_abandoned` | `{session_id, reason?}` | Gives up the claim that the space was swept. Counts already filed under it stand. |
| `requisition_created` | `{req_id, department?, need_by?, priority?, justification?, lines: [line]}` | Requester is the envelope `actor`. May be created with lines or empty. |
| `requisition_updated` | `{req_id, …changed header fields, lines?}` | Whole-`lines` replacement while `draft`; header-only once submitted. |
| `requisition_submitted` | `{req_id}` | draft → submitted. Locks the lines against edit by anyone but an approver. |
| `requisition_decided` | `{req_id, decision: "approved"\|"rejected", line_decisions?, comment?}` | One event carries the whole decision, per-line approvals included — an approval that silently drops a line is the failure mode this prevents. `line_decisions` is `{[line_id]: {decision, qty_approved?}}`; absent means every line takes the header decision. |
| `requisition_cancelled` | `{req_id, reason?}` | Requester or an approver. Terminal. |
| `po_created` | `{po_id, po_number?, supplier_id?, currency?, expected_date?, lines: [po_line], notes?}` | `po_line.req_line_id` links back to the requisition line it satisfies; that link is what closes the loop for the person who asked. |
| `po_updated` | `{po_id, …changed header fields, lines?}` | Whole-`lines` replacement while `draft`. Once sent, header and `expected_date` only — quantities change by cancelling and re-raising, so what was actually ordered stays legible. **One exception:** a line's `item_id` may still be set on a sent order when it was previously unset, because naming which item a line refers to is a link rather than a change to what was ordered. This is the path a free-text line takes when it is received and becomes a real item (§42.9); without it the stock would be right and the order line would never point at it, so `on_order` would silently miss. |
| `po_sent` | `{po_id, sent_via?, sent_at?}` | draft → sent. From here the lines are quantities we are owed. |
| `po_cancelled` | `{po_id, reason?, line_ids?}` | Whole order, or named lines. Cancelled lines stop counting toward `on_order`. |
| `po_closed` | `{po_id, reason?}` | Manual close for an order that will never fully arrive — short shipment written off, supplier discontinued the part. Distinct from cancellation: what did arrive stays received. |

There is deliberately **no `po_received` event.** Receipt is `stock_movement` with `kind: "receipt"` and a `po_line_id`; an order line's received quantity is the sum of movements pointing at it, and its status follows from that sum (§42.9). Rule 2.

### 42.5 The taxonomy seam — `procurementconfig.json`

> **Superseded in v2.33 by §42.14.** The taxonomy this section anticipated turned out to exist already, in TM Master, and to be far larger than a hand-kept config: 14,487 items across a 664-node stowage tree. Locations, categories, units and suppliers now arrive in the generated catalogue (§42.14); `procurementconfig.json` keeps only its `settings` block, and its taxonomy arrays remain as a fallback for a vessel with no TM Master export at all. **The tolerance rules below still hold and are what made the switch cheap** — ids stayed opaque strings, hierarchy stayed `parent_id`, and an unrecognised id still renders and still counts.

This file is the boundary between this module and the physical-structure work. **This module reads it and never writes it**, with the single exception of the `settings` block below. Shape:

```json
{
  "schema_version": 1,
  "locations": [
    { "location_id": "eng-store",   "name": "Engine Store", "parent_id": null,        "kind": "storeroom" },
    { "location_id": "eng-store-a3","name": "Rack A3",      "parent_id": "eng-store", "kind": "bin" }
  ],
  "categories": [
    { "category_id": "seals", "name": "Seals & Packing", "parent_id": null, "sfi_hint": "360" }
  ],
  "units": [
    { "unit": "ea", "name": "Each",  "decimals": 0 },
    { "unit": "L",  "name": "Litre", "decimals": 2 }
  ],
  "suppliers": [
    { "supplier_id": "acme", "name": "Acme Marine", "email": "", "phone": "", "account_ref": "" }
  ],
  "settings": {
    "approver_roles": ["Chief Engineer", "Admin"],
    "access_departments": ["Engine Room"],
    "default_currency": "USD",
    "receiving_locations": ["eng-store"],
    "exception_stale_days": 14
  }
}
```

**What this module guarantees to the taxonomy work:**

- `location_id`, `category_id`, `supplier_id` and `unit` are **opaque strings**. Nothing parses them, infers hierarchy from them, or requires a particular format.
- Hierarchy is expressed *only* by `parent_id`, and only for display and roll-up. Stock is held at whatever location an item's movements name — a storeroom or a bin, indifferently — so the taxonomy may deepen later without restating a single movement.
- **An unknown id is rendered, not dropped.** An item at `location_id: "eng-store-a3"` when the config no longer lists that bin shows as `eng-store-a3` marked as not in the current layout, and its stock still counts toward the item total. Re-organising the storerooms can never make stock vanish from the register.
- Lists may be empty. With no `locations[]` the module runs with a single implicit location (`"unassigned"`); with no `categories[]` items are simply uncategorised. The register is usable before the taxonomy exists.
- Extra fields are preserved on read and ignored — the taxonomy work may add whatever it needs.

**`settings` is the only block this module writes**, from the Procurement settings screen, via the ETag-guarded read-mutate-write used for `notesconfig.json` (§41.3). Locations, categories, units and suppliers are never written from the PWA.

### 42.6 The item record

Derived, not stored — this is the shape `reduceProcurement()` returns per item:

| Field | Source | Notes |
|---|---|---|
| `item_id` | create | UUID, canonical identity. |
| `name`, `unit`, `notes` | create / update | `unit` is a key into `units[]`; an unknown unit displays raw. |
| `part_number` | create / update | Manufacturer or supplier part number. **Not unique** — two suppliers sell the same seal under two numbers, and one number gets reused across suppliers. Search matches it; nothing keys on it. |
| `sfi_code` | create / update | Optional join to the asset register (§9). The universal join key across IDMS — set it and the item joins failure history, task records and the vault corpus for free. |
| `barcode` | create / update | Optional; reserved for scanning (§42.13). |
| `category_id`, `default_location_id` | create / update | Taxonomy references (§42.5). |
| `min_qty`, `max_qty`, `reorder_qty` | create / update | Reorder policy (§42.10). All optional; absent `min_qty` means the item never raises a low-stock flag. |
| `suppliers[]` | create / update | `[{supplier_id, supplier_part_number?, last_price?, currency?, lead_time_days?}]`. Ordered — first is preferred. |
| `by_location` | movements | `{[location_id]: qty}`. A location reaching zero is retained at `0` rather than removed, so "we used to keep them in A3" stays visible. |
| `on_hand` | movements | Sum of `by_location`. |
| `on_order` | PO lines | Ordered less received, over open (`sent`, `partial`) lines only. |
| `requested` | requisition lines | Approved-but-not-yet-ordered quantity. |
| `last_movement_at`, `last_count_at` | movements | `last_count_at` drives the cycle-count view (§42.10). |
| `archived` | archive events | |

### 42.7 Stock movements

One event type, one place where the arithmetic lives:

```json
{
  "movement_id": "uuid",
  "item_id":     "uuid",
  "kind":        "receipt | issue | adjustment | transfer | count",
  "qty":         12,
  "location_id": "eng-store",
  "to_location_id": null,
  "direction":   null,
  "counted_qty": null,
  "po_id": null, "po_line_id": null,
  "session_id": null,
  "task_id": null, "equipment_code": null,
  "unit_cost": null, "currency": null,
  "reason": null, "note": null
}
```

**`qty` is always a positive magnitude. `kind` decides what it does.** No signed quantities anywhere except through `direction`, because a sign convention silently inverted is the classic way an inventory ledger goes quietly wrong and stays wrong.

| `kind` | Effect | Required | Notes |
|---|---|---|---|
| `receipt` | `+qty` at `location_id` | `qty`, `location_id` | `po_id` + `po_line_id` when receiving against an order (§42.9). Without them it is a direct receipt — stores bought ashore, a part handed over by a rider — which is legitimate and recorded as such. `unit_cost` optional. |
| `issue` | `−qty` at `location_id` | `qty`, `location_id` | `task_id` and/or `equipment_code` optionally say what it went on; both are free-standing references, and §41's boundary holds — issuing a part **never** writes to `task_records`, TM Master or job history. |
| `adjustment` | `±qty` at `location_id` per `direction` | `qty`, `location_id`, `direction`, `reason` | `direction` is `"increase"` or `"decrease"`. `reason` is required: damage, expiry, found, lost. An adjustment without a reason is an unexplained hole in the ledger. |
| `transfer` | `−qty` at `location_id`, `+qty` at `to_location_id` | `qty`, `location_id`, `to_location_id` | One event, both halves — a transfer recorded as two events can half-fail. |
| `count` | sets `location_id` to `counted_qty` | `counted_qty`, `location_id` | Records what was physically counted. The reducer stores the implied `variance` (`counted_qty` − book quantity at that point in the replay) on the derived movement, so the count reads as "counted 12, book said 15, −3" rather than as a bare correction. `session_id` when the count was filed as part of a sweep (§42.7a); absent, it is a spot correction. |

**Negative on-hand is permitted and flagged, never blocked.** An issue that takes a location below zero means the book is wrong, not that the part is still on the shelf; refusing the entry would teach the crew to stop recording issues, which costs far more than a temporary negative. It surfaces on the exceptions list until a count clears it.

**Over-receipt is permitted and flagged.** Receiving 12 against an order line for 10 records 12, because 12 is what arrived.

### 42.7a Count sessions

**Status:** Settled and built on both surfaces. PWA 2026-09-06, Console 2026-09-06, brought level 2026-09-07.
**PWA:** `procurement.html` — the Stock Location screen (`?view=location`), with its own tile on the Procurement hub in `index.html`.
**Console:** `IDMS-Console/src/renderer/js/stocklocation.js`, nav key `stocklocation`; `IDMS-Console/docs/stock-location.md` is the long form.
**Reducer:** `utils/procurement-reduce.js` — `locationSheet`, `locationsUnder`, `lastVerified`.

A `count` movement is a **spot correction**: stand in front of a bin, type what is there, and the arithmetic follows. That is what §42.7 has always supported and it is unchanged.

What it cannot express is a **sweep** — one space walked end to end on one date. An item counted and found right moves nothing, so it files no movement, so it leaves no trace, and a shelf audited clean last Tuesday is indistinguishable from a shelf nobody has opened in a year. Both read as *no count*. The single figure an audit turns on is the one the movement log structurally cannot hold.

A session is that record and nothing else. **It moves no stock.**

```json
{
  "session_id":  "uuid",
  "location_id": "LOC-0142",
  "scope":       "here | deep",
  "status":      "open | closed | abandoned",
  "expected":    38,
  "note":        null
}
```

**Counts filed under a session are ordinary `count` movements carrying a `session_id`.** Rule 1 holds unchanged — on-hand is still derived from movements, the session is a grouping laid over movements that already stand on their own, and deleting every session event would change no quantity. A spot correction is the same movement with no `session_id` on it, which is why the Count button elsewhere in the module needed no change.

**`confirmed` is the half a movement cannot carry.** The `item_id`s a sweep reached and found the book right about. They move nothing and so file nothing; without the session they are indistinguishable from the items nobody ever reached. An item both counted and confirmed is one item, not two — the operator ticked it and then thought better of it.

**`expected` is read off the opening event, never recomputed.** Coverage is a claim about the sweep *as it was walked*; a transfer into the space an hour later must not retrospectively turn a complete count into a partial one.

**Abandoning gives up the claim, not the counts.** The counts already filed corrected real shelves, and a shelf does not become uncounted because the walk was cut short. What is abandoned is only the assertion that the space was swept.

Derived per session: `items_counted`, `items_confirmed`, `items_seen` (the union), `variance_count`, `net_delta`, and `coverage` (`items_seen / expected`, null when nothing was expected). A count that found the book right is not a variance — a sweep of forty items with three wrong is a good sweep and must not read as three items' worth of work.

`lastVerified(state)` gives the latest **closed** session per location; an abandoned one is not a sweep and does not count.

**Items gain `last_verified_at`**, which moves for a count *or* a confirmation. `last_count_at` keeps its existing meaning and only moves when a count movement was filed, so nothing already reading it changes behaviour.

#### The location sheet

`locationSheet(state, catalogue, location_id, {scope})` is defined in the reducer rather than in either screen, because the Console and the phone must ask the same question of the same shelf and **a sheet that differs by device is a sheet nobody can sign.**

Two kinds of row belong on it, and they are not the same thing: stock the book says is *here now*, and items whose `default_location_id` is here **though the book says none are left**. The second is the more useful half of an audit — an emptied bin is exactly where a miscount hides.

| Rule | Why |
|---|---|
| `book_qty` is the figure for **this space**, never the item's shipwide total | Counting a bin against a ship's total is how a count sheet destroys good stock. `elsewhere` carries the difference. |
| Unknown stock prints as unknown, not as `0` | 2,181 items carry no stock figure (§42.14). A sheet that prints 0 invites somebody to agree with it. |
| A row summing several bins offers **no** `count_location_id` | On a `deep` sheet there is no single bin for the count to land in, and a count filed against the wrong one is worse than none. The screen offers no box on that row. |
| A row with no stock but a home here counts against the home | So the empty bin is still asked about. |

#### What the two surfaces owe each other

The sheet is the same function on both, and the questions are the same three —
*where am I, what is here, what is this thing*. What may differ is only how the
three are stacked.

| | Console | PWA |
|---|---|---|
| Where am I | a tree pane held open beside the sheet | drill-down: deck, space, shelf |
| What is here | the sheet, top right | the sheet, below the crumb |
| What is this | a third pane, bottom right | opens under its own row |
| Print a sheet to walk with | yes | no — a phone is where you type a count |

Everything else is shared and is expected to stay shared. Two rules hold on both:

- **A long sheet is filtered and capped, and says so.** Over 25 rows it gets a
  filter box; the render stops at 400 rows and prints what it is not showing.
  Unlocalized Stock is 2,864 rows and Fwd Shop 583 — laying every one of them
  out, each with a number input, is a phone that stops responding. Truncating
  *silently* would be worse than either: a sheet claiming to be the whole space
  and not being it is a sheet somebody signs for stock they never saw. The audit
  bar still counts against the **whole** sheet, because coverage is a claim
  about the space and not about what is currently on screen.
- **Unlocalized Stock is a space like any other.** It has no node in the stowage
  tree and is still 2,864 items and the obvious place to work through when
  assigning homes, so it is a sheet, it is countable, and it can be audited. A
  guard written as *is this a real location* locks it out; the guard is
  *is this a real location **or** the reserved unplaced id*.

### 42.8 Requisitions

A requisition is somebody saying *we need this*, which is a different act from *we have ordered this* — and keeping the two apart is most of the value of the module.

```
req_id, department?, need_by?, priority?, justification?
lines[]: { line_id, item_id?, description?, qty, unit?, notes? }
```

`item_id` **or** `description` — a line may name an item already in the register, or describe something that has never been aboard. Free-text lines are the normal case for a first order and must not be second-class: at receipt, a free-text line offers to create the item, which is how the register grows without anyone having to sit down and populate it.

Status: `draft → submitted → approved | rejected → ordered → closed`, plus `cancelled` from any non-terminal state.

- `approved` becomes `ordered` when every approved line is covered by a PO line, and `closed` when every one of those PO lines is fully received. Both are derived — there is no event that says "ordered", because the PO already said it.
- Partial approval is normal: `line_decisions` approves three of five lines, and the requisition sits `approved` with two rejected lines still visible alongside their rejection.
- `qty_approved` may be less than `qty` requested. The requester sees both.

### 42.9 Purchase orders and receiving

```
po_id, po_number?, supplier_id?, currency?, expected_date?, notes?
lines[]: { line_id, item_id?, description?, qty_ordered, unit?, unit_price?, req_line_id? }
```

`po_number` is the human reference — the supplier's or the office's, whatever is written on the paperwork. Display and search only; `po_id` is identity.

**Derived line status**, from receipts referencing `po_line_id`:

| Received | Line status |
|---|---|
| 0 | `open` |
| 0 < received < ordered | `partial` |
| received ≥ ordered | `received` (`over` when strictly greater) |
| line cancelled | `cancelled` |

**Order status** is the roll-up: `draft`, `sent`, `partial` (some line has a receipt, not all lines complete), `received` (every non-cancelled line complete), `cancelled`, `closed`.

**Receiving (check-in)** is the module's busiest screen, and it is built for a person standing at a pallet with a phone in one hand:

1. Pick the order — open orders first, most recently sent at the top, searchable by `po_number` or supplier. **Or "no order"**, for stores that arrive without paperwork.
2. Each line shows ordered, already received, and outstanding, with the outstanding quantity pre-filled, so the common case — it all came — is one tap per line.
3. One receiving location for the whole delivery, defaulted from `settings.receiving_locations`, overridable per line.
4. Optional unit cost per line, defaulted from the order.
5. Commit writes **one `stock_movement` per line with a non-zero quantity** — never one event for the whole delivery, because the lines are separate facts and one of them may later turn out to be wrong on its own.

A short shipment is simply a smaller quantity: the line goes `partial` and stays on the outstanding list. Nothing needs to be said about the rest, and nobody has to remember to come back and close anything.

**Idempotency.** A receipt commit interrupted part-way leaves the lines it already wrote; re-running it shows the reduced outstanding quantities, so the retry receives the remainder rather than doubling the delivery. Movement events are individually `If-None-Match: *` guarded on their own `movement_id`, so a retried *identical* write 412s into a no-op.

### 42.10 Reorder, low stock and counting

**Low stock is `on_hand + on_order < min_qty`.** Including what is already on order is the whole point: the failure this module exists to stop is ordering a second time because nobody could see the first order is on its way. Items with no `min_qty` never appear.

**Suggested order quantity** is `max_qty − (on_hand + on_order)` where `max_qty` is set, otherwise `reorder_qty`, otherwise the shortfall against `min_qty`. It is a suggestion in a pre-filled field, never an automatic order.

**Cycle counting.** There is no annual stock-take mode: a count is a `stock_movement` like any other, and counting ten items on a quiet afternoon is the intended shape. What is offered least-recently-verified-first is the **space list** on the Stock Location screen (§42.7a), ordered by the `closed_at` of each space's last closed session, with never-swept spaces first and spaces holding nothing left out — a room with nothing in it is not overdue a count, it is empty. The item register itself is search-first and does not sort on count recency; `last_count_at` and `last_verified_at` are shown on the row and in the item detail, not sorted on. (Earlier versions of this paragraph said the register sorted by `last_count_at` ascending. It never has.)

**Exceptions list** — one screen, the things that need a human: negative on-hand, over-receipts, orders past `expected_date` with outstanding lines, approved requisition lines older than `settings.exception_stale_days` with no PO, and items below minimum with nothing on order.

### 42.11 Permissions

Deliberately close to §41's mostly-global stance — the record of who did what is the oversight — with one real gate, because approving spend is not the same as recording a shelf.

| Action | Who |
|---|---|
| Read everything | Anyone through the department gate below |
| Create/edit items, all stock movements, counts | Anyone through the department gate below |
| Raise and submit a requisition | Anyone |
| **Approve or reject a requisition** | `settings.approver_roles`, plus `permission_tier: "admin"` |
| Create, send, cancel or close a PO | Approvers |
| Edit `settings` | Approvers |

**Department gate.** Procurement is offered to `permission_tier: "admin"`, to roles listed in `settings.approver_roles`, to any user carrying `"Procurement"` in `departments[]`, and to anyone in a department named by `settings.access_departments` — which ships as `["Engine Room"]`. Same shape as `userIsPurser()`, generalised twice.

**Why the fourth door** (2026-09-07). The first three left the module gated on *rank*: an approver role, or a Procurement department the crew records do not have. But stores are held by a department, not by a rank. The people who stow the parts, walk the shelves and know that the spare is behind the lathe were the people locked out, and a first engineer had to be asked to look a part number up. `access_departments` gates on the department the work actually belongs to, which is what §42.11's first two rows meant by "anyone with the Procurement department" all along — the engine room *is* that department on this vessel.

**Access is not approval, and the split is the whole design.** Widening the door does not touch `pcCanApprove()` / `prcCanApprove()`: approving spend, and sending, cancelling or closing a PO, stay with `approver_roles` plus admin. An oiler can now count a shelf, book in a delivery and ask for a part. Agreeing to buy it is still an officer's signature. That is the line the table above draws between recording a shelf and committing money, and it is the reason widening was safe to do at all.

**Two properties of the list worth keeping.**

* **A missing key falls back to the default; an emptied list does not.** Every `procurementconfig.json` now on OneDrive was written before this key existed, so a missing key must mean `["Engine Room"]` or the change would do nothing until somebody edited JSON on a boat. But an *empty* list means empty — clearing the field in Settings is the only way to close the module back to roles alone, and reading it as "you must have meant the default" would make the setting one-way. `approver_roles` deliberately behaves the other way (empty falls back), because a config naming no approver is broken, while a config naming no department is merely strict.
* **The gate is written twice and must agree.** `userIsProcurement()` in `index.html` decides whether the department is offered; `pcHasAccess()` in `procurement.html` is authoritative on the page. Widen one and not the other and you get a tile that appears and then refuses, or a module nobody can find. `tools/test/access.test.js` pulls both functions out of their pages and asserts they answer identically for every crew record — it caught exactly that disagreement while this was being built.

**`browser` is a reserved actor here too** (§41.4d). A shared window may record movements — that is exactly what a receiving station is — but it can never approve a requisition or send an order, because those need a name.

### 42.12 Console side — built (v2.35)

`Operations → Procurement` in IDMS-Console 0.8.5. **Two renderers of one contract**, the rule the Notes Hub pair already follows: the same event stream, the same catalogue, and `utils/procurement-reduce.js` mirrored byte-identical into `src/renderer/js/` (the `crew-display.js` convention). Agreement is structural, not a thing anyone has to maintain.

| Piece | File |
|---|---|
| Ingest lane | `src/renderer/js/sync-procurement.js` |
| Screen | `src/renderer/js/procurement.js` |
| Reducer mirror | `src/renderer/js/procurement-reduce.js` |
| Graph helpers | `graph.js` — event stream, catalogue, ETag-guarded `settings` write |
| Tables, IPC, diagnostics | `src/main/main.js` — `procurement` in `DIAG_REGISTRY` |
| Harness | `src/renderer/_procurement-harness.html` |

**The lane** is `sync-notes.js` in shape: raw events into `procurement_events`, then the whole derived cache rebuilt through the shared reducer — whole-cache on change, because one derivation path cannot drift from itself. It lists every file and subtracts what it holds rather than seeking past a cursor, for the reason §41's lane does: an event file is named from the timestamp inside it, so a back-dated write sorts below a high-water mark and is lost for good.

**The catalogue** is the input the Notes lane has no equivalent of, and it arrives through the existing conditional-GET path (`graphGetPreferMirror` against the folder listing's eTag), so an unchanged 1.8 MB file costs a listing call and no download.

**SQLite earns its place rather than merely mirroring.** 14,487 items is far too many to hand to the renderer and filter in JavaScript, so `getProcurementItems` filters in SQL, requiring every search term to match somewhere — the way a person searches, where "seal 90" finds the 90 mm shaft seal and nothing else. Derived requisition and order lines carry an `item_name` folded in at derive time, since the Console holds no in-memory register to resolve one from; it is a cache of the reduced item's name and a rename in TM Master reaches it on the next derive.

**What is only on the Console:** approving a requisition and sending an order (§42.11) — officer actions, on the officer's machine, with per-line decisions and trimmed quantities. **What is only on the page:** nothing, deliberately.

Still to come, and the reason the Console is worth having beyond parity: spend by category and supplier over a trip, consumption history feeding `min_qty` proposals (§42.15), the join from `sfi_code` to failure history, and printable order documents.

### 42.13 Open items

- ~~**[SEAM]** `procurementconfig.json` locations / categories / units / suppliers are owned by the physical-structure work.~~ **Settled (v2.33):** the taxonomy is TM Master's, projected through the catalogue — §42.14. The tolerance rules written for the config are what made the switch cheap.
- ~~**[OPEN]** The reconciliation lane.~~ **Answered (v2.34):** it belongs to the existing service-report export path to TM Master, which is being extended into a general reconcile-and-push lane. This module supplies the input and builds no lane of its own — §42.15. What remains open is the *state* a proposal carries once that lane can push it (raised / pushed / confirmed by export / rejected), which will be a new event on this stream rather than a mutation.
- **[OPEN]** Whether to publish the 448 computed minimum proposals (§42.15) into `item_policy_set` events, and under whose signature. It is a policy decision about how the vessel orders, not a computation, and it rests on an assumed lead time until `est_delivery_days` is populated or learned.
- **[OPEN]** Whether the 138 units of measure should ever be reconciled. `Each`, `EA`, `PCE` and `pcs` are the same unit under four names, which makes any cross-item quantity roll-up meaningless. Normalising is TM Master's job, not this module's, but somebody has to decide it is worth doing.
- **[OPEN]** Whether `sfi_code` on an item should be single or a list. Single for now — a gasket used on three pumps is the case that will decide it.
- **[OPEN]** Costs are recorded (`unit_cost`, `currency`) but nothing converts currency or reconciles to an invoice. Spend reporting is Console work and needs a decision on whether IDMS is ever the financial record or always a shadow of one.
- **[FUTURE]** Barcode scanning at receipt and issue. `barcode` is on the item record for it; the camera path and the offline queue are the §19 service-worker lift, shared with §41.9.
- **[FUTURE]** Reserving stock against an approved requisition or a scheduled task, which is what would make `available` differ from `on_hand`.
- **[FUTURE]** Consumption-driven `min_qty` suggestions from movement history, and lead-time-aware reorder points.

### 42.14 The catalogue — TM Master as the item master

**This supersedes the working assumption in §42.5 that the taxonomy would be a hand-kept config file.** The vessel already has an item master: 14,487 items and a 664-node stowage tree in TM Master, exported and mirrored into the Engineering Vault at `50 Procurement/` as one note per item and one per stowage node. That is the register. This module does not get to invent a second one.

Two rules follow, and neither is negotiable:

1. **TM Master is the system of record for what an item *is*** — its name, unit, supplier, part numbers, stowage, compliance flags. This module reads a projection of it and **never writes back**. That is the ratified rule for TM Master writes across IDMS, not a limitation of this screen.
2. **The vessel still owns what it *does*.** Movements, counts, requisitions and orders are IDMS's own event stream, layered on the TM Master baseline. Stock on the shelf changes far faster than an export cycle, and a register that could only be as fresh as the last export would be useless on a receiving day.

#### The pipeline

```
TM Master  ──export──▶  Vault notes (status: mirror)  ──project──▶  catalogue JSON  ──▶  procurement.html
            (xlsx)      50 Procurement/50.3, 50.4        tools/build-procurement-catalogue.py
```

The second hop is `tools/build-procurement-catalogue.py` in this repo. It reads the Vault notes and writes only into the IDMS OneDrive folder — nothing writes to the Vault, which is what keeps the corpus a corpus. Rerun it after every fresh export:

```
python tools/build-procurement-catalogue.py [--vault PATH] [--out PATH] [--dry-run]
```

#### Files

```
data/procurement/
├── catalogue.json          ← ~1.8 MB. Everything needed to search, list and count.
└── catalogue-detail.json   ← ~2.1 MB. Specification, remarks, maker detail — fetched
                              lazily, on the first item anybody opens.
```

**Columnar and dictionary-encoded.** A `fields` header plus rows of values, with the low-cardinality columns (`uom`, `item_type`, `item_category`, `supplier`, `currency`) replaced by indexes into tables shipped alongside. Repeating forty key names and the string `"Spare part"` across 14,487 objects is most of the file otherwise — the naïve encoding is 4.6 MB, this one is 1.8. Boolean flags are packed into one integer per row against `flag_bits`. Both clients decode through `procurementReduce.hydrateCatalogue()` so neither has to know the encoding.

**Six columns are dropped**, listed in `never_populated`: `material_group`, `dangerous_goods`, `dangerous_goods_class`, `ihm_status`, `hs_code`, `hs_description`. The export carries them on every row and fills them on none.

**Caching.** The catalogue is held in IndexedDB, not `localStorage` — it would not fit, and it would be evicted against the event cache. On open, the cached copy renders immediately; one small Graph metadata request then compares eTags and the full file is re-fetched only when it has actually changed, which is once per export. A vessel that cannot reach OneDrive keeps working from the cached copy, labelled as one.

#### `baseline_at`, and what a movement means

The catalogue's quantities describe TM Master **at the moment the export was taken**, carried as `baseline_at`. The reducer seeds `by_location` from `in_stock` at the item's default stowage, then applies movements — but **only those with `timestamp > baseline_at`**. Anything at or before it was already absorbed into the exported figure, so applying it again would double-count. Such movements stay in the ledger, greyed and marked *already in the baseline*, and are counted in `superseded_movements`; the history reads continuously even where the arithmetic stops.

A consequence worth stating plainly: **a fresh export supersedes the movements older than it.** If a count recorded here has not yet been keyed into TM Master when the next export is taken, the export wins and the count is lost from the arithmetic. That divergence is the reconciliation report — the shelf said X, TM Master says Y — and is exactly what the exceptions screen is for.

**`in_stock: null` means unknown, not zero.** 2,181 items carry no stock figure in the export. They render as `—`, never as `0`, and never raise a low-stock flag; reporting 2,181 phantom shortages would bury the 152 real ones.

#### The policy overlay

**13,885 of the 14,487 items carry no minimum at all** — only 602 have one. A register nobody can set a minimum on is a register nobody can act on, and minimums must not require an officer to open TM Master. So IDMS keeps its own reorder policy over the mirror, in `item_policy_set` events:

| Field | Owner |
|---|---|
| `min_qty`, `max_qty`, `reorder_qty` | **IDMS** — policy, not fact. Overlay wins; clear it and TM Master's value returns. |
| `sfi_code` | **IDMS** — the export carries none, and this is the join to the asset register (§9), task records and failure history. |
| `barcode`, `notes` | **IDMS** |
| everything else | **TM Master** — read here, corrected there |

`procurementReduce.effective(item, field)` is the only correct way to read one of these: overlay first, then the mirror. The UI marks an overlaid value so nobody mistakes it for TM Master's.

#### Proposals

An edit to a TM-owned field is recorded as an `item_change_proposed` event and **never applied**. It shows on the item with who asked, when, and why; an officer makes the change in TM Master and the next export carries it back. A legacy `item_updated` against a mirrored item is treated the same way rather than being silently applied or silently dropped.

#### Local items

An item created here that TM Master has never heard of — stores bought ashore, a part received against a free-text order line — is a normal `item_created` with `source: 'local'`, and works exactly as §42.6 describes. `item_created` against an id the catalogue already supplies is ignored, so a stale local create can never rewrite a mirrored item.

#### `on_order`, from two places

TM Master reports 1,255 items on order at baseline; this module raises orders of its own. They are kept apart as `on_order_tm` and the derived PO remainder, and added for `on_order`. Collapsing them would make it impossible to tell an order raised aboard from one raised ashore.

#### What the register says right now

| | |
|---|---|
| Items | 14,487 |
| Stowage locations | 664, across 10 decks and shore stores |
| No stowage recorded | 2,864 |
| No stock figure in the export | 2,181 |
| Negative on hand | 35 |
| No minimum set | 13,885 |
| On order in TM Master | 1,255 |
| Critical occurrences | 58 |
| Blocked | 689 |

#### Source data this module does not correct

- **One shifted row.** `ITM-04387` carries a maker name in `OnOrder` and a part number in `Price`. The builder coerces non-numeric values in numeric columns to unknown and reports them; the fix belongs in TM Master.
- **138 distinct units of measure**, including `Each`, `EA`, `PCE` and `pcs` all meaning the same thing. Displayed as written. Quietly normalising somebody else's vocabulary is how a register stops matching the shelf label.
- **Stowage is a path, not a code.** `Maindeck\Fwd Shop\SH 5\5-2`. Lists show the last segment; the item screen shows the whole path.

### 42.15 Writing back to TM Master, and where minimums would come from

Two things sit downstream of §42.14 and are recorded here so the module is built to meet them rather than to be retrofitted.

#### The push-back lane

IDMS already exports service reports to TM Master, and that lane is being extended into a general reconcile-and-push path. **This module must not grow a second one.** Its two write-shaped event types are deliberately in the right shape to be *input* to that lane rather than a dead-end record:

| Event | What the lane would do with it |
|---|---|
| `item_change_proposed` | A correction to a TM-owned field, with `fields`, `reason`, actor and timestamp. This is already a proposal in the ratified sense — it goes to TM Master when an officer signs it, and comes back on the next export. |
| `stock_movement` where `timestamp <= baseline_at` | The superseded set (§42.14). These are movements the vessel recorded that the export has now overwritten — precisely the keying worklist a reconcile pass needs. `superseded_movements` on the derived item is the count. |

When the lane lands, a proposal gains a state — *raised, pushed, confirmed by export, rejected* — which is a new event on this stream, not a mutation of the proposal. Until then a proposal is simply raised and visible, and §42.1 rule 1 is unaffected either way: **the arithmetic still runs off the baseline plus the movements, whichever direction the corrections are travelling.**

The reconciliation question in §42.13 resolves through this lane rather than inside this module.

#### Minimums: what the history actually supports

Assessed 2026-09-05 against the real data, because "derive minimums from consumption" is easy to say and the numbers decide whether it is worth building.

**The signal.** TM Master carries three consumption columns (2024, 2025, 2026 — the last a part year, annualised on elapsed fraction). Across 14,487 items:

| | Items | Share |
|---|---|---|
| Moved in all three years | 107 | 0.7% |
| Moved in two of three | 341 | 2.4% |
| Moved in one of three | 2,204 | 15.2% |
| **No movement recorded at all** | **11,835** | **81.7%** |

Of the 2,652 that moved at all, the median three-year total is 3 units, and 1,375 of them average one unit a year or less. Most of this register is genuinely slow-moving spares, where consumption history is not a rate and never will be.

**The gap that matters more.** A minimum is *consumption × (lead time + restock interval)*. Two of those three are in hand — consumption above, and a restock interval of **16 days** (median gap across the 19 offloads in `scheduleconfig.json`, 15 of them Dutch Harbor). **Lead time is not: `est_delivery_days` is set on 1 item of 14,487.** With a restock cycle that short, lead time dominates the answer entirely:

| Assumed lead | Items whose minimum would be ≥ 2 |
|---|---|
| 7 days | 165 |
| 30 days | 323 |
| 90 days | 647 |

A four-fold swing on a number nobody has recorded. Any minimum published today rests on that assumption, and it must be stated on the screen rather than buried.

**Service reports do not help here.** There are 6,091 completed task records spanning 2017–2026 — a genuinely deep history — but `items_used` is populated on **7** of them. What was fitted to a job lives in the free-text `service_report` field. Text mining it into an ordering decision is not a basis for one.

**What is defensible now.** Banding by how much movement history stands behind each item, at an assumed 30-day lead:

| Band | | Items |
|---|---|---|
| A | three years, steady | 56 |
| B | three years, lumpy | 51 |
| C | two years | 341 |
| D | one year, real quantity — suggestive, needs an eye | 657 |
| E | one year, 1–5 units — noise, not a rate | 1,547 |

**Bands A–C are 448 items, 3.1% of the register**, 408 of which have no TM minimum today. Only 8 of the 58 critical-flagged items fall in them — critical spares are exactly the slow movers consumption history cannot speak to, and they need an engineer's judgement, not a regression.

67 of the 448 are already below their proposed minimum, which is the immediate value: a short list of things the vessel genuinely uses and is genuinely short of.

**The flywheel.** The reason to build this anyway is that the module generates its own better input. Every issue recorded here carries a quantity, a date and optionally a `task_id` or `equipment_code` — which is the structured parts-on-job capture that `items_used` never got. A season of that is worth more than three columns of annual totals, and it arrives whether or not anybody sets out to collect it. Lead times likewise: `po_sent` to first receipt measures the real one per supplier, which is §42.13's lead-time item and the thing that would move the 448 into the thousands.

**Not built.** Proposals are computed offline for now (`data/procurement/proposed-minimums.json`, generated, read by nothing). Publishing them into `item_policy_set` events is a decision about the vessel's ordering policy, not a computation, and it belongs to an officer.

### 42.16 The contact book

**Status:** Settled and built on both surfaces. Console 2026-09-06, PWA 2026-09-07.
**Baseline:** `data/procurement/contacts.json` (~1.1 MB, 1,745 contacts) — written by the Console's `tools/vault-export/import-procurement-seed.js` from TM Master's contact export plus the supplier names that appear on orders and in no export.
**Reducer:** `utils/contacts-reduce.js`, mirrored **byte-identical** at `IDMS-Console/src/renderer/js/contacts-reduce.js`.
**PWA:** `procurement.html` — the Contacts screen (`?view=contacts`), with its own tile on the Procurement hub.
**Console:** `IDMS-Console/src/renderer/js/proc-contacts.js`; `IDMS-Console/docs/procurement-registry.md` is the long form.

Who the vessel buys from, when they were last used, and for what. That last part is the reason the screen exists: a phone number on its own is a phone number, and with "last used 13 days ago, ARA-1292-SS-2026, wharfage" beside it, it is a decision about whether to call.

#### The rule the whole lane rests on

**TM Master's contact export is a baseline, not the truth.**

```
contact_created    { contact_id, ...editable fields }
contact_updated    { contact_id, ...the fields being written }
contact_archived   { contact_id, reason? }
contact_restored   { contact_id }
```

They are appended to the ordinary procurement event stream (§42.3) and replayed over whatever baseline is current, **field by field, last write wins**. A phone number corrected aboard therefore survives the next contact export, and every field nobody touched still comes from TM. **Nothing writes the baseline file.**

| Rule | Why |
|---|---|
| An event touches only the fields it **carries** | A client that knows fewer fields than the one that wrote before it must not blank the ones it has never heard of — two apps on two release cycles is the normal case, not the edge one. Sending a field empty is how a field is cleared, which is why the form sends all of them rather than a diff. |
| Only the fields in `EDITABLE_FIELDS` may be written | `order_count`, `order_spend`, `first_order`, `last_order` and `source` are TM's, folded in by the seed. A stale client cannot write an order count. |
| `contact_created` never applies over a contact the baseline supplied | A stale create replaying onto a fresh export must not blank what TM now knows. |
| A contact added aboard gets a `CONX-` id | The seed assigns `CON-####` by sort position and those shift on every re-seed. Two numbering schemes that can never meet. |
| Retiring flags, never removes | The order register still points at the card, and a card that vanishes takes the other end of that history with it. A retired contact is hidden from the default list and nothing more. |

#### What the two surfaces owe each other

Same book, same slices (`All`, `Orders only`, `Added aboard`, `Never used`, `No way to reach`, `Blocked`, `Retired`), same orderings (name, last used, longest dormant, most orders, most spent). *Dormant* means a supplier that went quiet, not one that was never used, so contacts with no history at all sort behind them on both surfaces.

One difference, deliberate: **the Console recomputes order history from `order-register.json`; the PWA reads it off the baseline.** `contacts.json` already carries `order_count`, `order_spend`, `first_order`, `last_order` and a `recent` tail of up to 25 orders per contact, folded in by the same seed that resolved the supplier join. The Console has the 2.7 MB register open anyway for its Order history screen; the phone does not, and fetching it to re-derive figures already in hand is not a trade worth making over a satellite link. **The join is still made exactly once, in the seed** — neither surface re-resolves a supplier from its name, because two matching rules eventually disagree, and then a supplier's history depends on which surface you asked.

#### The supplier field

`pcSupplierName(id)` reads the book first, `procurementconfig.json` second, and falls back to the id itself — §42.5's tolerance is unchanged, and an id nothing explains still renders rather than disappearing. Before the book existed the config was the only source and it has never had an entry in it, so every order printed a raw `CON-####` and the New order form offered no supplier at all. The form's field is a search over the book now, not a `<select>`: 1,745 options is the same mistake as §42.14's 14,487. Retired contacts are not offered — keeping the card is not a reason to send it a new order.

#### Reading TM's own text

Neither of these is a detail, because both produce a control that looks like it works:

- **The comma is not a separator in the e-mail field.** 54 of the 936 contacts that have an e-mail are written `Surname, Given <address>`; splitting on the comma makes a `mailto:` out of the surname, addressed to nothing. Split on `;` only, take what is inside `<>` when it is there, and print anything without an `@` rather than linking it — 14 fields hold a website somebody typed into the wrong box.
- **The slash is not a separator in the phone field.** 93 of the 1,008 numbers are written `207/594-4500`, which is TM's way of setting off the area code. Splitting on it dials 594-4500 — a **wrong number rather than no number**, which is the worse of the two failures. Split on `;` only; a fragment under 7 digits, or one over 15 because an extension is stuck on the end, is printed rather than dialled. 1,005 of 1,012 dial.

---

## Addendum v2.20.1 — Crew nickname field (optional, additive)

### `crewconfig.json` — `crew[].nickname` (optional, string)

A new optional `nickname` field may be present on each crew record. Empty string
and absent field are both treated as "no nickname"; existing records without
the field continue to work unchanged. No migration is required.

```jsonc
{
  "crew_id": "f1730346-…",
  "username": "wostara",
  "name": "William Ostara",
  "nickname": "Bill",       // optional; may be absent or empty
  …
}
```

### Display conventions

Two shared helpers (`IDMS/utils/crew-display.js`, mirrored at
`IDMS-Console/src/renderer/js/crew-display.js`) define the canonical display:

- **`getDisplayFirstName(crew)`** — first-name-only contexts (schedule slots,
  short labels, compact list rows). Returns `crew.nickname` if set; otherwise
  the first whitespace-delimited token of `crew.name`.
- **`getDisplayFullName(crew)`** — full-name contexts (detail headers,
  profiles, reports, contact lists). If `nickname` is set, returns
  `First "Nickname" Last` (ASCII double-quote `"`, never curly). If `nickname`
  is unset, returns `crew.name` unchanged.

Example — `William Ostara` with `nickname: "Bill"`:

- First-name contexts → `Bill`
- Full-name contexts → `William "Bill" Ostara`

### Tech debt

Crew names are currently stored as a single `name` string. The helpers parse on
the first whitespace to derive first/last for the quoted-nickname format. A
future migration should split `name` into `first_name` / `last_name` and drop
the parsing.

### Backward compatibility

All existing crew records continue to render exactly as before. The field is
purely additive.

## §43 — Development Plan

**Status:** Specified 2026-09-07 (v2.41); built in the same slice except where a subsection says otherwise. Supersedes §35 KSA Profiles.
**Files:** `utils/plan-derive.js` (canonical; mirrored byte-identical to `IDMS-Console/src/renderer/js/plan-derive.js`); PWA **Me** screens in `index.html`; Console `personneldev.js` (member sheet, KSA Plan panel, My development), `src/main/personnel-dev.js` (demand export).
**Location:** PWA: user menu → My Profile / My KSA Card / My Training, in every department. Console: Personnel → User Profile → My development; Personnel → KSA / Development → member sheet → Development plan; toolbar → **KSA Plan**.

### 43.1 What it is

A **derived view**, computed at read time and never stored — the same discipline as the Rough Log daily line (§31) — answering, for one crew member: *which competency cards does your work demand, at what level, what do you hold, and what closes the gap.* The system of record for what a competency **is** stays the Vault (`60 Training`); for who **holds** it, the personnel journal (`data/personnel/records/`); for what work **demands** it, the SOP and TASK cards (`20 Maintenance`). The plan adds no fourth store. Its only write path is the existing journal: a chief turns a plan row into a `goal` record.

Four governing rules, carried over from `IDMS-Console/docs/personnel-development.md` §1 and restated here as contract because a plan is the surface most likely to be misread as a score:

1. **Exposure, never proficiency; a plan is never a score.** No percentage complete per person, no ranking across members, no aggregate that could be read as a league table. Counts appear per group on a member's own sheet and nowhere else. Nothing here may feed pay, discipline or crew selection.
2. **Two currencies, never one ladder.** *Practice currency* is whether the person did the work inside the chief's recency window — the existing sign-off pips, time-based. *Revision currency* is whether the person has read the current revision of a card — version-based, never time-based. Each has its own trigger and its own clearing action (§43.7). A three-state fold of the two was considered and withdrawn: it loses the case of someone current by doing who has not seen last week's revision, which is exactly the case §43.7 exists for.
3. **Demand is joined, not authored.** No card lists which people need it; no task lists which competencies it needs. Demand is derived from a task's equipment code to the cards covering that equipment to their `requires_ksa`. Authoring stays in the lanes the Vault's Corpus Conventions assign.
4. **The member sees their own plan and only their own.** Computed from `shared` journal records only, so it matches what the member can see of their record. A card whose latest sign-off is chiefs-only reads as a gap on the member's plan while the chief's sheet shows it held. That is the existing §6 visibility decision inherited, not a defect.

### 43.2 Surfaces — one derivation, three views

| Surface | Who | Shows | Writes |
|---|---|---|---|
| PWA **Me → My Training** | the member | Now / Next / Refresh groups; each card's four-rung ladder with held rung filled and required rung marked; prerequisite arrows only where a card carries `requires_ksa` (degrades to a list) | nothing |
| PWA **Me → My KSA Card** | the member | sign-offs as pips with practice currency where a currency snapshot exists; revision-behind list (§43.7) | nothing |
| PWA **Me → My Profile** | the member | the existing profile screen, reached from every department rather than Engine Room only | profile self-edits (unchanged) |
| Console **User Profile → My development** | the member | the same plan rows as the phone | nothing |
| Console **KSA / Development → member sheet → Development plan** | chief / department head | the plan with evidence columns; **Set as goal** on a row prefills the existing New goal form | `goal` record (existing) |
| Console **KSA Plan** panel | chief / department head | per-department configuration (§43.4) and the vessel view (§43.5g) | `ksa-config.json → plan` |
| Console grid | chief | **one safety flag only**: assigned work demands a competency this person has no sign-off for | nothing |

All three read paths call the same `derivePlan()`; the phone and the Console must never compute two different plans from the same inputs. The Console is the only client that can compute practice currency (it needs SQLite), so it publishes a per-member snapshot the phone reads (§43.3c). Without that snapshot the phone still renders everything except practice-stale reasons, and says so on the screen.

### 43.3 OneDrive files

```
data/personnel/
├── ksa-registry.json          ← Console-published mirror of every signable card (existing; extended, §43.3a)
├── ksa-demand.json            ← Console-published mirror of every SOP/TASK card's demand (new, §43.3b)
├── currency/{crew_id}.json    ← Console-published competency currency per member (new, §43.3c)
├── ksa-config.json            ← tracked list (existing) + `plan` block (new, §43.4)
├── exposure/{YYYY}/           ← read markers, append-only (§43.7; specified, not built)
└── records/                   ← the journal (unchanged)
```

Every published mirror carries `schema_version`, `generated_at` and `source_root`, is best-effort (a failed publish leaves the publishing machine current), and is read by the phone with a `localStorage` cache keyed on the file's eTag. Mirrors are **regenerated whole** on every Console KSA-screen open where the Vault share is reachable — the same freshness pattern as the registry today.

**a. `ksa-registry.json` — extended.** Each card gains: `has_expectations` (false while the note body is a `[STUB]`), `requires_ksa` (prerequisite card ids, link text unwrapped, levels dropped), `recency_default_months` (an integer parsed from the card's `recency:` frontmatter, else `null` — every card today reads `[VERIFY]`, so this is a door, not data), `department` (from `tags`, see §43.8), `tags`.

**b. `ksa-demand.json` — new.**
```json
{ "schema_version": 1, "generated_at": "…", "source_root": "…",
  "cards": [{
    "id": "SOP-0021-main-engine-start", "kind": "SOP", "sop_kind": "operation",
    "title": "Main engine — start from the local engine panel",
    "asset_code": "601.001", "asset_label": "601.001 Main Engine",
    "department": "engine-room", "tags": ["engine-room"], "titles": "…",
    "status": "draft", "revised": "2026-08-27",
    "requires": [{ "id": "SKD-0029-main-engine-starting", "level": 3 }],
    "requires_knowledge": [], "chains": [],
    "defects": [] }],
  "defects": [{ "card": "SOP-0071-…", "field": "requires_ksa", "entry": "[[SKD-0046-…]]: assisted",
                "kind": "level-vocabulary", "applied": "supervised" }] }
```
Only SOP and TASK cards are demand cards. JOB cards are not (23 of 23 carry no `requires_ksa`; their decomposition tables are free text in 156 of 415 rows) — a job's demand is reached through the SOPs on the same asset. Levels are the canonical four (`aware`=1, `supervised`=2, `independent`=3, `assessor`=4). Anything else is normalised **and listed** under `defects`: `assisted` → `supervised`; a knowledge note (`KNG-*`, `KND-*`) at any level moves to `requires_knowledge` with no level (knowledge is unsignable by design); an unparseable entry is dropped with a defect. The defects list is the Vault's fix queue, printed by `tools/vault-export/check-plan-inputs.js`, and the exporter never edits a card.

**c. `currency/{crew_id}.json` — new.** `{ schema_version, generated_at, crew_id, byCompetency: { "<card id>": { last, via, n } } }` — exactly the Console's `getCompetencyExposure` result for that member, published when the KSA screen or the member's own card computes it. `via` is `tool` | `equipment` | `discipline`, strongest first, as on the Console (§4a of the Console doc). Consumers treat a missing file as *unknown*, never as *stale*.

### 43.4 Configuration — `ksa-config.json → plan`

Department-keyed so a department head configures their own department. Absent keys take the defaults; the file is written whole by the Console under the existing `pdSaveKsaConfig` (low-frequency admin file, ETag-free by prior decision).

```json
"plan": {
  "Engine Room": {
    "rings":               { "assigned": true, "due": true, "baseline": true },
    "due_window_days":     45,
    "assessor_policy":     "chief",
    "assessor_ranks":      ["Chief Engineer", "Assistant Engineer"],
    "provisional_methods": ["workbook-import"],
    "provisional_counts":  true,
    "recency_default_months": 24,
    "baseline_scope":      { "tags": ["engine-room"], "card_ids": [] }
  }
}
```

| Key | Meaning |
|---|---|
| `rings` | Which demand rings are on. Turning one off removes its rows, never its data. |
| `due_window_days` | How far ahead the **due** ring looks, on `due_date` or `tm_due`. |
| `assessor_policy` | `chief` — every member whose role is in `assessor_ranks` can sign any card; `independent_rank` — a member holding level ≥ 3 on the card **and** a role in `assessor_ranks`; `record` — only a level-4 sign-off on that card. Today no one holds level 4 on any card, so `record` returns nobody everywhere; `chief` is the default and the empty top rung is still reported by the vessel view (§43.5g). |
| `provisional_methods` | Sign-off `method` values that count as provisional (the 634 workbook imports). |
| `provisional_counts` | `true`: provisional sign-offs hold their level, flagged. `false`: they are shown but count as missing for the gap. |
| `recency_default_months` | Window for a card with no tracked entry and no `recency_default_months` of its own. `null` disables practice staleness for untracked cards. |
| `baseline_scope` | Which demand cards are this department's syllabus: any card carrying one of `tags`, plus `card_ids` by hand. |

### 43.5 Derivation — `utils/plan-derive.js`

Pure: no DOM, no fetch, no globals. Inputs are plain objects; the caller decides visibility filtering, vessel confinement (`taskSameVessel`, §41.6a rule) and identity keying (**crew_id**, never username — §41.4a rule; `username` is carried only to match `assigned_to`).

```
derivePlan({ member: {crew_id, username, name, role, department},
             tasks, demand, registry, signoffs, currency, config, now })
  → { now: [row], next: [row], refresh: [row], unassessable: [row],
      summary: { now, next, refresh, unassessable }, defects: [...] }
```

**a. Demand rings.** A task is *open* unless its status is `completed` or `cancelled`. Holder match: `assigned_to` equals the member's username, or `assignees` contains the member's crew_id or username. Due = `due_date`, else `tm_due` parsed as a date, else none.

| Ring | Rows come from | Ordering key |
|---|---|---|
| `assigned` | open tasks holding the member → cards covering any of their `equipment_ids` → `requires` | task due, earliest first |
| `due` | open tasks of the member's department, due inside `due_window_days`, not holding the member → same join | due, earliest first |
| `baseline` | every demand card in `baseline_scope` → `requires` | number of demanding cards, most first |

**b. The asset join.** A task equipment code matches a card whose `asset_code` is **equal to it or one level above it** (`601.001.027.001` demands the cards on `601.001.027` and does not demand the cards on `601.001`). This is the rule the Console already uses to credit competency currency from job history; the two must not drift, so the plan uses the same one and states it. A card with no numeric `asset_code` is vessel-global and is reached only through the baseline ring.

**c. Required and held.** `required_level` per card = the maximum level any demanding card asks. `held_level` = the member's latest sign-off level for the card (canonical id; short ids resolve as on the Console), or 0. A provisional sign-off is flagged `provisional`; with `provisional_counts: false` its held level is treated as 0 for the gap while still displayed.

**d. States.**

| State | When |
|---|---|
| `held` | held ≥ required, and neither refresh condition (e) applies |
| `partial` | 0 < held < required |
| `missing` | no sign-off |
| `unassessable` | the target is not a signable card in the registry, or `has_expectations` is false — named as a target, useless as an assessment; listed separately, never in Now/Next |

**e. Refresh.** A held card lands in `refresh` rather than `held` when either applies, and the row says which: **practice-stale** — `currency[id].last` is absent or older than `now − months`, where months = tracked `recency_months` → card `recency_default_months` → config default; a `discipline`-only `via` never satisfies currency (weak evidence, same as the Console's dim date); **revision-behind** — the sign-off date precedes the card's `revised` date (the Console's existing ⚠ rule), or the member's read marker predates the card's revision (§43.7).

**f. Grouping and order.** `now` = required by an `assigned` or `due` ring row and state ≠ held. `next` = baseline-only rows with state ≠ held. `refresh` = state held-but-refresh. Within a group: ring rank (assigned, due, baseline), then earliest due, then demand count descending, then **prerequisite depth** (a card that other required cards list in their `requires_ksa` sorts before them — the syllabus order; nearly empty today and left as the door it is), then label. Each row carries `demanded_by[]` — every demanding card with the ring, the task and its due where a task produced it — so a member can see *why*.

**g. Vessel view** — `deriveVesselView({ members, tasks, demand, registry, config, now })`, the officer's trip question, computed over the department's active members:

- `uncovered` — cards demanded by open tasks due inside the window that **nobody** holds at the required level.
- `single_holder` — cards demanded inside the window held at the required level by **exactly one** person (the JSA §6 manning-risk finding, per trip instead of per job).
- `no_assessor` — demanded cards for which `assessorsFor()` returns nobody under the configured policy.

The vessel view names cards, not people-with-scores; a member appears only as *the* holder of a single-holder card.

**h. Assessors.** `assessorsFor(cardId, members, signoffsByMember, config)` per the policy in §43.4; shown on every plan row as *who can sign this off*, empty rendered as "no assessor recorded" rather than blank.

### 43.6 Presentation rules

- The phone's Training page is three stacked groups with one line per card: label, lane chip, the four-rung ladder (held filled, required marked, provisional hollow-dotted), the shortest reason ("demanded by SOP-0021 · task due 12 Sep"). Tapping a card opens the card where a Navipedia export exists, else the demand list.
- Refresh rows name their reason: *practice* or *revision*, never a merged "stale".
- The chief's member sheet adds columns the phone omits: demanded-by, evidence (`tool` / `equipment` / `discipline` / `read`), method, assessors, and the **Set as goal** action, which opens `pdOpenNewGoalModal` prefilled with title, description and one milestone per gap rung.
- Every screen carries the caption *exposure, not proficiency* or its plan equivalent: *what your work asks for, not how good you are*.

### 43.7 Revision currency and read markers — specified, **not built in this slice**

Revision currency is version-based only. A card that has not changed since the member read it is current however long ago that was.

```
data/personnel/exposure/{YYYY}/{iso}-{event_id}.json
{ schema_version: 1, event_id, event_type: "card_read", timestamp, actor,
  payload: { crew_id, card_id, card_revised, page_id? } }
```

- **Written by** the client that rendered the card, **only when** `(card_id, card_revised)` differs from the member's last marker for that card — volume is bounded by crew × cards × revisions. Attaches to lane cards only (SOP, TASK, KSA, SKG, SKD, KNG), never to Navipedia maps; reading a map that embeds a card records the card.
- **Trigger:** the card's `revised` moves past the marker. **Clears:** opening the card writes a new marker. Nothing else touches it — not time, not dismissing a popup, not doing the job.
- **Surfaces:** on job issue, a popup listing the cards in the task's demand chain that are behind, with the card's Change Log lines dated after the marker; on Me → My KSA Card as a standing list; on the chief's grid as a count per member. The Change Log parse needs each card's dated bullets exported into the demand and registry mirrors as `changes: [{date, text}]` — the Vault's lines are uniform (`- YYYY-MM-DD — text`).
- **Never clears practice staleness.** A member cannot re-read their way to currency.
- **Prerequisite:** the Navipedia export (schema section to follow) gives the phone a card to open. Until then no marker is written and the KSA Card page shows the Console's existing sign-off-before-revision flag only.

### 43.8 Vault health rules the demand export enforces

Reported, never fixed, by `node tools/vault-export/check-plan-inputs.js` (IDMS-Console), exit non-zero on any finding so it can gate a mirror publish:

1. `requires_ksa` targets are signable cards and levels are one of the four rungs (§43.3b defects).
2. A demanded card that is still a stub — Training's authoring queue, sorted by how many cards demand it.
3. A SOP or TASK card with no department tag (`engine-room`, `deck`, `factory`, `accommodation`) cannot enter any baseline ring.
4. The latest Change Log date must equal `revised:`; a card edited without either moving is invisible to revision currency.
5. A `requires_ksa` target that resolves to nothing (dangling) — the Corpus Conventions queue, restated.

### 43.9 Gate

Reading one's own plan needs no role. The KSA Plan panel and the member-sheet plan are visible to `canSeePersonnelDev()` (Chief Engineer / admin) **or** a department head named in `notesconfig.json → department_heads` for the department being viewed — the SOP corpus already holds a dozen factory cards, so the plan is not engine-only and the Chief Engineer role gate alone would lock Factory out of its own syllabus.

### 43.10 Not built in this slice

- Read markers and the job-issue popup (§43.7).
- `changes[]` in the mirrors (needed only by §43.7).
- Prerequisite depth ordering is implemented but inert until Training authors `requires_ksa` on skill cards (3 legacy KSA and 2 SKG carry one today).
- The JOB-card demand path: `build-task-register.js` deriving `requires_ksa` for a job from its linked SOP/TASK cards is the intended route; 13 of 23 jobs link no SOP.

---
