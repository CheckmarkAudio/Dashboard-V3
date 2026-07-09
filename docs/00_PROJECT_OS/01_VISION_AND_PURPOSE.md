# Vision And Purpose

Purpose: preserve the zoomed-out mission so every AI and human starts from the same standard before choosing tasks, files, or implementation details.

## North Star

Checkmark Audio Dashboard is not just a website. It is the working operating system for Checkmark Audio.

It should feel:

- beautiful without becoming decorative
- easy without becoming shallow
- powerful without becoming noisy
- polished without hiding work behind mystery controls
- stable enough that employees trust it
- magnetic enough that employees naturally want to use it

The product should make everyday studio work easier to see, click, complete, review, and improve.

## Frontend Goal

The website should be so obvious and refined that a worker can find the right action without being trained through paragraphs of explanation.

Frontend goals:

- visible primary actions
- clear page hierarchy
- fewer equal-weight information walls
- worker language instead of database language
- consistent buttons, labels, borders, font scale, spacing, and page rhythm
- mobile and desktop that both feel intentional
- attractive visual surfaces that still move work forward
- no hidden critical controls that only power users remember

Current tactical proof point:

- `/daily` and Tasks are first because they are daily employee work.

Important framing:

- Tasks is not the core vision. Tasks is the first visible test of whether the broader vision is becoming real.

## Backend Goal

The backend must feel boring in the best way: safe, reliable, documented, organized, non-crashing, and wired to real data without orphaned rows or fake success.

Backend goals:

- Supabase data remains team-scoped and permission-safe
- RLS, RPCs, migrations, and generated types stay aligned
- frontend state reflects backend-confirmed results
- deletes, edits, transfers, approvals, and requests do not pretend success
- migrations are applied and verified separately from Vercel
- branch history and PR ownership remain traceable
- no critical behavior depends on stale placeholder data
- no AI guesses through schema, role, or security uncertainty

## Business Goal

The app exists for a real studio team.

It should help Checkmark Audio:

- coordinate workers
- manage tasks
- schedule shifts and sessions
- communicate clearly
- track bookings, sessions, clients, and flywheel progress
- build toward Accountant and education modules without making the daily tool unstable

This is studio operations first, not generic SaaS.

## Experience Promises

Every major change should move the product toward these promises:

1. Employees can find their work.
2. Admins can see what needs attention.
3. Data shown in the interface is honest.
4. Buttons look clickable and behave predictably.
5. Primary actions are not hidden in unclear icons.
6. Pages have hierarchy, not information overload.
7. Backend safety is not sacrificed for visual speed.
8. The brand feels like Checkmark, not a template.
9. The project history remains understandable to the next session.

## What "Amazing" Means Here

Amazing does not mean a huge rewrite.

Amazing means:

- small details line up
- users do not get lost
- repeated components feel like siblings
- real data flows through clean contracts
- visual design has taste and restraint
- daily work feels fast
- the next AI session knows the point of the work

The best version of this app should feel simple at the surface because the underlying structure is disciplined.

## Current Focus Without Losing The Vision

Current UI/UX sequence:

1. Tasks page and `/daily`
2. Messages / DMs / Forum discovery
3. Schedule and vacation/time-off clarity
4. Dashboard hierarchy
5. Admin operation polish
6. Accountant foundation after daily worker clarity

These are steps, not the mission itself.

The mission is a refined, stable, attractive studio operating system that workers and admins actually use.
