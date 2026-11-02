"""Measure representative encode loss and show matched master/export frames."""
from pathlib import Path
import json, os, re, subprocess
from PIL import Image, ImageDraw

repo = Path(__file__).resolve().parents[2]
work = Path(os.environ.get('FIREART_HERO_WORKDIR', repo / 'output/hero-rebuild')).resolve()
out = work / 'compression-review'
out.mkdir(parents=True, exist_ok=True)
results = []
edit=json.loads((work/'edit.json').read_text())
for tag, profile in [('wide', 'landscape'), ('portrait', 'portrait')]:
    master = work / f'FireArt-{profile}-4K.mp4'
    frames = []
    for chapter, sample in [(1, 4.5), (2, 25.5), (3, 30)]:
        for suffix, width, height in ([('', 1920, 1080), ('-retina', 2560, 1440), ('-uhd', 3840, 2160)] if tag == 'wide'
                                      else [('', 1080, 1920), ('-retina', 1440, 2560)]):
            encoded = work / 'delivery' / f'hero-film-{tag}-{chapter}{suffix}.mp4'
            command = ['ffmpeg', '-nostdin', '-v', 'info', '-ss', str(sample), '-i', str(encoded),
                       '-ss', str(edit['chapters'][chapter-1] + sample), '-i', str(master),
                       '-filter_complex', f'[1:v]scale={width}:{height}:flags=lanczos,setsar=1[ref];[0:v]setsar=1[enc];[enc][ref]ssim',
                       '-frames:v', '90', '-an', '-f', 'null', '-']
            process = subprocess.run(command, capture_output=True, text=True)
            if process.returncode:
                raise RuntimeError(process.stderr[-3000:])
            match = re.search(r'All:([0-9.]+)', process.stderr)
            assert match, process.stderr[-1000:]
            score = float(match.group(1))
            results.append({'file': encoded.name, 'sample_seconds': [sample, sample+3], 'ssim': score})
            assert score >= .965, ('compression requires review', encoded.name, score)
            print(encoded.name, 'SSIM', score, flush=True)
            pair = []
            for name, source, stamp in [('master', master, edit['chapters'][chapter-1]+sample+1), ('export', encoded, sample+1)]:
                image = out / f'{encoded.stem}-{name}.png'
                subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-ss', str(stamp), '-i', str(source),
                                '-frames:v', '1', '-vf', f'scale={width}:{height}:flags=lanczos', str(image)], check=True)
                im = Image.open(image)
                # Exact same central pixels at the delivery's native resolution.
                left, top = (width-700)//2, (height-420)//2
                pair.append(im.crop((left, top, left+700, top+420)))
            frames.append((encoded.name, pair))
    sheet = Image.new('RGB', (1400, 450*len(frames)), '#15191f')
    draw = ImageDraw.Draw(sheet)
    for row, (name, pair) in enumerate(frames):
        for col, im in enumerate(pair):
            sheet.paste(im, (700*col, 450*row))
            draw.text((700*col+5, 450*row+425), f'{name}: {"master" if col==0 else "export"}', fill='white')
    sheet.save(out / f'{tag}-matched-detail.jpg', quality=96)
(out / 'ssim.json').write_text(json.dumps(results, indent=2))
