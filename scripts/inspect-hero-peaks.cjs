// Offline source review only; preserves the owner's originals.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const dir = path.join(repo, 'output/cinema-peaks-v7');
fs.mkdirSync(dir, { recursive: true });
const sources = JSON.parse(fs.readFileSync(path.join(repo, 'output/hero-cinema-audit/sources.json')));
const requested = process.argv.slice(2);
for (const index of requested.length ? requested : ['01', '10', '28', '29']) {
  const src = sources.find(x => x.index === index);
  const step = (Number(src.format.duration) - 10) / 24;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', src.file,
    '-vf', `fps=1/${step},scale=320:180,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${index} %{pts\\:hms}':fontsize=16:fontcolor=white:box=1:boxcolor=black:x=4:y=158,tile=6x4`,
    '-frames:v', '1', '-y', path.join(dir, `overview-${index}.jpg`)], { stdio: 'inherit' });
  console.log(`Reviewed source ${index}: ${path.join(dir, `overview-${index}.jpg`)}`);
}
