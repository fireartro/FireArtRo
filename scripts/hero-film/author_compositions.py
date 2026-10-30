from pathlib import Path
import json,urllib.request,subprocess
import os
R=Path(os.environ.get('FIREART_HERO_WORKDIR',Path(__file__).resolve().parents[2]/'output/hero-rebuild')).resolve()
edit=json.loads((R/'edit.json').read_text())
shots=edit['shots']
for profile,w,h in [('landscape',3840,2160),('portrait',2160,3840)]:
    root=R/profile
    gsap=root/'assets/gsap.min.js'
    if not gsap.exists(): urllib.request.urlretrieve('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js',gsap)
    hosts=[]
    for s in shots:
        spec=s['wide' if profile=='landscape' else 'portrait']
        if spec.get('omit'):continue
        photo=spec['src'].startswith('D'); ext='webp' if photo else 'mp4';kind='img' if photo else 'video'
        path=root/'assets'/f"{s['id']}.{ext}"
        if not path.exists(): continue
        if photo:
            from PIL import Image
            sw,sh=Image.open(path).size
        else:
            v=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',str(path)]))['streams'][0]
            sw,sh=v['width'],v['height']
        # Desktop accepts native panoramic sources only. No half-frame panels.
        if profile=='landscape':
            assert abs(sw/sh-16/9)<.015, f'Landscape source must be panoramic: {s["id"]} {sw}x{sh}'
        box='left:0;width:100%;'
        fit='cover'
        position=spec.get('position','center')
        sid=s['id'];d=spec.get('duration',s['duration']);t=spec.get('start',s['start'])
        media=f'<{kind} id="{sid}-media" src="assets/{sid}.{ext}" '+('alt="Spectacol real de drone FireArtRo"' if photo else f'class="clip" data-start="0" data-duration="{d}" data-track-index="0" muted playsinline preload="metadata"')+' />'
        if not photo: media=media[:-3]+'></video>'
        inner=f'<div id="{sid}-frame" class="photo-frame">{media}</div>' if photo else media
        # A bounded 2% photographic push preserves source detail and the formation.
        tween=f'tl.fromTo("#{sid}-frame",{{scale:1}},{{scale:1.02,duration:{d},ease:"none"}},0);' if photo else ''
        html=f'''<template>
<style>#root{{position:absolute;inset:0;overflow:hidden;background:#030407}}#{sid}-frame{{position:absolute;top:0;height:100%;{box}overflow:hidden}}#{sid}-media{{position:absolute;top:0;height:100%;{('left:0;width:100%;' if photo else box)}object-fit:{fit};object-position:{position};display:block}}</style>
<div id="root" data-composition-id="{sid}" data-duration="{d}" data-width="{w}" data-height="{h}">{inner}</div>
<script>const tl=gsap.timeline({{paused:true}});{tween}window.__timelines["{sid}"]=tl;</script>
</template>'''
        (root/'compositions'/f'{sid}.html').write_text(html,encoding='utf-8')
        hosts.append(f'<div id="{sid}" class="clip" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" data-start="{t}" data-duration="{d}" data-track-index="1" data-track-kind="graphics" data-width="{w}" data-height="{h}"></div>')
    html=f'''<!doctype html><html lang="ro"><head><meta charset="UTF-8"><script src="assets/gsap.min.js"></script><style>*{{box-sizing:border-box;margin:0}}html,body{{width:{w}px;height:{h}px;overflow:hidden;background:#030407}}#root{{position:relative;width:100%;height:100%}}.clip{{position:absolute;inset:0}}</style></head><body><main id="root" data-composition-id="main" data-duration="90" data-fps="30" data-width="{w}" data-height="{h}">{''.join(hosts)}</main><script>window.__timelines.main=gsap.timeline({{paused:true}});</script></body></html>'''
    (root/'index.html').write_text(html,encoding='utf-8')
    (root/'SPEC.md').write_text(f'''# FireArt hero revision\n\nTwo compositions, {w}x{h}, 30 fps, 2700 frames / 90 seconds. Three 900-frame chapters: night, daylight, drone and pyro. Original footage only. No audio: this is the existing muted website hero. No printed logos. Existing Romanian site typography stays as HTML above the film and follows video.currentTime. Sources and cuts: ../edit.json and ../inventory.json.\n\nNo blurred fill, no artificial fireworks, no stretch. Panoramic desktop sources fill the full frame. No portrait inserts, split screens or half-frame panels. Preserve the camera framing and the drone formation. Photographic motion limited to 2 percent. Review the ignition, widest burst and decay of each video; drone formation must remain recognizable.\n''',encoding='utf-8')
print('AUTHORED')
