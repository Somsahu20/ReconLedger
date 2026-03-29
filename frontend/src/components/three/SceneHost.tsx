import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useLocation } from 'react-router-dom'
import { AuthScene } from './AuthScene'
import { DashboardScene } from './DashboardScene'
import { InvoicesScene } from './InvoicesScene'
import { ReviewScene } from './ReviewScene'
import { QueryScene } from './QueryScene'
import { ReconciliationScene } from './ReconciliationScene'
import { UploadScene } from './UploadScene'

export function SceneHost() {
  const { pathname } = useLocation()

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

  return (
    <div className="fixed inset-0 -z-50 pointer-events-none overflow-hidden select-none touch-none">
      <Suspense fallback={null}>
        <Canvas 
          camera={{ position: [0, 0, 6], fov: 52 }}
          dpr={[1, 1.5]}
          gl={{ 
            powerPreference: 'high-performance',
            alpha: true,
            antialias: false,
            stencil: false,
            depth: true
          }}
        >
          {getSceneContent()}
        </Canvas>
      </Suspense>
    </div>
  )
}
