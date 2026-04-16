# Dashboard Rebuild Blueprint

This document defines the structural rebuild direction for the Checkmark Audio dashboard.

It focuses on three foundations:

1. Role and permission architecture
2. Widget and workspace architecture
3. Core data model for bookings, tasks, sessions, and flywheel metrics

The goal is to turn the dashboard into a studio operating system for a small growing music business, with a clean split between admin and employee workflows, strong future-proofing, and a satisfying low-friction experience for daily use.

## Product Principles

- Build one shared platform, not two separate apps
- Keep admin and employee experiences clearly separated at the workflow level
- Make the system modular so screens can be rearranged without rewriting business logic
- Prefer data-derived metrics over manual KPI entry whenever possible
- Design for fast clicking, visible progress, and low cognitive load
- Keep the visual system consistent, calm, and structured, inspired by Ableton's clarity and modularity

## 1. Role And Permission Architecture

### Roles

Start with these roles:

- `owner`
- `admin`
- `member`

Optional later:

- `manager`

### Role intent

- `owner`: full business control, including granting and removing admin access
- `admin`: can manage team members, templates, bookings, sessions, KPI rules, workspace defaults, and analytics
- `member`: can manage their own work, own widgets, own tasks, own sessions, and permitted shared records

### Structural rule

Permissions must not be scattered across components.

They should live in three layers:

1. Database policies and row ownership
2. Shared permission helpers in app code
3. Route and feature guards in the UI

### Recommended permission model

Use a dedicated membership model rather than relying only on a `role` string on the user record.

Minimum practical structure:

- `users`
- `teams`
- `team_memberships`
- `roles`

For this app's current size, this can still be implemented inside the existing `intern_users`-style structure first, then normalized later. But the code should act as if membership is a first-class concept.

### Admin/member app separation

Keep one shared shell and one shared design system, but split feature surfaces:

- `member app`
  - Today
  - My tasks
  - My bookings
  - My sessions
  - My flywheel
  - My overview workspace

- `admin app`
  - Team operations
  - Permissions
  - Scheduling oversight
  - KPI rules and flywheel analytics
  - Workspace defaults
  - Templates and automations

### Implementation guidance

- Keep routes separated by area, for example:
  - `/app/...`
  - `/admin/...`
- Keep feature folders separated by area, for example:
  - `src/features/member/...`
  - `src/features/admin/...`
  - `src/features/shared/...`
- Use shared domain modules underneath both:
  - `src/domain/bookings/...`
  - `src/domain/tasks/...`
  - `src/domain/sessions/...`
  - `src/domain/flywheel/...`

### First permission deliverables

- Add a clean permission helper layer
- Define a single source of truth for current user's role and capabilities
- Add an admin-only permissions screen for promoting and demoting users
- Treat `checkmarkaudio@gmail.com` as the initial owner/admin conceptually

## 2. Widget And Workspace Architecture

### Core idea

The dashboard should behave more like a customizable studio workspace than a fixed website homepage.

The Overview page should be a configurable canvas of widgets, similar in spirit to Ableton's modular work areas and customizable browser organization.

### Widget system goals

Every widget should be:

- reusable
- movable
- hideable
- configurable
- consistently styled
- independently data-backed

### Widget contract

Each widget should follow one shared structure:

- widget id
- title
- description
- size
- allowed roles
- default position
- configuration schema
- data loader
- action set

### Recommended widget types for v1

- `my_tasks`
- `today_schedule`
- `bookings_queue`
- `sessions_today`
- `flywheel_progress`
- `team_updates`
- `quick_actions`
- `notes`
- `focus_block`

### Workspace model

Each user should have:

- a personal workspace layout
- optional saved presets
- optional role-based defaults

Admins should also have:

- admin workspace defaults
- ability to publish recommended layouts by role

### Layout model

Recommended entities:

- `workspace_templates`
- `user_workspaces`
- `workspace_widgets`

Each widget instance should store:

- position
- width/height
- visibility
- settings

### UX principles for the workspace

- Drag-and-drop should be optional, not required for basic use
- Clicking should feel immediate and satisfying
- Important actions should be large and obvious
- Widget chrome should be uniform so the page feels coherent even when personalized
- Personalization should never break data integrity or permissions

### Visual system guidance

Borrow from Ableton at the system level, not by copying its visuals literally:

- stable grid
- consistent panel framing
- clear hierarchy
- modular panels
- restrained but intentional accent colors
- strong visual predictability

### First widget deliverables

- Build a shared `DashboardWidgetFrame`
- Build a workspace registry that lists all available widgets
- Add per-user widget visibility and order persistence
- Rebuild Overview around widgets instead of hardcoded page sections

## 3. Core Data Model: Bookings, Tasks, Sessions, Flywheel

