# IDMS PWA — Changelog

What changed, in the crew's words rather than the commit log's. The app reads
this file at sign-in and shows anything newer than the version that crew member
last saw, so keep entries short and say what someone can now *do*.

Format matters — the parser expects `## <version> — <date>` and `- ` bullets,
the same shape `IDMS-Console/CHANGELOG.md` uses. Newest version at the top, and
`PWA_VERSION` in `index.html` must match the newest heading here.

## 1.31 — 2026-09-20

- **A note about a machine now lives in one place.** Set a note's type to
  **Equipment** and name the machine, and it leaves its list for the
  **Equipment** band at the foot of the Notes sidebar — the tree of component
  codes. No more finding the same note twice.
- Alerts, To Order and the Offload List are untouched: a note there that
  names a machine is still on the list somebody works off. Only notes whose
  *type* is Equipment move, and one you have not given a machine to yet stays
  where it is until you pick one.
- **A folder keeps what you filed into it.** Only the lists a note fell into
  by default — the department's own list, General, somebody's personal list —
  let it go. Rounds comments stay in the Rounds folder and appear under their
  machine as well, so you can reach one from the round or from the machine.
  It is still one note either way.
- **Two new Recents rows**, one for the vessel and one for your department,
  each showing the last ten notes anybody edited — most recent first, with a
  line saying which list each one came out of. Open, edit or delete them from
  there like any other note. Nothing is filed into a Recents row.
- **Gear sizes on My Profile.** A new Gear Sizes section lists what you wear —
  gloves, boots, trousers, jacket, shirt and the rest — with a size and a note
  for each. Add a row for anything missing, remove any you don't need, and tap
  save. Engine room crew: your sizes from your most recent gear order are
  already filled in, with the year of the order in the note — check them and
  fix anything that has changed. The Console's Crew List shows and edits the
  same sizes.
- **Procurement is now called Inventory**, the name the Console gives it. Same
  tile, same people can open it. Inside, the register is **Items** and Stock
  Location is **Stock**, as on the Console.
- **Stock searches the whole ship.** The box at the top of Stock now finds
  items, not only spaces — type a name, a maker or a part number and every line
  it finds sits under the shelf it is on, with its own count box and a ✓ for
  "seen, and the book is right". A thing kept on two shelves is a line on each,
  so a count always lands on the shelf you typed it against. Plain words still
  find a space by name too.
- **The same searches as the Console.** `belt green` for both words,
  `belt OR sling*`, `-green` to leave something out, `"bow thruster"` for a
  phrase, and `maker:` `supplier:` `pn:` to look in one column — `pn:` checks
  both part numbers at once. Suggestions appear under the box as you type; tap
  one to use it. Every shelf's own search box works the same way.
- **Every line shows who makes it and who sells it** — maker, maker's part
  number, supplier and supplier's ref — so the number on the box in your hand
  can be matched whichever of them printed it.
- **Receive, Move and Open from the line.** Tap a line's name: under it are
  **Receive into** and **Move stock from** that shelf, and from a search,
  **Open** to go to the whole shelf.
- **Items search looks at makers and suppliers too**, the way the Console's
  does, and an item shows its maker's part number and its annual use. The
  Minimum & policy form has the Annual consumption box the Console has — leave
  it blank until somebody knows the figure.

## 1.30 — 2026-09-18

- **Editing a requisition no longer empties boxes this app cannot show.** A
  line written on the Console carries a maker, a supplier and both their
  reference numbers, and a price; changing a quantity here used to wipe them,
  so the person keying the order into TM Master found the boxes blank. They
  are carried through untouched now.

## 1.29 — 2026-09-18

- **A comment you leave on rounds now stays with the machine.** Whatever you
  type — or photograph — against a round item becomes a note on that item's
  component when you submit, so the next person to look at that machine finds
  it in Notes instead of having to know which day's round it was buried in.
- The note carries who left it, which round, and the reading at the time.
- Nothing changes in how you comment, and a comment is never lost if the note
  cannot be filed — the Console files anything that did not make it.

## 1.28 — 2026-09-12

- **Add Oil starts with the oil or the machine.** The Oil list is items from
  Inventory › Items, with their item numbers. Pick an oil and To and From show
  only where it is linked to go and where it is kept. Pick a machine instead
  and only its oils are listed.
- **To and From are filled in for you** from where that oil has usually gone
  before. Change either one and it stays as you set it.
