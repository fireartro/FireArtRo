import * as THREE from 'three';
import { partnerDestination } from '@/data/partnerCatalog';
import { CARD_HEIGHT, CARD_LENGTH, CARD_PITCH, createPartnerPath, leadingDistance, writePartnerPoint } from './partnerRibbonMath';
import { damp } from './weblyHelixMath';

function partnerTexture(partner, onLoad) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 234;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const draw = image => {
    const dark = partner.theme === 'dark';
    ctx.fillStyle = dark ? '#102036' : partner.theme === 'neutral' ? '#727b87' : '#faf9f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (image) {
      const scale = Math.min(548 / image.naturalWidth, 145 / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      ctx.drawImage(image, (canvas.width - w) / 2, 97 - h / 2, w, h);
    }
    ctx.fillStyle = dark ? '#eff5ff' : '#172334';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${image ? 28 : 40}px Arial, sans-serif`;
    ctx.fillText(partner.name, 320, image ? 202 : 117, 566);
    texture.needsUpdate = true;
  };
  draw(null);
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => { draw(image); onLoad(); };
  if (partner.logo) image.src = partner.logo;
  return { texture, dispose() { image.onload = null; texture.dispose(); } };
}

const vertexShader = `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vDepth = position.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    // A radius measured in tile heights stays round on a wide card.
    vec2 q = (abs(vUv - 0.5) - 0.5) * vec2(2.736, 1.0) + 0.135;
    float edge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.135;
    if (edge >= 0.0) discard;
    vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
    vec3 ink = texture2D(uTexture, uv).rgb;
    float rear = 1.0 - smoothstep(-7.2, 5.5, vDepth);
    gl_FragColor = vec4(mix(ink, vec3(0.035, 0.053, 0.081), 0.48 * rear), 1.0);
    #include <colorspace_fragment>
  }
