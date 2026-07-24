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

- [ ] Google/Apple Calendar auto-push automation (workspace bookings → Google Calendar on every new/updated booking, event-triggered, not a scheduled sweep) — Requested by: director · Added: 2026-07-18 · ASAP: no · Notes: Two-way sync deprioritized in favor of one-way push first (workspace→Google matters more than Google→workspace right now). Prerequisite race-condition fix (duplicate recurring bookings + duplicate Google events) is DONE — see `claude/recurring-booking-race-fix` branch / PROJECT_STATE "Currently active" row, migration `20260718120000_recurring_session_race_and_sync_claim.sql`, edge function `google-calendar-sync` v15. Remaining: Supabase Database Webhook wiring (Codex) to fire the now-hardened push path automatically instead of the manual "Push pending bookings" button, + a nightly reconciliation cron as a safety net. Needs director input before Codex builds: reconnect Google Calendar OAuth once webhook is ready to test end-to-end; confirm recurring-series edit/delete → Google event cleanup behavior is what's expected; sign off on the PR before merge (touches booking data).

<!-- ACTIVE:END -->

---

## Done

Completed priority items, most recent first. Kept as a record — do not delete.

- [x] Add communication reactions, @pings, and sound cues for Forum + DMs — Requested by: Gavin · Added: 2026-07-10 · Done: 2026-07-10 · Notes: Added chat_message_reactions and chat_message_mentions, Forum/DM reaction buttons, @[Name] mention picker, Checkmark Chime/Soft Pop/Silent preference, and global clickable sound bubbles for DMs, reactions, and pings.

- [x] Wire site-wide dashboard banner/header from Settings Branding — Requested by: Gavin · Added: 2026-07-10 · Done: 2026-07-10 · Notes: Global header is larger, reads a team-wide banner through RPC, and Settings Branding uploads/removes the shared banner via member-media storage.

<!-- Example:
- [x] Fix member archive not hiding on overview — Requested by: Gavin · Added: 2026-07-10 · Done: 2026-07-10
-->