- **Override attachment, for when SOP is not followed.** Each list has one. It
  shows everything, marks what is not linked with ⚠, and the entry is recorded
  as an override.
- **Oil can come out of stores.** A shelf that holds the oil is offered as a
  From, and oil taken from it comes out of stock when the item is counted in
  gallons — a drum or pail item is left for you to issue when it is empty. Oil
  out of a tank moves the tank, which is what the stability booklet reads.
- **An item can carry more than one SFI code.** Under Procurement → item →
  Set minimum & policy, list every place it belongs, separated by commas — an
  oil under the system it feeds *and* the tank it is kept in. Tick **Fluid**
  for oil kept in drums or pails with no tank.
- Every entry now records which oil it was, so the Console shows the same
  thing you picked.
- **Sign in to Notes and Procurement by typing your username**, the same as the
  main IDMS sign-in. Both pages asked you to pick your name from a list, and
  that list had stopped being kept up to date — it only held a handful of
  people, so most of the crew could not sign in there at all. Anyone who can
  sign in to IDMS can now sign in to both.
- **The offload list is in Notes.** Engine Room notes have an **🚢 Offload
  List** row. When an offload is commenced in the Console, every item on the
  list lands there as its own note that anyone can pick up, and everyone in the
  engine room is told on the phone. Tick one off here and it is ticked on the
  Console's list too. A note you add to that folder, or drag into it, is open
  for anyone to pick up, and the engine room is told about it the same way.

## 1.27 — 2026-09-11

- **Oil you add now stays attached to the machine you added it to.** Add Oil
  moved the tank and wrote the log entry, but the engine, generator or
  compressor was named only in the Rough Log sentence — so none of it counted
  towards that machine anywhere. It is recorded on the entry itself now, and the
  Console shows it under **Inventory › Components › Oil History**: every drop a
  machine has had, and every drop drained out of it.

- **If you write the same top-up up twice, it counts once.** Record it here and
  again on a service report and the two appear as one event with both names
  against it, rather than as two top-ups. Where the amounts disagree, both are
  kept and flagged rather than one being picked.

- **A pail into a head tank is recorded too.** Where neither end of the movement
  is a tracked tank there was nothing to write and nothing was written. The
  top-up is now logged against the machine even though no tank level moves.

- **Names, not ids.** Equipment could show as a long string of letters and
  numbers instead of its name — three separate causes, including the equipment
  list quietly giving up if it was asked for too early and then never trying
  again. Tanks could do the same. Both fixed.

- Quantities are written the same way round as the Console writes them, so a
  top-up no longer shows as a negative on Tank Levels & Transfers.

## 1.26 — 2026-09-10

- **Discontinued Stock, on the deck tiles beside Unlocalized Stock.** Anything
  whose name carries **\*BLOCK\*** is gathered there and comes off every shelf's
  count sheet — 66 items today. To discontinue something, put the word in its
  name, here or in TM Master; to bring it back, take the word out. Nothing
  moves and no stock changes: it is the same part on the same shelf, just not
  asked about, and a count typed on the discontinued sheet still lands in the
  bin it is really in.
- The asterisks are what makes it a marker rather than a word: *TERM BLOCK
  PLUG* and the two *BLOCK ASSEMBLY* engine parts are real and stay where they
  belong.

## 1.25 — 2026-09-10

- **📦 To Order is a row of its own now, on every department.** The shopping
  list used to be an ordinary folder somebody had made, filed among the rest.
  It now sits under your department's notes, above Shipyard, and cannot be
  renamed or deleted out from under the screens that read it. Write a note,
  drag it onto 📦 To Order, and it is on the list.
- **What you put there is in front of whoever buys it.** The same list shows
  on the Console's Assign board as a tray, and in the sidebar of Procurement →
  Requisitions. It is one list, not three copies — put something on it here and
  it is there, take it off there and it is gone from here.

## 1.24 — 2026-09-10

- **Alerts and Shipyard notes are on the phone now.** Notes only ever drew the
  folders somebody had made, so the two pads IDMS fills by itself were missing:
  **🔔 Alerts**, which every department has and which the Console's alert rules
  write into, and **⚓ Shipyard notes**, the Engine Room pad the Console's
  Docking Jobs and Flowchart screens drag from. The notes had been arriving all
  along — there was simply no row to reach them by. Both now sit directly under
  Department notes, where the Console keeps them.
