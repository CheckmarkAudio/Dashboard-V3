# Dev Learning Log — Bridges

> A running record of development concepts, terminology, and methodology you've
> picked up while building Checkmark Audio Dashboard-V3. Use this as a personal
> reference — every entry is something you actually encountered in a real PR,
> not abstract textbook stuff.

---

## How to use this doc

- **Newest entries are at the top** so the most-recently-learned stuff is the
  easiest to find when you're trying to remember something.
- Each entry has the same shape: **Concept · TL;DR · When you encountered it ·
  Why it matters · Mental model**.
- Tell Claude `"add this to my learning log"` when you learn something new
  (or want a refresher captured in your own words). Claude will append a new
  entry at the top.
- If you want to deepen an entry later ("explain this more"), just ask —
  Claude can expand any section with a worked example or a counterexample.
- This file is plain text — feel free to edit it directly in your editor,
  add personal notes, scribble in the margins. It's yours.

---

## Glossary index

Quick alphabetical jumping-off point. Click or search.

- [Branches (Git)](#branches-git)
- [Build (the dev meaning)](#build-the-dev-meaning)
- [Bundle / bundle size](#bundle--bundle-size)
- [Code splitting / lazy loading](#code-splitting--lazy-loading)
- [Commit](#commit)
- [CSV format (RFC 4180, BOM, CRLF)](#csv-format-rfc-4180-bom-crlf)
- [Detached HEAD](#detached-head)
- [Drift / drift-proofing](#drift--drift-proofing)
- [Fetch vs Pull](#fetch-vs-pull)
- [GitHub Desktop loop](#github-desktop-loop)
- [Lazy import (dynamic `import()`)](#lazy-import-dynamic-import)
- [Merge conflict](#merge-conflict)
- [Parse-on-display](#parse-on-display)
- [Production vs Preview (Vercel)](#production-vs-preview-vercel)
- [Pull request (PR)](#pull-request-pr)
- [Push](#push)
- [Schema migration](#schema-migration)
- [Single source of truth (DRY)](#single-source-of-truth-dry)
- [Squash merge](#squash-merge)
- [TypeScript strict mode](#typescript-strict-mode)
- [Worktree](#worktree)

---

# 2026-05-17 — Event ledger pattern (Flywheel Phase 1)

## Fire-and-forget side-effect emits

**TL;DR:** When you want to record analytics events (or any
non-critical side effect) from a user action, NEVER block the user's
primary action on the emit. Wrap the emit in a fire-and-forget helper
that swallows errors with a `console.warn` and returns synchronously
(or with `void` so callers don't accidentally `await` it).

**When you encountered it:** Phase 1 of the Flywheel event ledger.
Five different user actions (task complete, booking create, client
create, media upload, etc.) needed to emit a `flywheel_events` row.
The temptation was to `await emitFlywheelEvent(...)` inside each
action's success path. The right move: `void emitFlywheelEvent(...)`
+ a helper that catches its own errors.

**Why it matters:** If the analytics RPC has a momentary blip
(network, RLS issue, server hiccup), and the emit is `await`-ed,
the user's task-complete or booking-save will FAIL. That's a
catastrophic regression for an analytics side effect. The user
won't care that we missed one analytics row — they will care a
LOT if their booking didn't save.

**Mental model:** Think of the emit as "writing to a journal we
keep on the side." Journals are great when they work, but if the
journal is locked the cook still cooks dinner. The kitchen doesn't
shut down because the journal is broken.

**Pattern in code:**
```ts
// In the helper:
export async function emitFlywheelEvent(input): Promise<string | null> {
  try {
    const { error } = await supabase.rpc('record_flywheel_event', ...)
    if (error) { console.warn(...); return null }
    return data
  } catch (err) { console.warn(...); return null }
}

// At every call site:
void emitFlywheelEvent({ stage: 'deliver', source_type: 'task', ... })
// (NOT await — even if the emit takes a moment, the user is moving on)
```

**Counter-rule:** If the side effect IS critical to the user's
action (e.g. payment recorded must happen before "purchase
confirmed" toast), then it's NOT a side effect — it's part of the
primary action and should be awaited + errored properly. Only use
this pattern for genuinely auxiliary effects.

---

## Append-only ledger tables (no UPDATE/DELETE policies)

**TL;DR:** For event-history tables (analytics ledgers, audit logs,
billing events), set up RLS so that ONLY SELECT is allowed from app
code, and direct INSERTs are blocked too — funnel all inserts
through a single SECURITY DEFINER RPC that validates inputs. No
UPDATE or DELETE policy at all means history is immutable from the
app layer. If a row truly needs deleting, an operator does it via
SQL with full intent.

**When you encountered it:** `flywheel_events` table. App code
never INSERTs directly; everything goes through `record_flywheel_event()`.
There's no INSERT/UPDATE/DELETE policy, so RLS denies those operations
even if a malicious or buggy client tried.

**Why it matters:** Analytics integrity. If an event got logged
once, you want it to stay logged. If a buggy retry path could
double-emit, the RPC can dedupe; if it could delete, the RPC's job
is harder. Locking out UPDATE/DELETE entirely makes the history
worth what it claims to be.

**Mental model:** Cash register receipts. You can READ a receipt
from yesterday. You can WRITE today's receipts through the printer
(the RPC). You CANNOT go back and change a receipt from yesterday,
even if you really want to — the printer's the only path in, and
it only emits new receipts.

---

# 2026-05-17 — Extracting a shared algorithm (PR #200)

## Extracting a reusable algorithm into a shared module

**TL;DR:** When you find yourself copy-pasting the SAME non-trivial
algorithm into a second component, that's the signal to extract it
into a shared module. Even small algorithmic helpers (50–100 lines)
benefit from living in `src/lib/<name>/` rather than being inlined
twice.

**When you encountered it:** PR #199 shipped the carousel page-
packing algorithm inline inside `MemberActivitySection.tsx`. PR #200
needed the same algorithm for `WorkspacePanel.tsx` (Overview + Hub).
Instead of copy-pasting, we extracted it to
`src/lib/carousel/packPagedWidgets.ts`, made it generic over the
widget-id type, and both components now consume it. Same logic, ONE
source of truth — if the packing algorithm ever needs a tweak (e.g.
support 3-slot widgets), the change happens in one place and
propagates to every carousel using it.

**Why it matters:** Drift again. Two copies of an algorithm WILL
diverge over time — someone fixes a bug in one and not the other,
or someone tightens an edge case in one and leaves the other lax.
Single source of truth keeps the behavior consistent across the app.

**Mental model:** A helper function is "shareable" when (a) its
inputs are simple values and (b) its output doesn't depend on
component-specific UI. The packing algorithm took an ordered list of
ids + a weight function + a page size, and returned a layout array.
Nothing in there required knowing about React, dnd-kit, or specific
widget types — so it could live in `src/lib/` and be imported from
anywhere.

---

# 2026-05-17 — Inline widget expansion (PRs #199 + #200)

## Carousel page packing with variable widget widths

**TL;DR:** When a carousel's items can have different widths (e.g.
a widget that grows 2× when "expanded"), straightforward flex layout
breaks because widget left-edges drift mid-page and the page snap
stops working. Fix: pack widgets into pages by "slot weight" and
insert invisible spacer divs to keep page boundaries aligned.

**When you encountered it:** The Members → Activity widget carousel
(PR #199), then extended in PR #200 to the Overview + Hub widget
carousels (`WorkspacePanel`). The expand button used to open a modal
on all three; you asked for inline 2× expansion that pushes other
widgets across the carousel pages. PR #200 generalized the algorithm
to support variable page sizes (Overview/Hub use 1/2/3 widgets per
page based on viewport width, vs Activity's fixed 2).

**Why it matters:** Most carousel tutorials assume uniform item
sizes. Real product UIs often need adaptive sizing (expand, collapse,
"hero" item). Knowing the spacer-padding technique means you can
build expansion features without rewriting the carousel.

**Mental model:** Imagine a page as a row of fixed-width slots
(2 slots for tablet/Activity, 3 for desktop, 1 for phone). Each
widget claims 1 slot (normal) or 2 slots (expanded). When packing
left-to-right, if the next widget needs 2 slots but only 1 slot is
left in the current page, you drop an empty placeholder into that
orphan slot to "kick" the wide widget to the start of the next page.
The placeholder isn't a real widget — it's just there to fill the
gap and keep the visual rhythm.

**Bonus pattern — "auto-navigate on state change":** When something
changes that moves a widget to a different page (expand, collapse,
reorder), set `currentPage` to wherever the affected widget ended up.
Without this, the user clicks a button and "nothing visible happens"
because they're looking at the wrong page. Auto-snap to the relevant
page = the click feels alive.

**Edge case — degenerate page size:** On phone (`pageSize=1`), every
widget is already full width, so "expand to 2 slots" has nothing to
expand into. Solution: hide the expand chevron entirely on small
screens and auto-collapse any in-flight expansion when the viewport
shrinks. Pattern: "degenerate cases get hidden, not broken."

---

# 2026-05-17 — Tasks descriptor refactor (PR #197)

## Narrow descriptor + fat interactive shell

**TL;DR:** When a row has BOTH data display (text, badges) AND
interactive controls (checkboxes, edit/delete buttons), split them:
let descriptors own the display + export, let the row component own
the interaction. Both stay simple.

**When you encountered it:** Asking "did we drift-proof the tasks
pages the same as Members?" The first answer was "no, the task rows
duplicate display logic." The refactor that followed put the
display cells (title, due_date, recurrence pill) into the shared
`taskExportColumns` descriptors with `render` functions, while
keeping the checkbox + edit/delete buttons hardcoded inside
`TaskRow` / `StudioTaskRow`.

**Why it matters:** Forcing EVERYTHING into descriptors (including
the interactive bits) would mean passing handlers, selectMode,
isSelected, mutation callbacks, etc. through every render function.
The descriptor type would balloon and become awkward. The pragmatic
split — "descriptors own data display + export; row components own
interaction" — keeps both clean.

**Mental model:** Think of a row as two layers: a **data layer**
(what does this row SHOW about the task?) and a **behavior layer**
(what can the user DO with this row?). Descriptors are the data
layer. Row components are the behavior layer. They meet inside the
row's JSX but they're authored separately.

**Counter-rule:** If a row is mostly data display with one tiny
action menu at the end (like the Members roster), put EVERYTHING in
descriptors including the menu — the action menu is small enough to
live as one descriptor. The split only matters when interactive
controls are heavy or share row-level state.

---

# 2026-05-17 — ExportButtons PR session

## GitHub Desktop loop

**TL;DR:** The 7-step daily workflow for shipping code with GitHub Desktop:
**fetch → switch branch → edit → save → review diff → commit → push.**

**When you encountered it:** Your first solo GitHub Desktop commits today
(`3ec4fb5` clock name change, `0214ff4` Clock In capitalization fix).

**Why it matters:** Once you know this loop, you can ship a typo fix or a
header rename in 3 minutes without waiting for Claude. You're not locked
out of your own codebase.

**Mental model:**
1. **Fetch origin** = "download what changed on GitHub" (doesn't change
   your files yet, just updates your knowledge)
2. **Switch branch** = "tell GitHub Desktop which version of the code I
   want to work on"
3. **Edit + save** = "make the change in a text editor"
4. **Review diff** = "look at what I changed before committing — catches
   accidents"
5. **Commit** = "package this change with a short message explaining it"
6. **Push** = "send my packaged change up to GitHub so others (and Vercel)
   can see it"
7. **Wait for Vercel** = "GitHub tells Vercel to rebuild the site; ~60s
   later the preview URL serves your new code"

---

## Branches (Git)

**TL;DR:** A branch is a parallel copy of the codebase where you can make
changes without affecting `main`. `main` is the version that gets
deployed to production; feature branches are scratch spaces.

**When you encountered it:** Your edits went onto `claude/export-buttons`,
not `main` directly. Once the PR merged, those commits landed on `main`.

**Why it matters:** Branches let multiple people (or sessions) work in
parallel without stepping on each other. You can also throw away an
experiment by deleting the branch — no harm done to `main`.

**Mental model:** Imagine `main` is the published version of a book.
A branch is a draft chapter you're rewriting. When the draft is good,
you merge it back into the book (the PR). Until then, the book stays
unchanged.

---

## Pull request (PR)

**TL;DR:** A formal request to merge a branch INTO `main`. It bundles
the diff + a description + automated checks (build, tests, Vercel
preview) + a place for review comments.

**When you encountered it:** PR #194 was the wrapper around all the
ExportButtons work.

**Why it matters:** PRs are the "checkpoint" before code reaches users.
They give you a Vercel preview URL to test on, a place to spot mistakes,
and a Merge button that's deliberately separate from `git push`.

**Mental model:** A push sends code to the branch. A PR merge promotes
the branch's code to production. Two different gates on purpose.

---

## Fetch vs Pull

**TL;DR:**
- **Fetch** = download GitHub's latest info to your local Git, but
  don't change any files yet
- **Pull** = fetch AND update your working files to match

**When you encountered it:** GitHub Desktop's top bar shows "Fetch origin"
(then becomes "Pull origin" when there's something to apply).

**Why it matters:** Fetch is always safe — you can always do it without
worrying. Pull modifies your files and can occasionally cause conflicts
if you have local changes that overlap with what's coming in.

**Mental model:** Fetch = "check the mail." Pull = "check the mail AND
sort it into the filing cabinet."

---

## Commit

**TL;DR:** A snapshot of changes with a short message explaining the
"why." Every commit has a unique 7-character ID (like `3ec4fb5`).

**When you encountered it:** "Commit to claude/export-buttons" button in
GitHub Desktop, paired with the Summary field.

**Why it matters:** Commits are the unit of history. Good commit messages
make it possible to understand WHY something changed months later. Bad
ones ("update", "fix", "stuff") leave you guessing.

**Mental model:** Commit messages are little notes to your future self.
Future-you will thank present-you for writing "rename Clocked in →
Clock In" instead of "changes."

---

## Push

**TL;DR:** Send your local commits up to GitHub so the world (and
Vercel) can see them.

**When you encountered it:** "Push origin" button in GitHub Desktop, top
bar. The "1" badge meant you had 1 unpushed commit.

**Why it matters:** Until you push, your commit only exists on your
laptop. Vercel doesn't know about it. Other people can't see it. Push is
the moment your work becomes real to the outside world.

**Mental model:** Commit = saved a draft locally. Push = published the
draft to the cloud.

---

## Merge conflict

**TL;DR:** Git's polite refusal to guess when two branches edit the same
lines. It surfaces the conflict markers (`<<<<<<<`, `=======`,
`>>>>>>>`) and asks a human to pick.

**When you encountered it:** PR #194 → main had moved on with Calendar
work; both branches edited the same rows of `docs/PROJECT_STATE.md`.
GitHub showed you the conflicts page; we resolved them on the branch.

**Why it matters:** Conflicts are NORMAL, not a bug. They happen any
time two branches change the same line. The fix is usually 1-line —
just decide whose version wins, or keep both.

**Mental model:** Two editors mark up the same paragraph of a manuscript.
Git doesn't know which edit you want. It hands you both pens and asks
you to merge them by hand.

**Rule of thumb for resolving:**
- Conflict about **parallel work** (your PR vs another PR) → usually
  keep both sides' info
- Conflict about **competing choices** (two different approaches to the
  same problem) → pick one

---

## Production vs Preview (Vercel)

**TL;DR:**
- **Production** = `dashboard-v3-dusky.vercel.app` — what the team sees;
  built from `main` only, redeployed when `main` updates
- **Preview** = `dashboard-v3-git-<branch>-...vercel.app` — a per-branch
  test deployment; lets you test before merging

**When you encountered it:** The CSV test loop. Editing in your editor
doesn't change either site — only commits + pushes do. And only the
preview reflects branch work; production only sees what's on `main`.

**Why it matters:** Preview URLs are how you verify a PR is safe BEFORE
merging. Test on the preview. Once you're confident, merge → production
catches up.

**Mental model:** Preview = dress rehearsal. Production = opening night.

---

## Worktree

**TL;DR:** A second checkout of the same repo, in a different folder,
on a different branch. Git allows one repo to have multiple worktrees,
but each branch can live in only ONE worktree at a time.

**When you encountered it:** The `fatal: 'main' is already used by
worktree at '/Users/bridges/GITHUB/Dashboard-V3'` error in GitHub
Desktop. That repo had `main` checked out, and another worktree was
trying to grab it too.

**Why it matters:** Claude agents use worktrees so they can work on
multiple branches simultaneously without disrupting your main checkout.
If you hit the "already used" error, tell Claude — they can free up
the branch by detaching their worktree.

**Mental model:** A repo is a library. A worktree is a desk where one
specific book (branch) is checked out and being edited. Multiple desks
allowed, but a book can only be on one desk at a time.

---

## Detached HEAD

**TL;DR:** Git's way of saying "you're looking at a specific commit, not
a branch." You can still see and edit code, but new commits don't
automatically belong to any branch.

**When you encountered it:** Indirectly — Claude's agent worktree spent
some of today's session in detached HEAD while your GitHub Desktop had
the branch checked out. Commits made in detached HEAD were pushed
explicitly via `git push origin HEAD:claude/export-buttons`.

**Why it matters:** Almost never an issue if you stay in GitHub Desktop.
Mostly a "behind the scenes" Git concept you don't need to remember,
but useful to recognize if you ever see "HEAD detached at ..." in a
terminal.

**Mental model:** Branches are bookmarks. Detached HEAD is reading a
page directly without a bookmark — you can still read and write, but
nothing will know to look there unless you tell it.

---

## Drift / drift-proofing

**TL;DR:** "Drift" = two places in your code that SHOULD say the same
thing slowly diverging over time because someone updates one but
forgets the other. "Drift-proofing" = restructuring so there's only
ONE place to update, eliminating the divergence by design.

**When you encountered it:** Before PR #194, the Members table had its
column headers declared in JSX `<th>` cells AND duplicated in a
separate `memberExportColumns` array. Renaming a header in one place
left the CSV showing the old name. After the refactor, ONE `TableColumn<T>[]`
array drives both — rename once, both update.

**Why it matters:** Drift is one of the silent killers of software
quality. The bug isn't loud — it's two sources of truth quietly
disagreeing for months. Drift-proofing your patterns means future-you
can't accidentally introduce the bug.

**Mental model:** If your fridge has TWO grocery lists and you only
update one, the other is wrong. Drift-proofing = one shared list on
the wall that everyone uses.

---

## Single source of truth (DRY)

**TL;DR:** DRY = "Don't Repeat Yourself." Every piece of knowledge in
your codebase should have exactly ONE authoritative home. If you need
the same data in two places, derive one from the other rather than
duplicating.

**When you encountered it:** The `TableColumn<T>` pattern is a textbook
DRY application — one column array, two derived surfaces (visible
table, export).

**Why it matters:** DRY isn't about "less typing." It's about
eliminating the possibility of two copies disagreeing. Every duplicated
fact is a future bug.

**Mental model:** A wedding invitation lists the date once. If you
copy-pasted the date into 5 paragraphs and the venue called to
reschedule, you'd have to update 5 places and would probably miss one.
DRY = put the date in one variable, reference it everywhere.

---

## Code splitting / lazy loading

**TL;DR:** Instead of shipping ALL the JavaScript when a user opens the
site, split it into chunks and only download what's actually needed.
"Lazy loading" = deferring the download until the user does something
that requires that chunk.

**When you encountered it:** jsPDF (~390KB) was a heavy library to add
for an export button most users would rarely click. We used a dynamic
`import('jspdf')` inside the click handler — admins who never export
PDFs never download the library.

**Why it matters:** Bundle size = how fast the page loads. Every extra
KB of JavaScript slows the first paint. Lazy loading lets you keep the
features without paying the load-time cost upfront.

**Mental model:** A restaurant menu. The whole menu is the bundle. If
every diner had to read every page before ordering, dinner would take
hours. Code splitting = put the desserts on a separate page that only
shows up if someone asks for one.

---

## Lazy import (dynamic `import()`)

**TL;DR:** The actual JavaScript syntax for deferring a module load.
Looks like: `const lib = await import('heavy-library')`. Modern
bundlers (Vite, webpack) automatically split that into its own chunk.

**When you encountered it:** Inside `ExportButtons.tsx`, the PDF click
handler does `await Promise.all([import('jspdf'), import('jspdf-autotable')])`.

**Why it matters:** This is the mechanism behind code splitting. If
you write `import jsPDF from 'jspdf'` at the TOP of a file, it's part
of that file's bundle forever. If you write `await import('jspdf')`
inside a function, it becomes its own lazy chunk.

**Mental model:** Eager import = "always pack this for the trip."
Lazy import = "buy this at the destination only if I actually need it."

---

## Bundle / bundle size

**TL;DR:** The compiled JavaScript file (or files) that the browser
downloads. "Bundle size" = how many KB. Smaller = faster load.

**When you encountered it:** Build output showed `jspdf.es.min` as its
own 390KB chunk separate from `index-*.js` (the main bundle). That's
proof the lazy import worked.

**Why it matters:** Real users on slow networks (3G, hotel WiFi, rural)
feel every extra KB. The Checkmark dashboard is admin-only on fast
laptops, so it's less critical here, but the discipline carries over to
every web app.

**Mental model:** Bundle = the moving truck for your code. Bigger truck
= slower trip. Lazy loading = leave the rarely-used boxes at the old
house and drive back for them only if needed.

---

## CSV format (RFC 4180, BOM, CRLF)

**TL;DR:** CSV looks simple ("just commas, right?") but has surprisingly
strict rules to handle edge cases like commas IN values, quotes, and
line breaks. RFC 4180 is the standard.

**When you encountered it:** Building `<ExportButtons />`'s CSV
serializer. Three rules baked in:
- **RFC 4180 escaping** — if a value contains `,` `"` or a newline,
  wrap it in `"..."` and double up any embedded `"`s
- **UTF-8 BOM** — a 3-byte prefix (`﻿`) at the start of the file
  tells Excel "this is UTF-8 encoded" so it doesn't garble non-ASCII
  characters
- **CRLF line endings** — `\r\n` between rows so both Excel and Google
  Sheets parse cleanly

**Why it matters:** Every "the CSV looks weird in Excel" bug traces
back to one of these three. Doing it right once means the file just
works everywhere.

**Mental model:** CSV is a contract between writer and reader. RFC 4180
is what professional readers expect. Skip the escaping rules and your
CSV will only work in the writer's head.

---

## Schema migration

**TL;DR:** A change to the database structure (adding a column,
renaming a table, changing a column type). Migrations are scripts that
apply the change in a controlled, repeatable way — typically run once
on production and tracked in version control.

**When you encountered it:** We DIDN'T need one for the Went Well / To
Improve split, because we chose parse-on-display instead. If we'd added
two new columns to the clock entries table, that would have been a
migration.

**Why it matters:** Migrations are powerful but risky — they can lock
tables, lose data if buggy, and can't be undone without a backup. Best
practice: prefer non-schema-change solutions when possible (like
parse-on-display), and when you DO migrate, test on a copy first.

**Mental model:** Migration = renovating a wall of a building. Powerful,
but you can't just unkick a load-bearing wall. Better to hang a new
picture (parse-on-display) than to move the wall (schema change) if
either gets the job done.

---

## Parse-on-display

**TL;DR:** Instead of restructuring stored data to match how you want
to display it, KEEP the data as-is and write a small function that
extracts what you need at render/export time.

**When you encountered it:** The Notes column. Stored as a single
flat string like `"Went well: foo\n\nTo improve: bar"`. Instead of
splitting it into two database columns (migration), we wrote
`parseClockNotes(notes)` that regex-extracts the two halves whenever
they're shown. Both the table cell and the CSV cell call the same
parser.

**Why it matters:** Parse-on-display lets you ship UI changes without
touching the database. Zero migration risk. If the display format
changes later, only the parser needs updating, not historical data.

**Mental model:** Storing a JPG of a receipt vs. typing the line items
into a database. The JPG is the truth; the parser reads what it needs
each time. If you later want a different view of the receipt, you read
it differently — you don't repaint the JPG.

---

## Build (the dev meaning)

**TL;DR:** Running `npm run build` compiles your TypeScript + bundles
your code + checks for type errors, producing the JavaScript that
actually runs in browsers. Catches bugs BEFORE deploy.

**When you encountered it:** Vercel runs this automatically on every
push. Claude runs it locally before committing. A failed build means
the code wouldn't have worked in production.

**Why it matters:** Build is your safety net. A clean build means at
minimum the code TYPE-checks and bundles. It doesn't guarantee
behavioral correctness (that's what tests + your eyes are for), but it
catches a huge class of "I forgot a comma" / "this variable doesn't
exist" mistakes.

**Mental model:** Build = the spell-check + grammar pass before
sending an email. Doesn't guarantee the email is GOOD, but catches the
obviously broken parts.

---

## TypeScript strict mode

**TL;DR:** TypeScript's strict mode flags potentially-undefined values
as errors. Helpful but sometimes pedantic — you have to explicitly
acknowledge "this might be undefined and here's what I want to happen."

**When you encountered it:** The build error
`Object is possibly 'undefined'` when accessing `wentMatch[1]` (a
regex match result that might not exist). Fixed by writing
`wentMatch?.[1] ?? ''` instead — "if wentMatch is defined, get [1],
and if that's still undefined, use empty string."

**Why it matters:** Strict mode catches null/undefined bugs at COMPILE
time instead of when a user clicks something at 11pm. Annoying in the
moment, lifesaving in production.

**Mental model:** TypeScript is the friend who says "wait, are you sure
that key is in that dict?" Strict mode is when they refuse to let you
proceed until you answer.

---

## Squash merge

**TL;DR:** A merge style that collapses all of a PR's commits into ONE
commit on `main`, with a clean message. The individual commits are
preserved in the PR's history but `main` stays linear and easy to
read.

**When you encountered it:** PR #194 merged as commit `2ead2eb`,
squashing six branch commits (49a6ccf, a835986, 3ec4fb5, 0214ff4,
bdf2d38, 45edb10) into one. Your two GitHub Desktop commits still
exist in the PR archive but `main`'s log shows just the one merge.

**Why it matters:** Squash keeps `main`'s history readable — one PR
= one commit. The alternative (regular merge commit) preserves every
intermediate step, which is honest but noisy.

**Mental model:** Squash = the final book draft. Regular merge = the
final book PLUS every page of the editor's red-pen notes appended.

---

## Adding new entries

When you encounter something new — a term in a PR, a concept in a doc,
something Claude explained — tell Claude:

> "Add **<concept name>** to my learning log."

Claude will write an entry following the same shape (TL;DR · When ·
Why · Mental model) and place it at the top of the most recent date
section, or start a new date section if a new day has begun.

You can also ask:

> "Re-explain **<concept name>** with a different example."
> "Expand the **<concept name>** entry with a counterexample."
> "Add a personal note to my learning log: <your note>."

This doc is yours. Make it as terse or as detailed as serves you best.
