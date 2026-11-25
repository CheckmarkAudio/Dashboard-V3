# Project Spaces — design and implementation draft

Date: 2026-09-29
Status: Beta implementation in PR #346. Database migration applied and verified on 2026-10-24; frontend deployment pending. The broader nested-spaces/AI design remains a draft.
Owner: Codex for architecture and data contracts. Master phase order remains in `../pwa/APP_BUILD_ROADMAP.md`.

## Product direction

Make a project a place to work: a visual collection of tasks, notes, pictures, measurements, and smaller spaces. Design for installed computer and phone use from the start. The director's Studio Glow-Up project is the first concrete example.

The page's job: let someone capture an idea, find its context, and take one useful next action.

Top three actions:

1. Add a thought, picture, measurement, or task without first designing a system.
2. Enter an area and see its work and references together.
3. Complete a task or grow it into a space without losing its identity.

This extends the Checkmark operating-system mission and the existing Assign behavior contract. It is not a new task engine or a replacement roadmap.

## Evidence from the existing workspace

- The director's screenshot shows Studio Glow-Up as a large project header, project team section, and objectives list. Work and references have no shared spatial home.
- `src/pages/Projects.tsx` implements create/edit forms, objectives, subtasks, membership, completion, and progress notes in one page module.
- `src/lib/queries/projects.ts` reads `projects`, `project_objectives`, `assigned_tasks`, `project_members`, `project_updates`, and project pins. Existing tasks already have `project_id` and `project_objective_id`.
- The inspected project query layer has no content-block, nested-space, measurement, or project-attachment contract.
- React/Vite is the current runtime. Manifest/icons exist. Device installation, authentication, updates, and packaging readiness are separate release gates; this design does not establish them.
- This is a local code inspection, not a production schema audit. Existing SQL/RLS must be inspected before selecting a migration design.

## Studio Glow-Up example

Project home holds visible previews of a few areas:

- Cleaning → Closet, Piano teaching zone, Studio A.
- Furniture & fit → furniture name, width/depth/height, explicit units, room/reference image, fit notes.
- Room plans → uploaded pictures or diagrams, captions, related tasks.
- Shopping → ideas and linked tasks; buying is never triggered by checking a project task.
- An easy capture area for thoughts that have not found a home yet.

Subspaces use the same small collection of block types as project home. Breadcrumbs and back navigation preserve location. Notes are content, not required tasks; adding a photo must not change the completion denominator.

## Interaction model

- A bounded, gently arranged board on computers: sections keep stable positions, with drag placement as an enhancement.
- The same underlying content on phones: one column, tappable previews, full-width editing, visible Back and Add controls. Never shrink the desktop canvas to fit a phone.
- Start with four block types: task reference, note, image/file, and measurement. A space contains blocks and other spaces.
- Make a space: wrap an existing task in a linked workspace, preserving its ID, assignee, permissions, completion, comments/history, and links. Do not duplicate the task. Creating a space does not complete or reopen it.
- Focus: explicitly chosen view with one next incomplete task, its project context, and Done/Back controls. Order is transparent; no guessed priorities or deadlines.
- Capture first: users can add content without owners, dates, colors, or categories. Those fields remain available when useful.
- Arrange without dragging: Move to…, Move earlier/later, keyboard controls, and touch controls provide equivalent actions. WCAG 2.2 requires a non-drag pointer alternative for dragging functionality: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- Reversible changes: undo archive/move where supported; explicit confirmation for destructive actions.
- Optional restrained completion feedback, no mandatory sounds, streak penalties, or motion. Respect reduced-motion preference.
- Keep the Checkmark logo, gold/purple identity, readable typography, shared button hierarchy, and light/dark themes.

These are usability hypotheses, not claims of clinical ADHD effectiveness. Validate with the director and real workers.

## Prompt-based New Project

Flow: describe → proposed layout → edit/remove suggestions → create.

Example input: “Refresh the studio. Clean the closet, piano teaching zone, and Studio A. Keep furniture dimensions, room plans, and a shopping list together.”

The starter proposes a small number of spaces and concrete initial tasks, with blank measurement fields. It does not invent measurements, costs, people, dates, room geometry, or completed work.

- A blank project and reusable templates remain available without AI.
- AI output is a validated draft, not executable SQL or trusted authorization.
- Generation uses a server-side provider integration, with secrets kept off clients; authenticated requests, limits, clear failure states, and bounded output.
- Only submit the user-provided project description and explicitly selected context. Do not silently include unrelated team/client data or attachments.
- Validate schema, allowed block types, depth/count limits, text lengths, and references. Plain text must remain plain text.
- User acceptance creates the complete starter atomically with retry/idempotency handling. Generation failure cannot leave half a project.
- NEEDS-DIRECTOR before live AI integration: select provider/account, budget limit, and acceptable project-data handling.

## Proposed persistence boundary — subject to schema audit

Prefer an additive model over changing task ownership semantics:

