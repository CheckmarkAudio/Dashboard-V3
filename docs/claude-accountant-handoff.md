# Claude Handoff: Checkmark Accountant

Use this when asking Claude to help with the Accountant module.

## Reference Files

- Visual/product reference: `docs/mockups/checkmark-accountant-v5-beta.html`
- Integration plan: `docs/checkmark-accountant-integration-plan.md`
- Existing clients foundation:
  - `src/components/clients/ClientsPanel.tsx`
  - `src/lib/queries/clients.ts`
  - `supabase/migrations/20260429100000_clients_table.sql`

## Non-Negotiables

- Do not paste the standalone HTML mockup directly into production React.
- Do not create browser-only finance state.
- Do not invent financial schema casually inside UI work.
- Do not expose team financial data to regular members by default.
- Do not hard-delete financial records unless explicitly approved.
- Use existing Checkmark visual language: same tokens, borders, typography, buttons, modals, tables, and accessibility patterns.
- Keep code clean, DRY, performant, accessible, and secure.

## Intended Product

Checkmark Accountant should become a first-class Checkmark Workspace module for tracking:

- clients
- bookings/sessions
- invoices
- payments
- expenses
- member/client revenue

It should feel native to Checkmark, not like a separate app glued on.

V1 access decision:

- Admin/owner accounts only.
- Regular members and interns should not see Accountant in v1.
- Member-facing finance can be considered later after the admin-only model is proven safe in production.

## Recommended Build Order

1. Read the integration plan and mockup.
2. Do not start UI implementation until schema/RLS/RPC ownership is clear.
3. If doing visual work first, create only mockups/docs, not live production screens.
4. Let Codex own the database/RLS/RPC/query layer unless explicitly reassigned.
5. Build the production feature in phases:
   - docs/mockup alignment
   - schema + RLS + RPCs
   - query layer
   - read-only Accountant page
   - invoice/payment writes
   - client/member/booking integration
   - reports/exports

## Claude-Safe UI Scope

Good Claude tasks:

- Review the accountant mockup and extract reusable visual patterns.
- Draft an Accountant page wireframe using current Checkmark components.
- Propose nav placement and page structure.
- Make a non-production HTML/CSS mockup in `docs/mockups/`.
- Polish UI after Codex has created typed data contracts.

Avoid until backend is ready:

- Real invoice creation UI.
- Payment recording UI.
- Member finance pages.
- Permission-sensitive dashboards.
- Production data mutations.

## Suggested Prompt

Please review `docs/mockups/checkmark-accountant-v5-beta.html` and `docs/checkmark-accountant-integration-plan.md`.

The goal is to integrate Checkmark Accountant into Checkmark Workspace as a native module, not paste the standalone HTML into React. Keep our cornerstones in mind: clean DRY code, performance, accessibility, and secure backend practices.

For now, do not touch Supabase migrations, RLS, RPCs, finance query logic, or production write flows. Focus only on understanding the visual/product direction and proposing a Checkmark-native UI structure that could later connect to real typed data. Preserve the existing Checkmark visual system and avoid creating one-off borders, fonts, spacing, or buttons.

Before coding, summarize:

- what visual patterns from the mockup should transfer
- what should not transfer directly
- where the module should live in the app
- which files you would touch
- what you will avoid touching to prevent conflict with Codex/backend work

## Open Questions For Gavin

- Should the module name be `Accountant`, `Finance`, `Books`, or something else?
- Should members ever see their own income/session finance later, after v1?
- Should members ever be able to create expense entries later, or should that remain admin-only?
- Should invoices be sent from Checkmark eventually, or tracked only?
- Should payments be manually recorded first, before any Stripe/Square integration?
- Should financial reports be owner-only?
- Should client finance live primarily under the Accountant module, the Clients panel, or both?