- **An alert reaches you without anyone assigning it.** Anything open in your
  department's Alerts pad now raises the alert popup at sign-in and on the sync
  tick, naming the rule that fired. Landing in that pad *is* the notification —
  there is no assignee, everyone in the department is told, and dismissing one
  only dismisses it for you, so the watch coming on still sees it.
- Neither pad can be renamed, removed, or created a second time by hand. Other
  screens reach both by name, and a folder renamed from under them is a folder
  that keeps filling and that nobody can find again.
- Fixed: the phone was dropping the rule, severity and reason a note carried
  when the Console's alerts lane raised it — its copy of the notes reducer had
  fallen behind the Console's.

## 1.23 — 2026-09-09

- **Promote to Task now opens the report instead of telling you where it is.**
  In the **IDMS Notes** window on a console, pressing it brings the Console up
  with that note's service report already filled in — its title, its body, the
  comments, the photos, whoever is carrying it, and the checklist with the
  steps you have already ticked. Nothing happens to the note until you save.
- On a phone or in a browser there is no Console to open, so it still says
  where the form is — and it now names the right place, **Records › Notes**.
  The section had been renamed and the message had not.

## 1.22 — 2026-09-07

- **Move a part from the shelf you are standing at.** Tap an item on a Stock
  Location sheet and the pane now has **Move stock from ‹this space›**. It opens
  the move already pointing at the space you are in, so a part stowed on the
  wrong shelf gets put right where you found it, instead of being remembered
  until you are back at a desk.
- It works from **Unlocalized Stock** too, which is how an item with no
  address finally gets one.
- **Procurement is open to the wheelhouse as well as the engine room.** Master,
  mates and pursers now get the stores register, the sheets and requisitions.
  Approving an order is unchanged — still the chief engineers and admins.

## 1.21 — 2026-09-07

- **Procurement is open to the whole engine room.** If Engine Room is one of
  your departments, the tile is on your hub: the stores register, where things
  are stowed, what is short, receiving, counts, and raising a requisition.
  You no longer need to be a chief to look something up or book a part in.
- Approving a requisition and sending an order are unchanged — still the
  chief engineers and admins. Asking for a part and agreeing to buy it are
  different jobs.
- Which departments get in is now a setting (Procurement → Settings), so it
  can be widened or closed without a new build.

## 1.20 — 2026-09-07

- Your user menu now has **My Profile**, **My KSA Card** and **My Training** in every department, not just the Engine Room.
- **My KSA Card** shows your verified sign-offs with when the work last came round, and flags any card revised after you were signed off.
- **My Training** shows what your work asks for: cards needed for jobs assigned to you or due soon, your department's syllabus, and anything to refresh. Tap a card to see why. It is a plan, not a score.

## 1.19 — 2026-09-07

- **The incinerator lamp tells the truth on every phone.** It only ever lights
  from a complete read of the log, it re-reads by itself (when you open the
  hub, when you come back to the app, and every minute while it is on
  screen), and if it could not read the log it says so instead of guessing.
  The "running for 800 hours" readings were never an hour-meter: that was a
  phone counting from a session everyone else had already stopped or deleted.
- **Long runs read as days.** Above a day the bar says `1d 02:15:00`, not
  `26:15:00`. A session open more than 12 hours is marked *stale?* so someone
  looks.
- **STOP, ADD, DELETE and edits check the log first.** If another phone has
  already stopped or deleted the session you are looking at, you are told, and
  nothing is written. Buttons go quiet while a write is in flight, so a double
  tap is one event, not two.
- **Editing a stopped session keeps it stopped.** Leaving the stop time blank
  used to re-open it silently.

## 1.18 — 2026-09-07

- **Contacts.** Everyone the vessel buys from — 1,745 of them — is on the phone
  now, with its own tile on the Procurement screen. Search by name, e-mail,
  phone, country or anything in the remarks.
- **What a card tells you first is when we last used them, and for what.** Then
  how many orders, what we have spent, and the last 25 orders with what each one
  was for. A phone number on its own is a phone number; with that beside it, it
  is a decision about whether to call.
- **Tap the number and it dials. Tap the address and it composes.**
- **Fix anything that is wrong.** Phone, e-mail, terms, remarks — the lot. Your
  correction sticks: TM Master's contact list is the starting point, not the
  last word, so the next export will not undo it. Everything nobody has touched
  still comes from TM.
