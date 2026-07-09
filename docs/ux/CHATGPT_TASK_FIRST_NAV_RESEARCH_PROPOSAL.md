# ChatGPT Task-First Navigation Research Proposal

Status: research intake, not source of truth.

Origin: compressed and sanitized from two ChatGPT-generated drafts added by the user on 2026-07-09:

- `Dashboard-V3_Nav_Task_Research_Reports.md`
- `Dashboard-V3_Task_First_Nav_Reform_Plan.md`

This file preserves the useful research direction and product hypotheses while removing or downgrading overconfident "final recommendation" language. It should inform focused UX planning, not override the Project OS or roadmap.

## Read This First

This document is not the master roadmap.

The binding sources remain:

- `docs/pwa/APP_BUILD_ROADMAP.md` for phase order
- `docs/pwa/WEB_INTERFACE_POLISH_ROADMAP.md` for website clarity sequence
- `docs/ux/TASKS_PAGE_REDESIGN_PLAN.md` for `/daily`
- `docs/ux/MESSAGES_DISCOVERY_PLAN.md` for Messages / DMs / Forum discovery
- `docs/ux/SCHEDULE_UX_REDESIGN_PLAN.md` for schedule and time-off clarity

Do not hand this file to Claude, Codex, Cursor, or ChatGPT as a direct implementation prompt. Use it as research context, then create a scoped task from the binding docs.

## Sanitization Notes

- Named user-role guesses were removed. The repo's own team/role files are the source of truth.
- "Final" and score-based claims were downgraded to proposal language.
- Broad implementation prompts were removed because they encouraged too much change at once.
- Exact research statistics are retained only as source leads from ChatGPT research. Verify them before citing them as evidence in a PR, decision memo, or external document.
- Backend-heavy ideas are marked as later architecture work, not immediate UI work.

## Research Hypothesis

The ChatGPT research argues that Checkmark should become easier to use by making daily work visible, especially tasks and communication.

Useful hypothesis:

> Employee-facing navigation should make the next work action obvious. Tasks, Messages, Schedule, and Bookings should be easy to find without training.

Keep this narrower than the full project vision. Checkmark is not only a task app; it is the broader Checkmark Audio operating system. Tasks are currently the first tactical proof point for worker-obviousness.

## Navigation Research Takeaways

The research compared persistent navigation, hidden navigation, desktop top navigation, mobile bottom tabs, and dashboard-grid navigation.

Useful takeaways for Checkmark:

- Worker-critical routes should not be hidden behind mystery icons or hamburger-only navigation.
- A left/sidebar navigation pattern is a strong candidate for a later global shell pass because Checkmark has many durable work areas.
- The top bar should be treated as a utility zone, not the only place to discover major work areas.
- Mobile should not be a squeezed desktop sidebar. A later mobile shell pass should consider bottom tabs for the highest-frequency destinations.
- The dashboard can remain useful as an overview, but it should not be the only navigation model.
- Badges should indicate action needed, not decorative activity.

Candidate desktop nav order from the research:

1. Tasks
2. Messages
3. Forum
4. Schedule
5. Bookings
6. Media
7. Members
8. Training
9. Analytics
10. Admin / Settings

Candidate mobile bottom tabs from the research:

1. Tasks
2. Messages
3. Schedule
4. Bookings
5. More

These are candidates for a later app-shell/nav pass, not an instruction to redesign the global shell inside the current Messages discovery slice.

## Task UX Takeaways

The research supports the direction already started on `/daily`:

- My work should appear first.
- Do not show every task context at the same time by default.
- Use a small number of visible task categories.
- Keep detailed metadata in a task detail panel or modal.
- Keep task cards clean: title, status/check, assignee, due date, priority, and only operationally important indicators.
- Use tags/metadata for filtering and automation rather than turning every work type into a visible nav tab.

Candidate future smart views:

- Today
- Mine
- Team
- Checklist
- Submitted
- Done

These are not yet approved as a data model or UI commitment. They are a useful vocabulary for future `/daily` evolution after the current My Tasks pane is worker-tested.

