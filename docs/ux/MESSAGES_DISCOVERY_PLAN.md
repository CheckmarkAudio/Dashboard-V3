# Messages Discovery Plan

Purpose: make direct messages obvious enough that workers find them without being told where to look.

## Problem

DM capability exists, but discovery is too subtle.

Gavin had trouble finding:

- the DM section in Forum
- the top-right Messages icon

This is a product signal. If one worker misses it, others will too.

## Known Current Implementation

- `src/components/Layout.tsx` renders `MessagesBell` in the top-right header controls.
- `src/components/messages/MessagesBell.tsx` shows unread counts, recent threads, and a New button.
- `src/components/messages/DmDock.tsx` opens floating conversations across pages.
- `src/pages/Content.tsx` supports DM deep links with `?dm=<channel_id>`.
- `src/pages/Content.tsx` imports `NewMessageDialog`, `useDmThreads`, and DM query helpers.
- `src/lib/queries/dms.ts` owns DM query/mutation helpers.

## Target Job

"Let me message a teammate, and let me know when someone messaged me."

## Design Direction

Header:

- show icon plus "Messages" label where there is room
- keep unread badge
- make hover/title/focus text explicit
- consider a stronger unread state than a small red badge alone

Forum:

- add or strengthen a Direct Messages section in the sidebar
- show "New message" near the Direct Messages label
- show unread counts beside threads
- use worker language: "Direct Messages" or "Messages"

Empty state:

- if no DMs exist, show a clear "Start a message" action

Mobile:

- header access must remain reachable
- DM drawer/dock behavior must not cover the message composer or nav

## Likely Implementation Path

1. Inspect actual rendered Forum sidebar and header at desktop and mobile.
2. Improve `MessagesBell` label/visibility without breaking responsive top nav.
3. Improve Forum sidebar DM entry points.
4. Add empty-state and unread language where missing.
5. Verify `DmDock` still opens and marks reads.

## Likely Files

- `src/components/Layout.tsx`
- `src/components/messages/MessagesBell.tsx`
- `src/components/messages/DmDock.tsx`
- `src/pages/Content.tsx`
- `src/components/messages/NewMessageDialog.tsx`
- `src/lib/queries/dms.ts`, only if unread/thread data behavior changes

## Non-Goals

- Do not redesign the whole Forum.
- Do not rewrite DM backend.
- Do not change message storage or RLS in a discovery-only pass.
- Do not remove the floating dock unless a separate UX decision is made.

## Acceptance Criteria

- a worker can find DMs in under 5 seconds
- header entry is understandable without knowing the icon
- Forum exposes DMs as a clear place, not hidden behavior
- unread state is visible and not color-only
- keyboard users can open messages and start a new message

## Open Decisions

<span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Test whether "Messages" or "Direct Messages" is clearer for employees.

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Decide whether DMs should feel like part of Forum or a separate top-level communication area.

