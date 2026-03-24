import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Sparkles, useDetectGPU } from '@react-three/drei'
import type { Group } from 'three'

function QueryGlyphs() {
  const glyphRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!glyphRef.current) return
    glyphRef.current.rotation.y += delta * 0.11
  })

  return (
    <group ref={glyphRef}>
      <Float speed={1.1} rotationIntensity={0.26} floatIntensity={0.85}>
        <mesh position={[-2, 1.1, -1.3]} rotation={[0.2, 0.15, 0.1]}>
          <torusKnotGeometry args={[0.38, 0.12, 96, 16]} />
          <meshStandardMaterial color="#4f46e5" transparent opacity={0.28} />
        </mesh>
      </Float>

      <Float speed={0.95} rotationIntensity={0.24} floatIntensity={0.8}>
        <mesh position={[2.1, -1.2, -1.8]}>
          <icosahedronGeometry args={[0.62, 1]} />
          <meshStandardMaterial color="#818cf8" transparent opacity={0.24} wireframe />
        </mesh>
      </Float>
    </group>
  )
}

function AdaptiveSparkleField() {
  const gpuTier = useDetectGPU()
  const count = gpuTier.tier >= 3 ? 160 : gpuTier.tier >= 2 ? 105 : 60

  return <Sparkles count={count} speed={0.24} size={2.1} scale={[8, 8, 8]} color="#c7d2fe" />
}

export function QueryScene() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <Suspense fallback={null}>
        <Canvas camera={{ position: [0, 0, 6], fov: 52 }}>
          <ambientLight intensity={0.58} />
          <directionalLight position={[2, 2, 2.8]} intensity={1.06} color="#818cf8" />
          <QueryGlyphs />
          <AdaptiveSparkleField />
        </Canvas>
      </Suspense>
    </div>
  )
}
