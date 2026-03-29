import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
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

export function ReconciliationScene() {
  return (
    <>
      <ambientLight intensity={0.58} />
      <directionalLight position={[2, 2, 3]} intensity={1.06} color="#818cf8" />
      <LedgerForms />
    </>
  )
}

