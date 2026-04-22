# Assignment Task Model

This repo is converging on a monday-style task model:

- A task is a real row in `assigned_tasks`
- Assignment is metadata, not a separate UI-only concept
- Progress is task completion state, not a different record type
- "My Tasks" is an aggregated personal view
- "Team Tasks" is a team-wide view across member and studio work
- "Studio Tasks" is shared work with no single assignee

## Product decisions

1. `assigned_tasks` gets an explicit `scope`
   - `member`: one owner, only that owner completes it
   - `studio`: shared team task, anyone on the team can complete it

2. `Team Tasks` is a view, not a storage mode
   - It reads all visible member tasks plus studio tasks
   - We do not add a separate `team` scope to storage

3. Daily checklists belong in the same task surface
   - Keep a `source_type` so the UI can label where the task came from
   - Avoid separate mental models for "assigned tasks" vs "checklists"

4. Notification click should target the owning task surface
   - Prefer exact task highlight when possible
   - Fall back to batch-level highlight if only batch context exists

## Recommended schema shape

`assigned_tasks`

- `id uuid primary key`
- `team_id uuid not null`
- `assignment_id uuid null`
- `batch_id uuid null`
- `scope text not null default 'member' check (scope in ('member','studio'))`
- `assigned_to_member_id uuid null`
- `title text not null`
- `description text null`
- `category text null`
- `source_type text not null`
- `source_template_id uuid null`
- `source_template_item_id uuid null`
- `sort_order integer not null default 0`
- `is_required boolean not null default false`
- `visible_on_overview boolean not null default true`
- `is_completed boolean not null default false`
- `completed_at timestamptz null`
- `completed_by_member_id uuid null`
- `due_date date null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `scope = 'member'` requires `assigned_to_member_id is not null`
- `scope = 'studio'` requires `assigned_to_member_id is null`

## Read models

Use separate RPCs for separate UI surfaces:

- `get_member_assigned_tasks(user_id, include_completed, only_overview)`
- `get_team_assigned_tasks(user_id, include_completed)`
- `get_studio_assigned_tasks(user_id, include_completed)`

This keeps frontend code simple and lets RLS stay strict.

## Completion rules

- Member task: assignee or admin can toggle it
- Studio task: any team member or admin can toggle it
- Team Tasks surface is view-first
  - users should not complete other members' tasks there
  - they can complete studio tasks there

## Frontend implications

- `MyTasksCard` should read real assigned tasks, not local mock state
- `/daily` should show `Team Tasks`, `My Tasks`, and `Studio Tasks`
- Team/Studio cards should degrade gracefully until the scope migration is applied