## Messages / Forum Takeaways

The research reinforces the existing Messages discovery plan:

- Messages and Forum should be mentally distinct.
- Messages means direct or small-group coordination.
- Forum means shared channels, knowledge, announcements, culture, training, ideas, and discussion.
- A worker should not need to know that DMs hide in Forum or behind a top-right icon.
- Header access should use a clear label where space allows.
- Forum should expose Direct Messages as a clear sidebar section.
- Unread state should use labels/counts, not color alone.

This supports the next scoped target: make Messages / DMs impossible to miss without redesigning the entire Forum.

## Later Architecture Ideas

These ideas are valuable but should wait for Codex architecture/data review before implementation:

- booking-generated task bundles
- task-to-booking links
- task-to-session links
- task-to-schedule links
- proof requirements such as photo, video, upload, or URL before task submission
- task statuses such as To Do, In Progress, Blocked, Submitted, Done, and Needs Revision
- backend tags for location, department, proof requirements, recurrence, priority, and review state
- calendar views that show shifts, bookings, due tasks, and overdue tasks together

Reason: these touch schema, RLS, RPCs, realtime, generated types, and worker-facing business rules. They are not just visual changes.

## What To Extract Into Source Docs

Already extracted or planned:

- `WEB_INTERFACE_POLISH_ROADMAP.md`: keep worker-obvious sequence; note later app-shell/nav pass.
- `TASKS_PAGE_REDESIGN_PLAN.md`: preserve My Tasks first; add future smart-view vocabulary without changing data semantics.
- `MESSAGES_DISCOVERY_PLAN.md`: strengthen Messages vs Forum separation and labeled entry points.

Do not extract:

- raw implementation prompts
- score claims such as "9.7 / 10"
- exact research statistics unless independently verified
- team-member role assumptions
- "Tasks are the whole center" language that narrows the broader Project OS mission

## Source Leads From ChatGPT Research

These links came from the ChatGPT research file. They are useful leads, not independently verified repo evidence.

Navigation and UX:

- NN/g — Hamburger Menus and Hidden Navigation Hurt UX Metrics: https://www.nngroup.com/articles/hamburger-menus/
- NN/g — Hamburger Menus Hurt UX Metrics video: https://www.nngroup.com/videos/hamburger-menus/
- NN/g — Left-Side Vertical Navigation on Desktop: https://www.nngroup.com/articles/vertical-nav/
- NN/g — Menu-Design Checklist: https://www.nngroup.com/articles/menu-design/
- Material Design — Navigation Bar: https://m3.material.io/components/navigation-bar/overview

Task apps and workflow:

- Todoist — Calendar Integration: https://www.todoist.com/help/articles/use-the-calendar-integration-rCqwLCt3G
- Trello — Adding Dates to Cards: https://support.atlassian.com/trello/docs/adding-dates-to-cards/
- Trello — Calendar View: https://trello.com/views/calendar
- Asana — Project Views: https://asana.com/features/project-management/project-views
- ClickUp — Intro to Views: https://help.clickup.com/hc/en-us/articles/6329880717719-Intro-to-views
- ClickUp — Show Custom Fields in Tasks and Views: https://help.clickup.com/hc/en-us/articles/6330455628439-Show-Custom-Fields-in-tasks-and-views
- GitHub Docs — Managing Labels: https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels
- arXiv — Label it be! A large-scale study of issue labeling in modern open-source repositories: https://arxiv.org/abs/2110.01328

## Open Decisions

<span style="color:#d97706">NEEDS-DIRECTOR</span>: Should the later global shell pass make `/daily` the default logged-in landing page, or should Overview remain the landing page while Tasks becomes the first visible work destination?

<span style="color:#2563eb">NEEDS-WORKER-TEST</span>: Test whether employees understand "Messages" or "Direct Messages" faster.

<span style="color:#7c3aed">ASSUMPTION</span>: The strongest near-term value is Messages discovery, not a full global shell redesign.
