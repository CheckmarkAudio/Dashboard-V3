# Checkmark Accountant Integration Plan

Purpose: integrate a per-user finance and client-tracking workspace into Checkmark without making it feel like a bolted-on side app.

Current anchor points:

- `public.clients` already exists and is team-scoped.
- `sessions.client_id` already exists for linking bookings to real clients.
- The app already has admin settings, member profiles, booking/session flows, and dashboard widgets.
- The accountant mockup is now preserved at `docs/mockups/checkmark-accountant-v5-beta.html`.
- Use the accountant mockup as a visual/product reference, not as code to paste directly into the app.

## Product Shape

Checkmark Accountant should be a first-class workspace module, not a separate microsite.

Recommended placement:

- Main nav item: `Accountant` or `Finance`.
- Member profile tab: `Finance`, scoped to that member.
- Client detail drawer/page: financial history for that client.
- Dashboard widgets: compact summaries only, such as unpaid invoices, this month revenue, recent payments.

Avoid:

- A disconnected HTML import.
- A finance UI with different cards, fonts, borders, or button logic.
- Storing financial data in browser-only state.
- Letting non-admin members see full team financials by default.

## Core Concepts

The finance model should connect these existing ideas:

- Team: the business/accounting boundary.
- Member: the person doing work or receiving revenue/pay.
- Client: the customer.
- Session/booking: the work performed.
- Invoice: the request for payment.
- Payment: money received.
- Expense: money spent.
- Ledger entry: normalized financial event used for reporting.

## Data Model

Add tables in small migrations, not all at once.

Phase 1 tables:

- `client_accounts`
  - `id`
  - `team_id`
  - `client_id`
  - billing contact fields
  - default payment terms
  - tax/exemption notes if needed
  - `created_at`, `updated_at`

- `invoices`
  - `id`
  - `team_id`
  - `client_id`
  - `member_id` nullable if invoice is team-owned
  - `invoice_number`
  - `status`: `draft`, `sent`, `paid`, `void`, `overdue`
  - `issue_date`, `due_date`
  - `subtotal_cents`, `tax_cents`, `total_cents`, `paid_cents`
  - `notes`
  - `created_by`, `created_at`, `updated_at`

- `invoice_items`
  - `id`
  - `team_id`
  - `invoice_id`
  - `session_id` nullable
  - `description`
  - `quantity`
  - `unit_amount_cents`
  - `line_total_cents`

- `payments`
  - `id`
  - `team_id`
  - `invoice_id`
  - `client_id`
  - `amount_cents`
  - `payment_date`
  - `method`
  - `reference`
  - `notes`
  - `created_by`, `created_at`

Phase 2 tables:

- `expenses`
  - member/team scoped expenses
  - category, vendor, amount, date, receipt URL

- `ledger_entries`
  - normalized rows for reporting
  - source table/id, debit/credit direction, amount, date

Important rule:

- Store money as integer cents, never floating-point dollars.

## Security Model

Use RLS and SECURITY DEFINER RPCs like the existing clients system.

Suggested permissions:

- Owner/admin:
  - full team finance access.
  - create/edit/void invoices.
  - record payments.
  - view all members and clients.

- Member:
  - no Accountant access in v1.
  - future expansion can add member-scoped finance views after the admin-only model is proven safe.

- Intern:
  - no Accountant access in v1.

Backend rules:

- Every finance table must include `team_id`.
- All write RPCs verify `auth.uid()`, `get_my_team_id()`, and role.
- Do not trust `team_id`, `member_id`, totals, or status transitions from the frontend.
- Totals should be computed server-side from invoice items.
- Soft-delete or void financial records instead of hard-deleting where possible.

## UI Integration

Use existing Checkmark surfaces and visual rules.

Navigation:

- Add a top-level `Accountant` nav item only once the base read view works.
- Until then, expose it through Settings or a hidden/admin route for development.

Main Accountant page:

- Top summary row:
  - unpaid balance
  - paid this month
  - overdue count
  - draft invoices

- Primary tabs:
  - `Invoices`
  - `Payments`
  - `Clients`
  - `Expenses`
  - `Reports`

- Invoices table:
  - consistent admin table pattern.
  - no subtext-heavy rows.
  - use clean columns: client, date, due, amount, status, actions.

Member profile integration:

- Add a `Finance` tab or section showing:
  - this member's booked revenue
  - invoices tied to their sessions
  - payments collected
  - unpaid work

Client integration:

- Client detail should show:
  - contact details
  - session history
  - invoice history
  - payment history
  - balance

Booking integration:

- Booking detail can show invoice state:
  - `Not invoiced`
  - `Draft invoice`
  - `Sent`
  - `Paid`

Do not overload the booking modal with full finance editing.

## Implementation Phases

### Phase 0: Inventory and Mockup Capture

Goal: locate the original accountant HTML or recreate its intent as a canonical mockup.

Tasks:

- Search repo and local files for accountant mockup.
- If found, move/copy reference into `docs/mockups/`.
- Create `docs/accountant-ui-blueprint.md` describing visual and interaction rules.
- Decide final module name: `Accountant`, `Finance`, or `Books`.

