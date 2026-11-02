from pathlib import Path
import json, subprocess, shutil, concurrent.futures
import os
R=Path(os.environ.get('FIREART_HERO_WORKDIR',Path(__file__).resolve().parents[2]/'output/hero-rebuild')).resolve()
repo=Path(__file__).resolve().parents[2]
inv=json.loads((R/'inventory.json').read_text())
videos={v['id']:v for v in inv['videos']}
drones={d['id']:d for d in json.loads((R/'drones.json').read_text())}

# Cut windows were inspected around ignition, peak and decay. Each effect is
# used once. Daylight uses two separate camera events, interleaved with drones.
# Portrait substitutions are explicit editorial choices, never a blind centre crop.
edit=json.loads((Path(__file__).parent/'edit.json').read_text())
shots=edit['shots']

def run(args):
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace')[-4000:])

for profile in ['landscape','portrait']:
    (R/profile/'assets').mkdir(parents=True,exist_ok=True)
    (R/profile/'compositions').mkdir(parents=True,exist_ok=True)

def prepare(job):
    shot,profile=job
    spec=shot['wide' if profile=='landscape' else 'portrait']
    if spec.get('omit'):return
    src=spec['src']; assets=R/profile/'assets'
    duration=spec.get('duration',shot['duration'])
    if src.startswith('D'):
        p=Path(drones[src]['path']); dest=assets/(shot['id']+'.webp');shutil.copy2(p,dest)
        return
    v=videos[src]; dest=assets/(shot['id']+'.mp4')
    stamp=dest.with_suffix('.json')
    key=json.dumps([spec,duration,'4k-tv-range-v4'])
    if dest.exists() and stamp.exists() and stamp.read_text()==key: return
    at=spec['at'];rate=spec['rate']
    assert at+duration*rate<=v['duration']+.01,(shot,profile)
    # Lossless framing follows in HyperFrames; source orientation is normalised here.
    vf=f'setpts=(PTS-STARTPTS)/{rate},'
    vf+=('minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' if spec.get('interpolate') else 'fps=30')
    w,h=(3840,2160) if profile=='landscape' else (2160,3840)
    # Normalise once; reject mismatched aspect ratios instead of stretching.
    sw,sh=v['stream']['width'],v['stream']['height']
    rotation=next((d.get('rotation',0) for d in v['stream'].get('side_data_list',[]) if 'rotation' in d),0)
    if abs(rotation)%180==90:sw,sh=sh,sw
    assert abs(sw/sh-w/h)<.015,(profile,src,sw,sh)
    vf+=f',scale={w}:{h}:in_range=auto:out_range=tv:flags=lanczos,setsar=1'
    temporary=dest.with_name(dest.stem+'.preparing.mp4')
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(at),'-i',v['path'],'-vf',vf,'-frames:v',str(round(duration*30)),'-an','-c:v','h264_nvenc','-preset','p5','-rc','vbr','-cq','17','-b:v','0','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-g','30','-video_track_timescale','15360','-map_metadata','-1','-movflags','+faststart',str(temporary)])
    temporary.replace(dest)
    stamp.write_text(key)
    print(profile,shot['id'],flush=True)

(R/'edit.json').write_text(json.dumps(edit,indent=2),encoding='utf-8')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: list(pool.map(prepare,[(s,p) for p in ['landscape','portrait'] for s in shots]))
print('PREPARED',flush=True)