- Project remains the permission and membership boundary.
- A project-space record holds project ID, optional parent space, title, stable order, optional linked task ID, and archive/version metadata.
- Typed content blocks belong to a project space. Task blocks reference existing `assigned_tasks` IDs; notes/measurements have validated content; attachments reference private storage metadata.
- Both parent and linked records must belong to the same authorized project/team. Prevent cycles and enforce nesting limits in the database.
- Desktop board position and mobile reading order are separate presentation fields. Coordinates must not determine phone usability or reading order.
- Private attachments need scoped storage policies, type/size checks, signed access, orphan cleanup, and permission tests. Do not assume that knowing a storage URL grants access.
- Existing objectives need a reversible mapping to spaces; preserve original IDs/history and keep old clients functional during rollout.
- My Tasks and project blocks read the same task. Audit cache invalidation and realtime subscriptions so completion is visible everywhere.
- Writes return confirmed IDs/versions. Failed writes keep the draft with a Retry action; concurrent edits detect conflicts. Never show Saved before backend confirmation.
- Initial offline behavior follows the existing app policy: clear reconnect state, no private-data cache or offline editing until explicitly designed and secured.

## Delivery slices

1. Review the Studio Glow-Up interaction concept on computer and phone; validate navigation, content types, and task-to-space behavior.
2. Audit production-aligned schema, task permissions, membership, objective semantics, storage, migrations, and generated types. Write the exact additive contract and rollback approach.
3. Ship real spaces with notes and references to existing tasks. Migrate/map existing objectives without loss; keep existing task workflows functioning.
4. Add private images and structured measurements, then reorder/move and focused task view.
5. Add reusable starters, followed by server-backed prompt generation with draft review.
6. Complete installed-device release checks: launch/relaunch, auth links, resume, updates/rollback, reconnect, file picker/camera, back navigation, keyboard, and phone safe areas.

Auth/shell safety remains a prerequisite for an app release. Native packaging choice is tracked in the app roadmap, not selected by this concept.

## First concept — scope and limits

The conversation contains an interactive concept named Studio Project Space. It uses sample content and local, in-memory state. It explores nested navigation, task-to-space promotion, focus, dimensions, local image preview, and computer/phone layout. The New Project example is a labeled preset, not live AI generation. Nothing is saved to the real project.

It is not a repo runtime component or a deployed app. The draft intentionally omits production drag/drop, per-space persistence, membership controls, concurrency, storage uploads, and real AI. Those belong in the delivery slices above.

## Acceptance criteria

### Director refinement — furniture and shopping, 2026-09-29

- Match the current Soft Gold appearance rather than the host app's dark theme. Verified local sources: `src/workspace.css` for the active cream/bronze palette and serif headings, `src/components/ui/Button.tsx` for 32px small / 40px medium desktop controls, and `src/index.css` for 14px body / 12px secondary text. Use 44px touch controls and 16px editable fields on phone.
- Furniture dimensions are a collection of named entries. Add a name and any known width/depth/height; Add or Return appends an entry and clears the quick-entry fields. Measurements may remain blank. Selecting an entry reopens room, type, units, measurements, and notes for later edits.
- Distinguish the dimensions of existing furniture from available room/closet space. Do not imply a purchase will fit just because numbers exist; clearance notes remain visible when relevant.
- Shopping is a real checklist. Items can reference a furniture/space measurement entry. Reference changes must propagate wherever that entry is displayed.
- The dimensions block can appear beside Shopping or inside it. Both placements refer to the same project block; removing a placement must not delete its entries. Drag placement is an enhancement to explicit Add inside / Add beside controls.
- On phone, show a shopping item and its linked measurements together in a compact vertical group. Full measurement details remain accessible through a Dimensions shortcut; no shrunken two-column desktop canvas.
- Preserve useful shortcuts: Dimensions, Add furniture, and At the store. The phone version also offers Shopping list to return directly to the checklist.
- The second conversation mockup, Shopping And Measurements, compares side-by-side, inside Shopping, and phone-at-store arrangements with shared in-memory sample data. It is not shipped or persisted to Supabase.
- Production unit handling must preserve measurement meaning. The concept converts entered values when switching inches/cm; production should store canonical precision and round only for display.

### Release acceptance

- A worker can locate Closet from project home, add a room picture, record a dimension with units, and find the next task without coaching.
- Turning a task into a space preserves its identity, history, and permissions; it does not produce duplicate work in My Tasks.
- Back navigation returns to the prior place; deep links work after relaunch.
- Both 320–390px phone widths and computer layouts preserve readable content, touch targets, focus, and all essential actions without horizontal panning.
- Completion updates every task surface; notes/photos never distort progress.
- Saved work survives reload and another authorized device; failures and conflicts remain visible and recoverable.
- Cross-team and unauthorized writes/attachments fail on the backend, not merely in the UI.
- AI-generated suggestions remain editable and uncommitted until accepted; generation outage leaves manual creation usable.
- NEEDS-WORKER-TEST: actual director/employee walkthrough before claiming the experience is obvious or adoption-ready.


