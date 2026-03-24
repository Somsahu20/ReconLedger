import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles, useDetectGPU } from '@react-three/drei'
import type { Group } from 'three'

function LedgerForms() {
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * 0.12
    groupRef.current.rotation.x += delta * 0.03
  })

  return (
    <group ref={groupRef}>
      <Float speed={1.05} rotationIntensity={0.24} floatIntensity={0.8}>
        <mesh position={[-2.2, 1.2, -1.4]} rotation={[0.2, 0.2, 0.1]}>
          <boxGeometry args={[1.15, 1.42, 0.05]} />
          <meshStandardMaterial color="#4f46e5" transparent opacity={0.3} />
        </mesh>
      </Float>

      <Float speed={0.9} rotationIntensity={0.22} floatIntensity={0.85}>
        <mesh position={[2.1, -1.15, -1.8]} rotation={[-0.1, -0.2, -0.1]}>
          <boxGeometry args={[1, 1.3, 0.05]} />
          <meshStandardMaterial color="#818cf8" transparent opacity={0.28} />
        </mesh>
      </Float>
    </group>
  )
}

function AdaptiveParticles() {
  const gpuTier = useDetectGPU()
  const count = gpuTier.tier >= 3 ? 150 : gpuTier.tier >= 2 ? 95 : 55

  return <Sparkles count={count} speed={0.24} size={2.1} color="#c7d2fe" scale={[8, 8, 8]} />
}

export function ReconciliationScene() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <Suspense fallback={null}>
        <Canvas camera={{ position: [0, 0, 6], fov: 52 }}>
          <ambientLight intensity={0.58} />
          <directionalLight position={[2, 2, 3]} intensity={1.06} color="#818cf8" />
          <LedgerForms />
          <AdaptiveParticles />
        </Canvas>
      </Suspense>
    </div>
  )
}
