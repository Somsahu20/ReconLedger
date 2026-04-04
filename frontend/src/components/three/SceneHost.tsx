import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useLocation } from 'react-router-dom'
import { AuthScene } from './AuthScene'
import { DashboardScene } from './DashboardScene'
import { InvoicesScene } from './InvoicesScene'
import { ReviewScene } from './ReviewScene'
import { QueryScene } from './QueryScene'
import { ReconciliationScene } from './ReconciliationScene'
import { UploadScene } from './UploadScene'

const WEBGL_RETRY_DELAY_MS = 1200

export function SceneHost() {
  const { pathname } = useLocation()
  const [webglFallback, setWebglFallback] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [documentVisible, setDocumentVisible] = useState(true)
  const cleanupContextRef = useRef<(() => void) | null>(null)
  const retryTimerRef = useRef<number | null>(null)

  const isLowPowerMode = useMemo(() => {
    if (typeof window === 'undefined') return true

    const nav = navigator as Navigator & {
      deviceMemory?: number
      connection?: { saveData?: boolean }
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    const lowCpu = nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4
    const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4
    const saveData = Boolean(nav.connection?.saveData)

    return prefersReducedMotion || hasCoarsePointer || lowCpu || lowMemory || saveData
  }, [])

  const scheduleWebglRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
    }

    retryTimerRef.current = window.setTimeout(() => {
      setWebglFallback(false)
      setCanvasKey((current) => current + 1)
      retryTimerRef.current = null
    }, WEBGL_RETRY_DELAY_MS)
  }, [])

  useEffect(() => {
    const onVisibilityChange = () => {
      setDocumentVisible(!document.hidden)
    }

    onVisibilityChange()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupContextRef.current?.()
      cleanupContextRef.current = null

      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [])

  // Match routes to scenes
  function getSceneContent() {
    if (pathname === '/login' || pathname === '/register') {
      return <AuthScene />
    }
    if (pathname === '/dashboard') {
      return <DashboardScene />
    }
    if (pathname.startsWith('/invoices')) {
      return <InvoicesScene />
    }
    if (pathname === '/review') {
      return <ReviewScene />
    }
    if (pathname === '/query') {
      return <QueryScene />
    }
    if (pathname.startsWith('/reconciliation')) {
      return <ReconciliationScene />
    }
    if (pathname === '/upload') {
      return <UploadScene />
    }
    return <DashboardScene /> // Default fallback
  }

  if (webglFallback) {
    return (
      <div
        aria-hidden
        className="fixed inset-0 -z-50 pointer-events-none overflow-hidden select-none touch-none"
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_10%_0%,rgba(245,158,11,0.08),transparent_55%),radial-gradient(120%_120%_at_90%_100%,rgba(245,158,11,0.05),transparent_60%)]" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 -z-50 pointer-events-none overflow-hidden select-none touch-none">
      <Suspense fallback={null}>
        <Canvas
          key={canvasKey}
          camera={{ position: [0, 0, 6], fov: 52 }}
          dpr={isLowPowerMode ? [1, 1] : [1, 1.25]}
          frameloop={documentVisible ? 'always' : 'never'}
          gl={{
            powerPreference: isLowPowerMode ? 'low-power' : 'high-performance',
            alpha: true,
            antialias: false,
            stencil: false,
            depth: true,
            preserveDrawingBuffer: false,
          }}
          onCreated={({ gl }) => {
            const canvas = gl.domElement

            const onContextLost = (event: Event) => {
              event.preventDefault()
              setWebglFallback(true)
              scheduleWebglRetry()
            }

            const onContextRestored = () => {
              setWebglFallback(false)
            }

            canvas.addEventListener('webglcontextlost', onContextLost, false)
            canvas.addEventListener('webglcontextrestored', onContextRestored, false)

            cleanupContextRef.current = () => {
              canvas.removeEventListener('webglcontextlost', onContextLost)
              canvas.removeEventListener('webglcontextrestored', onContextRestored)
            }
          }}
        >
          {getSceneContent()}
        </Canvas>
      </Suspense>
    </div>
  )
}
