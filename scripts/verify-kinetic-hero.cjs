// Inspect every shot from all six local delivery profiles before promotion.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../output/fireart-cinema/kinetic-v7');
const profiles = ['wide', 'ultrawide', 'tablet-landscape', 'tablet-portrait', 'mobile', 'mobile-tall'];
const selectedProfiles = process.argv.slice(2);
if (selectedProfiles.some(profile => !profiles.includes(profile))) throw Error('Unknown delivery profile');
for (const profile of selectedProfiles.length ? selectedProfiles : profiles) {
  const dir = path.join(root, profile);
  const edit = JSON.parse(fs.readFileSync(path.join(dir, 'edit.json')));
  const video = path.join(dir, 'fireart-hero-' + profile + '.mp4');
  const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',video], { encoding: 'utf8' }));
  if (probe.streams.length !== 1 || +probe.streams[0].nb_frames !== 768) throw Error('Bad frame count: ' + profile);
  const selected = edit.shots.map(x => (x.start + x.end) / 2);
  const frames = [];
  for (const [i, stamp] of selected.entries()) {
    const dest = path.join(dir, 'review-' + String(i).padStart(2,'0') + '.jpg');
    execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-ss',String(stamp),'-i',video,'-frames:v','1','-vf',
      "scale=320:240:force_original_aspect_ratio=decrease,pad=320:266:(ow-iw)/2:0,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='" + edit.shots[i].id + " " + stamp.toFixed(1) + "s':fontsize=16:fontcolor=white:x=6:y=245",
      '-y',dest], { stdio: 'pipe' });
    frames.push(dest);
  }
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-i',path.join(dir,'review-%02d.jpg'),'-vf','tile=4x4','-frames:v','1','-y',path.join(dir,'review-sheet.jpg')], { stdio:'pipe' });
  console.log(profile + ': ' + probe.streams[0].width + 'x' + probe.streams[0].height + ', 768 frames, 32s; review sheet ready.');
}