### Core problem to solve

Right now, the business workflow needs one connected chain:

- Booking created
- Work prepared
- Session delivered
- Follow-up completed
- KPI/flywheel impact recorded

That chain should exist in the data model directly.

### Recommended domain entities

#### Clients

Tracks who the studio serves.

Fields:

- `id`
- `name`
- `client_type`
- `email`
- `phone`
- `notes`
- `status`

#### Bookings

A booking is a scheduled commitment.

Fields:

- `id`
- `client_id`
- `service_type`
- `status`
- `scheduled_start`
- `scheduled_end`
- `room_id`
- `assigned_member_id`
- `created_by`
- `notes`
- `source`

Suggested statuses:

- `draft`
- `confirmed`
- `cancelled`
- `completed`
- `no_show`

#### Sessions

A session is the actual execution record of booked work.

Fields:

- `id`
- `booking_id`
- `client_id`
- `session_type`
- `owner_member_id`
- `actual_start`
- `actual_end`
- `status`
- `quality_score`
- `outcome_notes`
- `followup_required`

Suggested statuses:

- `planned`
- `in_progress`
- `completed`
- `cancelled`

#### Tasks

Tasks represent work that supports bookings, sessions, clients, operations, or marketing.

Fields:

- `id`
- `title`
- `task_type`
- `status`
- `priority`
- `assigned_to`
- `due_at`
- `related_client_id`
- `related_booking_id`
- `related_session_id`
- `related_project_id`
- `flywheel_stage`
- `completion_points`

Suggested task types:

- `prep`
- `session_execution`
- `followup`
- `marketing`
- `admin`
- `maintenance`

#### Flywheel events

This should be the backbone of analytics.

Instead of storing only summary percentages, store event rows whenever meaningful work happens.

Fields:

- `id`
- `event_type`
- `stage`
- `source_table`
- `source_id`
- `member_id`
- `team_id`
- `event_at`
- `value`
- `metadata`

Suggested stages:

- `deliver`
- `capture`
- `share`
- `attract`
- `book`

### Key relationship rules

- One client can have many bookings
- One booking can create one or more sessions
- One booking can generate many tasks
- One session can generate many follow-up tasks
- Task completion and booking/session state changes can emit flywheel events

### Example workflow chain

1. Admin or member creates booking
2. Booking emits a `book` flywheel event
3. System auto-generates prep tasks from a workflow template
4. Team completes prep tasks
5. Session starts and later completes
6. Session completion emits `deliver` event
7. Follow-up tasks appear automatically
8. Review, testimonial, content sharing, or outreach can emit `share`, `capture`, or `attract` events

### Workflow templates

This system should support templated operational playbooks.

Examples:

- Recording session template
- Mixing session template
- Music lesson template
- Consultation template

Each template should define:

- default tasks
- recommended timeline offsets
- responsible role
- flywheel event rules

## Recommended App Structure

Suggested top-level structure:

- `src/app/`
- `src/features/admin/`
- `src/features/member/`
- `src/features/shared/`
- `src/domain/auth/`
- `src/domain/permissions/`
- `src/domain/workspaces/`
- `src/domain/bookings/`
- `src/domain/tasks/`
- `src/domain/sessions/`
- `src/domain/flywheel/`
- `src/components/ui/`

Suggested rule:

- UI components should not own business rules
- Domain modules should define queries, mutations, types, and mapping helpers
- Widgets should assemble domain data, not invent it

## Rebuild Order

### Phase 1: Foundations

- Remove dependence on mock operational state for primary routes
- Define role/capability helpers
- Separate admin/member route areas
- Create shared domain modules for bookings, tasks, sessions, flywheel

### Phase 2: Core data rebuild

- Add real `bookings` model
- Link bookings to sessions and tasks
- Add flywheel event ledger
- Add workflow template support

### Phase 3: Workspace rebuild

- Build shared widget frame
- Build workspace persistence
- Rebuild Overview as personalized widget layout
- Publish role-based default layouts

### Phase 4: Analytics and automation

- Derive flywheel reporting from events
- Add admin flywheel rules editor
- Add quality and productivity scorecards
- Add recommendation panels like "next best action"

## Immediate Build Targets

The next implementation steps should be:

1. Create the permission and route blueprint in code
2. Replace hardcoded Overview with a widget registry plan
3. Design the new relational model for bookings, sessions, tasks, and flywheel events

## Success Criteria

The rebuild is succeeding when:

- admin and member experiences are clearly separated without duplicated logic
- overview content is modular and user-configurable
- bookings, tasks, sessions, and flywheel metrics are part of one connected system
- dashboards reflect real work, not mock data
- employees can move quickly with low friction and high clarity
- the product feels consistent, professional, and satisfying to use every day
