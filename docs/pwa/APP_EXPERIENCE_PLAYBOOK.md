# Checkmark Workspace App Experience Playbook

Purpose: define how Checkmark Workspace should feel and behave as an installed app, before route-by-route mobile polish begins.

This document turns the app vision into buildable standards. Use it alongside `PWA_STRATEGY.md`, `MOBILE_ROUTE_INVENTORY.md`, and `MOBILE_AUTH_QA.md`.

## Experience North Star

Checkmark Workspace should feel like a professional studio control surface:

- fast enough that the interface gets out of the way
- visually calm, not empty
- touch-friendly, not toy-like
- modular without feeling scattered
- useful immediately after login
- expressive enough to feel like Checkmark, not generic software

The app should borrow from the mentality of great music tools:

- Ableton-like clarity: dense workflows, clean grouping, low friction
- Max/MSP-like modularity: small parts connect predictably
- studio-first rhythm: daily work, session flow, staff accountability, and communication stay close to the surface

This is an inspiration anchor, not a visual clone.

## Product Feel

The app should feel:

- `Operational`: users know what needs attention right now.
- `Fluid`: screens move naturally between overview, task, booking, and detail states.
- `Professional`: typography, spacing, icons, and actions feel intentional.
- `Personal`: users can make the workspace feel like theirs without setup becoming a chore.
- `Stable`: auth, session, booking, task, and member flows never feel experimental.

Avoid:

- decorative complexity that does not clarify work
- hidden primary actions
- cramped desktop UI forced into mobile
- generic SaaS visuals that erase the studio identity
- big rewrites when focused component fixes will do

## App Shell Standards

The installed app shell is the frame users live inside. It should be boring in the best way.

Required:

- header/nav stays readable and stable on small screens
- route changes feel predictable
- back/close behavior is obvious
- modals fit the viewport and can scroll internally when needed
- primary actions sit where thumbs can reach them
- no horizontal overflow
- no blank white loading screens
- no unauthenticated private data flash

Mobile shell priorities:

1. Identity: user can tell they are in Checkmark Workspace.
2. Status: user can tell if they are clocked in, logged in, connected, synced, or blocked.
3. Navigation: user can reach daily work quickly.
4. Action: user can complete the top task without hunting.

## Role-Based Home Rules

Role-based home is not a separate app. It is the same app prioritizing different work.

Admin/owner launch priority:

1. operational alerts
2. calendar/session status
3. task and assignment health
4. member/staff state
5. finance/accounting later

Employee/member launch priority:

1. clock state
2. today schedule
3. assigned tasks
4. messages/requests
5. personal profile/progress

Both roles should still be able to reach the full authorized app. The launch surface just decides what comes first.

## Mobile Interaction Standards

Use these standards when converting a route from responsive website to app-quality mobile.

- A tap should have an obvious result.
- Primary actions should use direct verbs.
- Destructive actions should be deliberate and confirmed.
- Important rows should open a detail view, not rely on tiny inline controls.
- Checkboxes, icon buttons, and menus need comfortable touch targets.
- Lists should preserve context after edit/delete/complete.
- Loading states should name what is loading.
- Error states should say what failed and what the user can do next.

Do not solve mobile pressure with tiny text. Reflow, summarize, collapse, or move detail into a modal/sheet.

## Visual System Rules

Dark mode is primary, but light mode must be equally legible and intentional.

Core colors:

- black
- white
- checkmark gold
- purple accent

Limited support colors:

- green for success/synced/confirmed
- red/rose for destructive/error
- blue/cyan for informational sync/system states
- profile/KPI accent colors only as small markers

Shape and structure:

- app surfaces can be slightly softer than the website
- use nested panels where they clarify grouping
- use thin divider lines for rows and task groups
- avoid heavy card piles inside other card piles
- avoid inconsistent border radii page-to-page

Icon style:

- use clear, solid icons when the icon is the identity of the action
- use line icons for secondary navigation/actions
- keep icon weight consistent within a surface
- icon-only buttons require accessible labels

Typography:

- headings should establish hierarchy without shouting
- operational rows should favor scan speed
- avoid explanatory subtext where the user already understands the object
- use metadata only when it changes a decision

## First-Run Personalization

First-run personalization should make the app feel owned, not delayed.

Prompt sequence:

1. Choose app color mode: dark or light.
2. Add profile picture.
3. Add banner image.

Rules:

- `Update later` is always available for image steps.
- App theme can differ from website theme.
- Profile picture and banner are account-level and shared across app/web.
- Existing users with saved media should not be prompted again.
- Existing users missing media can be prompted gently.
- Personalization never blocks urgent work.

## Workflow Quality Bar

A route is app-quality only when:

- the main job can be done with one hand on a phone
- the route has clear loading, empty, error, and success states
- the route does not depend on desktop hover
- the user can recover from mistakes
- auth/session behavior is safe
- data displayed matches backend truth
- all primary buttons fit and remain visible
- the route has been checked in dark and light mode

## Route Polish Order

Work from operational dependency, not excitement.

1. Login/auth/setup/recovery.
2. App shell/nav/clock state.
3. Overview role-based home.
4. Tasks and daily work.
5. Calendar and booking details.
6. Booking create/edit.
7. Forum/messages.
8. Members/account access.
9. Settings.
10. Accountant and finance module.

Reason:

- users must get in first
- then they need a stable home
- then they need daily operational work
- deeper admin and finance surfaces can follow once the app shell is trusted

## Implementation Playbook

For each route:

1. Identify the route's one-sentence job.
2. List the top three user actions.
3. Define the mobile layout shape before coding.
4. Reuse shared tokens/components where possible.
5. Build the smallest route-specific change.
6. Verify desktop did not regress.
7. Verify mobile viewport.
8. Verify auth/permissions if the route touches protected data.
9. Update docs if behavior, route priority, or data contract changed.

Do not combine unrelated mobile polish across many routes in one PR. Small, verified route slices are safer.

## Claude Handoff Prompt

Use this when handing a mobile/app UI task to Claude:

```text
Read docs/pwa/APP_EXPERIENCE_PLAYBOOK.md, docs/pwa/PWA_STRATEGY.md, docs/pwa/MOBILE_ROUTE_INVENTORY.md, docs/claude-web-dev-guardrails.md, and docs/ui-standards.md before editing.

Work only on [ROUTE/COMPONENT]. Keep the change focused. Preserve auth/session behavior, Supabase behavior, and existing desktop behavior. Use shared tokens/components where possible. Verify dark mode and light mode, desktop and mobile viewport, loading/empty/error states, and no horizontal overflow. Do not touch service worker, manifest, auth routing, or unrelated pages.
```

## Definition Of Ready For A Mobile PR

A mobile/app PR is ready to start when:

- target route/component is named
- role is named: admin, employee, or both
- top user action is named
- files likely to change are scoped
- active Claude/Codex PR overlap has been checked
- backend/security risk is identified as none, low, or explicit

## Definition Of Done For A Mobile PR

A mobile/app PR is done when:

- build passes
- preview link exists
- desktop route still works
- mobile viewport has no horizontal overflow
- primary workflow works with touch
- auth/data privacy was not weakened
- screenshots or notes document verification
- docs were updated if route behavior or standards changed
