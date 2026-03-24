import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Points, PointMaterial } from '@react-three/drei'
import type { Points as ThreePoints } from 'three'

function ParticleCloud() {
  const pointsRef = useRef<ThreePoints>(null)
  const sphere = new Float32Array(900)

  for (let i = 0; i < 900; i += 1) {
    const band = i % 3
    const t = i * 0.37
    if (band === 0) sphere[i] = Math.sin(t) * 4.4
    if (band === 1) sphere[i] = Math.cos(t * 0.8) * 3.8
    if (band === 2) sphere[i] = Math.sin(t * 1.2) * 4.1
  }

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    pointsRef.current.rotation.y += delta * 0.03
    pointsRef.current.rotation.x += delta * 0.008
  })

  return (
    <Points ref={pointsRef} positions={sphere} stride={3} frustumCulled>
      <PointMaterial transparent color="#9fb7ff" size={0.04} sizeAttenuation depthWrite={false} />
    </Points>
  )
}

function FloatingOrb() {
  return (
    <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.8}>
      <mesh position={[2.2, 1, -1.5]}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial color="#66c6bb" transparent opacity={0.22} wireframe />
      </mesh>
    </Float>
  )
}

export function DashboardScene() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <Suspense fallback={null}>
        <Canvas camera={{ position: [0, 0, 6], fov: 52 }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[2, 2, 3]} intensity={1.1} color="#6caef3" />
          <ParticleCloud />
          <FloatingOrb />
        </Canvas>
      </Suspense>
    </div>
  )
}
