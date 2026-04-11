// Barrel export for the design-system primitives.
// Pages should import from this file to keep imports tidy:
//
//   import { Button, Card, EmptyState, PageHeader } from '@/components/ui'
//
// (We don't have a `@/` alias yet — use a relative path until Phase 4.)

export { default as Button } from './Button'
export { default as Card, CardHeader, CardBody, CardFooter } from './Card'
export { default as Input } from './Input'
export { default as Textarea } from './Textarea'
export { default as Select } from './Select'
export { default as Badge, type BadgeVariant } from './Badge'
export { default as EmptyState } from './EmptyState'
export {
  default as Skeleton,
  CardSkeleton,
  RowSkeleton,
  TableSkeleton,
} from './Skeleton'
export { default as Modal } from './Modal'
export { default as PageHeader } from './PageHeader'
