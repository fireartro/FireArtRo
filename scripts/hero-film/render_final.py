from pathlib import Path
import subprocess,json,concurrent.futures,hashlib,argparse
import os
R=Path(os.environ.get('FIREART_HERO_WORKDIR',Path(__file__).resolve().parents[2]/'output/hero-rebuild')).resolve()
edit=json.loads((R/'edit.json').read_text())
parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=['landscape','portrait']);parser.add_argument('--shots');args=parser.parse_args()
def run(args,**kw):
    p=subprocess.run(args,**kw)
    if p.returncode: raise RuntimeError(f'command failed ({p.returncode}): {args[:4]}')
def valid(path,duration):
    if not path.exists():return False
    try:
        data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=nb_frames,width,height:format=duration','-of','json',str(path)]))
        return abs(float(data['format']['duration'])-duration)<.01 and int(data['streams'][0]['nb_frames'])==round(duration*30)
    except Exception:return False
def render(profile):
    root=R/profile;out=R/'rendered'/profile;out.mkdir(parents=True,exist_ok=True)
    profile_key='wide' if profile=='landscape' else 'portrait'
    shots=[{**s,'duration':s[profile_key].get('duration',s['duration']),'start':s[profile_key].get('start',s['start'])} for s in edit['shots'] if not s[profile_key].get('omit')]
    shots.sort(key=lambda s:s['start'])
    for shot in shots:
        dest=out/(shot['id']+'.mp4')
        if args.shots and shot['id'] not in args.shots.split(','):
            if not valid(dest,shot['duration']):raise RuntimeError('Missing unchanged scene: '+shot['id'])
            continue
        spec=shot['wide' if profile=='landscape' else 'portrait']
        asset=root/'assets'/(shot['id']+('.webp' if spec['src'].startswith('D') else '.mp4'))
        fingerprint=hashlib.sha256(asset.read_bytes()+(root/'compositions'/(shot['id']+'.html')).read_bytes()+b'hero-pipeline-v2').hexdigest()
        stamp=dest.with_suffix('.sha256')
        if valid(dest,shot['duration']) and stamp.exists() and stamp.read_text()==fingerprint:continue
        if not spec['src'].startswith('D'):
            # These shots contain no authored graphic layers or transforms.
            # Conform their already-cut original pixels directly: no browser
            # JPEG roundtrip, and bounded memory for the native 4K footage.
            w,h=(3840,2160) if profile=='landscape' else (2160,3840)
            run(['ffmpeg','-v','error','-y','-i',str(root/'assets'/(shot['id']+'.mp4')),'-vf',f'scale={w}:{h}:flags=lanczos,setsar=1','-frames:v',str(round(shot['duration']*30)),'-an','-c:v','h264_nvenc','-preset','p5','-cq','17','-b:v','0','-pix_fmt','yuv420p','-video_track_timescale','15360','-movflags','+faststart',str(dest)])
            if not valid(dest,shot['duration']):raise RuntimeError('invalid conformed source')
            stamp.write_text(fingerprint)
            print('CONFORMED',profile,shot['id'],flush=True)
            continue
        print('RENDER',profile,shot['id'],flush=True)
        with (out/(shot['id']+'.log')).open('w',encoding='utf-8') as log:
            run(['npx.cmd','--yes','hyperframes','render','-c',f"compositions/{shot['id']}.html",'--output',str(dest),'--quality','delivery','--gpu','--workers','1','--frames-cache-dir','off'],cwd=root,stdout=log,stderr=subprocess.STDOUT)
        if not valid(dest,shot['duration']):raise RuntimeError('invalid rendered duration: '+str(dest))
        stamp.write_text(fingerprint)
        print('DONE',profile,shot['id'],flush=True)
    listing=out/'concat.txt'
    listing.write_text(''.join("file '"+s['id']+".mp4'\n" for s in shots))
    master=R/f'FireArt-{profile}-4K.mp4'
    joined=out/'joined.mp4'
    run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(joined)])
    # Mixed camera and browser encoders have different B-frame start offsets.
    # Assign one exact PTS per decoded frame so chapter cuts stay at 900 frames.
    run(['ffmpeg','-nostdin','-v','error','-y','-r','30','-reinit_filter','0','-i',str(joined),'-fps_mode','passthrough','-an','-c:v','h264_nvenc','-preset','p5','-cq','17','-b:v','0','-pix_fmt','yuv420p','-video_track_timescale','15360','-movflags','+faststart',str(master)])
    if not valid(master,90):raise RuntimeError('invalid master')
    joined.unlink()
    print('MASTER',profile,flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    list(pool.map(render,[args.profile] if args.profile else ['landscape','portrait']))
print('MASTERS COMPLETE',flush=True)
