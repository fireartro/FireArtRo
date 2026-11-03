import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Monitor, RotateCcw, Smartphone, Tablet } from 'lucide-react';
import { DEFAULT_IMAGE_FRAME, FRAME_DEVICES, frameImageStyle, galleryFrameRatio, getFrame } from '@/lib/imageFrame';
import useNearViewport from '@/hooks/useNearViewport';

const AdminFrameGeometry=lazy(()=>import('./AdminFrameGeometry'));

const devices = {desktop:{label:'Desktop',Icon:Monitor},tablet:{label:'Tabletă',Icon:Tablet},phone:{label:'Telefon',Icon:Smartphone}};
const ratios = {desktop:1.6,tablet:1.25,phone:1};
const clamp = number => Math.round(Math.max(0,Math.min(100,number))*10)/10;

function FrameNumber({label,value,min,max,step,onChange,nullable=false}) {
  const [text,setText]=useState(value == null ? '' : String(value));
  const focused=useRef(false);
  useEffect(()=>{if(!focused.current)setText(value == null ? '' : String(value));},[value]);
  const valid=text === '' ? nullable : Number.isFinite(Number(text)) && Number(text)>=min && Number(text)<=max;
  return <label className="admin-field">{label}<input type="number" inputMode="decimal" min={min} max={max} step={step} value={text} placeholder={nullable ? 'Automat' : undefined} aria-invalid={!valid} onFocus={()=>{focused.current=true;}} onBlur={()=>{focused.current=false;if(!valid)setText(value == null ? '' : String(value));}} onChange={event=>{
    const next=event.target.value;setText(next);
    if(next === '' && nullable)onChange(null);
    else if(next !== '' && Number.isFinite(Number(next)) && Number(next)>=min && Number(next)<=max)onChange(Number(next));
  }}/>{!valid && <small role="alert">Alege o valoare între {min} și {max}.</small>}</label>;
}
export default function AdminImageFrame({value, onChange, src, label='Încadrarea imaginii', defaultRatios=ratios,surface='image',target}) {
  const [device,setDevice] = useState(()=>typeof window !== 'undefined' && window.matchMedia?.('(max-width: 599px)').matches ? 'phone' : 'desktop');
  const [dragValue,setDragValue] = useState(null);
  const [failed,setFailed] = useState(false);
  const drag = useRef(null);
  const image = useRef(null);
  const anchor=useRef(null);
  const near=useNearViewport(anchor,'200px');
  const [naturalRatio,setNaturalRatio]=useState(null);
  const [measured,setMeasured]=useState({});
  const measureRatio=useCallback(ratio=>setMeasured(previous=>Math.abs((previous[device] || 0)-ratio)<.0001 ? previous : {...previous,[device]:ratio}),[device]);
  const effective = dragValue || value;
  const frame = getFrame(effective,device);
  const inherited = device !== 'desktop' && !value?.[device];
  useEffect(()=>{setFailed(false);setDragValue(null);setNaturalRatio(null);setMeasured({});drag.current=null;},[src]);
  const dynamic=surface === 'home-packages' || surface === 'home-gallery';
  const originalRatio=surface === 'package' ? 16/9 : surface === 'gallery' ? galleryFrameRatio(naturalRatio) : measured[device] || defaultRatios[device];
  const waiting=dynamic && !frame.ratio && !measured[device];
  const patch = change => onChange({...value, desktop:getFrame(value,'desktop'),[device]:{...getFrame(value,device),...change}});
  const resetDevice = () => {
    if (device === 'desktop') patch(DEFAULT_IMAGE_FRAME);
    else {const next={...value};delete next[device];onChange(next);}
  };
  const pointerDown = event => {
    if (event.button !== 0 || !image.current?.naturalWidth) return;
    const bounds=event.currentTarget.getBoundingClientRect();
    const {naturalWidth:w,naturalHeight:h}=image.current;
    const scale=(frame.fit === 'contain' ? Math.min(bounds.width/w,bounds.height/h) : Math.max(bounds.width/w,bounds.height/h))*frame.zoom;
    drag.current={pointer:event.pointerId,clientX:event.clientX,clientY:event.clientY,frame,overflowX:w*scale-bounds.width,overflowY:h*scale-bounds.height};
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const pointerMove = event => {
    const start=drag.current;if(!start || start.pointer !== event.pointerId) return;
    const next={...start.frame,x:Math.abs(start.overflowX)>1 ? clamp(start.frame.x-(event.clientX-start.clientX)/start.overflowX*100) : start.frame.x,
      y:Math.abs(start.overflowY)>1 ? clamp(start.frame.y-(event.clientY-start.clientY)/start.overflowY*100) : start.frame.y};
    drag.current.result={...value,desktop:getFrame(value,'desktop'),[device]:next};setDragValue(drag.current.result);
  };
  const pointerEnd = event => {
    if(!drag.current || drag.current.pointer !== event.pointerId) return;
    const next=drag.current.result;drag.current=null;setDragValue(null);
    if(next && event.type !== 'pointercancel') onChange(next);
  };
  return <section ref={anchor} className="cms-image-frame" aria-label={label}>
    {near && dynamic && src && !frame.ratio && <Suspense fallback={null}><AdminFrameGeometry surface={surface} target={target} device={device} onRatio={measureRatio}/></Suspense>}
    <header><div><h3>{label}</h3><p>Poziție, mărime și formă, separat pentru fiecare ecran.</p></div><button type="button" className="admin-button" disabled={!value} onClick={()=>onChange(null)} aria-label="Resetează toate încadrările"><RotateCcw aria-hidden="true"/>Resetează</button></header>
    <div className="cms-frame-devices" aria-label="Dispozitiv pentru încadrare">{FRAME_DEVICES.map(key=>{const {Icon,label:deviceLabel}=devices[key];return <button type="button" key={key} aria-pressed={device === key} aria-description={key === 'desktop' || value?.[key] ? 'Setări proprii' : 'Moștenește setările desktop'} onClick={()=>{setDevice(key);setDragValue(null);drag.current=null;}}><Icon aria-hidden="true"/>{deviceLabel}{key !== 'desktop' && value?.[key] && <span aria-hidden="true"/>}</button>;})}</div>
    {!src || failed ? <p className="cms-frame-missing" role="status">{failed ? 'Imaginea nu poate fi încărcată. Verifică materialul selectat.' : 'Alege o imagine pentru a-i regla încadrarea.'}</p> : <div className="cms-frame-workspace">
      <div className="cms-frame-canvas"><div className={`cms-frame-stage is-${device}`} aria-busy={waiting} style={{aspectRatio:frame.ratio || originalRatio}} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
        <img ref={image} src={src} alt="Previzualizarea încadrării" draggable="false" style={{...frameImageStyle(effective,device),visibility:waiting ? 'hidden' : undefined}} onLoad={event=>setNaturalRatio(event.currentTarget.naturalWidth/event.currentTarget.naturalHeight)} onError={()=>setFailed(true)}/>{waiting ? <span className="cms-frame-loading" role="status">Se pregătește cadrul…</span> : <span className="cms-frame-crosshair" aria-hidden="true"/>}
      </div><p>Trage imaginea în cadru sau folosește reglajele de alături.</p></div>
      <div className="cms-frame-controls">
        {device !== 'desktop' && <label className="cms-frame-inherit"><input type="checkbox" checked={inherited} onChange={event=>event.target.checked ? resetDevice() : patch({})}/>Folosește setările desktop</label>}
        {[['x','Poziție orizontală',0,100,.5,'%'],['y','Poziție verticală',0,100,.5,'%'],['zoom','Mărimea imaginii',1,3,.01,'×']].map(([key,text,min,max,step,unit])=><label className="cms-frame-range" key={key}><span>{text}<output>{frame[key].toLocaleString('ro-RO',{maximumFractionDigits:2})}{unit}</output></span><input type="range" aria-label={text} min={min} max={max} step={step} value={frame[key]} onChange={event=>patch({[key]:Number(event.target.value)})}/></label>)}
        <label className="admin-field">Așezare<select aria-label="Așezarea imaginii" value={frame.fit} onChange={event=>patch({fit:event.target.value})}><option value="cover">Umple cadrul</option><option value="contain">Imagine completă</option></select></label>
        <label className="admin-field">Forma cadrului<select aria-label="Forma cadrului" value={frame.ratio ?? 'auto'} onChange={event=>patch({ratio:event.target.value === 'auto' ? null : Number(event.target.value)})}>
          <option value="auto">Cadrul paginii</option><option value={16/9}>Panoramic · 16:9</option><option value={4/3}>Orizontal · 4:3</option><option value={1}>Pătrat · 1:1</option><option value={4/5}>Portret · 4:5</option><option value={9/16}>Vertical · 9:16</option>
          {frame.ratio && ![16/9,4/3,1,4/5,9/16].includes(frame.ratio) && <option value={frame.ratio}>Personalizat · {frame.ratio}</option>}
        </select></label>
        <div className="cms-frame-actions"><button type="button" className="admin-button" onClick={resetDevice}>Resetează {devices[device].label.toLowerCase()}</button><button type="button" className="admin-button" onClick={()=>onChange(Object.fromEntries(FRAME_DEVICES.map(key=>[key,{...frame}])))}><Copy aria-hidden="true"/>Aplică pe toate</button></div>
        <details className="cms-frame-precise"><summary>Reglaje precise</summary><div>
          <FrameNumber key={`${device}-x`} label="Orizontal (%)" value={frame.x} min={0} max={100} step={.5} onChange={x=>patch({x})}/>
          <FrameNumber key={`${device}-y`} label="Vertical (%)" value={frame.y} min={0} max={100} step={.5} onChange={y=>patch({y})}/>
          <FrameNumber key={`${device}-ratio`} label="Raport lățime / înălțime" value={frame.ratio} min={.4} max={3} step={.01} nullable onChange={ratio=>patch({ratio})}/>
        </div></details>
        <small>{inherited ? 'Moștenește desktopul. Orice reglaj creează setări proprii pentru acest dispozitiv.' : 'Reglajele se salvează în draft. Originalul rămâne intact.'}</small>
      </div>
    </div>}
  </section>;
}
