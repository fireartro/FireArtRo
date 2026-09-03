import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  uniform float uTime;
  uniform float uIntensity;
  attribute float aSize;
  varying float vPulse;

  void main() {
    vec3 p = position;
    float pulse = 0.62 + 0.38 * sin(uTime * 0.9 + position.z * 1.7 + position.x * 2.0);
    p.y += sin(uTime * 0.22 + position.x * 1.8) * 0.025;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * pulse * uIntensity * (120.0 / -mvPosition.z);
    vPulse = pulse;
  }
`;

const fragmentShader = `
  varying float vPulse;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float core = smoothstep(0.5, 0.05, distanceToCenter);
    float halo = smoothstep(0.5, 0.2, distanceToCenter);
    vec3 ice = vec3(0.55, 0.83, 1.0);
    vec3 electric = vec3(0.09, 0.46, 1.0);
    vec3 color = mix(electric, ice, core);
    float alpha = (core * 0.9 + halo * 0.34) * (0.62 + vPulse * 0.38);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createLineGeometry(points) {
  return new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point)));
}

function RunwayWorld({ activeChapter }) {
  const worldRef = useRef(null);
  const starMaterialRef = useRef(null);
  const { pointer } = useThree();

  const rails = useMemo(
    () => [
      createLineGeometry([[-2.8, -1.3, 1.8], [-0.66, -0.58, -8.5], [-0.16, -0.22, -18]]),
      createLineGeometry([[2.8, -1.3, 1.8], [0.66, -0.58, -8.5], [0.16, -0.22, -18]]),
    ],
    [],
  );

  const constellation = useMemo(() => {
    const count = 118;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const lane = (index % 7) - 3;
      const depth = -1.8 - (index / count) * 17;
      const radius = 0.7 + ((index * 37) % 100) / 42;
      const angle = index * 2.39996;
      positions[index * 3] = Math.cos(angle) * radius + lane * 0.18;
      positions[index * 3 + 1] = Math.sin(angle) * radius * 0.58 + 0.3;
      positions[index * 3 + 2] = depth + Math.sin(index * 0.73) * 0.65;
      sizes[index] = 3.2 + (index % 5) * 0.9;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }, []);

  const crossbars = useMemo(
    () => Array.from({ length: 18 }, (_, index) => ({
      z: 1.2 - index * 0.72,
      width: Math.max(0.44, 5.2 - index * 0.245),
      opacity: Math.max(0.1, 0.46 - index * 0.018),
    })),
    [],
  );

  useFrame((state, delta) => {
    if (!worldRef.current) return;
    const targetRotationY = pointer.x * 0.085;
    const targetRotationX = -pointer.y * 0.035;
    worldRef.current.rotation.y = THREE.MathUtils.damp(
      worldRef.current.rotation.y,
      targetRotationY,
      3.4,
      delta,
    );
    worldRef.current.rotation.x = THREE.MathUtils.damp(
      worldRef.current.rotation.x,
      targetRotationX,
      3.4,
      delta,
    );
    worldRef.current.position.z = THREE.MathUtils.damp(
      worldRef.current.position.z,
      activeChapter * 0.12,
      2.6,
      delta,
    );

    if (starMaterialRef.current) {
      starMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      starMaterialRef.current.uniforms.uIntensity.value = 0.95 + activeChapter * 0.06;
    }
  });

  return (
    <group ref={worldRef} position={[0, 0.05, 0]}>
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 1, 1.5]} color="#8dd3ff" intensity={8} distance={11} />

      {rails.map((geometry, index) => (
        <line key={index} geometry={geometry}>
          <lineBasicMaterial color={index ? "#8dd3ff" : "#1677ff"} transparent opacity={0.82} />
        </line>
      ))}

      {crossbars.map((bar) => (
        <mesh key={bar.z} position={[0, -0.72 + Math.abs(bar.z) * 0.015, bar.z]} rotation={[-0.08, 0, 0]}>
          <boxGeometry args={[bar.width, 0.012, 0.018]} />
          <meshBasicMaterial color="#1677ff" transparent opacity={bar.opacity} />
        </mesh>
      ))}

      <mesh position={[0, -0.43, -10.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.5, 21]} />
        <meshBasicMaterial
          color="#032d60"
          transparent
          opacity={0.075}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <points geometry={constellation}>
        <shaderMaterial
          ref={starMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uIntensity: { value: 1 },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <mesh position={[0, 0.08, -12]}>
        <ringGeometry args={[0.46, 0.485, 96]} />
        <meshBasicMaterial color="#8dd3ff" transparent opacity={0.38} />
      </mesh>
    </group>
  );
}

export default function RunwayScene({ activeChapter = 0 }) {
  return (
    <div className="nr-home__scene" data-testid="runway-scene" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.45, 5.5], fov: 46, near: 0.1, far: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <RunwayWorld activeChapter={activeChapter} />
      </Canvas>
    </div>
  );
}
