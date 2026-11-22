const COVER_PALETTES = [
  { from: '#2b2114', mid: '#8a6e2f', to: '#e8d5a3' },
  { from: '#3a2714', mid: '#c9a84c', to: '#f6e7c1' },
  { from: '#241c16', mid: '#a8893d', to: '#f0e0b8' },
  { from: '#322416', mid: '#d4a63e', to: '#f3e6c8' },
  { from: '#1f1913', mid: '#7a5b28', to: '#e2cc96' },
  { from: '#3d2c18', mid: '#e0bc6a', to: '#f8edd4' },
] as const

function hashKey(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return Math.abs(hash)
}

const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'to'])

export function projectInitials(title: string): string {
  const raw = title.trim().split(/\s+/).filter(Boolean)
  const significant = raw.filter((word) => !SMALL_WORDS.has(word.toLowerCase()))
  const words = significant.length >= 2 ? significant : raw
  if (words.length === 0) return 'P'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase()
}

export function projectCover(id: string, title = ''): {
  initials: string
  background: string
  angle: number
} {
  const hash = hashKey(id || title)
  const palette = COVER_PALETTES[hash % COVER_PALETTES.length]!
  const angle = 118 + (hash % 40)
  return {
    initials: projectInitials(title),
    angle,
    background: [
      `radial-gradient(circle at 18% 20%, rgba(255,245,220,.28), transparent 42%)`,
      `radial-gradient(circle at 86% 86%, rgba(20,12,6,.28), transparent 46%)`,
      `repeating-linear-gradient(${angle + 28}deg, rgba(255,255,255,.08) 0 2px, transparent 2px 18px)`,
      `linear-gradient(${angle}deg, ${palette.from} 0%, ${palette.mid} 52%, ${palette.to} 100%)`,
    ].join(', '),
  }
}
