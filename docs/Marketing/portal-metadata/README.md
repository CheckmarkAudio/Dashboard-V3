# Portal Metadata Notes

This folder tracks how marketing templates should eventually be exposed in the workspace portal.

## Indexing Assumption

The portal should be able to scan Markdown files under `docs/Marketing/` and read YAML frontmatter from each reusable template.

## Required Fields

| Field | Purpose |
|-------|---------|
| `title` | Human-readable template name. |
| `type` | High-level template group: `email`, `social`, `classified`, or `campaign`. |
| `channel` | Delivery channel or `multi-channel`. |
| `audience` | Intended audience. |
| `status` | Lifecycle state: `draft`, `ready`, or `archived`. |
| `owner` | Team or person responsible for review. |
| `last_reviewed` | Date the template was last checked. |
| `tags` | Search and filter keywords. |
| `portal_ready` | Boolean flag for whether the template should appear in the portal. |

## Suggested Portal Filters

- Type
- Channel
- Audience
- Status
- Tags
- Portal ready

## Suggested Portal Actions

- Preview template.
- Copy reusable body.
- Duplicate into a campaign draft.
- Mark reviewed.
- Archive outdated template.

## Content Safety

The portal should hide templates where:

- `status` is `archived`.
- `portal_ready` is `false`.
- Required frontmatter is missing.

Draft files can still remain in this folder for team development.
