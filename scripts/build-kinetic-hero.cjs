// Local, reproducible edit from the owner's originals and published photographs.
// Never downloads stock, generates footage, publishes, or changes the originals.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const root = path.join(repo, 'output/fireart-cinema/kinetic-v7');
const inventory = JSON.parse(fs.readFileSync(path.join(repo, 'output/hero-cinema-audit/sources.json'), 'utf8'));
const profiles = {
  wide: [1920, 1200], ultrawide: [1920, 900],
  'tablet-landscape': [1440, 1080], 'tablet-portrait': [1080, 1440],
  mobile: [720, 1280], 'mobile-tall': [720, 1560],
};
const shots = [
  {
    "id": "rise",
    "start": 0,
    "end": 2.8,
    "index": "32",
    "at": 139,
    "portraitIndex": "32",
    "portraitAt": 139
  },
  {
    "id": "purple",
    "start": 2.8,
    "end": 5,
    "index": "01",
    "at": 33,
    "portraitIndex": "01",
    "portraitAt": 33
  },
  {
    "id": "face",
    "start": 5,
    "end": 7.3,
    "photo": "drone-show-baia-mare-img-5485-2",
    "portrait": "drone-show-baia-mare-img-5485-2"
  },
  {
    "id": "colour",
    "start": 7.3,
    "end": 9.5,
    "index": "27",
    "at": 5.1,
    "portraitIndex": "27",
    "portraitAt": 5.1
  },
  {
    "id": "gold",
    "start": 9.5,
    "end": 11.8,
    "index": "10",
    "at": 134.7,
    "portraitIndex": "10",
    "portraitAt": 134.7
  },
  {
    "id": "motion",
    "start": 11.8,
    "end": 13.8,
    "photo": "drone-show-adam-show-img-7638-3",
    "portrait": "drone-show-adam-show-img-7638-3"
  },
  {
    "id": "fan",
    "start": 13.8,
    "end": 16,
    "index": "10",
    "at": 98,
    "portraitIndex": "10",
    "portraitAt": 98
  },
  {
    "id": "night",
    "start": 16,
    "end": 18.5,
    "index": "01",
    "at": 58.3,
    "portraitIndex": "01",
    "portraitAt": 58.3
  },
  {
    "id": "spark",
    "start": 18.5,
    "end": 20.4,
    "index": "28",
    "at": 3,
    "portraitIndex": "28",
    "portraitAt": 3
  },
  {
    "id": "heart",
    "start": 20.4,
    "end": 22.8,
    "photo": "drone-show-baia-mare-img-5528-2",
    "portrait": "drone-show-baia-mare-img-5528-2"
  },
  {
    "id": "higher",
    "start": 22.8,
    "end": 25,
    "index": "28",
    "at": 190.5,
    "portraitIndex": "28",
    "portraitAt": 190.5
  },
  {
    "id": "together",
    "start": 25,
    "end": 27.2,
    "photo": "drone-show-baia-mare-img-5527-2",
    "portrait": "drone-show-baia-mare-img-5527-2"
  },
  {
    "id": "finale",
    "start": 27.2,
    "end": 32,
    "index": "29",
    "at": 132.3,
    "portraitIndex": "29",
    "portraitAt": 132.3
  }
];
const args = process.argv.slice(2);
const selected = args.find(arg => arg.startsWith('--profiles='))?.split('=')[1].split(',') || Object.keys(profiles);
if (selected.some(profile => !profiles[profile])) throw new Error('Unknown profile');
const run = (exe, argv, options = {}) => execFileSync(exe, argv, { stdio: 'inherit', ...options });
const ffmpeg = argv => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...argv]);
const verifiedSources = new Map();
const verifySource = src => {
  if (verifiedSources.has(src)) return verifiedSources.get(src);
  const { streams } = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_streams', '-of', 'json', src], { encoding: 'utf8' }));
  const stream = streams[0];
  const rotation = stream.side_data_list?.find(item => item.rotation !== undefined)?.rotation || 0;
  if (Math.abs(rotation) % 180 || Math.abs(stream.width / stream.height - 16 / 9) >= .005 || stream.width < 1800) {
    throw new Error(`Requires a high-resolution landscape 16:9 original: ${src}`);
  }
  const info = { width: stream.width, height: stream.height, rotation };
  verifiedSources.set(src, info);
  return info;
};
for (const profile of selected) {
  const [width, height] = profiles[profile];
  const portrait = height > width;
  const dir = path.join(root, profile);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scenes'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'frontend/node_modules/gsap/dist/gsap.min.js'), path.join(dir, 'assets/gsap.min.js'));
  if (args.includes('--refresh')) {
    for (const name of ['master.mp4', `fireart-hero-${profile}.mp4`, `fireart-hero-${profile}.webm`]) {
      const target = path.resolve(dir, name);
      if (!target.startsWith(root + path.sep)) throw new Error('Unsafe generated-file target');
      if (fs.existsSync(target)) fs.renameSync(target, `${target}.previous-${Date.now()}`);
    }
  }
  const manifest = [];
  for (const [i, shot] of shots.entries()) {
    const duration = Number((shot.end - shot.start).toFixed(3));
    const src = shot.photo
      ? path.join(repo, 'frontend/public/media/gallery', `fireartro-${portrait ? shot.portrait : shot.photo}.webp`)
      : inventory.find(item => item.index === (portrait ? shot.portraitIndex : shot.index))?.file;
    if (!src || !fs.existsSync(src)) throw new Error(`Missing source for ${shot.id}: ${src}`);
    const sourceInfo = verifySource(src);
    const ext = shot.photo ? 'webp' : 'mp4';
    const asset = `${shot.id}.${ext}`;
    const assetPath = path.join(dir, 'assets', asset);
    if (shot.photo) fs.copyFileSync(src, assetPath);
    else if (!fs.existsSync(assetPath)) {
      // Only landscape 16:9 originals; portrait exports crop these same originals.
      const fit = `scale=${width}:${height}:force_original_aspect_ratio=increase:force_divisible_by=2:flags=lanczos,crop=${width}:${height}`;
      ffmpeg(['-ss', String(portrait ? shot.portraitAt : shot.at), '-i', src, '-t', String(duration), '-an', '-vf', `${fit},fps=24,setsar=1`,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-g', '24', '-pix_fmt', 'yuv420p', '-threads', '4', '-map_metadata', '-1', '-movflags', '+faststart', '-y', assetPath]);
    }
    const media = shot.photo
      ? `<img id="${shot.id}-media" class="clip" data-start="0" data-duration="${duration}" data-track-index="0" src="../assets/${asset}" alt="Fotografie originală FireArtRo">`
      : `<video id="${shot.id}-media" class="clip" data-start="0" data-duration="${duration}" data-media-start="0" data-track-index="0" src="../assets/${asset}" muted playsinline preload="auto"></video>`;
    // Only a camera move over the photograph: no invented drone movement.
    const scaleFrom = i % 2 ? 1.035 : 1;
    const scaleTo = i % 2 ? 1 : 1.035;
    fs.writeFileSync(path.join(dir, 'scenes', `${shot.id}.html`), `<!doctype html><html><body><template>
<style>#scene{position:absolute;inset:0;overflow:hidden;background:#020305}.camera{position:absolute;inset:0;transform-origin:50% 50%;display:flex;align-items:center;justify-content:center}img,video{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 50%}</style>
<section id="scene" data-composition-id="${shot.id}" data-duration="${duration}" data-width="${width}" data-height="${height}"><div class="camera" data-layout-allow-overflow>${media}</div></section>
<script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});
${shot.photo ? `tl.fromTo('.camera',{scale:${scaleFrom}},{scale:${scaleTo},duration:${duration},ease:'none'},0);` : ''}
window.__timelines['${shot.id}']=tl;</script></template></body></html>`);
    manifest.push({ ...shot, source: path.relative(repo, src), sourceInfo, duration, asset });
  }
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html lang="ro"><head><meta charset="utf-8"><script src="assets/gsap.min.js"></script>
<style>*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#020305}#film{position:relative;width:${width}px;height:${height}px}.scene{position:absolute;inset:0;width:100%;height:100%}</style></head><body>
<main id="film" data-composition-id="main" data-width="${width}" data-height="${height}" data-duration="32" data-fps="24">
${manifest.map((shot, i) => `<div id="${shot.id}-host" class="scene clip" data-composition-id="${shot.id}" data-composition-src="scenes/${shot.id}.html" data-start="${shot.start}" data-duration="${shot.duration}" data-track-index="${i}" data-width="${width}" data-height="${height}"></div>`).join('\n')}
</main><script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});window.__timelines.main=tl;</script></body></html>`);
  fs.writeFileSync(path.join(dir, 'hyperframes.json'), JSON.stringify({ width, height, fps: 24 }, null, 2));
  fs.writeFileSync(path.join(dir, 'edit.json'), JSON.stringify({ duration: 32, fps: 24, width, height, profile, shots: manifest }, null, 2));
  console.log(`Prepared ${profile}: ${width}x${height}, 32 seconds, ${manifest.length} shots.`);
  if (!args.includes('--render')) continue;
  const master = path.join(dir, 'master.mp4');
  if (!fs.existsSync(master)) {
    const result = spawnSync('npx.cmd', ['--yes', 'hyperframes@0.8.36', 'render', dir, '--output', master, '--fps', '24', '--quality', 'high', '--crf', '17', '--workers', '2'], { stdio: 'inherit', shell: true });
    if (result.status !== 0) throw new Error(`HyperFrames failed for ${profile}`);
  }
  const delivery = path.join(dir, `fireart-hero-${profile}.mp4`);
  if (!fs.existsSync(delivery) || args.includes('--reencode')) ffmpeg(['-i', master, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-g', '48', '-threads', '4', '-map_metadata', '-1', '-movflags', '+faststart', '-y', delivery]);
  ffmpeg(['-ss', '0.08', '-i', delivery, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '86', '-y', path.join(dir, `fireart-hero-${profile}.webp`)]);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', delivery], { encoding: 'utf8' }));
  if (probe.streams.length !== 1 || probe.streams[0].width !== width || probe.streams[0].height !== height || Math.abs(Number(probe.format.duration) - 32) > .05) throw new Error(`Invalid export: ${profile}`);
  fs.writeFileSync(path.join(dir, 'export.json'), JSON.stringify(probe, null, 2));
  console.log(`FINISHED ${profile}: ${(fs.statSync(delivery).size / 1048576).toFixed(2)} MiB`);
}