Safe with Claude:

- Yes, docs/mockups only.

### Phase 1: Data Foundation

Goal: add schema without changing the visible app much.

Tasks:

- Create migrations for invoices, invoice items, payments, and client account metadata.
- Add RLS policies.
- Add RPCs:
  - `create_invoice`
  - `update_invoice`
  - `void_invoice`
  - `record_payment`
  - `get_accountant_summary`
  - `get_invoices`
- Add database tests or SQL verification queries.

Safe with Claude:

- Yes, if Claude avoids Supabase migrations and finance files.

### Phase 2: Query Layer

Goal: frontend API wrappers with typed contracts.

Tasks:

- Add `src/lib/queries/accountant.ts`.
- Add query keys.
- Convert RPC results into stable UI types.
- Add optimistic updates only after server confirms identity and totals.

Safe with Claude:

- Mostly yes, isolated file.

### Phase 3: Admin Accountant Page

Goal: read-only first, then controlled writes.

Tasks:

- Add route/page shell.
- Add summary widgets.
- Add invoice table.
- Add invoice detail drawer.
- Add create draft invoice modal.
- Add payment recording modal.

Safe with Claude:

- Moderate. Coordinate if Claude is editing nav, dashboard shell, settings, or shared UI.

### Phase 4: Client and Booking Integration

Goal: connect finance to existing workflow.

Tasks:

- Link sessions to invoice items.
- Add `Create invoice from booking/session`.
- Add client finance detail section.
- Add booking detail invoice status.

Safe with Claude:

- Higher conflict risk if Claude is working Booking, Calendar, Clients, or modals.

### Phase 5: Member Profile Accountant

Goal: future expansion only, after the admin-only model is proven safe.

Tasks:

- Add member finance section.
- Restrict data by role.
- Show only assigned/owned sessions and invoice rows for non-admin members.
- Decide whether member can request invoice creation or only view status.

Safe with Claude:

- Coordinate carefully if Claude is doing Members/Profile UI.

Decision:

- Defer this phase until after admin-only invoices, payments, and reports are working securely in production.

### Phase 6: Reporting and Exports

Goal: useful business reporting.

Tasks:

- Monthly revenue.
- Revenue by client.
- Revenue by member.
- Outstanding balances.
- CSV/PDF exports using the reusable ExportButtons track.

Safe with Claude:

- Coordinate around export components.

## Development Logistics

Branching:

- Use one PR per phase.
- Keep migrations and frontend changes together only when the frontend depends on those migrations.
- Apply Supabase migrations before relying on live preview behavior.

Suggested PR sequence:

1. Docs/mockup alignment.
2. Finance schema + RPCs.
3. Query layer + read-only Accountant page.
4. Invoice creation/payment recording.
5. Booking/client/member integration.
6. Reports and exports.

Testing:

- Run `npm run build`.
- Verify RLS/RPCs with admin and non-admin users.
- Create test invoices only under test clients.
- Confirm members cannot see other members' restricted finance data.
- Confirm totals are computed server-side.

Data safety:

- Start with test data.
- Avoid hard-deleting financial rows.
- Add audit fields early.
- Add clear `void`/`archived` states.

Performance:

- Index by `team_id`, `client_id`, `member_id`, `status`, and date.
- Paginate invoice tables.
- Do not load every invoice into dashboard widgets.
- Summaries should come from RPCs/views, not large client-side reductions.

Accessibility:

- Tables need real headers.
- Modals need focus trapping and keyboard close.
- Status badges need text, not color alone.
- Currency and dates should be readable by screen readers.

## Realism

This is realistic, but it is not a small cosmetic task.

Expected size:

- Basic usable accountant: 3 to 5 focused PRs.
- Solid secure accountant with profile/client/session integration: 6 to 10 PRs.
- Full accounting system with reports, exports, permissions, auditability: larger ongoing module.

Main risks:

- Permissions leakage.
- Money math bugs.
- Duplicate client/session/invoice relationships.
- UI drift if copied from a standalone HTML page.
- Trying to do schema, permissions, and UI polish in one giant PR.

Best path:

- Treat the HTML as visual reference only.
- Let the database model and existing Checkmark workflows drive the product architecture.
- Build read-only first, then add writes after RLS is proven.
- Keep v1 admin-only. Expand to members later only after real production behavior proves the permission model.

## Claude/Codex Split

Recommended ownership:

- Codex:
  - schema
  - RLS
  - RPCs
  - query layer
  - integration plan
  - data safety review

- Claude:
  - visual treatment
  - page polish
  - layout consistency
  - icon/button styling

Guardrail:

- Claude should not touch finance migrations/RPCs unless explicitly assigned.
- Codex should not rewrite broad UI surfaces while Claude is doing cosmetic work.

## First Concrete Next Step

Create a small PR that does only:

- Find or recreate the accountant mockup.
- Define the module name.
- Add the data model proposal.
- Add a route/nav placement decision.

Then build the schema PR from that plan.
