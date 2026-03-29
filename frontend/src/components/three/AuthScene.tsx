import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import type { Mesh } from 'three'

type SpinningCoreProps = {
  color: string
}

function SpinningCore({ color }: SpinningCoreProps) {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * 0.35
    meshRef.current.rotation.x += delta * 0.1
  })

  return (
    <Float speed={1.1} rotationIntensity={0.5} floatIntensity={1.2}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.05, 1]} />
        <meshStandardMaterial color={color} wireframe transparent opacity={0.7} />
      </mesh>
    </Float>
  )
}

function OrbitRing({ color, size, speed }: { color: string; size: number; speed: number }) {
  const ringRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!ringRef.current) return
    ringRef.current.rotation.z += delta * speed
  })

  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2.6, 0, 0]}>
      <torusGeometry args={[size, 0.025, 18, 96]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} transparent opacity={0.65} />
    </mesh>
  )
}

export function AuthScene() {
  return (
    <>
      <fog attach="fog" args={['#0c1629', 4, 11]} />
      <ambientLight intensity={0.55} />
      <pointLight position={[2.5, 1.6, 2]} intensity={1.3} color="#2ca99a" />
      <pointLight position={[-2.2, -1.2, 1.8]} intensity={0.95} color="#4c91ec" />

      <group scale={1.05}>
        <SpinningCore color="#7ce5d8" />
        <OrbitRing color="#36c2b2" size={1.45} speed={0.24} />
        <OrbitRing color="#4c91ec" size={1.85} speed={-0.18} />
      </group>
    </>
  )
}
