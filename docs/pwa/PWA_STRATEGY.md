# Checkmark Workspace PWA Strategy

Purpose: turn Checkmark Workspace from a responsive website into an installable, app-like workspace for desktop, iPhone, and Android without creating a second codebase.

## Product North Star

Checkmark Workspace should feel like a modular studio operating surface:

- fast enough to disappear while people work
- calm and visually simple
- touch-friendly without losing desktop density
- modular by default, customizable when useful
- low demand on device/network resources
- designed around studio operations, not generic business software

Inspiration anchor:

- Ableton/Max philosophy: modular, powerful, low-friction, performance-minded, and ahead of the curve without visual clutter.
- This is inspiration, not a clone. Checkmark keeps its own visual identity and business workflow.

## App Name

Public/installable app name:

- `Checkmark Workspace`

Short name:

- `Checkmark`

## Scope

PWA v1 should make the existing production app installable and dependable.

In scope:

- web app manifest
- app icons
- iOS home-screen metadata
- safe app-shell service worker
- first-run app personalization plan
- mobile route inventory
- install QA
- mobile auth QA
- targeted mobile blocker fixes after QA

Out of scope for PWA v1:

- App Store / Play Store release
- Capacitor/native wrapper
- push notifications
- private offline data
- offline editing
- Accountant implementation
- broad visual redesign

## Offline Policy

V1 offline behavior:

- Do not cache private Supabase/team/business data.
- Do not allow offline edits.
- If the network is unavailable, show a clear reconnect state.
- Static shell assets may be cached only if cache invalidation is predictable.

Reason:

- Checkmark contains sensitive studio, employee, client, booking, task, and eventually finance data.
- Stale private data is more dangerous than a simple online-only app in v1.

## Role-Based Home

Role-based home means the app launch experience prioritizes the user role, not that we build two apps.

Recommended:

- Admin/owner opens into an admin-aware Overview/Hub surface.
- Employee/member opens into a Today/My Tasks/progress surface.
- Same shell, same routes, same design system.

The route can remain `/` or `/overview`; the content priority should be role-aware.

## First-Run Personalization

The installed app should help users make the workspace feel like theirs without blocking urgent work.

Recommended onboarding prompts after first app login/install launch:

1. Choose app color mode:
   - `Dark`
   - `Light`

2. Add profile picture:
   - upload/crop/select image
   - allow `Update later`

3. Add banner image:
   - upload/crop/select image
   - allow `Update later`

Theme rule:

- App color mode can be device/app-specific.
- Website color mode can remain separate.
- A user may prefer dark on desktop and light on phone, or the reverse.

Profile media rule:

- Profile picture and banner image are account-level assets.
- Once saved, they should remain consistent across installed app and website.
- Existing users who already have profile/banner images should not be forced through those steps again.
- Existing users missing either image can be gently prompted, with `Update later`.

Implementation guardrails:

- Do not block login or urgent task access behind personalization.
- Do not create a long onboarding wizard.
- Store completion/dismissal state clearly so users are not nagged every launch.
- Keep image upload accessible and mobile-safe.
- Use existing profile/member data paths when possible.

## Visual Direction

Dark mode is primary.

Core palette:

- black
- white
- checkmark gold
- purple accent

Other colors:

- only for small identifiers such as notifications, KPI/stage markers, profile accents, and status dots.

App feel:

- slightly softer/touch-friendlier than the current website
- still consistent with existing Checkmark UI
- important actions should visually pull attention
- tasks, checkboxes, due items, alerts, and primary actions must not be hidden
- optional customization should never be required for the default app to be useful

## Architecture Principles

- Keep one repo and one web app.
- Keep PWA plumbing isolated from feature UI.
- Do not let service worker code affect auth or Supabase behavior until explicitly tested.
- Prefer progressive enhancement: the website should still work if install features are unavailable.
- Avoid app-wide rewrites during PWA foundation work.
- Defer native wrapper until PWA is stable.

## Claude/Codex Ownership

Codex owns:

- PWA strategy
- manifest/service worker architecture
- caching policy
- auth/session QA plan
- safety and release process

Claude owns focused UI tasks after scope is defined:

- icon concept sketches
- route-level mobile polish
- touch-friendly UI refinements
- screenshot-based visual fixes

Claude should not touch:

- service worker caching rules
- auth/session logic
- Supabase security
- broad app architecture
- unrelated route redesigns

## Build Sequence

1. PWA strategy and app identity docs.
2. Mobile route inventory for admin and employee workflows.
3. App icon direction.
4. Manifest + app metadata + iOS tags.
5. Safe service worker with no private offline data.
6. Install QA on desktop, Android, and iPhone.
7. Mobile auth QA.
8. Mobile route QA.
9. Targeted mobile blocker fixes.
10. Revisit native wrapper only after PWA behavior is stable.

## Success Criteria

PWA foundation is successful when:

- Checkmark Workspace can be installed from desktop Chrome.
- Checkmark Workspace can be added to an iPhone home screen.
- Checkmark Workspace can be installed from Android Chrome.
- The app launches with correct name, icon, theme color, and standalone display.
- Login/logout/recovery still work.
- No private data is cached offline.
- Key mobile routes are inventoried and ranked.
- Follow-up mobile fixes are clearly scoped.