- **Retiring keeps the card.** Old orders still point at it, so it is hidden
  from the list rather than deleted. Retiring is an approver's call; correcting
  a phone number is anybody's.
- **Orders say who they are going to again.** Every order and purchase order
  used to show its supplier as a code like CON-0660 — and the New order form's
  supplier list was empty, so you could not name one at all. Both now use the
  contact book, and the supplier field is a search rather than a list of 1,745.
- Look for the **Orders only** filter: 82 names appear on TM orders with no
  contact record behind them at all. They are usually a duplicate of somebody
  who is in the book.

## 1.17 — 2026-09-07

- **Stock Location has its own tile now.** It is on the Procurement screen
  beside Inventory, rather than only inside the page. It answers a different
  question from Inventory — not *what have we got* but *what is in this locker,
  and is that number true* — and it is the one you use standing up.
- **The big spaces open.** Unlocalized Stock is 2,864 items and Fwd Shop 583.
  Those sheets used to be laid out in full and the phone would sit there. Now a
  long sheet gets a **filter box** at the top, shows the first 400 lines, and
  tells you how many it is not showing — type a name or a part number to reach
  the rest.
- **You can audit Unlocalized Stock.** The stock the export never gave an
  address to is a space like any other: walk it, count it, close it. It is also
  the obvious list to work through when giving things a home.
- **Tap a line and you get the whole item.** What it is, who makes it, its
  category and unit, what it last cost and when, everywhere else the book has
  it, and **the last few things that happened to it** — which is usually where
  the answer is when your count does not match the book.
- **Type a count, press Enter, and you are on the next line.** No reaching for
  the next box.
- Both search boxes keep the cursor while you type. They used to lose it
  mid-word.
- **Low stock shows the minimum that actually put the item on the list.** If the
  minimum was set here rather than in TM Master, the column used to read 0 while
  the Suggest column beside it worked from the real figure. It now shows the
  number in force and marks it **IDMS** when it is ours.

## 1.16 — 2026-09-06

- **Stock Location: walk a space and count it properly.** Open the Procurement
  page and pick **Stock Location** along the top, then choose the room or shelf
  you are standing in — you get a count sheet for it. Type what is actually
  there and it corrects the book, the same as the Count button always did. What
  is new is that the sheet keeps track of the whole walk.
- **Tick the ones that were right.** Most of a shelf is correct, and until now
  that left no record at all: an item you checked and found right looked exactly
  the same as one nobody had opened in a year. Tick it and the space now shows
  as swept. **Only tick what you actually looked at** — this is the record that
  says the space was counted.
- **Put it down and pick it up.** Your ticks survive closing the page, so a
  forty-line shelf does not have to be done in one go.
- **The empty bins are on the sheet too.** If the book says a part lives here
  but shows none left, it still gets a line — an empty bin is exactly where a
  miscount hides.
- The sheet shows the figure for **that space**, not the ship's total, and an
  item with no stock figure at all reads as **unknown** rather than as 0.
- Counting a whole room including its shelves — switch the sheet from **This
  space only** to **Including sublocations** — shows you everything under it,
  but only offers a box where there is one bin for the number to go into.
- The front screen lists the spaces **least recently counted first**, so the
  shelves nobody has been near are the ones you see.
- Tap any line to see the item underneath it — maker, part number, the ship's
  total, and everywhere else the book has it — without losing your place on the
  sheet.

## 1.15 — 2026-09-06

- **"Report Complete" is what it is called now, everywhere.** The status you
  set, the option on the create form, and the button the engineer presses in
  the Console all use the same two words. Nothing says "Close" any more,
  because closing a job is telling TM Master about it — and that is a separate
  step somebody else takes.
- Creating an already-done job from the phone now sets **Report Complete**
  directly. Same result as before: the service report is written the moment you
  save, and it goes into the officer's queue for TM Master.

## 1.14 — 2026-09-05

- **Closing a job out no longer says TM Master has it.** Reporting a job done
  from the phone records the work and files the service report exactly as
  before, but the job now reads **Reported Complete** and stays on the board
  until an officer pushes it to TM Master from the Console.
- That is the honest answer: until TM Master has the record, the company's
  system does not know the job was done. Nothing is lost — the record is
  written the moment you save, and the push is what finishes it.
- The close-out option now says so: **Close out — record the work (TM Master
  still to be told)**.
- Fixed: saving a task said **Save failed** even though the task had been
  saved. The message came from writing the rough-log line, after the task was
  already on OneDrive.

