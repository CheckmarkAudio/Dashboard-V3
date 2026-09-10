# Optional portal appearance — integration draft

Local preview: http://127.0.0.1:5173/appearance

## Scope

Three browser-local choices: Classic (default), Soft Gold (reference design), Studio (same interaction layout, neutral surfaces and sans-serif headings). Light, dark, and system remain independent preferences. An Appearance link is available from either layout. Nothing is deployed and no database migration is required.

Classic keeps the previous Layout, Dashboard, Calendar, Content, AddMedia, and OverviewScorePreview implementations from repository HEAD `156722f`, in adjacent `*Classic.tsx` modules. Existing task/project changes in the working tree were retained. Shared query/mutation libraries, permission checks, authentication/recovery, exports, dialogs, and the original headphones/microphone logo remain in use. The optional CSS is injected only outside Classic and removed on return to Classic. Snapshot copies are a temporary migration boundary; apply functional bug fixes to both implementations until they can share smaller presentation components.

## Page coverage

All 15 existing canonical routes are linked from Appearance. Admin links and routes retain their existing access checks.

| Page | Route | Integration / preview check |
| --- | --- | --- |
| Overview | `/` | Joined counters, tasks/projects toggle, messages, sessions and schedule; sample data renders |
| Tasks | `/daily` | Compact My/Team/Studio controls; original task and widget workflows retained |
| Projects | `/projects` | Shared heading/forms/cards; three sample projects render; detail routes retained |
| Calendar | `/calendar` | Contained week grid, 5/7-day control, room filters, supporting agenda; sample sessions render |
| Booking and clients | `/sessions` | Existing tabs, booking table, forms and export controls; sample bookings render |
| Forum and messages | `/content` | Searchable conversation column, contained message stream/composer; sample channels and DMs |
| Media | `/add-media` | Three-column library, type filters, list/grid toggle, original upload queue; local audio/image previews |
| Employee profile | `/profile/:memberId` | Identity/contact/schedule/stats; direct Message action for other members; own Security collapses |
| Admin dashboard | `/admin` | Shared style plus compact Command/Requests/Schedule/Alerts controls |
| Assign | `/admin/templates` | Member picker and task editor retained; corrected nested main landmark and secondary heading |
| Assignment tools | `/admin/assign-classic` | Existing legacy tool widgets remain reachable |
| Members | `/admin/my-team` | Compact Roster/Work Scheduler/Clock Data/Activity controls; roster and actions retained |
| Template library | `/admin/template-library` | Existing search, category/sort, archive, create/edit controls retained; empty sample state |
| Analytics | `/admin/health` | Existing charts, date filters, stage drilldowns and exports use shared tokens |
| Settings | `/admin/settings` | Compact section navigation; existing account/access/branding/keys/hours/database controls retained |

## Interaction changes

- Predictable left navigation and separate search and activity rows; original logo throughout.
- Single-click section controls for tasks and administration instead of a tall secondary sidebar.
- One profile Message action uses the existing DM service and dock; no message is sent automatically.
- Profile Security is collapsed in the optional layouts; the original form remains available.
- Reduce motion preference and OS reduced-motion support; overview numbers display directly instead of counting up on refresh.
- Existing media preview now traps keyboard focus and restores it on close. Non-Dropbox media URLs are no longer rewritten with Dropbox query parameters.
- Redundant explanatory copy removed from redesigned headings, upload section, and conversation list. User-authored descriptions, error messages, constraints, and account/security instructions remain.

## Research translated into decisions

- W3C, [Help Users Focus](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o5-user-focus/): avoid competing distractions and support reorientation. Applied as stable navigation, bounded sections, and reduced movement.
- W3C, [Make Short Critical Paths](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o5p02-short-paths/): reduce unnecessary steps in key workflows. Applied as profile-to-message access, joined overview controls, compact section switches, and the existing page finder.
- W3C, [Designing for Web Accessibility](https://www.w3.org/WAI/tips/designing/): consistent navigation, clear headings, and visible focus. Applied to shared page headings, meaningful control labels, and keyboard-visible focus.
- [Accessible Design in Integrated Development Environments: A Think Aloud Study Exploring the Experiences of Students with ADHD](https://arxiv.org/abs/2506.10598): participatory evidence that usability should be evaluated with people with ADHD in the actual task context. This is a different application domain, not proof this portal improves ADHD outcomes.

These are accessibility-informed design choices, not a clinical intervention or a universal ADHD prescription. Next validation should observe actual team members finding a task, opening a file, booking a session, and messaging a colleague; measure completion, wrong turns, and assistance needed against Classic. No unmeasured speed or clinical benefit is claimed.

## Local sample mode and limits

Appearance → Open sample preview (development only), or `/appearance?sample=1`. The current browser tab/session is visibly labeled “Sample data · Read-only.” Exit through Appearance. Production ignores this flag; sample modules and assets are absent from the production bundle.

The sample Supabase transport never falls through to a real backend. It uses synthetic records, blocks writes/unknown RPCs with an explicit read-only error, does not persist/auth-refresh a session, and points realtime toward the local preview origin. Dropbox upload entry points also reject sample writes before streaming. Looking up an existing sample DM returns only that fixture. Unknown table reads show empty sample states; this is not evidence of live backend data or permissions being correct.

Fixtures cover profiles, tasks, projects/objectives, sessions, channels, DMs, and media metadata. One audio and one artwork sample have local preview assets; the remaining media entries illustrate layout only. Templates, work schedules, and some admin reports show empty states. Real uploads, messages, account changes, exports, and backend CRUD were not executed during this review.

## Verification

- TypeScript + Vite production build passes; existing large-chunk warning remains.
- 33 automated tests pass, including added default-style validation and sample transport write isolation/filter tests.
- Browser visited every canonical route in Soft Gold. Checked media type filtering and grid/list switching, local audio metadata/preview focus, profile-to-DM opening, Classic restoration, Studio + dark mode, and mobile navigation/media at 390px.
- Classic restoration confirmed zero optional stylesheet nodes and no redesigned sidebar.
- Mobile document width checked at 390px with no horizontal document overflow; temporary viewport reset afterwards.
- Production bundle checked for fixture identifiers and read-only adapter strings; none found.

This is a working local integration draft. Authenticated live-backend regression checks and usability sessions are still required before an official rollout. No production deployment, permission changes, or live-data mutations occurred.
