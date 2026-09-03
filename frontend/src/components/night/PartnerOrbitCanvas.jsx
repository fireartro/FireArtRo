import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  uniform float uTime;
  uniform float uReveal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 positionOffset = position;
    positionOffset.z += sin((position.x * 3.0) + uTime * 0.65) * 0.025 * uReveal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(positionOffset, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform float uReveal;
  varying vec2 vUv;

  float roundedBoxSdf(vec2 point, vec2 halfSize, float radius) {
    vec2 distance = abs(point) - halfSize + radius;
    return length(max(distance, 0.0)) + min(max(distance.x, distance.y), 0.0) - radius;
  }

  void main() {
    float edge = roundedBoxSdf(vUv - 0.5, vec2(0.47, 0.43), 0.08);
    float alpha = 1.0 - smoothstep(-0.012, 0.012, edge);
    vec4 textureColor = texture2D(uTexture, vUv);
    float glow = 0.94 + 0.06 * sin(vUv.y * 3.14159);
    gl_FragColor = vec4(textureColor.rgb * glow, textureColor.a * alpha * uReveal);
  }
`;

function createLabelTexture(label, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 420;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = index % 2 === 0 ? "#0d2740" : "#102e4b";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const light = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  light.addColorStop(0, "rgba(100, 174, 255, 0.18)");
  light.addColorStop(0.5, "rgba(255, 255, 255, 0.02)");
  light.addColorStop(1, "rgba(2, 7, 14, 0.34)");
  context.fillStyle = light;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(239, 246, 255, 0.92)";
  context.font = "600 44px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2);
  context.fillStyle = "rgba(142, 184, 255, 0.72)";
  context.fillRect(canvas.width / 2 - 54, canvas.height / 2 + 48, 108, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const PartnerOrbitCanvas = forwardRef(function PartnerOrbitCanvas({ partners, onReady }, ref) {
  const hostRef = useRef(null);
  const progressRef = useRef(0);

  useImperativeHandle(ref, () => ({
    setProgress(value) {
      progressRef.current = THREE.MathUtils.clamp(value, 0, 1);
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      onReady?.("fallback");
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 0, 10.5);
    const root = new THREE.Group();
    scene.add(root);
    const tiles = [];
    const geometry = new THREE.PlaneGeometry(1.58, 0.9, 18, 10);

    partners.forEach((partner, index) => {
      const ringIndex = index % 3;
      const slot = Math.floor(index / 3);
      const theta = slot * (Math.PI * 0.5) + ringIndex * 0.42;
      const latitude = (ringIndex - 1) * 0.62;
      const radius = 3.8 + ringIndex * 0.16;
      const target = new THREE.Vector3(
        Math.cos(theta) * radius * Math.cos(latitude),
        Math.sin(latitude) * 2.35,
        Math.sin(theta) * radius * Math.cos(latitude),
      );
      const scatter = target.clone().multiplyScalar(1.85 + (index % 4) * 0.12);
      scatter.y += (index % 2 === 0 ? 1 : -1) * 2.4;

      const material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uTexture: { value: createLabelTexture(partner.name, index) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(scatter);
      mesh.lookAt(0, 0, 0);
      root.add(mesh);
      tiles.push({ mesh, material, target, scatter, phase: index * 0.3 });
    });

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    let visible = true;
    let animationFrame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !animationFrame) animationFrame = window.requestAnimationFrame(render);
    }, { rootMargin: "25% 0px" });
    observer.observe(host);

    const clock = new THREE.Clock();
    function render() {
      animationFrame = 0;
      if (!visible) return;
      const elapsed = clock.getElapsedTime();
      const progress = progressRef.current;
      const assemble = THREE.MathUtils.smoothstep(progress, 0.03, 0.5);
      const disperse = 1 - THREE.MathUtils.smoothstep(progress, 0.79, 0.98);
      const reveal = Math.min(assemble, disperse);

      root.rotation.y = elapsed * 0.09 + progress * Math.PI * 1.7;
      root.rotation.x = Math.sin(elapsed * 0.18) * 0.05 + (progress - 0.5) * 0.12;

      tiles.forEach(({ mesh, material, target, scatter, phase }, index) => {
        const departure = target.clone().multiplyScalar(1.45 + (index % 3) * 0.08);
        departure.y += Math.sin(phase + elapsed * 0.2) * 1.8;
        mesh.position.copy(scatter).lerp(target, assemble).lerp(departure, 1 - disperse);
        mesh.lookAt(camera.position);
        material.uniforms.uTime.value = elapsed + phase;
        material.uniforms.uReveal.value = reveal;
      });

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    }

    // Compile once off the critical scroll path so the first visible frame is stable.
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    renderer.clear();
    onReady?.("ready");
    animationFrame = window.requestAnimationFrame(render);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      tiles.forEach(({ material }) => {
        material.uniforms.uTexture.value.dispose();
        material.dispose();
      });
      geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [onReady, partners]);

  return <div className="fa-partners__canvas" ref={hostRef} />;
});

export default PartnerOrbitCanvas;
