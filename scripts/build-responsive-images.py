"""Build reviewable derivatives of immutable bundled photographs.

Requires Pillow with AVIF/WebP support. Originals and uploaded/versioned CMS
images are never overwritten. The manifest is the runtime allowlist.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public'
DEST = PUBLIC / 'media/responsive'
VERSION = '20261103'


def build_posters():
    for original in (PUBLIC / 'media/optimized').glob('spectacol-artificii-*.webp'):
        with Image.open(original) as image:
            target = original.with_name(original.stem.replace('20261102', VERSION) + '.avif')
            image.save(target, quality=65, speed=6, subsampling='4:2:0', max_threads=2)


def add_catalogue_versions(items):
    catalogue = json.loads((ROOT / 'frontend/src/data/importedGalleryItems.json').read_text(encoding='utf-8'))
    for item in catalogue:
        src = item.get('src', '')
        base, _, query = src.partition('?')
        if query == 'v=source-crop-20260828' and base in items:
            items[src] = items[base]


def derive(file):
    with Image.open(file) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        width, height = image.size
        variants = {'avif': [], 'webp': []}
        for size in sorted({min(640, width), min(1280, width), width}):
            frame = image if size == width else image.resize((size, round(height * size / width)), Image.Resampling.LANCZOS)
            formats = ['avif', 'webp'] if size < width else ['avif']
            for fmt in formats:
                target = DEST / f'{file.stem}-{size}-{VERSION}.{fmt}'
                if fmt == 'avif':
                    frame.save(target, quality=65, speed=6, subsampling='4:2:0', max_threads=2)
                else:
                    frame.save(target, quality=86, method=6)
                if target.stat().st_size < file.stat().st_size:
                    variants[fmt].append({'width': size, 'src': '/' + target.relative_to(PUBLIC).as_posix(), 'bytes': target.stat().st_size})
                else:
                    target.unlink()
        return '/' + file.relative_to(PUBLIC).as_posix(), {
            'width': width, 'height': height, 'bytes': file.stat().st_size,
            'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), **variants,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='Comma-separated original filenames for a quality trial')
    parser.add_argument('--posters-only', action='store_true')
    parser.add_argument('--catalogue-versions-only', action='store_true')
    args = parser.parse_args()
    if args.posters_only:
        build_posters()
        return
    manifest = ROOT / 'frontend/src/data/responsiveImages.json'
    if args.catalogue_versions_only:
        items = json.loads(manifest.read_text(encoding='utf-8'))
        add_catalogue_versions(items)
        manifest.write_text(json.dumps(items, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
        return
    DEST.mkdir(parents=True, exist_ok=True)
    files = []
    for file in sorted((PUBLIC / 'media').rglob('*.webp')):
        if file.parent.name not in ('gallery', 'media') or file.stem.startswith('promovare-'):
            continue
        if args.only and file.name not in args.only.split(','):
            continue
        with Image.open(file) as image:
            if image.width < 640 or image.height < 400 or image.mode not in ('RGB', 'L'):
                continue
        files.append(file)
    with ThreadPoolExecutor(max_workers=3) as pool:
        items = dict(pool.map(derive, files))
    # Only exact historical crops in the committed catalogue are aliases.
    # Other query strings can denote owner replacements.
    add_catalogue_versions(items)
    if args.only:
        manifest = ROOT / 'output/performance-2026-11-03/image-trial.json'
    manifest.write_text(json.dumps(items, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    if not args.only:
        build_posters()
    print(json.dumps({'photos': len(files), 'manifest': str(manifest), 'originalBytes': sum(v['bytes'] for k, v in items.items() if '?' not in k), 'avifBytes': sum(v['avif'][-1]['bytes'] if v['avif'] else v['bytes'] for k, v in items.items() if '?' not in k)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
