"""Resolve the supplied camera files without copying them into Git."""
from pathlib import Path
import argparse,json,os,subprocess,zipfile

parser=argparse.ArgumentParser()
parser.add_argument('source_folder',type=Path)
args=parser.parse_args()
repo=Path(__file__).resolve().parents[2]
work=Path(os.environ.get('FIREART_HERO_WORKDIR',repo/'output/hero-rebuild')).resolve()
work.mkdir(parents=True,exist_ok=True)
sources=json.loads((Path(__file__).parent/'sources.json').read_text())
required=set(sources['videos'].values())
found={p.name:p for p in args.source_folder.rglob('*') if p.is_file() and p.name in required}
for archive in args.source_folder.glob('*.zip'):
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            filename=Path(entry.filename).name
            if filename not in required or filename in found:continue
            # Do not trust archive member paths. Write only selected basenames
            # into a checked workspace extraction directory.
            extraction=(work/'sources'/archive.stem).resolve()
            destination=(extraction/filename).resolve()
            if not destination.is_relative_to(work):raise ValueError('Unsafe archive path')
            extraction.mkdir(parents=True,exist_ok=True)
            if not destination.exists():destination.write_bytes(z.read(entry))
            found[filename]=destination
missing=required-set(found)
if missing:raise FileNotFoundError(', '.join(sorted(missing)))
videos=[]
for id,name in sources['videos'].items():
    path=found[name].resolve()
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
    stream=next(s for s in probe['streams'] if s['codec_type']=='video')
    videos.append({'id':id,'path':str(path),'duration':float(probe['format']['duration']),'stream':stream})
(work/'inventory.json').write_text(json.dumps({'videos':videos},indent=2))
(work/'drones.json').write_text(json.dumps([{'id':id,'path':str(repo/path)} for id,path in sources['drones'].items()],indent=2))
for profile in ['landscape','portrait']:
    root=work/profile
    if not (root/'hyperframes.json').exists():
        subprocess.run(['npx.cmd','--yes','hyperframes','init',str(root)],check=True)
print('Resolved',len(videos),'camera sources and',len(sources['drones']),'drone photos.')