## Modular tools beta — 2026-10-14

Director requested moving the reviewed concept into the real Projects route. Vocabulary: **tools** and **Tool bank**. This is an explicitly requested Phase 3 slice; it does not assert installed-app release readiness.

Implemented:
- Searchable catalog; drag from bank or tap Add; pointer/keyboard reorder plus move buttons; multiple instances, editable titles, full-width option, confirmed removal.
- Measurements: name + Return, optional dimensions, later editing, units conversion, clearance notes.
- Shopping list: check items, reference project measurements, show sizes and notes together on phones.
- Task list: select an existing objective or all project tasks. Existing task rows, IDs, mutations, progress history and completion permissions are reused; removing a tool does not remove tasks.
- Typed notes and vector Sketchpad: mouse/pen, opt-in finger drawing, stroke undo, pen width, typed caption. Touch does not draw by default; drawing surface owns gestures, surrounding page scrolls. Actual Apple Pencil/palm behavior remains a device test.
- Existing objectives/team/progress remain available in an expandable section below the workspace.

Architecture:
- `src/domain/projectTools/model.ts` owns the versioned discriminated union, searchable catalog, validation and pure operations. Add future tools here, in `ProjectToolContent.tsx`, and in the SQL validator together; unknown types fail explicitly.
- `ProjectToolsBoard.tsx` reuses `DashboardWidgetFrame` and existing dnd-kit. The existing `WorkspacePanel` is intentionally not used: it is a fixed-height personal member/admin carousel with static role-specific IDs, incompatible with project-owned dynamic instances and shared content. This beta uses a responsive, ordered two-column grid; phone reading order is the same saved array. No global chrome or existing carousel behavior changed.
- One `project_toolboards` record per project stores versioned content + layout and an optimistic-concurrency revision. The save RPC locks the parent project (including first save), validates references and bounds, checks active membership/owner/admin, and rejects stale revisions. Team-scoped reads explicitly require an active member, avoiding reliance on the live `get_my_team_id()` fallback alone.
- Writes are explicit **Save workspace**. Task mutations save through their existing RPCs independently. Only confirmed responses show Saved. Failed drafts remain editable; Retry, Download draft, and Load latest are available. Discard is confirmed. Drafts also remain in account/project-scoped query memory during in-app navigation; no private offline cache or browser persistence was added. Reload/close warns while dirty.
- Board reads refresh on focus and every 30 seconds. A local draft is not overwritten by polling; stale saves require reconciliation. Whole-board conflict detection is conservative; simultaneous automatic merging is not part of this beta.
- RLS, grants, RPC contract and mirrored TypeScript database definitions are in `20261014120000_project_toolboards.sql` and `src/types/database.ts`. No storage bucket is needed for vector strokes.

Verification:
- 43 Node tests; production build and release-marker check passed (existing bundle-size warning remains).
- Isolated PostgreSQL/PGlite test runner: `scripts/test-project-tools-db.mjs`. Install `@electric-sql/pglite@0.3.14` outside the repo, then run with `PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js`. Tests migration execution, content roundtrip, revision conflicts, invalid/cross-project references, direct-write denial, team read isolation, active members, admin access, unknown users, anonymous access, archives and cascade cleanup. This uses contract fixtures, not a full Supabase instance.
- Read-only live schema audit verified the referenced columns, base tables, and current permission helpers on linked project `ncljfjdcyswoeitsooty`; toolboards did not exist at audit time.
- Browser: all five tool types, search, Return entry, linked measurements, note editing, save confirmation, invalid save recovery, bank drag, keyboard reorder, move buttons, mouse drawing/undo, light/dark, and 320/390px overflow checks.
- Local `/projects?sample=1&project=sample-project-0` uses clearly marked synthetic content. Toolboard saves are memory-only there and reset on reload; other sample mutations remain read-only. Production builds exclude the sample transport.

Release gate:
- Migration **APPLIED 2026-10-24** to linked CM-Audio Workspace (`ncljfjdcyswoeitsooty`) after the director's explicit approval. Command: `supabase db query --linked --file supabase/migrations/20261014120000_project_toolboards.sql`. History recorded with `supabase migration repair 20261014120000 --status applied --linked`. Only this migration was applied.
- Live verification confirmed RLS, authenticated SELECT/RPC grants, anonymous denial and direct-write denial. An authenticated-owner save/read and stale-revision rejection passed inside a transaction that was rolled back; zero toolboards remained afterward. These checks do not replace browser/device verification.
- Frontend deployment remains pending. PR #346 code checks passed, but its Vercel preview failed; the CLI login is invalid and browser access requires authenticator verification before build logs can be inspected. Resume from the deployment linked on the PR after sign-in. Then test a real project on two authorized sessions and an iPad. Roll back the frontend without dropping the new table; preserve recorded content.
- Remaining later slices: nested room spaces/task-to-space promotion, private room images, AI starters, automatic conflict merging, and installed-device packaging. These are not claimed by this beta.
