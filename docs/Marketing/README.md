# Marketing Template Library

This folder is the source of truth for reusable email, social, classified, campaign, and marketing copy templates.

Use it for drafts that should become repeatable assets, not one-off notes. Every template should be written so it can eventually appear in the workspace portal as a searchable, reusable item.

## Folder Map

| Folder | Purpose |
|--------|---------|
| `email/` | Reusable email templates, subject lines, nurture copy, announcements, and follow-ups. |
| `social/` | Reusable social captions, launch posts, update posts, recruiting posts, and short-form copy. |
| `classifieds/` | Reusable Craigslist and classified-ad templates for services, lessons, local promotion, and editable DOCX versions. |
| `campaigns/` | Campaign-level briefs that connect multiple posts, emails, offers, and goals. |
| `portal-metadata/` | Future-facing indexing notes for making these templates available in the workspace portal. |

## Required Template Format

Every reusable template should use this frontmatter:

```yaml
---
title: "Template title"
type: "email | social | classified | campaign"
channel: "email | craigslist | linkedin | instagram | facebook | internal | multi-channel"
audience: "clients | prospects | members | partners | internal | public"
status: "draft | ready | archived"
owner: "Marketing"
last_reviewed: "YYYY-MM-DD"
tags:
  - reusable
  - example-tag
portal_ready: false
---
```

Then include these sections:

- `Purpose`: What this template is for.
- `Use When`: The situation that should trigger reuse.
- `Do Not Use When`: Guardrails for avoiding the wrong message.
- `Template`: The reusable copy with bracketed placeholders.
- `Customization Notes`: What to change before sending or publishing.
- `Review Checklist`: Final checks before use.

## Naming Rules

- Use lowercase kebab-case file names.
- Start with the workflow or channel when useful, such as `email-client-follow-up.md`.
- Keep names durable. Avoid dates unless the template is tied to a specific campaign period.
- Archive outdated templates by changing `status` to `archived`; do not delete them unless they were added by mistake.

## Copy Standards

- Lead with the audience's need, not our internal process.
- Keep one clear call to action.
- Use plain, specific language.
- Avoid hype, filler, vague urgency, and generic claims.
- Replace every bracketed placeholder before publishing.
- Keep reusable posts adaptable across future campaigns.

## Portal Readiness

A template is portal-ready when:

- Frontmatter is complete.
- `status` is `ready`.
- The reusable copy is not tied to a stale date, one-time event, or private context.
- Placeholders are obvious and safe to fill in.
- The review checklist has been followed at least once.

When a template is ready for the portal, set `portal_ready: true`.
