"""Check delivered media timestamps, codec, dimensions, faststart and decoding."""
from pathlib import Path
import json,subprocess,argparse
repo=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--decode',action='store_true');args=parser.parse_args()
reports=[]
for tag in ['wide','portrait']:
    for chapter in range(1,4):
        for uhd in [False,True]:
            path=repo/'frontend/public/media'/f"hero-film-{tag}-{chapter}{'-uhd' if uhd else ''}.mp4"
            data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-show_packets','-show_entries','packet=pts_time','-of','json',str(path)]))
            assert len(data['streams'])==1,('unexpected audio',path)
            v=data['streams'][0]
            w,h=((3840,2160) if tag=='wide' else (2160,3840)) if uhd else ((1920,1080) if tag=='wide' else (1080,1920))
            assert (v['width'],v['height'])==(w,h)
            assert v['codec_name']=='h264' and v['pix_fmt']=='yuv420p'
            assert int(v['nb_frames'])==900 and abs(float(data['format']['duration'])-30)<.001
            times=sorted(float(p['pts_time']) for p in data['packets'])
            assert len(times)==900 and all(abs(t-i/30)<.00001 for i,t in enumerate(times)),('nonuniform frame timestamps',path)
            with path.open('rb') as f:head=f.read(1024*1024)
            assert 0<head.find(b'moov')<head.find(b'mdat'),('not faststart',path)
            if args.decode:
                subprocess.run(['ffmpeg','-nostdin','-v','error','-hwaccel','cuda','-hwaccel_output_format','cuda','-i',str(path),'-f','null','-'],check=True)
            reports.append({'file':path.name,'dimensions':[w,h],'duration':30,'frames':900,'timestamps':'uniform 30 fps','faststart':True,'decoded':args.decode,'bytes':path.stat().st_size})
            print('PASS',path.name,flush=True)
out=repo/'output/hero-rebuild/media-verification.json';out.write_text(json.dumps(reports,indent=2))
