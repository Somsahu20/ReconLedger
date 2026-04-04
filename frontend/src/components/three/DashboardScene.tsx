import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Points, PointMaterial } from '@react-three/drei'
import type { Points as ThreePoints } from 'three'

function ParticleCloud() {
  const pointsRef = useRef<ThreePoints>(null)
  const sphere = useMemo(() => {
    const points = new Float32Array(540)

    for (let i = 0; i < 540; i += 1) {
      const band = i % 3
      const t = i * 0.37
      if (band === 0) points[i] = Math.sin(t) * 4.4
      if (band === 1) points[i] = Math.cos(t * 0.8) * 3.8
      if (band === 2) points[i] = Math.sin(t * 1.2) * 4.1
    }

    return points
  }, [])

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
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 2, 3]} intensity={1.1} color="#6caef3" />
      <ParticleCloud />
      <FloatingOrb />
    </>
  )
}
