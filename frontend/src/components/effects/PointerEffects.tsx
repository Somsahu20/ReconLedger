import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

type TrailPoint = {
  id: string
  x: number
  y: number
  bornAt: number
}

type RipplePoint = {
  id: string
  x: number
  y: number
  bornAt: number
}

const TRAIL_LIFETIME_MS = 420
const RIPPLE_LIFETIME_MS = 700
const MOVE_SAMPLE_MS = 24

export function PointerEffects() {
  const [isEnabled, setIsEnabled] = useState(false)
  const [trails, setTrails] = useState<TrailPoint[]>([])
  const [ripples, setRipples] = useState<RipplePoint[]>([])
  const [cursor, setCursor] = useState({ x: -100, y: -100 })

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

    let lastMoveAt = 0

    function onPointerMove(event: PointerEvent) {
      const now = performance.now()
      setCursor({ x: event.clientX, y: event.clientY })

      if (now - lastMoveAt < MOVE_SAMPLE_MS) {
        return
      }
      lastMoveAt = now

      setTrails((previous) => {
        const recent = previous.filter((point) => now - point.bornAt < TRAIL_LIFETIME_MS)
        return [
          ...recent.slice(-12),
          {
            id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
            x: event.clientX,
            y: event.clientY,
            bornAt: now,
          },
        ]
      })
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
      setTrails((previous) => previous.filter((point) => now - point.bornAt < TRAIL_LIFETIME_MS))
      setRipples((previous) => previous.filter((point) => now - point.bornAt < RIPPLE_LIFETIME_MS))
    }, 120)

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })

    return () => {
      window.clearInterval(pruneTimer)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isEnabled])

  if (!isEnabled) {
    return null
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-60 overflow-hidden">
      <motion.span
        className="absolute h-2.5 w-2.5 rounded-full bg-(--brand) opacity-70"
        animate={{ x: cursor.x - 5, y: cursor.y - 5 }}
        transition={{ type: 'spring', stiffness: 700, damping: 34, mass: 0.25 }}
      />

      <AnimatePresence>
        {trails.map((trail) => (
          <motion.span
            key={trail.id}
            className="absolute h-3 w-3 rounded-full bg-(--brand) opacity-35"
            initial={{ x: trail.x - 6, y: trail.y - 6, scale: 0.5, opacity: 0.48 }}
            animate={{ x: trail.x - 6, y: trail.y - 6, scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>

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
