const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const dir = path.join(repo, 'output/cinema-peaks-v7');
fs.mkdirSync(dir, { recursive: true });
const sources = JSON.parse(fs.readFileSync(path.join(repo, 'output/hero-cinema-audit/sources.json'), 'utf8'));
for (const [index, start] of [['28', 0], ['28', 190], ['10', 130]]) {
  const src = sources.find(x => x.index === index);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(start), '-i', src.file, '-t', '8', '-vf',
    "fps=1,scale=400:225:force_original_aspect_ratio=decrease,pad=400:248:(ow-iw)/2:0,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='" + index + " %{pts\\:flt} + " + start + "s':fontsize=16:fontcolor=white:x=6:y=229,tile=4x2",
    '-frames:v', '1', '-y', path.join(dir, 'select-' + index + '-' + start + '.jpg')], { stdio: 'pipe' });
  console.log(index, src.streams, src.format);
}