`;

export function mountPartnerRibbons({canvas, section, partners, onReady, onFailure}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, stencil:false, powerPreference:'low-power'});
  } catch { onFailure(); return () => {}; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 500);
  const point = new Float32Array(3);
  let frame = 0, last = 0, currentProgress = 0, targetProgress = 0;
  let visible = false, disposed = false, pointerDown = null, path;
  let scrollRange = 1, top = 0;
  const schedule = () => {
    if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(render);
  };
  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const tiles = partners.map((partner, index) => {
    const graphic = partnerTexture(partner, schedule);
    graphic.texture.anisotropy = anisotropy;
    const material = new THREE.ShaderMaterial({
      uniforms:{uTexture:{value:graphic.texture}}, vertexShader, fragmentShader,
      side:THREE.DoubleSide, depthWrite:true, toneMapped:false,
    });
    const geometry = new THREE.PlaneGeometry(1, 1, 48, 1);
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.userData = {index, partner};
    scene.add(mesh);
    return {mesh, graphic};
  });
  const meshes = tiles.map(tile => tile.mesh);
  const guides = [];
  for (const lane of [0, 1]) {
    for (const side of [-1, 1]) {
      const material = new THREE.LineBasicMaterial({
        color:lane === 0 ? 0xbccfec : 0xe3ba91, transparent:true, opacity:0.38, depthWrite:false,
      });
      const line = new THREE.Line(new THREE.BufferGeometry(), material);
      line.visible = false;
      scene.add(line);
      guides.push({line, lane, side});
    }
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const radius = Math.min(10.4, Math.max(6.9, camera.aspect * 8.2));
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(27, 3.8 + (radius + 0.55) / (camera.aspect * tangent));
    camera.updateProjectionMatrix();
    // Even the far end of a lead is beyond the lateral edge of the camera.
    const extent = (camera.position.z + 4.4) * tangent * camera.aspect + CARD_LENGTH;
    path = createPartnerPath(radius, extent);
    for (const {line, lane, side} of guides) {
      const positions = new Float32Array((path.steps + 1) * 3);
      for (let i = 0; i <= path.steps; i++) {
        writePartnerPoint(point, path, i * path.length / path.steps, side * (CARD_HEIGHT / 2 + 0.16), lane);
        positions.set(point, i * 3);
      }
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry();
      line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
    const lead = window.innerHeight * 0.16;
    top = window.scrollY + section.getBoundingClientRect().top - lead;
    scrollRange = Math.max(1, section.offsetHeight - section.firstElementChild.offsetHeight + lead);
    updateScroll();
    currentProgress = targetProgress;
  }

  function updateScroll() {
    const next = THREE.MathUtils.clamp((window.scrollY - top) / scrollRange, 0, 1);
    if (next !== targetProgress) canvas.dataset.settled = 'false';
    targetProgress = next;
    schedule();
  }

  function render(now) {
    frame = 0;
    if (disposed || !visible || document.hidden) { last = 0; return; }
    // Exponential damping already bounds the step. Count elapsed time even
    // when a slow GPU skips frames; suspend/resume resets the clock.
    const delta = last ? Math.max(0, (now - last) / 1000) : 1 / 60;
    currentProgress = damp(currentProgress, targetProgress, delta);
    const settled = Math.abs(currentProgress - targetProgress) < 0.00005;
    if (settled) currentProgress = targetProgress;
    const head = leadingDistance(currentProgress, path.length, partners.length);
    meshes.forEach((mesh, index) => {
      const start = head - Math.floor(index / 2) * CARD_PITCH - CARD_LENGTH;
      mesh.visible = start < path.length && start + CARD_LENGTH > 0;
      if (!mesh.visible) return;
      const {uv, position} = mesh.geometry.attributes;
      for (let i = 0; i < position.count; i++) {
        writePartnerPoint(point, path, start + uv.getX(i) * CARD_LENGTH, (uv.getY(i) - 0.5) * CARD_HEIGHT, index % 2);
        position.setXYZ(i, point[0], point[1], point[2]);
      }
      position.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    });
    for (const {line, lane} of guides) {
      const count = Math.ceil((partners.length - lane) / 2);
      const back = head - (count - 1) * CARD_PITCH - CARD_LENGTH;
      const first = Math.max(0, Math.ceil(back / path.length * path.steps));
      const end = Math.min(path.steps, Math.floor(head / path.length * path.steps));
      line.visible = count > 0 && end > first;
      line.geometry.setDrawRange(first, Math.max(0, end - first + 1));
    }
    renderer.render(scene, camera);
    if (settled && canvas.dataset.settled !== 'true') canvas.dataset.settled = 'true';
    last = settled ? 0 : now;
    if (!settled) schedule();
  }

  const suspend = () => { cancelAnimationFrame(frame); frame = 0; last = 0; pointerDown = null; };
  const resume = () => { suspend(); updateScroll(); currentProgress = targetProgress; schedule(); };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = event => {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(meshes.filter(mesh => mesh.visible)).find(({uv}) => {
      const x = Math.max(0, (Math.abs(uv.x - 0.5) - 0.5) * CARD_LENGTH / CARD_HEIGHT + 0.135);
      const y = Math.max(0, Math.abs(uv.y - 0.5) - 0.5 + 0.135);
      return Math.hypot(x, y) <= 0.135;
    })?.object;
  };
  const down = event => {
    if (event.button !== 0 || !event.isPrimary) return;
    pointerDown = {x:event.clientX, y:event.clientY, scroll:window.scrollY, mesh:pick(event)};
  };
  const up = event => {
    const start = pointerDown;
    pointerDown = null;
    if (!start?.mesh || !event.isPrimary || Math.abs(start.scroll - window.scrollY) > 2 ||
      Math.hypot(start.x - event.clientX, start.y - event.clientY) > 8 || pick(event) !== start.mesh) return;
    window.open(partnerDestination(start.mesh.userData.partner), '_blank', 'noopener,noreferrer');
  };
  const cancel = () => { pointerDown = null; };
  const move = event => {
    if (event.pointerType !== 'mouse') return;
    const mesh = pick(event);
    canvas.style.cursor = mesh ? 'pointer' : 'default';
    canvas.title = mesh?.userData.partner.name || '';
  };
  const loss = event => { event.preventDefault(); onFailure(); };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) resume(); else suspend();
  }, {rootMargin:'120px 0px'});
  const sizes = new ResizeObserver(resize);
  resize();
  observer.observe(canvas);
  sizes.observe(canvas);
  window.addEventListener('scroll', updateScroll, {passive:true});
  window.addEventListener('pageshow', resume);
  window.addEventListener('pagehide', suspend);
  document.addEventListener('visibilitychange', resume);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', cancel);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('webglcontextlost', loss);
  onReady();
  return () => {
    disposed = true;
    suspend();
    observer.disconnect();
    sizes.disconnect();
    window.removeEventListener('scroll', updateScroll);
    window.removeEventListener('pageshow', resume);
    window.removeEventListener('pagehide', suspend);
    document.removeEventListener('visibilitychange', resume);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('pointerleave', cancel);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('webglcontextlost', loss);
    tiles.forEach(({mesh, graphic}) => { mesh.geometry.dispose(); mesh.material.dispose(); graphic.dispose(); });
    guides.forEach(({line}) => { line.geometry.dispose(); line.material.dispose(); });
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
