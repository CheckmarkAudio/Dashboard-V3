# 00 · Priority Queue

**This is the top of the task hierarchy.** Anything in the Active list below jumps ahead of the roadmap, the current PR, and any in-flight plan. When the director (or Gavin) drops an ASAP ask, it goes here — and it gets done next, even if it means pausing other work and coming back to it.

> This file is `00_` on purpose: it is the first thing in the project brain. AI coders read it before `01_VISION_AND_PURPOSE.md`.

---

## AI Coder Protocol (read this every session)

**At the start of every session** — a fresh chat, a "where were we", or an "awaken phase" — before summarizing anything else, **state the Active priority queue back to the user** as a short numbered list, then ask which to kick off (or start the top one if the user already said go).

Rules of precedence:

1. **Active priority items outrank everything** — the roadmap (`docs/pwa/APP_BUILD_ROADMAP.md`), the current branch, and any half-finished plan. If you are mid-task when a new priority lands, note where you paused (in that task's notes) and switch.
2. **Never silently drop one.** If you can't finish a priority item this session, leave it in Active with a `Paused:` note saying exactly where it stands, so the next session picks it up cold.
3. **Finish, then move.** When a priority item is truly done and verified, move its line from **Active** to **Done** with a completion date. Do not delete it.
4. **When in doubt, ask.** If two priority items conflict or an item is ambiguous, surface it to the director rather than guessing (this is the standing law in `03_LAWS_AND_SAFETY.md`).

The SessionStart hook (`.claude/hooks/check-drift.sh`) reads the Active block below and surfaces it automatically, so it can't be missed — but you still state it in your own words.

---

## How to add a priority item (director / Gavin)

Add a line to the **Active** block below. Minimum is the checkbox + what you want. The rest is optional but helps:

```
- [ ] <what you want done> — Requested by: <name> · Added: <YYYY-MM-DD> · ASAP: <yes/no> · Notes: <anything>
```

You can also just tell an AI coder "add this to the priority queue" and it will write the line for you.

---

## Active

<!-- ACTIVE:START -->
<!-- Add priority items below this line as `- [ ] ...`. The session-start hook reads everything between the ACTIVE markers. Keep finished items OUT of here — move them to Done. -->

- [ ] Redesign the schedule widget's visual treatment — Requested by: director · Added: 2026-07-26 · ASAP: no · Notes: director dislikes the purple chip rows currently used for scheduled shifts (`AdminEmployeeScheduleWidget.tsx`'s day-row chips, `border-purple-500/20 bg-purple-700/10 text-purple-100`, and the matching treatment in `MyScheduleWidget.tsx` + Calendar's Team Schedule tab). Wants it "easy on the eyes" and in Checkmark brand colors (gold/black/white per the design system — see `project_design_system_v1` memory / the design-system PDF — purple is off-brand here) instead of purple. Not urgent — explicitly deferred ("we can reform... though"), just don't lose it. **Expanded 2026-07-28 with a much fuller Calendar-page brief (below) — treat as the same initiative, superset of this item.**

- [ ] Calendar page ("Team Schedule" tab) visual revamp — Requested by: director · Added: 2026-07-28 · ASAP: no · Notes: director tried the page live after the header-bar ship and wants a substantial visual pass, inspired by Monday.com / similar planning-scheduling apps. **Update 2026-07-28:** mockups signed off, then built — [PR #328](https://github.com/CheckmarkAudio/Dashboard-V3/pull/328) (branch `claude/calendar-schedule-revamp`, awaiting a Vercel-preview data check before merge) ships the member-rows grid, the gold-filled toggle, and the locked per-member colors (replacing purple + grey). **Still open, not in PR #328:**
  - Redesign the **"update your work schedule" modal** (`ScheduleRequestModal.tsx` / the weekly-hours editor) so a member's **current schedule is visually obvious before/while editing** — director: "when I updated my hours I couldnt tell what I was updating or if i even had a set schedule to begin with." Wants a visual breakdown of the person's current schedule shown alongside the edit form, not just blank/unclear inputs.
  - **Hour-accuracy investigation** — director: "we need to make sure that the hours match with the employee's schedule." PR #328's new grid positions blocks directly from real `starts_at`/`ends_at` (same math as `HeaderActivityBar`), which should already resolve this, but hasn't been checked against real data yet (see PR #328's open verification gap) — confirm on the Vercel preview before considering this closed.
  - **NEEDS-DIRECTOR** (surfaced in PR #328, not decided): whether the old hover-highlight interaction (dim everyone, light up on hover — a 2026-05-27 decision) should be layered back on top of the new always-visible per-member colors, or stays retired now that color alone carries identity.
  - Canonical home for the full plan (problem breakdown, data model notes, file list, acceptance criteria, locked colors) is `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`.

- [ ] Customizable per-member schedule colors — Requested by: director · Added: 2026-07-28 · ASAP: no · Notes: after locking the six team members' colors for the Team Schedule redesign (Bridget red-orange, Checkmark gold, Christian blue, Matthan gray, Richard green, Tony red — see `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md`), director wants these changeable later as a real setting in admin Settings (a color picker per member) rather than hardcoded. Log only, build alongside the Team Schedule redesign above — not urgent on its own.

- [ ] Developer activity tracker / patch notes for Bridget's own dev work — Requested by: Bridget (director) · Added: 2026-07-28 · ASAP: no · Notes: Bridget does the actual Dashboard-V3 + checkmarkaudio.com coding herself and wants to see her own dev work reflected somewhere in the app — there is currently no dev-activity tracker or changelog/patch-notes record anywhere. Distinct from the existing Member Activity/Presence system: presence (`usePresenceHeartbeat`) only captures time with the Dashboard-V3 browser tab open and focused — it has no visibility into time spent coding in an editor/CLI, so "coding hours" can't be captured automatically without new instrumentation (flagged to Bridget directly, not glossed over). Near-term direction discussed: a simple manual "log a work session" entry (start/end + note) she fills in herself, rendered as its own segment kind on `HeaderActivityBar`, with the bar's click-through wired to a real activity-detail page instead of just Overview (`navigate('/')` today). A fuller version — patch notes/changelog tied to git commit history — is a separate, bigger feature, not scoped yet.

<!-- ACTIVE:END -->

---

## Done

Completed priority items, most recent first. Kept as a record — do not delete.

- [x] Google/Apple Calendar auto-push automation (workspace bookings → Google Calendar on every new/updated booking, event-triggered, not a scheduled sweep) — Requested by: director · Added: 2026-07-18 · Done: 2026-07-24 · Notes: Shipped as two PRs: [#314](https://github.com/CheckmarkAudio/Dashboard-V3/pull/314) (recurring-booking race fix + Google-sync claim-before-send hardening — prerequisite so the automation can't create duplicate bookings or duplicate Google events) and [#315](https://github.com/CheckmarkAudio/Dashboard-V3/pull/315) (the actual trigger — a Postgres trigger on `sessions` INSERT/UPDATE calls `google-calendar-sync` via `pg_net`, async, authenticated by a shared secret stored only in Supabase Vault). Verified live in production with real test bookings: create → real Google event, edit → same event updated, cancel → event deleted. Two-way (Google→workspace) sync stays deferred, matching the original ask. Nightly `pg_cron` reconciliation safety net is a nice-to-have, not blocking, and remains unbuilt.

- [x] Add communication reactions, @pings, and sound cues for Forum + DMs — Requested by: Gavin · Added: 2026-07-10 · Done: 2026-07-10 · Notes: Added chat_message_reactions and chat_message_mentions, Forum/DM reaction buttons, @[Name] mention picker, Checkmark Chime/Soft Pop/Silent preference, and global clickable sound bubbles for DMs, reactions, and pings.

- [x] Wire site-wide dashboard banner/header from Settings Branding — Requested by: Gavin · Added: 2026-07-10 · Done: 2026-07-10 · Notes: Global header is larger, reads a team-wide banner through RPC, and Settings Branding uploads/removes the shared banner via member-media storage.

<!-- Example:
- [x] Fix member archive not hiding on overview — Requested by: Gavin · Added: 2026-07-10 · Done: 2026-07-10
-->
