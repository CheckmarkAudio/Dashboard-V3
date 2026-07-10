export type CommunicationSound = 'checkmark_chime' | 'soft_pop' | 'silent'

export const COMMUNICATION_SOUND_OPTIONS: Array<{ value: CommunicationSound; label: string }> = [
  { value: 'checkmark_chime', label: 'Checkmark Chime' },
  { value: 'soft_pop', label: 'Soft Pop' },
  { value: 'silent', label: 'Silent' },
]

export function getCommunicationSoundPreference(preferences: unknown): CommunicationSound {
  const raw = preferences && typeof preferences === 'object'
    ? (preferences as Record<string, unknown>).communication_sound
    : null
  return raw === 'soft_pop' || raw === 'silent' || raw === 'checkmark_chime'
    ? raw
    : 'checkmark_chime'
}

export function playCommunicationSound(sound: CommunicationSound = 'checkmark_chime'): void {
  if (sound === 'silent') return
  if (typeof window === 'undefined') return

  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(sound === 'soft_pop' ? 0.045 : 0.055, ctx.currentTime + 0.012)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (sound === 'soft_pop' ? 0.16 : 0.32))
    master.connect(ctx.destination)

    const first = ctx.createOscillator()
    first.type = 'sine'
    first.frequency.setValueAtTime(sound === 'soft_pop' ? 420 : 660, ctx.currentTime)
    first.connect(master)
    first.start()
    first.stop(ctx.currentTime + (sound === 'soft_pop' ? 0.16 : 0.18))

    if (sound === 'checkmark_chime') {
      const second = ctx.createOscillator()
      second.type = 'triangle'
      second.frequency.setValueAtTime(990, ctx.currentTime + 0.09)
      second.connect(master)
      second.start(ctx.currentTime + 0.09)
      second.stop(ctx.currentTime + 0.32)
    }

    window.setTimeout(() => {
      void ctx.close().catch(() => {})
    }, 420)
  } catch {
    // Browser autoplay rules may reject sound before the first user
    // gesture. Notifications still render visually, so this is safe.
  }
}
