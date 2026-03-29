import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import type { Group } from 'three'

function BadgeCloud() {
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * 0.12
    groupRef.current.rotation.z += delta * 0.04
  })

  return (
    <group ref={groupRef}>
      <Float speed={1.2} floatIntensity={1} rotationIntensity={0.24}>
        <mesh position={[-2.15, 1.1, -1.2]}>
          <torusGeometry args={[0.65, 0.16, 16, 38]} />
          <meshStandardMaterial color="#5fa9f2" transparent opacity={0.28} />
        </mesh>
      </Float>

      <Float speed={0.9} floatIntensity={0.85} rotationIntensity={0.28}>
        <mesh position={[2, -1.2, -1.4]}>
          <octahedronGeometry args={[0.74, 0]} />
          <meshStandardMaterial color="#7bd0a8" transparent opacity={0.3} wireframe />
        </mesh>
      </Float>
    </group>
  )
}

function PulseNode() {
  const nodeRef = useRef<Group>(null)

  useFrame(({ clock }) => {
    if (!nodeRef.current) return
    const pulse = 0.88 + Math.sin(clock.elapsedTime * 1.5) * 0.1
    nodeRef.current.scale.setScalar(pulse)
  })

  return (
    <group ref={nodeRef} position={[0.3, 1.75, -2.3]}>
      <mesh>
        <sphereGeometry args={[0.58, 22, 22]} />
        <meshStandardMaterial color="#9dc4ff" transparent opacity={0.2} />
      </mesh>
    </group>
  )
}

export function ReviewScene() {
  return (
    <>
      <ambientLight intensity={0.58} />
      <directionalLight position={[2, 2, 2.8]} intensity={1.06} color="#818cf8" />
      <BadgeCloud />
      <PulseNode />
    </>
  )
}

