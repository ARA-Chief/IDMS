# IDMS PWA — Changelog

What changed, in the crew's words rather than the commit log's. The app reads
this file at sign-in and shows anything newer than the version that crew member
last saw, so keep entries short and say what someone can now *do*.

Format matters — the parser expects `## <version> — <date>` and `- ` bullets,
the same shape `IDMS-Console/CHANGELOG.md` uses. Newest version at the top, and
`PWA_VERSION` in `index.html` must match the newest heading here.

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
