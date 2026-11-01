"""Editorial acceptance: full timelines, distinct source moments, media types."""
from pathlib import Path
import json,os
repo=Path(__file__).resolve().parents[2]
work=Path(os.environ.get('FIREART_HERO_WORKDIR',repo/'output/hero-rebuild')).resolve()
edit=json.loads((work/'edit.json').read_text())
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
    cursor=0;used_photos=set();used_day_events=set();source_windows={};previous_photo=False
    for s in scenes:
        assert abs(s['start']-cursor)<1e-6,('gap or overlap',profile,s)
        cursor+=s['duration']
        assert abs(s['duration']*30-round(s['duration']*30))<1e-6
        source=s['src']
        if source.startswith('D'):
            assert source not in used_photos,('repeated photo',profile,source)
            assert not previous_photo,('consecutive drone photographs',profile,s)
            used_photos.add(source)
        else:
            assert source.startswith('V'),('photo must be a drone photograph',source)
            interval=(s['at'],s['at']+s['duration']*s['rate'])
            for other in source_windows.get(source,[]):
                assert min(interval[1],other[1])-max(interval[0],other[0])<=.001,('repeated video frames',profile,source,interval,other)
            source_windows.setdefault(source,[]).append(interval)
            if next(shot['family'] for shot in edit['shots'] if shot['id']==s['id']).startswith('daylight'):
                event=events.get(source,source)
                assert event not in used_day_events,('same daylight effect replayed',profile,event)
                used_day_events.add(event)
        previous_photo=source.startswith('D')
        if profile=='wide':
            assert not any(k in s for k in ['panels','crop','contain']),('incomplete desktop frame',s)
    assert cursor==90 and len(used_day_events)>=2
    report[profile]={'duration':90,'frames':2700,'scenes':len(scenes),'unique_drone_photos':len(used_photos),'distinct_day_events':len(used_day_events),'repeated_source_frames':0,'consecutive_photos':0,'fireworks_stills':0}
(work/'edit-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
