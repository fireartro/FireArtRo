"""Create smaller, compatible hero renditions without changing source films.

Pass --skill-dir pointing at the local ffmpeg-skill package. All encodes run
through its probe/export/fit/check tools, including identity verification.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public/media'
WORK = ROOT / 'output/performance-2026-11-03'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skill-dir', required=True, type=Path)
    args = parser.parse_args()
    WORK.mkdir(parents=True, exist_ok=True)

    def run(tool, *params):
        result = subprocess.run([sys.executable, str(args.skill_dir / 'scripts' / f'{tool}.py'), *map(str, params), '--json'], capture_output=True, text=True, encoding='utf-8')
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        return json.loads(result.stdout)

    report = []
    for tag, name in [('portrait', 'portret'), ('wide', 'panoramic')]:
        for index in range(1, 4):
            original = PUBLIC / f'hero-film-{tag}-{index}.mp4'
            before = run('probe', original)
            duration = before['duration']
            normal = PUBLIC / f'film-spectacol-{name}-{index}-hd-20261103.mp4'
            light = PUBLIC / f'film-spectacol-{name}-{index}-usor-20261103.mp4'
            intermediate = WORK / f'{tag}-{index}-720p.mp4'
            if not normal.exists():
                plan = run('export', original, '--preset', 'youtube', '--no-scale', '--crf', '29', '-o', normal, '--dry-run')
                (WORK / f'{tag}-{index}-hd-plan.json').write_text(json.dumps(plan, indent=2), encoding='utf-8')
                run('export', original, '--preset', 'youtube', '--no-scale', '--crf', '29', '-o', normal)
            if not light.exists():
                if not intermediate.exists():
                    run('fit', original, '--height', '1280' if tag == 'portrait' else '720', '--codec', 'h264', '--quality', '22', '-o', intermediate)
                # About 1.2 Mbps, leaving bandwidth for the page on slow 4G.
                # Preserve more face and colored-trail detail in this chapter.
                budget = round(duration * (0.175 if tag == 'portrait' and index == 2 else 0.15), 2)
                run('export', intermediate, '--preset', 'youtube', '--no-scale', '--max-mb', budget, '-o', light, '--dry-run')
                run('export', intermediate, '--preset', 'youtube', '--no-scale', '--max-mb', budget, '-o', light)
            for quality, file in [('hd', normal), ('light', light)]:
                after = run('probe', file)
                assert abs(after['duration'] - duration) < 0.04
                assert after['video']['fps'] == before['video']['fps']
                assert after['size_bytes'] < before['size_bytes']
                assert after['video']['codec'] == 'h264' and after['video']['pix_fmt'] == 'yuv420p'
                comparison = run('check', file, '--platform', 'custom', '--no-loudness', '--compare', original if quality == 'hd' else intermediate)
                (WORK / f'{tag}-{index}-{quality}-quality.json').write_text(json.dumps(comparison, indent=2), encoding='utf-8')
                report.append({'source': original.name, 'file': file.name, 'quality': quality, 'originalBytes': before['size_bytes'], 'bytes': after['size_bytes'], 'duration': duration, 'width': after['video']['width'], 'height': after['video']['height'], 'fps': after['video']['fps'], 'similarity': next(r for r in comparison['checks'] if r['check'] == 'similarity')})
            (WORK / 'video-delivery-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            print(f'Built {tag} film {index}', flush=True)


if __name__ == '__main__':
    main()
