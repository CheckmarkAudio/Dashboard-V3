export interface ProjectArtOption {
  id: string
  src: string
  phrases: string[]
  keywords: string[]
}

export const PROJECT_ART_CATALOG: ProjectArtOption[] = [
  { id: 'gold-mic', src: '/project-art/gold-mic.webp', phrases: ['echoes in gold', 'echoes'], keywords: ['gold', 'echo'] },
  { id: 'after-hours', src: '/project-art/after-hours.webp', phrases: ['after hours'], keywords: ['night', 'club', 'late night', 'dj'] },
  { id: 'vinyl', src: '/project-art/vinyl.webp', phrases: ['long way home', 'long way'], keywords: ['vinyl', 'album', 'turntable', 'lp', 'artwork'] },
  { id: 'live-stage', src: '/project-art/live-stage.webp', phrases: ['northline'], keywords: ['live', 'sessions', 'session', 'stage', 'concert', 'performance'] },
  { id: 'piano', src: '/project-art/piano.webp', phrases: ['holiday special', 'holiday'], keywords: ['festive', 'christmas', 'piano'] },
  { id: 'studio-room', src: '/project-art/studio-room.webp', phrases: ['studio b', 'refresh'], keywords: ['renovat', 'closet', 'floor plan', 'storage'] },
  { id: 'mix-desk', src: '/project-art/mix-desk.webp', phrases: ['mix and master', 'mix & master'], keywords: ['mix', 'master', 'console', 'mixing'] },
  { id: 'headphones', src: '/project-art/headphones.webp', phrases: ['headphones'], keywords: ['listen', 'review', 'monitor'] },
  { id: 'guitar', src: '/project-art/guitar.webp', phrases: [], keywords: ['guitar', 'amp', 'electric'] },
]

export interface ProjectArtInput {
  id: string
  title: string
  objective?: string | null
  cover_url?: string | null
}

export interface ResolvedProjectArt {
  id: string
  src: string
  custom: boolean
}

export function artTransitionName(projectId: string): string {
  return `part${projectId.replace(/[^a-zA-Z0-9]/g, '') || 'x'}`
}

function hashKey(value: string): number {
  let hash = 0
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return Math.abs(hash)
}

export function scoreProjectArt(art: ProjectArtOption, title: string, description: string): number {
  let score = 0
  for (const phrase of art.phrases) {
    if (title.includes(phrase)) score += 8
    else if (description.includes(phrase)) score += 4
  }
  for (const keyword of art.keywords) {
    if (title.includes(keyword)) score += 3
    else if (description.includes(keyword)) score += 1
  }
  return score
}

export function resolveProjectArt(project: ProjectArtInput): ResolvedProjectArt {
  const custom = project.cover_url?.trim()
  if (custom) return { id: 'custom', src: custom, custom: true }

  const title = project.title.toLowerCase()
  const description = (project.objective ?? '').toLowerCase()
  let best = PROJECT_ART_CATALOG[0]!
  let bestScore = -1
  for (const art of PROJECT_ART_CATALOG) {
    const score = scoreProjectArt(art, title, description)
    if (score > bestScore) {
      best = art
      bestScore = score
    }
  }
  if (bestScore <= 0) {
    best = PROJECT_ART_CATALOG[hashKey(project.id || title) % PROJECT_ART_CATALOG.length]!
  }
  return { id: best.id, src: best.src, custom: false }
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
