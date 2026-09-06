# IDMS PWA — Changelog

What changed, in the crew's words rather than the commit log's. The app reads
this file at sign-in and shows anything newer than the version that crew member
last saw, so keep entries short and say what someone can now *do*.

Format matters — the parser expects `## <version> — <date>` and `- ` bullets,
the same shape `IDMS-Console/CHANGELOG.md` uses. Newest version at the top, and
`PWA_VERSION` in `index.html` must match the newest heading here.

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
