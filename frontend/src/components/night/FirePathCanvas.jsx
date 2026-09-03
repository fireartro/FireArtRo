import { useEffect, useRef } from "react";

const POINT_COUNT = 420;

const seededNoise = (index, salt = 0) => {
  const value = Math.sin(index * 91.733 + salt * 17.17) * 43758.5453;
  return value - Math.floor(value);
};

const buildFormation = (mode) => {
  const positions = new Float32Array(POINT_COUNT * 3);

  for (let index = 0; index < POINT_COUNT; index += 1) {
    const progress = index / (POINT_COUNT - 1);
    const offset = index * 3;

    if (mode === 0) {
      const columns = 28;
      const row = Math.floor(index / columns);
      const column = index % columns;
      positions[offset] = (column / (columns - 1) - 0.5) * 8.4;
      positions[offset + 1] = (row / 14 - 0.5) * 4.2 + Math.sin(column * 0.7) * 0.12;
      positions[offset + 2] = (seededNoise(index, 1) - 0.5) * 0.5;
    } else if (mode === 1) {
      const burst = index % 7;
      const angle = progress * Math.PI * 18 + burst * 0.24;
      const radius = 0.35 + (index % 60) / 60 * 3.9;
      positions[offset] = Math.cos(angle) * radius + (burst - 3) * 0.34;
      positions[offset + 1] = Math.sin(angle) * radius * 0.72 + 0.6 - radius * 0.12;
      positions[offset + 2] = (seededNoise(index, 2) - 0.5) * 1.2;
    } else {
      const ray = index % 14;
      const distance = (Math.floor(index / 14) / 29) * 4.8;
      const angle = -Math.PI * 0.82 + (ray / 13) * Math.PI * 0.64;
      positions[offset] = Math.cos(angle) * distance - 0.4;
      positions[offset + 1] = Math.sin(angle) * distance + 1.5;
      positions[offset + 2] = (seededNoise(index, 3) - 0.5) * 0.7;
    }
  }

  return positions;
};

export default function FirePathCanvas({ serviceIndex }) {
  const hostRef = useRef(null);
  const serviceRef = useRef(serviceIndex);

  useEffect(() => {
    serviceRef.current = serviceIndex;
  }, [serviceIndex]);

  useEffect(() => {
    const host = hostRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smallScreen = window.matchMedia("(max-width: 900px)").matches;
    const saveData = navigator.connection?.saveData;
    const lowConcurrency = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    if (!host) return undefined;
    if (reducedMotion || smallScreen || saveData || lowConcurrency) {
      host.dataset.canvasState = "disabled";
      return undefined;
    }
    host.dataset.canvasState = "idle";

    let disposed = false;
    let initialized = false;
    let visible = false;
    let frame = 0;
    let cleanupScene = () => {};
    let resumeScene = () => {};
    let pauseScene = () => {};

    const initialize = async () => {
      if (initialized || disposed) return;
      initialized = true;
      const THREE = await import("three");
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 10);

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.tabIndex = -1;
      host.appendChild(renderer.domElement);

      const current = buildFormation(serviceRef.current);
      const geometry = new THREE.BufferGeometry();
      const attribute = new THREE.BufferAttribute(current, 3);
      geometry.setAttribute("position", attribute);

      const material = new THREE.PointsMaterial({
        color: 0x8eb8ff,
        size: 0.045,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geometry, material);
      points.position.x = 2.15;
      scene.add(points);

      let width = 0;
      let height = 0;
      let targetMode = serviceRef.current;
      let target = buildFormation(targetMode);
      let lastRenderTime = 0;

      const resize = () => {
        const rect = host.getBoundingClientRect();
        const nextWidth = Math.max(1, Math.round(rect.width));
        const nextHeight = Math.max(1, Math.round(rect.height));
        if (nextWidth === width && nextHeight === height) return;
        width = nextWidth;
        height = nextHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      const render = (time = 0) => {
        frame = 0;
        if (!visible || document.hidden || disposed) return;
        if (time - lastRenderTime < 32) {
          frame = window.requestAnimationFrame(render);
          return;
        }
        lastRenderTime = time;
        resize();

        if (targetMode !== serviceRef.current) {
          targetMode = serviceRef.current;
          target = buildFormation(targetMode);
        }

        const values = attribute.array;
        for (let index = 0; index < values.length; index += 1) {
          values[index] += (target[index] - values[index]) * 0.065;
        }
        attribute.needsUpdate = true;
        points.rotation.z = Math.sin(time * 0.00022) * 0.018;
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(render);
      };

      const start = () => {
        if (!frame && visible && !document.hidden) {
          host.dataset.canvasState = "running";
          frame = window.requestAnimationFrame(render);
        }
      };
      const stop = () => {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        host.dataset.canvasState = "paused";
      };
      const onVisibility = () => (document.hidden ? stop() : start());
      resumeScene = start;
      pauseScene = stop;
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      document.addEventListener("visibilitychange", onVisibility);
      resize();
      start();

      cleanupScene = () => {
        stop();
        resizeObserver.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) initialize().then(() => resumeScene());
        else if (initialized) pauseScene();
      },
      { threshold: 0.02, rootMargin: "140px 0px" },
    );
    observer.observe(host);

    return () => {
      disposed = true;
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      cleanupScene();
    };
  }, []);

  return <div ref={hostRef} className="fa-service-stage__canvas" data-testid="fire-path-canvas" aria-hidden="true" />;
}
