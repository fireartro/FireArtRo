// Delivery-only optimization. Never changes the montage, titles or framing.
// Requires local FFmpeg with SVT-AV1 and libvmaf; masters stay in ignored output/.
// node scripts/optimize-kinetic-delivery.cjs --encode --promote
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const output = path.join(repo, 'output/fireart-cinema/delivery-owner-v4');
const profiles = { wide: [1920,1200], ultrawide: [1920,900], 'tablet-landscape': [1440,1080], 'tablet-portrait': [1080,1440], mobile: [720,1280], 'mobile-tall': [720,1560] };
const report = [];
fs.mkdirSync(output, { recursive: true });
const measure = (file, master) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-i', master, '-lavfi',
    '[0:v]settb=AVTB,setpts=N/(24*TB)[d];[1:v]settb=AVTB,setpts=N/(24*TB)[r];[d][r]libvmaf=n_threads=4',
    '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'], { encoding:'utf8', maxBuffer:8*1024*1024 });
  const score = Number(result.stderr.match(/VMAF score: ([\d.]+)/)?.[1]);
  if (result.status !== 0 || !Number.isFinite(score)) throw new Error('Quality measurement failed');
  return score;
};
const preserveCandidate = file => {
  const resolved = path.resolve(file);
  const staging = path.resolve(repo, 'output/fireart-cinema') + path.sep;
  if (!resolved.startsWith(staging)) throw new Error('Refusing to move an unstaged original');
  fs.renameSync(resolved, `${resolved}.rejected-${Date.now()}`);
};
for (const [profile, [width, height]] of Object.entries(profiles)) {
  const master = path.join(repo, 'output/fireart-cinema/kinetic-v4', profile, 'master.mp4');
  const filename = `fireart-hero-${profile}-av1.mp4`;
  const destination = path.join(output, filename);
  const compatible = path.join(repo, 'output/fireart-cinema/kinetic-v4', profile, `fireart-hero-${profile}.mp4`);
  const phone = profile.startsWith('mobile');
  let crf = ['wide', 'ultrawide'].includes(profile) ? 30 : phone ? 28 : 29;
  const preset = phone ? 3 : 4;
  // The compatibility fallback must meet the same clarity gate as AV1.
  const fallbackMetaPath = path.join(output, `${profile}-h264-quality.json`);
  let fallbackCrf = fs.existsSync(fallbackMetaPath) ? JSON.parse(fs.readFileSync(fallbackMetaPath)).crf : 24;
  let fallbackVmaf = measure(compatible, master);
  while (fallbackVmaf < 95 && process.argv.includes('--encode') && fallbackCrf > 18) {
    preserveCandidate(compatible);
    fallbackCrf -= 2;
    execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',master,'-an','-c:v','libx264','-preset','slow',
      '-crf',String(fallbackCrf),'-pix_fmt','yuv420p','-g','48','-threads','4','-map_metadata','-1','-movflags','+faststart','-n',compatible], {stdio:'inherit'});
    fallbackVmaf = measure(compatible, master);
    fs.writeFileSync(fallbackMetaPath, JSON.stringify({crf:fallbackCrf,vmaf:fallbackVmaf}));
  }
  if (fallbackVmaf < 95) throw new Error(`H264 clarity gate failed: ${profile} (${fallbackVmaf})`);
  if (process.argv.includes('--encode') && !fs.existsSync(destination)) {
    // -n refuses to overwrite an existing candidate. Preserve earlier encodes.
    execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',master,'-map','0:v:0','-an','-map_metadata','-1',
      '-c:v','libsvtav1','-crf',String(crf),'-preset',String(preset),'-svtav1-params','lp=4:tune=0','-g','96','-pix_fmt','yuv420p',
      '-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart','-n',destination], { stdio: 'inherit' });
  }
  const av1MetaPath = path.join(output, `${profile}-av1-quality.json`);
  if (fs.existsSync(av1MetaPath)) crf = JSON.parse(fs.readFileSync(av1MetaPath)).crf;
  let vmaf = measure(destination, master);
  while (vmaf < 95 && process.argv.includes('--encode') && crf > 20) {
    preserveCandidate(destination);
    crf -= 2;
    execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',master,'-map','0:v:0','-an','-map_metadata','-1',
      '-c:v','libsvtav1','-crf',String(crf),'-preset',String(preset),'-svtav1-params','lp=4:tune=0','-g','96','-pix_fmt','yuv420p',
      '-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart','-n',destination], {stdio:'inherit'});
    vmaf = measure(destination, master);
    fs.writeFileSync(av1MetaPath, JSON.stringify({crf,vmaf}));
  }
  const info = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',destination], { encoding: 'utf8' }));
  const video = info.streams[0];
  const bytes = fs.readFileSync(destination);
  const fallbackBytes = fs.statSync(compatible).size;
  if (info.streams.length !== 1 || video.codec_name !== 'av1' || video.pix_fmt !== 'yuv420p'
      || video.width !== width || video.height !== height || video.r_frame_rate !== '24/1'
      || Number(video.nb_frames) !== 768 || Math.abs(Number(info.format.duration) - 32) > .01) {
    throw new Error(`Invalid delivery metadata: ${profile}`);
  }
  const moov = bytes.indexOf(Buffer.from('moov'));
  const mdat = bytes.indexOf(Buffer.from('mdat'));
  if (moov < 0 || mdat < 0 || moov > mdat || bytes.length >= fallbackBytes) throw new Error(`Not streamable or not smaller: ${profile}`);
  if (vmaf < 95) throw new Error(`Quality gate failed: ${profile} (${vmaf})`);
  const row = { profile, width, height, seconds:32, frames:768, codec:'av1', crf, preset, bytes:bytes.length, fallbackBytes,
    reductionPercent:Number((100*(1-bytes.length/fallbackBytes)).toFixed(1)), vmaf, fallbackCrf, fallbackVmaf,
    sha256:crypto.createHash('sha256').update(bytes).digest('hex') };
  report.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(output, 'quality-report.json'), JSON.stringify(report, null, 2));
// Validate the entire set before promoting any candidate. H264 is unchanged.
if (process.argv.includes('--promote')) {
  for (const { profile } of report) {
    const filename = `fireart-hero-${profile}-av1.mp4`;
    fs.copyFileSync(path.join(output, filename), path.join(repo, 'frontend/public/media', filename));
  }
}
