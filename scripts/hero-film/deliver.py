from pathlib import Path
import json,subprocess,shutil,argparse,time
import os
R=Path(os.environ.get('FIREART_HERO_WORKDIR',Path(__file__).resolve().parents[2]/'output/hero-rebuild')).resolve()
repo=Path(__file__).resolve().parents[2]
dest=repo/'frontend/public/media'
parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=['landscape','portrait']);parser.add_argument('--only');args=parser.parse_args()
report=json.loads((R/'delivery-report.json').read_text()) if (R/'delivery-report.json').exists() else []
for profile,tag in [('landscape','wide'),('portrait','portrait')]:
    if args.profile and args.profile!=profile:continue
    source=R/f'FireArt-{profile}-4K.mp4'
    for i in range(3):
        variants=[
            ('hd', (1920,1080) if tag=='wide' else (1080,1920), '24'),
            ('retina', (2560,1440) if tag=='wide' else (1440,2560), '21'),
        ]
        if tag=='wide':variants.append(('uhd',(3840,2160),'24'))
        for quality,(w,h),crf in variants:
            suffix={'hd':'','retina':'-retina','uhd':'-uhd'}[quality]
            out=dest/f"hero-film-{tag}-{i+1}{suffix}.mp4"
            if args.only and out.stem not in args.only.split(','):continue
            temporary=out.with_name(out.stem+'.encoding.mp4')
            cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(i*30),'-i',str(source),'-t','30','-vf',f'scale={w}:{h}:in_range=auto:out_range=tv:flags=lanczos,setsar=1','-an','-c:v','libx264','-preset','medium','-crf',crf,'-profile:v','high','-pix_fmt','yuv420p','-r','30','-g','60','-video_track_timescale','15360','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',str(out)]
            cmd[-1]=str(temporary)
            subprocess.run(cmd,check=True)
            probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(temporary)]))
            video=probe['streams'][0]
            assert video['width']==w and video['height']==h and int(video['nb_frames'])==900
            assert abs(float(probe['format']['duration'])-30)<.01
            for attempt in range(6):
                try:
                    temporary.replace(out)
                    break
                except PermissionError:
                    if attempt==5:raise
                    time.sleep(1)
            report=[r for r in report if r['file']!=out.name]
            report.append({'file':out.name,'quality':quality,'width':w,'height':h,'frames':900,'duration':30,'crf':int(crf),'bytes':out.stat().st_size})
            (R/'delivery-report.json').write_text(json.dumps(report,indent=2))
            # Keep the already-running, explicitly selected preview in sync.
            build=repo/'frontend/build/media'/out.name
            if build.parent.exists():shutil.copy2(out,build)
            print('DELIVERED',out.name,out.stat().st_size,flush=True)
    out=dest/f'hero-film-{tag}.webp'
    size='2560:1440' if tag=='wide' else '1080:1920'
    subprocess.run(['ffmpeg','-v','error','-y','-ss','3.5','-i',str(source),'-frames:v','1','-vf','scale='+size+':flags=lanczos','-quality','92',str(out)],check=True)
    build=repo/'frontend/build/media'/out.name
    if build.parent.exists():shutil.copy2(out,build)
(R/'delivery-report.json').write_text(json.dumps(report,indent=2))
print('DELIVERY COMPLETE',flush=True)
