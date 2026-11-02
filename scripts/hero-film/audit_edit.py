"""Editorial acceptance: full timelines, distinct source moments, media types."""
from pathlib import Path
import json,os
repo=Path(__file__).resolve().parents[2]
work=Path(os.environ.get('FIREART_HERO_WORKDIR',repo/'output/hero-rebuild')).resolve()
edit=json.loads((work/'edit.json').read_text())
inventory={v['id']:v for v in json.loads((work/'inventory.json').read_text())['videos']}
# Different camera angles of the same ignition are the same event.
events={'V01':'rainbow-wedding','V07':'rainbow-wedding','V08':'lake-wedding','V09':'lake-wedding','V15':'garden-wedding','V16':'garden-wedding'}
report={}
for profile in ['wide','portrait']:
    scenes=[]
    for shot in edit['shots']:
        spec=shot[profile]
        if spec.get('omit'):continue
        scenes.append({'id':shot['id'],'start':spec.get('start',shot['start']),'duration':spec.get('duration',shot['duration']),**spec})
    scenes.sort(key=lambda s:s['start'])
    cursor=0;used_photos=set();used_day_events=set();source_windows={};photo_run=0;max_photo_run=0
    for s in scenes:
        assert abs(s['start']-cursor)<1e-6,('gap or overlap',profile,s)
        cursor+=s['duration']
        assert abs(s['duration']*30-round(s['duration']*30))<1e-6
        source=s['src']
        if source.startswith('D'):
            assert source not in used_photos,('repeated photo',profile,source)
            photo_run+=1
            max_photo_run=max(max_photo_run,photo_run)
            assert photo_run<=2,('three consecutive drone photographs',profile,s)
            used_photos.add(source)
        else:
            photo_run=0
            assert source.startswith('V'),('photo must be a drone photograph',source)
            interval=(s['at'],s['at']+s['duration']*s['rate'])
            assert abs(interval[1]-s['source_out'])<.00001,('unreviewed cut endpoint',profile,s['id'])
            assert interval[1]<=inventory[source]['duration'],('source ends before cut',profile,s['id'])
            for other in source_windows.get(source,[]):
                assert min(interval[1],other[1])-max(interval[0],other[0])<=.001,('repeated video frames',profile,source,interval,other)
            source_windows.setdefault(source,[]).append(interval)
            if next(shot['family'] for shot in edit['shots'] if shot['id']==s['id']).startswith('daylight'):
                event=events.get(source,source)
                assert event not in used_day_events,('same daylight effect replayed',profile,event)
                used_day_events.add(event)
        if profile=='wide':
            assert not any(k in s for k in ['panels','crop','contain']),('incomplete desktop frame',s)
    assert abs(cursor-edit['duration'])<.00001 and len(used_day_events)>=2
    report[profile]={'duration':edit['duration'],'frames':round(edit['duration']*edit['fps']),'scenes':len(scenes),'unique_drone_photos':len(used_photos),'distinct_day_events':len(used_day_events),'repeated_source_frames':0,'maximum_consecutive_photos':max_photo_run,'fireworks_stills':0}
(work/'edit-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
