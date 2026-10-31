import * as THREE from 'three';
import { partnerDestination } from '@/data/partnerCatalog';
import { ribbonDistance, ribbonLayout, ribbonPeriod, writeRibbonVertex } from './partnerRibbonMath';

function partnerTexture(partner) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 396;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  let disposed = false;
  const draw = image => {
    if (disposed) return;
    const dark = partner.theme === 'dark';
    ctx.fillStyle = dark ? '#102036' : partner.theme === 'neutral' ? '#727b87' : '#f7f7f4';
    ctx.fillRect(0, 0, 640, 396);
    if (image) {
      const ratio = Math.min(520 / image.naturalWidth, 228 / image.naturalHeight);
      const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
      ctx.drawImage(image, (640 - width) / 2, 154 - height / 2, width, height);
    }
    ctx.fillStyle = dark ? '#eff5ff' : '#142238';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${image ? 28 : 40}px Arial, sans-serif`;
    const words = partner.name.split(' ');
    const lines = [];
    let line = '';
    words.forEach(word => {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > 540) { lines.push(line); line = word; }
      else line = next;
    });
    lines.push(line);
    lines.forEach((text, i) => ctx.fillText(text, 320, (image ? 329 : 198) + (i - (lines.length - 1) / 2) * (image ? 32 : 46), 540));
    texture.needsUpdate = true;
  };
  draw(null);
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => draw(image);
  if (partner.logo) image.src = partner.logo;
  return {texture, dispose() { disposed = true; image.onload = null; image.src = ''; texture.dispose(); }};
}

const fragmentShader = `
  uniform sampler2D uTexture;
  varying vec2 vUv;
  void main() {
    vec2 q = abs(vUv - 0.5) - vec2(0.445, 0.415);
    float edge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.055;
    if (edge > 0.002) discard;
    vec2 textureUv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
    gl_FragColor = texture2D(uTexture, textureUv);
    gl_FragColor.rgb *= gl_FrontFacing ? 1.0 : 0.78;
    gl_FragColor.a *= 1.0 - smoothstep(-fwidth(edge), fwidth(edge), edge);
    #include <colorspace_fragment>
  }
`;

export function mountPartnerRibbons({canvas, section, partners, onReady, onFailure}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, stencil:false, powerPreference:'low-power'});
  } catch { onFailure(); return () => {}; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
  camera.position.z = 1200;
  const vertex = {x:0,y:0,z:0};
  const tiles = partners.map((partner, index) => {
    const graphic = partnerTexture(partner);
    const material = new THREE.ShaderMaterial({
      uniforms:{uTexture:{value:graphic.texture}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader, side:THREE.DoubleSide, alphaToCoverage:true,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 20, 2), material);
    mesh.frustumCulled = false;
    mesh.userData = {index, partner};
    scene.add(mesh);
    return {mesh, graphic};
  });
  let width = 1, height = 1, layout, top = 0, scrollRange = 1;
  let frame = 0, last = 0, travel = 0, scrollTravel = 0, targetTravel = 0;
  let visible = false, disposed = false, focused = null, pointerDown = null, hovered = false;
  const updateScroll = () => {
    hovered=false;
    const progress = Math.max(0, Math.min(1, (window.scrollY - top) / scrollRange));
    targetTravel = progress * ribbonPeriod(partners.length,layout);
  };
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    layout = ribbonLayout(width, height);
    camera.position.z=Math.max(480,layout.depth*3.4);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = 2 * Math.atan(height / (2*camera.position.z)) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    top = window.scrollY + section.getBoundingClientRect().top;
    scrollRange = Math.max(1, section.offsetHeight - section.firstElementChild.offsetHeight);
    updateScroll();
  };
  const render = now => {
    frame = 0;
    if (disposed || !visible || document.hidden) { last = 0; return; }
    const delta = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    if (focused === null && !pointerDown && !hovered) {
      travel += delta * 20;
      scrollTravel += (targetTravel - scrollTravel) * (1 - Math.exp(-delta * 6));
    }
    const phase = (travel + scrollTravel) / layout.pitch;
    tiles.forEach(({mesh}, index) => {
      let center = ribbonDistance(index, partners.length, travel + scrollTravel, layout, width);
      if (focused === index) center = -width * .22;
      const positions = mesh.geometry.attributes.position;
      const uv = mesh.geometry.attributes.uv;
      for (let i=0;i<positions.count;i++) {
        writeRibbonVertex(vertex, center + (uv.getX(i) - .5) * layout.cardWidth,
          (uv.getY(i) - .5) * layout.cardHeight, index % 2, phase, layout);
        positions.setXYZ(i,vertex.x,vertex.y,vertex.z);
      }
      positions.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
    });
    renderer.render(scene,camera);
    frame = requestAnimationFrame(render);
  };
  const schedule = () => { if (!frame && !disposed && visible && !document.hidden) frame=requestAnimationFrame(render); };
  const suspend = () => {
    cancelAnimationFrame(frame);frame=0;last=0;pointerDown=null;hovered=false;
  };
  const resume = () => { suspend();schedule(); };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = event => {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/width*2-1, -(event.clientY-rect.top)/height*2+1);
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(tiles.map(tile=>tile.mesh))[0]?.object;
  };
  const down = event => {
    if (event.button !== 0 || !event.isPrimary) return;
    pointerDown = {x:event.clientX,y:event.clientY,scroll:window.scrollY,mesh:pick(event)};
  };
  const up = event => {
    const start = pointerDown;
    pointerDown = null;
    hovered = false;
    if (!start?.mesh || !event.isPrimary || Math.abs(start.scroll-window.scrollY)>2 ||
      Math.hypot(start.x-event.clientX,start.y-event.clientY)>8 || pick(event)!==start.mesh) return;
    window.open(partnerDestination(start.mesh.userData.partner),'_blank','noopener,noreferrer');
  };
  const cancel = () => { pointerDown = null;hovered=false; };
  const move = event => {
    if(event.pointerType!=='mouse')return;
    const mesh=pick(event);
    hovered=Boolean(mesh);
    canvas.style.cursor=mesh?'pointer':'default';
    canvas.title=mesh?.userData.partner.name || '';
  };
  const focus = event => {
    const link=event.target.closest('[data-partner-id]');
    if (!link) return;
    focused=partners.findIndex(partner=>partner.id===link.dataset.partnerId);
    schedule();
  };
  const blur = event => { if (!section.contains(event.relatedTarget)) focused=null; };
  const loss = event => { event.preventDefault(); onFailure(); };
  const observer = new IntersectionObserver(([entry]) => {
    visible=entry.isIntersecting; updateScroll(); schedule();
  },{rootMargin:'160px 0px'});
  const sizes = new ResizeObserver(() => {resize();schedule();});
  resize();
  observer.observe(canvas);
  sizes.observe(canvas);
  window.addEventListener('scroll',updateScroll,{passive:true});
  window.addEventListener('pageshow',resume);
  window.addEventListener('pagehide',suspend);
  document.addEventListener('visibilitychange',resume);
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('pointerleave',cancel);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('webglcontextlost',loss);
  section.addEventListener('focusin',focus);
  section.addEventListener('focusout',blur);
  onReady();
  return () => {
    disposed=true;
    cancelAnimationFrame(frame); observer.disconnect();sizes.disconnect();
    window.removeEventListener('scroll',updateScroll);
    window.removeEventListener('pageshow',resume);
    window.removeEventListener('pagehide',suspend);
    document.removeEventListener('visibilitychange',resume);
    canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);
    canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('pointermove',move);
    canvas.removeEventListener('pointerleave',cancel);
    canvas.removeEventListener('webglcontextlost',loss);
    section.removeEventListener('focusin',focus);section.removeEventListener('focusout',blur);
    tiles.forEach(({mesh,graphic})=>{mesh.geometry.dispose();mesh.material.dispose();graphic.dispose();});
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
