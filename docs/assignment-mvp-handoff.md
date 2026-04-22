# Minimum Testable Assignment Slice

Build the minimum testable assignment slice for `Dashboard-V3`. The goal is to prove the assignment architecture end-to-end in real use before adding the full template system.

## Success Criteria

1. Admin can assign a custom task to one or more members.
2. The assigned member sees that task in a dedicated `Assigned To You` area on their Overview.
3. The assigned member also gets an assignment notification in the notifications widget.
4. The assigned member can mark the task complete/incomplete.
5. Users only see their own assigned tasks and notifications.
6. Admin/member separation stays intact.

Keep scope intentionally small. Do not build the full template system yet. This slice is for validating the assignment architecture quickly.

## Build Order

### 1. Supabase schema

Create only the minimum tables needed for custom assignment:

- `task_assignment_batches`
- `task_assignments`
- `assigned_tasks`
- `task_assignment_notifications`

Use the architecture where:

- a batch = one admin assignment action
- an assignment = one recipient's copy of that action
- assigned tasks = the real user-facing tasks
- notifications = generated automatically for recipients

Recommended intent:

- `task_assignment_batches` tracks who assigned what and when
- `task_assignments` tracks which members received it
- `assigned_tasks` is what the member actually sees and checks off
- `task_assignment_notifications` feeds the notifications widget

### 2. RLS / permissions

Set strong role-safe behavior:

- only admin can create assignment batches / assignments / assigned tasks via assignment RPC
- regular users can only read their own `assigned_tasks`
- regular users can only update completion for their own `assigned_tasks`
- regular users can only read their own `task_assignment_notifications`
- admin can read across assignment data

### 3. RPCs

Implement only these first:

- `assign_custom_task_to_members`
  - Purpose: admin assigns one custom task to one or more members
  - It should:
    - create one batch row
    - create one `task_assignments` row per member
    - create one `assigned_tasks` row per member
    - create one notification per member
  - Return a structured summary, not just boolean

- `get_member_assigned_tasks`
  - Purpose: fetch active assigned tasks for a member, suitable for Overview widget

- `complete_assigned_task`
  - Purpose: member toggles complete/incomplete on their own assigned task

- `get_member_assignment_notifications`
  - Purpose: fetch assignment notifications for a member

- `mark_assignment_notification_read`
  - Purpose: mark one assignment notification as read

Keep RPC return payloads structured and frontend-friendly.

### 4. Frontend data layer

Add:

- TypeScript types for assigned task / assignment notification
- query helpers for the read RPCs
- mutation helpers for assign / complete / mark-read flows

Prefer a clean separation in `src/lib/queries/...` or equivalent.

### 5. Admin UI

Build one small admin assign surface only: `Assign Task`

Recommended placement:

- Assign page
- or Admin Hub widget

whichever is simpler with current code structure.

Fields:

- recipient member(s)
- task title
- optional description
- optional category
- optional due date
- required toggle if useful
- assign button

This does not need to be fancy yet. Prioritize correctness and speed.

### 6. Member Overview UI

Add a dedicated `Assigned To You` section/widget on member Overview.

Show:

- task title
- short description if present
- category if present
- due date if present
- completion toggle
- optional `new` badge for recently assigned items

This widget should read from `get_member_assigned_tasks`.

### 7. Notifications widget integration

Add assignment notifications into the notifications widget.

Show examples like:

- `New task assigned: Follow up with client`
- `Admin assigned you a task`

Click behavior can be simple:

- navigate to Overview
- or focus/open the assigned task area

Simple is fine for this first slice.

### 8. Testing expectations

After this is built, I want to be able to test:

- Admin assigns a task to Member A
- Member A logs in and sees it on Overview
- Member A sees an assignment notification
- Member A completes the task
- The task state persists correctly
- Member B does not see Member A's task
- Admin/member separation holds

### 9. Scope guardrails

Please do not expand this slice into:

- full template library
- partial template assignment
- assignment history UI
- batch cancellation UI
- spreadsheet export
- major refactor beyond what is needed

This slice is specifically to validate the assignment system in practice as fast as possible.

### 10. Implementation philosophy

Use this product model:

- templates will later be reusable admin blueprints
- assignments are the act of giving work to members
- assigned tasks are the real user-facing tasks
- notifications announce new assignments

For this first slice, build only the custom-assignment path, but build it in a way that will scale cleanly into template assignment later.
