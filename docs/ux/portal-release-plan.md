# Portal redesign release track

## Saved versions

- Production rollback tag: `portal-production-before-redesign-2026-09-09` at `90d326d5bc6ab07b97599c4d533f2e31beb88fe4`.
- Evidence: GitHub Production deployment `5712469784` reports success at that commit (2026-08-02); its deployment URL is https://cm-audio-ahqdw9zdw-gavin-hammonds-projects.vercel.app.
- Redesign branch: `codex/portal-style-integration`.
- Initial redesign checkpoint: `fe253d1`.
- Latest production fixes merged into the redesign. The activity bar keeps the new responsive width and production's elapsed/upcoming schedule distinction.
- The tag restores application source. It is not a database backup and does not reverse database changes. This rollout adds no migrations beyond those already on main.

## Deployment boundary

`main` remains the production branch. Do not merge this draft or promote its Vercel deployment until the release checks below pass. Classic remains the default appearance and Soft Gold / Studio are opt-in browser preferences.

Every Vercel Preview build on this version must provide these **Preview-only** settings:

| Setting | Value |
| --- | --- |
| `PORTAL_TEST_SUPABASE_REF` | Separate test project's reference |
| `VITE_SUPABASE_URL` | `https://<test-reference>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | That test project's public anon or publishable key |

The build refuses an absent/mismatched backend, the known production reference, and privileged or mismatched legacy JWT keys. Publishable-key ownership must also be checked in Supabase when configuring the project. The prefix check does not prove key ownership. Local Vite development retains its existing behavior; use **Open sample preview** for isolated read-only fixture data.

Shared preview auto-login credentials are stripped in Preview and Production builds. Hosted previews require real test accounts and exercise real access control. Never use production member accounts or copy production records into the test project. Configure test-only storage and integrations; disable outbound email/calendar/payment side effects unless pointing to explicit test destinations. None of those services are provisioned by committing this document.

The public GitHub repository already exposes source. A Vercel preview URL is not an authorization boundary: use Vercel deployment protection when available and retain application login/RLS regardless. Do not publish local dev mode.

## Checks

The `Portal checks` workflow runs tests, builds with production auth and deliberately injected dummy preview credentials, and scans every JS chunk to ensure those credentials, the developer identity, and sample transport are absent. It uses placeholder backend values and no repository secrets. These automated checks do not replace authenticated regression tests.

Before release, verify with a signed-out browser, a test member, and a test admin:

- Sign-in, refresh/session expiry, sign-out, setup and recovery links.
- Direct admin URLs denied to members; API/RPC authorization also denies privileged actions.
- One member cannot read another member's private conversations or edit their role.
- Tasks, project pins/objectives/subtasks/completion, bookings and recurring sessions.
- Media upload/play/download/delete, forum messages/reactions/attachments, profile editing.
- All of the above across Classic, Soft Gold and Studio; narrow-screen navigation and keyboard focus.
- Production versus redesign functionality comparison. In particular, existing uncommitted Projects edits were preserved in the checkpoint; project pin controls need explicit parity review before release.

For rollback after release, redeploy the saved production deployment or open a reviewed revert PR restoring the tagged application code. Do not force-reset main. Database recovery is separate and requires a verified database backup if later work changes schema/data.

## Outstanding setup

A separate Supabase test project, test identities and its schema/storage/integration configuration must be established before hosted write testing. Until configured, the Vercel preview build intentionally stops and the local sample preview remains available. Do not substitute production credentials to make the preview build pass.
