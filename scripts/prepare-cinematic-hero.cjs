const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
// The inventory contains local paths to the owner's originals, never secrets.
// Keep original footage and generated editing intermediates outside Git.
const projectRoot = path.resolve(__dirname, '../output/fireart-cinema');
const inventoryPath = process.argv[2] || path.resolve(__dirname, '../output/hero-cinema-audit/sources.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const shots = [
  { id: 'purple', index: '05', at: 35.1, length: 6.5, y: .78, x: .5 },
  { id: 'sky', index: '24', at: 79.7, length: 5, y: .35, x: .5 },
  { id: 'gold', index: '14', at: 74.9, length: 5, y: .54, x: .5 },
  { id: 'finale', index: '32', at: 139, length: 5.5, y: .5, x: .32 },
];
const speed = .75;
const dimensions = { landscape: [1920, 1080], portrait: [1080, 1920] };
for (const [profile, [width, height]] of Object.entries(dimensions)) {
  const root = path.join(projectRoot, profile);
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scenes'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../frontend/node_modules/gsap/dist/gsap.min.js'), path.join(root, 'assets/gsap.min.js'));
  for (const shot of shots) {
    const dest = path.join(root, 'assets', `${shot.id}.mp4`);
    if (!fs.existsSync(dest)) {
      const source = inventory.find(item => item.index === shot.index).file;
      const crop = `crop=w='min(iw,ih*${width}/${height})':h='min(ih,iw*${height}/${width})':x='(iw-ow)*${shot.x}':y='(ih-oh)*${shot.y}'`;
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(shot.at), '-i', source,
        '-an', '-vf', `setpts=(PTS-STARTPTS)/${speed},${crop},scale=${width}:${height}:flags=lanczos,fps=24,setsar=1`,
        '-t', String(shot.length), '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-g', '24', '-pix_fmt', 'yuv420p', '-threads', '4',
        '-map_metadata', '-1', '-movflags', '+faststart', '-y', dest], { stdio: 'inherit' });
      console.log(`${profile}/${shot.id} clean source prepared`);
    }
  }
  const edits = [
    { id: 'opening', media: 'purple', start: 0, length: 6, offset: .5 },
    { id: 'sky', media: 'sky', start: 5.5, length: 5, offset: 0 },
    { id: 'gold', media: 'gold', start: 10, length: 5, offset: 0 },
    { id: 'finale', media: 'finale', start: 14.5, length: 5.5, offset: 0 },
    { id: 'loop', media: 'purple', start: 19.5, length: .5, offset: 0 },
  ];
  for (const shot of edits) {
    fs.writeFileSync(path.join(root, 'scenes', `${shot.id}.html`), `<!doctype html><html><body><template>
<style>#root{position:absolute;inset:0;overflow:hidden}video{display:block;width:100%;height:100%;object-fit:cover}</style>
<div id="root" data-composition-id="${shot.id}" data-duration="${shot.length}" data-width="${width}" data-height="${height}">
<video class="clip" data-start="0" data-duration="${shot.length}" data-media-start="${shot.offset}" data-track-index="0" src="../assets/${shot.media}.mp4" muted playsinline preload="auto"></video>
</div><script>window.__timelines=window.__timelines||{};window.__timelines["${shot.id}"]=gsap.timeline({paused:true});</script>
</template></body></html>`);
  }
  fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=${width}, height=${height}">
<script src="assets/gsap.min.js"></script><style>*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#000}#root{position:relative;width:${width}px;height:${height}px}.scene{position:absolute;inset:0;width:100%;height:100%}</style></head><body>
<main id="root" data-composition-id="main" data-width="${width}" data-height="${height}" data-duration="20">
${edits.map((shot, i) => `<div id="${shot.id}-host" class="scene clip" data-composition-id="${shot.id}" data-composition-src="scenes/${shot.id}.html" data-start="${shot.start}" data-duration="${shot.length}" data-track-index="${i}" data-width="${width}" data-height="${height}"></div>`).join('\n')}
</main><script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});
${edits.slice(1).map(shot => `tl.fromTo('#${shot.id}-host',{opacity:0},{opacity:1,duration:.5,ease:'none'},${shot.start});`).join('\n')}
window.__timelines.main=tl;</script></body></html>`);
  fs.writeFileSync(path.join(root, 'hyperframes.json'), JSON.stringify({ width, height, fps: 24 }, null, 2));
  fs.writeFileSync(path.join(root, 'edit.json'), JSON.stringify({ profile, duration: 20, speed, shots, edits }, null, 2));
}