## 1.13 — 2026-09-05

- **A note can now say which machine it is about.** Open a note, set its type to
  **Equipment**, and search the vessel's component register by code or name —
  type the words in any order, "trawl gearbox" finds the right one.
- Notes filed that way appear under **EQUIPMENT** at the bottom of the notes
  sidebar, in a tree of the codes in use. Closed until you open it. Picking a
  branch shows that code and everything under it, and a note dragged onto one
  is filed there.
- They also show up under that component in the Console, in Maintenance →
  Equipment → Notes, so the next person looking at the machine finds them.
- **A note's title can be corrected** — click it, type, Enter. The note keeps
  its comments, its photos and whose it is.
- An **Assignable** note can carry an equipment tag too, and now keeps it if you
  change the note's type. Tagging the machine means a service report made from
  that note later arrives with its equipment already filled in.
- **Promote to Task** appears only on assignable notes, and the service report
  itself is written in the Console for now.

## 1.12 — 2026-09-05

- **Procurement now shows the real stores register** — all 14,487 items from TM
  Master, in the 664 places aboard they are actually stowed, from the Engine
  Store down to a numbered bin in the Fwd Shop.
- The register is too big to scroll, so it opens on the decks: tap Maindeck to
  see its 6,448 items, or search by name, part number, stock tag or ITM number.
- **TM Master stays the book of record.** What an item *is* — its name,
  supplier, part number, where it lives — is read from TM Master and never
  changed here. Spot something wrong and **Propose a correction** records it
  with your name on it for an officer to key in.
- **What you do with stock is yours.** Receiving, issuing, moving and counting
  are recorded here as they happen and layered on top of the TM Master figures,
  so the shelf does not have to wait for the next export.
- **Minimums can be set from the app.** Only 602 of the 14,487 items have one in
  TM Master, so the low-stock list was nearly empty. Set a minimum, a maximum or
  an SFI code on any item and it is IDMS's own — clear it and TM Master's
  value comes back.
- Items the export never counted show **—** rather than 0, because unknown is
  not the same as none, and they never raise a false shortage.
- The register is kept on the device after the first load, so opening
  Procurement does not re-download it every time.

## 1.11 — 2026-09-05

- **Procurement** is a new department on the picker, for anyone holding stores.
  It covers the whole round trip: what we hold, what someone needs, what was
  ordered, and what actually turned up.
- **Inventory** tracks every part by storeroom, with a running ledger — you can
  see who took the last one and when. Add and edit items, issue them to a job,
  move them between storerooms, or record a count when the shelf disagrees with
  the book.
- **Check In** receives a delivery against its order. The outstanding quantity
  is already filled in, so "it all came" is one tap per line. A short shipment
  is just a smaller number — the line stays outstanding and nothing needs
  closing. Stores that arrive with no paperwork can be checked in too.
- **Low Stock** counts what is already on order, so nothing gets ordered twice
  because the first order was invisible.
- **Requisitions** are for asking. Describe a part that has never been aboard
  and it becomes a real item the moment it arrives. Approvals can trim a
  quantity or turn down one line without holding up the rest.
- **Exceptions** is the one page for things that need a person: stock gone
  negative, more delivered than ordered, orders past their date, and approved
  lines nobody has ordered yet.
- Nothing is ever deleted. Every quantity on screen is the sum of the movements
  that produced it, so a wrong number is fixed by recording the correction.

## 1.10 — 2026-09-03

- **Notes** is now on every department hub — a shared, non-private place for
  anything that needs doing but isn't a full task. Open it in its own browser
  window and leave it up all day.
- Notes can be assigned to one person or several, starred, filed into folders
  and groups, and promoted to a task when they turn out to be real work.
- Photos and documents can be attached to a note, or dropped straight onto the
  add bar.
- Anything assigned to you is pinned to the top of your own list, and you get a
  summary when you sign in.
- The engineering department's Microsoft To-Do lists have been migrated in —
  Araho Rules, Oiler's To Do, To Order, Follow Ups, Long Term and the rest.

## 1.9 — 2026-08-23

- Rounds submit no longer fails with a bare "401" after the app has been left
  in the background — the token is refreshed and the save is retried.
- Tasks: a **My Tasks / Everyone** switch, an Assigned-To picker drawn from the
  crew list, and a **reported complete** state for work the office still has to
  sign off.
