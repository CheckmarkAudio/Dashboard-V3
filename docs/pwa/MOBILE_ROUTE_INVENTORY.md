# Mobile Route Inventory

Purpose: rank the routes that matter most for Checkmark Workspace as an installed app.

This document prevents the vague task "make everything mobile friendly." Work from the highest-impact workflows first.

Use `APP_EXPERIENCE_PLAYBOOK.md` for route-level interaction standards and the definition of app-quality mobile polish.

## Priority Levels

- P0: must work before calling the app usable
- P1: important for daily use
- P2: useful but can wait
- P3: admin/deep workflow or later polish

## Role-Based Launch

Recommended launch behavior:

- Owner/admin: role-aware Overview/Hub with alerts, production status, calendar, feedback, and operational widgets.
- Employee/member: Today/My Tasks/progress-first view with schedule, task expectations, messages, and clock state.

## P0 Routes

| Route | Primary users | Why it matters | Mobile needs |
|---|---|---|---|
| `/login` | everyone | App is useless if login/setup/recovery fails. | large inputs, reliable recovery/setup flow, no viewport clipping |
| `/` / Overview | everyone | First app impression and daily command surface. | role-aware priority, readable widgets, no horizontal overflow |
| `/daily` / Tasks | employees/admins | Employees need to know what to do. Admins need progress visibility. | checkbox usability, task detail modal, pending states |
| `/calendar` | everyone | Studio schedule visibility. | readable day/week view, booking detail, sync status |
| `/sessions` / Booking | admins/staff | Create/edit bookings and clients. | create modal, client picker, date/time controls |
| `/profile` | everyone | Personalization, profile picture, banner image, and identity continuity across app/web. | profile media upload, `Update later`, mobile image controls |
| clock in/out flow | employees/admins | Operational attendance and end-of-day reporting. | clock button, clock-out modal, logout decision path |

## P1 Routes

| Route | Primary users | Why it matters | Mobile needs |
|---|---|---|---|
| `/forum` | everyone | Communication and file/media sharing. | message input, attachments, DMs, notifications |
| `/admin/settings` | admins | Account access, database, feedback, PWA-related settings later. | left rail collapse, focused panels |
| `/admin/members` | admins | Staff setup and access management. | table/card adaptation, setup-link flows |
| `/admin/assign` | admins | Assign and review tasks. | member selector, task list, edit/delete safety |
| `/admin` / Analytics | admins | Production visibility. | chart readability, summary-first layout |

## P2 Routes

| Route | Primary users | Why it matters | Mobile needs |
|---|---|---|---|
| `/add-media` | everyone | Media upload and library access. | upload affordances, thumbnail viewing |
| `/admin/template-library` | admins | Task template management. | editor modal usability |
| `/business-health` | admins | Flywheel/health analysis. | summaries before large charts |

## P3 / Later

| Route | Why later |
|---|---|
| Accountant | Needs secure admin-only backend model first. |
| Deep exports/reports | Useful, but not first installability blocker. |
| Future native wrapper settings | Wait until PWA is proven. |

## Mobile QA Notes

Every P0 route should be checked for:

- no horizontal overflow
- tap targets at least comfortable thumb size
- modals fit in mobile viewport
- visible focus states
- loading/empty/error states
- dark mode readability
- no hidden primary actions
- route works after installed-app launch

Every P0 route should also answer:

- What is the route's one-sentence job?
- What is the primary action?
- What should be visible without scrolling?
- What can move into a detail view or sheet?
- Does the route still work if the user is interrupted and returns later?

## First Mobile Fix Batch

Do not decide until after QA, but likely candidates:

- mobile nav density
- calendar week/day readability
- modal viewport behavior
- task row tap/checkbox ergonomics
- settings left rail collapse
- booking modal date/time controls

## Route Slice Template

Use this before assigning a route to Claude or Codex.

```text
Route:
Primary role:
One-sentence job:
Top three actions:
Desktop behavior to preserve:
Mobile blocker:
Likely files:
Backend/security risk:
QA viewports:
Dark/light mode required:
Docs to update:
```
