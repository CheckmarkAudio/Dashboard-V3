// Canonical role-tag (job category) registry for templates.
//
// Single source of truth for:
//   - Filter pills on `AdminTemplatesWidget`
//   - Role dropdown in `TemplateEditorModal`
//   - Icon shown on each thumbnail tile + the role-grouped dividers
//
// Add a new job category here ONCE and it shows up in both the
// editor dropdown and the widget filter row, with the right icon
// auto-applied to every template tagged with it.
//
// NOTE: GraduationCap is intentionally not used here — it's reserved
// for the future "education" category (the studio's education program
// per SESSION_CONTEXT). When that category lands, add it below with
// `icon: GraduationCap` and the rest follows.

import type { ComponentType, SVGProps } from 'react'
import {
  Briefcase,
  Camera,
  Code2,
  FileText,
  Headphones,
  Megaphone,
  Settings,
  Sprout,
} from 'lucide-react'

export type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export interface RoleTag {
  value: string
  label: string
  icon: LucideIcon
}

export const CANONICAL_ROLE_TAGS: readonly RoleTag[] = [
  { value: 'engineer',  label: 'Engineer',  icon: Headphones    },
  { value: 'marketing', label: 'Marketing', icon: Megaphone     },
  { value: 'media',     label: 'Media',     icon: Camera        },
  { value: 'intern',    label: 'Intern',    icon: Sprout        },
  { value: 'dev',       label: 'Dev',       icon: Code2         },
  { value: 'admin',     label: 'Admin',     icon: Briefcase     },
  { value: 'ops',       label: 'Ops',       icon: Settings      },
] as const

const ROLE_INDEX: Record<string, RoleTag> = Object.fromEntries(
  CANONICAL_ROLE_TAGS.map((r) => [r.value, r]),
)

export function iconForRole(roleTag: string | null): LucideIcon {
  if (!roleTag) return FileText
  return ROLE_INDEX[roleTag]?.icon ?? FileText
}

export function labelForRole(roleTag: string): string {
  return ROLE_INDEX[roleTag]?.label
    ?? roleTag.charAt(0).toUpperCase() + roleTag.slice(1)
}
