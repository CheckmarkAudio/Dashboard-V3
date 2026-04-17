# Intern → Team Rename — Resume Packet

This folder exists because a Claude Code session crashed mid-setup on the `intern_*` → `team_*` rename. Use these files to pick up exactly where we left off without re-pitching the plan.

## If you're the human opening a new Claude session

From your terminal:

```
cd ~/GITHUB/Dashboard-V3
claude
```

Then paste this as your first message:

> Resume the intern→team rename. Read `docs/intern-rename-resume/README.md` first, then walk me through Step 1 of `03-steps.md`. Do not start any migration without confirming with me.

That's it. Claude will know what to do from the files here and from the memory notes.

## If you're Claude

Read in this order:

1. `01-context.md` — what happened, where git is, what's safe
2. `02-strategy.md` — the approach the user already approved (don't re-litigate)
3. `03-steps.md` — the numbered actions to execute
4. `04-rollback.md` — what to do if something breaks

**Before you touch anything**: verify git HEAD is still `473f04c` ("Analytics Reform"). If it's not, stop and tell the user the world moved since this packet was written.

Confirm the user is ready before running any SQL that mutates the database. The export (Step 1) is read-only and safe to run without re-confirming.
