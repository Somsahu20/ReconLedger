import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import type { Mesh } from 'three'

type DocMeshProps = {
  position: [number, number, number]
  rotation: [number, number, number]
}

function DocMesh({ position, rotation }: DocMeshProps) {
  const docRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!docRef.current) return
    docRef.current.rotation.y += delta * 0.22
  })

  return (
    <Float speed={1.4} rotationIntensity={0.35} floatIntensity={1}>
      <mesh ref={docRef} position={position} rotation={rotation}>
        <boxGeometry args={[1.15, 1.55, 0.05]} />
        <meshStandardMaterial color="#8ecdd5" transparent opacity={0.45} />
      </mesh>
    </Float>
  )
}

function OrbPulse() {
  const orbRef = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!orbRef.current) return
    const pulse = 0.85 + Math.sin(clock.elapsedTime * 1.7) * 0.09
    orbRef.current.scale.setScalar(pulse)
  })

  return (
    <mesh ref={orbRef} position={[2.2, -1.2, -1.4]}>
      <sphereGeometry args={[0.6, 24, 24]} />
      <meshStandardMaterial color="#67a8f2" transparent opacity={0.28} />
    </mesh>
  )
}

export function UploadScene() {
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 2, 3]} intensity={1.1} color="#7aa4f5" />
      <DocMesh position={[-2.3, 1.2, -1]} rotation={[0.2, -0.35, 0.2]} />
      <DocMesh position={[1.8, 1.7, -2]} rotation={[-0.1, 0.3, -0.15]} />
      <OrbPulse />
      <Sparkles count={120} speed={0.26} size={2.2} scale={[8, 8, 8]} color="#c3dcff" />
    </>
  )
}
