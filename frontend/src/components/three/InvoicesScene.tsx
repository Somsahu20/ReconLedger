import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import type { Group } from 'three'

function RotatingDocs() {
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * 0.14
    groupRef.current.rotation.x += delta * 0.03
  })

  return (
    <group ref={groupRef} position={[-0.2, 0.15, -1]}>
      <Float speed={1.15} rotationIntensity={0.22} floatIntensity={0.8}>
        <mesh position={[-2, 1.1, 0]} rotation={[0.1, 0.2, 0.1]}>
          <boxGeometry args={[1.05, 1.42, 0.05]} />
          <meshStandardMaterial color="#8ad5bf" transparent opacity={0.34} />
        </mesh>
      </Float>

      <Float speed={0.9} rotationIntensity={0.3} floatIntensity={0.95}>
        <mesh position={[1.95, -1, -0.25]} rotation={[-0.2, -0.26, -0.08]}>
          <boxGeometry args={[0.95, 1.25, 0.05]} />
          <meshStandardMaterial color="#7fa4ec" transparent opacity={0.3} />
        </mesh>
      </Float>
    </group>
  )
}

function FocusOrb() {
  const orbRef = useRef<Group>(null)

  useFrame(({ clock }) => {
    if (!orbRef.current) return
    const pulse = 0.92 + Math.sin(clock.elapsedTime * 1.55) * 0.08
    orbRef.current.scale.setScalar(pulse)
  })

  return (
    <group ref={orbRef} position={[2.35, 1.7, -2.2]}>
      <mesh>
        <sphereGeometry args={[0.68, 24, 24]} />
        <meshStandardMaterial color="#5db7df" transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

export function InvoicesScene() {
  return (
    <>
      <ambientLight intensity={0.56} />
      <directionalLight position={[1.8, 2.2, 2.6]} intensity={1.08} color="#76a6f0" />
      <RotatingDocs />
      <FocusOrb />
      <Sparkles count={95} speed={0.28} size={2.15} color="#bddcff" scale={[8, 8, 8]} />
    </>
  )
}
