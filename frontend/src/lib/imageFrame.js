export const FRAME_DEVICES = ['desktop', 'tablet', 'phone'];
export const DEFAULT_IMAGE_FRAME = Object.freeze({x:50, y:50, zoom:1, fit:'cover', ratio:null});
export function galleryFrameRatio(ratio) {
  if(!Number.isFinite(ratio) || ratio<=0)return 4/3;
  return ratio<.6 ? 3/4 : ratio>2 ? 16/10 : ratio;
}
const bounded = (value, fallback, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min,value)) : fallback;

export function getFrame(value, device = 'desktop') {
  const input = value?.[device] || value?.desktop || DEFAULT_IMAGE_FRAME;
  return {x:bounded(input.x,50,0,100), y:bounded(input.y,50,0,100), zoom:bounded(input.zoom,1,1,3),
    fit:input.fit === 'contain' ? 'contain' : 'cover', ratio:typeof input.ratio === 'number' && Number.isFinite(input.ratio) ? bounded(input.ratio,null,.4,3) : null};
}

export function frameVariables(value) {
  if (!value) return undefined;
  return Object.fromEntries(FRAME_DEVICES.flatMap(device => {
    const frame = getFrame(value, device);
    return Object.entries({...frame,x:`${frame.x}%`,y:`${frame.y}%`,ratio:frame.ratio || 'var(--image-default-ratio, auto)',height:frame.ratio ? 'auto' : 'var(--image-default-height, auto)',minimum:frame.ratio ? '0px' : 'var(--image-default-minimum, 0px)'})
      .filter(([,entry])=>entry !== undefined).map(([key,entry])=>[`--frame-${device}-${key}`,String(entry)]);
  }));
}

export function frameImageStyle(value, device) {
  const frame = getFrame(value,device);
  return {objectFit:frame.fit,objectPosition:`${frame.x}% ${frame.y}%`,transform:`scale(${frame.zoom})`,transformOrigin:`${frame.x}% ${frame.y}%`};
}

export function frameContainerStyle(value,{height=false,minimum=false}={}) {
  if(!value)return undefined;
  return {...frameVariables(value),aspectRatio:'var(--frame-ratio)',...(height ? {height:'var(--frame-height)'} : {}),...(minimum ? {minHeight:'var(--frame-minimum)'} : {})};
}
