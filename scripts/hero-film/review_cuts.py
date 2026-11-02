"""Review rendered ignition/midpoint/out frames and detect encoded frame holds."""
from pathlib import Path
import argparse, json, os, subprocess
from PIL import Image, ImageDraw, ImageStat

repo = Path(__file__).resolve().parents[2]
work = Path(os.environ.get('FIREART_HERO_WORKDIR', repo / 'output/hero-rebuild')).resolve()
parser = argparse.ArgumentParser()
parser.add_argument('--profile', choices=['landscape', 'portrait'], required=True)
parser.add_argument('--reuse-frames',action='store_true',help='Reuse only review frames newer than the unchanged master')
args = parser.parse_args()
key = 'wide' if args.profile == 'landscape' else 'portrait'
edit = json.loads((work / 'edit.json').read_text(encoding='utf-8'))
master = work / f'FireArt-{args.profile}-4K.mp4'
def fresh(path):
    return args.reuse_frames and path.exists() and path.stat().st_mtime>=master.stat().st_mtime
out = work / 'cut-review' / args.profile
out.mkdir(parents=True, exist_ok=True)
shots = [s for s in edit['shots'] if s[key]['src'].startswith('V') and not s[key].get('omit')]
sheet = Image.new('RGB', (2520, 180 * len(shots)), '#15191f')
draw = ImageDraw.Draw(sheet)
hashes = subprocess.check_output([
    'ffmpeg', '-nostdin', '-v', 'error', '-hwaccel', 'cuda', '-i', str(master),
    '-vf', 'scale=320:180', '-an', '-f', 'framemd5', '-'
], text=True)
hashes = [line.rsplit(',', 1)[1].strip() for line in hashes.splitlines() if not line.startswith('#')]
assert len(hashes) == round(edit['duration']*edit['fps']), len(hashes)
report = []
bright_endings=[]
for row, shot in enumerate(shots):
    spec = shot[key]
    start, duration = spec.get('start', shot['start']), spec.get('duration', shot['duration'])
    segment = hashes[round(start * 30):round((start + duration) * 30)]
    longest = run = 1
    for previous, current in zip(segment, segment[1:]):
        run = run + 1 if current == previous else 1
        longest = max(longest, run)
    assert longest <= 6, ('encoded freeze', key, shot['id'], longest)
    report.append({'shot': shot['id'], 'start': start, 'duration': duration,
                   'source_in': spec['at'], 'source_out': spec['source_out'],
                   'longest_identical_frame_run': longest})
    detail = Image.new('RGB', (1260, 900), '#15191f')
    detail_draw = ImageDraw.Draw(detail)
    sky_energy=[]
    for col, offset in enumerate([.06 + (duration - .12) * i / 8 for i in range(9)]):
        time = start + offset
        frame = out / f'{shot["id"]}-{col}.png'
        if not fresh(frame):
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-hwaccel', 'cuda', '-ss', str(time),
                            '-i', str(master), '-frames:v', '1', '-vf',
                            'scale=800:800:force_original_aspect_ratio=decrease', str(frame)], check=True)
        im = Image.open(frame)
        # V03 tilts down as its finale ends; its illuminated building reaches
        # the lower 45% of the frame. Compare the same real sky region throughout.
        sky_bottom=.55 if spec['src']=='V03' else .70
        sky=im.crop((0,0,im.width,round(im.height*sky_bottom))).convert('L')
        sky_energy.append(ImageStat.Stat(sky.point(lambda value:max(0,value-24))).mean[0])
        im.thumbnail((412, 266))
        detail.paste(im, (col % 3 * 420 + (420 - im.width) // 2, col // 3 * 300))
        detail_draw.text((col % 3 * 420 + 5, col // 3 * 300 + 273), f'{shot["id"]}  {time:.2f}s', fill='white')
        im.thumbnail((276, 154))
        sheet.paste(im, (col * 280 + (280 - im.width) // 2, row * 180))
        draw.text((col * 280 + 4, row * 180 + 158), f'{shot["id"]} {time:.2f}s', fill='white')
    detail.save(out / f'{shot["id"]}-nine-frames.jpg', quality=94)
    if not shot['family'].startswith('daylight'):
        ratio=sky_energy[-1]/max(max(sky_energy),.0001)
        report[-1]['night_tail_to_peak_brightness']=round(ratio,5)
        report[-1]['sky_roi_bottom']=sky_bottom
        if ratio>.15:bright_endings.append((shot['id'],round(ratio,5)))
        print(args.profile,shot['id'],'tail/peak',round(ratio,5),flush=True)
sheet.save(out / 'ignition-peak-decay.jpg', quality=94)
timeline = sorted([s[key].get('start', s['start']) for s in edit['shots'] if not s[key].get('omit')])
boundaries = sorted(set(timeline[1:] + edit['chapters'][1:-1]))
seams = Image.new('RGB', (1920, 205 * len(boundaries)), '#15191f')
seam_draw = ImageDraw.Draw(seams)
for row, boundary in enumerate(boundaries):
    for col, delta in enumerate([-.2, -.1, -1/30, 0, 1/30, .1]):
        time = boundary + delta
        frame = out / f'cut-{boundary:.2f}-{col}.jpg'
        if not fresh(frame):
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-hwaccel', 'cuda', '-ss', str(time),
                            '-i', str(master), '-frames:v', '1', '-vf',
                            'scale=640:640:force_original_aspect_ratio=decrease', str(frame)], check=True)
        im = Image.open(frame)
        im.thumbnail((316, 177))
        seams.paste(im, (col * 320 + (320 - im.width) // 2, row * 205))
        seam_draw.text((col * 320 + 4, row * 205 + 182), f'{boundary:.2f}s cut | {time:.3f}s', fill='white')
seams.save(out / 'six-frames-per-cut.jpg', quality=94)
(out / 'frame-holds.json').write_text(json.dumps(report, indent=2))
print(f'Reviewed {len(shots)*9} in-shot frames and {len(boundaries)*6} seam frames', flush=True)
print(json.dumps(report, indent=2))
assert not bright_endings,('night cuts before the sky darkens',bright_endings)
