import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

type RipplePoint = {
  id: string
  x: number
  y: number
  bornAt: number
}

const RIPPLE_LIFETIME_MS = 700

export function PointerEffects() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [ripples, setRipples] = useState<RipplePoint[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)')

    const applyPreferences = () => {
      setIsEnabled(!reduceMotionQuery.matches && !coarsePointerQuery.matches)
    }

    applyPreferences()

    reduceMotionQuery.addEventListener('change', applyPreferences)
    coarsePointerQuery.addEventListener('change', applyPreferences)

    return () => {
      reduceMotionQuery.removeEventListener('change', applyPreferences)
      coarsePointerQuery.removeEventListener('change', applyPreferences)
    }
  }, [])

  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') {
      return
    }

    function onPointerDown(event: PointerEvent) {
      const now = performance.now()
      setRipples((previous) => {
        const recent = previous.filter((point) => now - point.bornAt < RIPPLE_LIFETIME_MS)
        return [
          ...recent.slice(-5),
          {
            id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
            x: event.clientX,
            y: event.clientY,
            bornAt: now,
          },
        ]
      })
    }

    const pruneTimer = window.setInterval(() => {
      const now = performance.now()
      setRipples((previous) => previous.filter((point) => now - point.bornAt < RIPPLE_LIFETIME_MS))
    }, 120)

    window.addEventListener('pointerdown', onPointerDown, { passive: true })

    return () => {
      window.clearInterval(pruneTimer)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isEnabled])

  if (!isEnabled) {
    return null
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-60 overflow-hidden">
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute h-6 w-6 rounded-full border border-(--brand) bg-(--brand) opacity-35"
            initial={{ x: ripple.x - 12, y: ripple.y - 12, scale: 0.24, opacity: 0.45 }}
            animate={{ x: ripple.x - 12, y: ripple.y - 12, scale: 8.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.68, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
