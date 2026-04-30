import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

export type AdminSection<K extends string = string> = {
  key: K
  icon: ComponentType<LucideProps>
  title: string
  subtitle: string
}

export function AdminSectionNavItem<K extends string>({
  section,
  active,
  onSelect,
  disabled = false,
}: {
  section: AdminSection<K>
  active: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  const Icon = section.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className={[
        'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 focus-ring',
        active ? 'bg-surface-alt ring-1 ring-border-light' : 'hover:bg-surface-hover',
        disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : '',
      ].join(' ')}
    >
      <span
        className={[
          'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-surface',
          active ? 'text-gold' : 'text-text-muted',
        ].join(' ')}
        aria-hidden="true"
      >
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold text-text">{section.title}</span>
        <span className="block text-[12px] text-text-muted truncate">{section.subtitle}</span>
      </span>
    </button>
  )
}
