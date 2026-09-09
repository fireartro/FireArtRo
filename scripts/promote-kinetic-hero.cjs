// Validate every staged deliverable before replacing any local public asset.
// This is not a deployment command and never calls Git or a hosting API.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const root = path.join(repo, 'output/fireart-cinema/kinetic-v3');
const profiles = { wide: [1920,1200], ultrawide: [1920,900], 'tablet-landscape': [1440,1080], 'tablet-portrait': [1080,1440], mobile: [720,1280], 'mobile-tall': [720,1560] };
const report = [];
for (const [profile, [width,height]] of Object.entries(profiles)) {
  const dir = path.join(root, profile);
  const name = `fireart-hero-${profile}`;
  const file = path.join(dir, name + '.mp4');
  const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',file], { encoding:'utf8' }));
  const stream = probe.streams[0];
  const data = fs.readFileSync(file);
  const poster = fs.readFileSync(path.join(dir, name + '.webp'));
  if (probe.streams.length !== 1 || stream.codec_name !== 'h264' || stream.pix_fmt !== 'yuv420p' || stream.width !== width || stream.height !== height || stream.r_frame_rate !== '24/1' || Number(stream.nb_frames) !== 768 || Math.abs(Number(probe.format.duration)-32) > .05) throw new Error(`Invalid video: ${profile}`);
  if (data.indexOf(Buffer.from('moov')) > data.indexOf(Buffer.from('mdat')) || data.length > 26*1048576) throw new Error(`Non-streamable or oversized video: ${profile}`);
  if (poster.toString('ascii',8,12) !== 'WEBP') throw new Error(`Invalid poster: ${profile}`);
  report.push({ profile, width, height, seconds:32, frames:768, bytes:data.length, posterBytes:poster.length, sha256:crypto.createHash('sha256').update(data).digest('hex') });
}
for (const { profile } of report) {
  for (const ext of ['mp4','webp']) {
    const name = `fireart-hero-${profile}.${ext}`;
    const source = path.join(root, profile, name);
    fs.copyFileSync(source, path.join(repo,'frontend/public/media',name));
    const build = path.join(repo,'frontend/build/media');
    if (fs.existsSync(build)) fs.copyFileSync(source, path.join(build,name));
  }
}
fs.writeFileSync(path.join(root,'delivery-report.json'), JSON.stringify(report,null,2));
console.table(report.map(({profile,width,height,bytes,posterBytes}) => ({profile,dimensions:`${width}x${height}`,MiB:(bytes/1048576).toFixed(2),posterKiB:(posterBytes/1024).toFixed(1)})));
