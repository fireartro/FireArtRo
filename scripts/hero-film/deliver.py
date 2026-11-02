from pathlib import Path
import json,subprocess,shutil,argparse,time
import os
R=Path(os.environ.get('FIREART_HERO_WORKDIR',Path(__file__).resolve().parents[2]/'output/hero-rebuild')).resolve()
repo=Path(__file__).resolve().parents[2]
dest=repo/'frontend/public/media'
parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=['landscape','portrait']);parser.add_argument('--only');parser.add_argument('--stage',action='store_true',help='Review exports locally before replacing public assets');parser.add_argument('--dry-run',action='store_true');parser.add_argument('--report',type=Path);args=parser.parse_args()
if args.stage:dest=R/'delivery'
if not args.dry_run:dest.mkdir(parents=True,exist_ok=True)
report_path=args.report or R/'delivery-report.json'
report=json.loads(report_path.read_text()) if report_path.exists() else []
edit=json.loads((R/'edit.json').read_text())
chapters=edit['chapters']
for profile,tag in [('landscape','wide'),('portrait','portrait')]:
    if args.profile and args.profile!=profile:continue
    source=R/f'FireArt-{profile}-4K.mp4'
    for i in range(3):
        start=chapters[i];duration=chapters[i+1]-start;frames=round(duration*edit['fps'])
        variants=[
            ('hd', (1920,1080) if tag=='wide' else (1080,1920), '26'),
            ('retina', (2560,1440) if tag=='wide' else (1440,2560), '26'),
        ]
        if tag=='wide':variants.append(('uhd',(3840,2160),'27'))
        for quality,(w,h),crf in variants:
            suffix={'hd':'','retina':'-retina','uhd':'-uhd'}[quality]
            out=dest/f"hero-film-{tag}-{i+1}{suffix}.mp4"
            if args.only and out.stem not in args.only.split(','):continue
            if args.dry_run:
                print(json.dumps({'file':str(out),'dimensions':[w,h],'seconds':duration,'crf':int(crf),'preset':'slow'}))
                continue
            temporary=out.with_name(out.stem+'.encoding.mp4')
            filters=[f'scale={w}:{h}:in_range=auto:out_range=tv:flags=lanczos','setsar=1']
            # Retain every selected source frame. Close only the final tail,
            # after its reviewed decay; the next shot starts fully visible.
            for shot in edit['shots']:
                spec=shot[tag]
                if spec.get('omit') or not spec['src'].startswith('V'):continue
                end=spec.get('start',shot['start'])+spec.get('duration',shot['duration'])
                if start < end <= start+duration+.00001:
                    local_end=round(end-start,6);fade_start=round(local_end-.45,6)
                    fade_duration=.45-1/edit['fps']
                    filters.append(f"fade=t=out:st={fade_start}:d={fade_duration}:color=black:enable='gte(t,{fade_start})*lt(t,{local_end})'")
            cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(source),'-t',str(duration),'-vf',','.join(filters),'-an','-c:v','libx264','-preset','slow','-crf',crf,'-profile:v','high','-pix_fmt','yuv420p','-r',str(edit['fps']),'-g','60','-video_track_timescale','15360','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-map_metadata','-1','-map_chapters','-1','-movflags','+faststart',str(out)]
            cmd[-1]=str(temporary)
            # Leave CPU capacity for the browser and the person's other apps.
            cmd[-1:-1]=['-threads','6']
            subprocess.run(cmd,check=True)
            probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(temporary)]))
            video=probe['streams'][0]
            assert video['width']==w and video['height']==h and int(video['nb_frames'])==frames
            assert abs(float(probe['format']['duration'])-duration)<.01
            for attempt in range(6):
                try:
                    temporary.replace(out)
                    break
                except PermissionError:
                    if attempt==5:raise
                    time.sleep(1)
            report=[r for r in report if r['file']!=out.name]
            report.append({'file':out.name,'quality':quality,'width':w,'height':h,'frames':frames,'duration':duration,'crf':int(crf),'bytes':out.stat().st_size})
            report_path.write_text(json.dumps(report,indent=2))
            # Keep the already-running, explicitly selected preview in sync.
            build=repo/'frontend/build/media'/out.name
            if not args.stage and build.parent.exists():shutil.copy2(out,build)
            print('DELIVERED',out.name,out.stat().st_size,flush=True)
    if args.dry_run:continue
    out=dest/f'hero-film-{tag}.webp'
    size='2560:1440' if tag=='wide' else '1080:1920'
    subprocess.run(['ffmpeg','-v','error','-y','-ss','3.5','-i',str(source),'-frames:v','1','-vf','scale='+size+':flags=lanczos','-quality','92',str(out)],check=True)
    build=repo/'frontend/build/media'/out.name
    if not args.stage and build.parent.exists():shutil.copy2(out,build)
if not args.dry_run:report_path.write_text(json.dumps(report,indent=2))
print('DELIVERY COMPLETE',flush=True)
