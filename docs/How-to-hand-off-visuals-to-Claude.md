# How to hand off visual drafts to Claude Code (human-friendly)

Use this when you want **drawings / PNG mockups** to become **real, clickable pages** that match the **Menu-Sidebar** header and menu—without repeating the same instructions every time.

---

## What “file path” means (no coding required)

A **file path** is the **address of a file on your computer or in this project**, like directions.

- **In this GitHub project:** paths often start from the project folder, for example  
  `docs/Menu-Sidebar/menu-sidebar-v5.2-reference.png`  
  That means: open the `docs` folder, then `Menu-Sidebar`, then the picture file.
- **On your Mac (Finder):** you can right-click a file → **Hold Option** → **Copy “…“ as Pathname** and paste that long path. Either style works for Claude if you paste it **exactly once** in the block below.

**Tip:** Keep every draft image **inside this project** (for example under `docs/pages/…`) so the path is short and the same on every machine.

---

## One copy-paste block for Claude (fill in the blanks)

Copy everything from **START** to **END** into Claude Code. Replace the `ALL_CAPS` parts with your real text. Leave anything you are unsure about as `ASK_ME` or blank—Claude can ask once.

```
===== START — IMPLEMENTATION REQUEST =====

PROJECT: Intern-Dashboard (Checkmark Audio dashboard).

FROZEN SHELL (DO NOT REDESIGN UNLESS I SAY “CHANGE MENU-SIDEBAR”):
- Read: docs/Menu-Sidebar/README.md
- Match visuals: docs/Menu-Sidebar/menu-sidebar-v5.2-reference.png
- Implement header + left menu so they match those files. Wire every menu row to the correct page (see PAGE MAP below).

SCOPE OF THIS TASK:
- Implement or update ONLY the page bodies listed in PAGE MAP.
- Do NOT change Menu-Sidebar layout, labels, or icons except to fix broken links if a label in PAGE MAP does not match a route yet.

PAGE MAP (each row = one screen; “draft path” must be a real path to my PNG(s)):
| # | Menu or header item that opens this screen | Short name I use for this screen | Path to my main mockup image | Path to extra images (optional) | Special notes for this screen |
|---|---------------------------------------------|----------------------------------|--------------------------------|----------------------------------|------------------------------|
| 1 | EXAMPLE: Overview                           | Overview home                    | docs/pages/Overview/overview-v1.png | (none)                    | Keep header from Menu-Sidebar only |
| 2 |                                             |                                  |                                |                                  |                              |
| 3 |                                             |                                  |                                |                                  |                              |

ACCEPTANCE (plain English):
- When I click each menu item in PAGE MAP, I land on a page that looks like my mockup(s) for that row.
- The header and sidebar always look like Menu-Sidebar v5.2; only the large area to the right changes per page.
- Use existing app styles (colors, fonts, buttons) unless my mockup clearly shows something new—then match the mockup and say what you added.

===== END =====
```

Add more table rows (`| 4 | …`) if you need more pages in one request.

---

## Where to put drafts (already created for you)

Folders for each menu label live under **`docs/pages/`**. See **`docs/pages/README.md`** for the full list.

Examples:

| Screen | Folder | Example file path |
|--------|--------|-------------------|
| Overview | `docs/pages/Overview/` | `docs/pages/Overview/overview-v1.png` |
| Booking Agent | `docs/pages/Booking Agent/` | `docs/pages/Booking Agent/booking-agent-v1.png` |

Tell Claude the **full path from the project root** including spaces exactly as in Finder (copy path if needed).

---

## How this avoids redundant requests

1. **Menu-Sidebar** is always the same two references: `README.md` + `menu-sidebar-v5.2-reference.png`. You do **not** re-describe the header/menu each time if you paste the **FROZEN SHELL** lines above.
2. **What changes each time** is only the **PAGE MAP** table: which button, which image path, which notes.
3. If Claude already implemented the shell, your next message can start with: **“Menu-Sidebar is already done; only update PAGE MAP rows 2 and 3.”**

---

## Tiny glossary (optional)

| Term | In one sentence |
|------|------------------|
| **Route / URL** | The web address piece after the site name, like `/calendar`—Claude wires the menu to these. |
| **Component** | The code file that draws one page—Claude picks the right file from the project. |
| **Redundancy** | Saying the same header spec twice—avoid it by always pointing at `docs/Menu-Sidebar/` instead of retyping. |

---

## Where the technical “what connects to what” lives

When you are ready, a maintainer (or Claude once) can fill **`docs/navigation-route-map.md`** with a table: menu label → URL path → code file. After that exists, your paste block can add one line: **“Follow docs/navigation-route-map.md for wiring.”** You still only maintain **your** column: paths to PNGs and plain-English notes.

A starter table lives at **`docs/navigation-route-map.md`**. Add your **visual draft paths** there as you create PNGs; Claude can read that file plus the copy-paste block so you do not repeat yourself.
