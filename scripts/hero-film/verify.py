"""Check delivered media timestamps, codec, dimensions, faststart and decoding."""
from pathlib import Path
import json,subprocess,argparse
repo=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--decode',action='store_true');parser.add_argument('--directory',type=Path,default=repo/'frontend/public/media');parser.add_argument('--report',type=Path,default=repo/'output/hero-rebuild/media-verification.json');parser.add_argument('--only',help='Comma-separated exact filenames for an early staged check');args=parser.parse_args()
reports=[]
edit=json.loads((repo/'scripts/hero-film/edit.json').read_text())
for tag in ['wide','portrait']:
    for chapter in range(1,4):
        duration=edit['chapters'][chapter]-edit['chapters'][chapter-1]
        frames=round(duration*edit['fps'])
        variants=[
            ('',(1920,1080) if tag=='wide' else (1080,1920)),
            ('-retina',(2560,1440) if tag=='wide' else (1440,2560)),
        ]
        if tag=='wide':variants.append(('-uhd',(3840,2160)))
        for suffix,(w,h) in variants:
            path=args.directory/f"hero-film-{tag}-{chapter}{suffix}.mp4"
            if args.only and path.name not in args.only.split(','):continue
            data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-show_packets','-show_entries','packet=pts_time','-of','json',str(path)]))
            assert len(data['streams'])==1,('unexpected audio',path)
            v=data['streams'][0]
            assert (v['width'],v['height'])==(w,h)
            assert v['codec_name']=='h264' and v['pix_fmt']=='yuv420p'
            assert v['color_range']=='tv' and v['color_space']=='bt709'
            assert int(v['nb_frames'])==frames and abs(float(data['format']['duration'])-duration)<.001
            times=sorted(float(p['pts_time']) for p in data['packets'])
            assert len(times)==frames and all(abs(t-i/edit['fps'])<.00001 for i,t in enumerate(times)),('nonuniform frame timestamps',path)
            with path.open('rb') as f:head=f.read(1024*1024)
            assert 0<head.find(b'moov')<head.find(b'mdat'),('not faststart',path)
            if args.decode:
                subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(path),'-f','null','-'],check=True)
            exits=[]
            for shot in edit['shots']:
                spec=shot[tag]
                if spec.get('omit') or not spec['src'].startswith('V'):continue
                end=spec.get('start',shot['start'])+spec.get('duration',shot['duration'])
                local=end-edit['chapters'][chapter-1]
                if not 0<local<=duration+.00001:continue
                pixels=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-ss',str(round(local-.04,6)),'-i',str(path),'-frames:v','1','-vf','scale=160:90','-pix_fmt','rgb24','-f','rawvideo','-'])
                level=sum(pixels)/len(pixels)
                assert level<3,('exit is not black',path.name,shot['id'],level)
                if local+.05<duration:
                    incoming=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-ss',str(round(local+.04,6)),'-i',str(path),'-frames:v','1','-vf','scale=160:90','-pix_fmt','rgb24','-f','rawvideo','-'])
                    assert max(incoming)>48,('next scene remains faded',path.name,shot['id'])
                exits.append({'shot':shot['id'],'last_frame_mean_rgb':round(level,4)})
            reports.append({'file':path.name,'dimensions':[w,h],'duration':duration,'frames':frames,'timestamps':'uniform 30 fps','faststart':True,'decoded':args.decode,'bytes':path.stat().st_size,'black_exits':exits})
            print('PASS',path.name,flush=True)
args.report.parent.mkdir(parents=True,exist_ok=True)
args.report.write_text(json.dumps(reports,indent=2))
