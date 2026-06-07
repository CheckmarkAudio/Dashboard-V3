// Floating "DEMO DATA" badge shown whenever the flywheel demo preview is
// active (?flywheel-demo=1). Makes it unmistakable that the flywheel
// numbers on screen are synthetic, not real recorded activity.

import { isFlywheelDemo } from '../../lib/flywheel/demo'

export default function FlywheelDemoBadge() {
  if (!isFlywheelDemo()) return null
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
        Demo data · flywheel preview
      </div>
    </div>
  )
}
