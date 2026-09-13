const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const script = fs.readFileSync(path.join(__dirname, 'build-kinetic-hero.cjs'), 'utf8');
const edit = JSON.parse(script.match(/const shots = (\[[\s\S]*?\n\]);/)[1]);
test('the opening footage appears once per complete film, including portrait playback', () => {
  for (const field of ['index', 'portraitIndex']) {
    const opening = edit[0][field];
    assert.equal(edit.filter(shot => shot[field] === opening).length, 1,
      `Opening source repeated in ${field}: ${edit.filter(shot => shot[field] === opening).map(shot => shot.id).join(', ')}`);
  }
});
test('the montage never replays a source time range internally', () => {
  for (const [index, at] of [['index', 'at'], ['portraitIndex', 'portraitAt']]) {
    const videos = edit.filter(shot => shot[index]);
    for (const [i, a] of videos.entries()) {
      for (const b of videos.slice(i + 1).filter(b => b[index] === a[index])) {
        assert.ok(a[at] + a.end - a.start <= b[at] + .0001 || b[at] + b.end - b.start <= a[at] + .0001,
          `Replayed source ${a[index]}: ${a.id} and ${b.id}`);
      }
    }
  }
});
test('every cinematic scene is full bleed without black padding or zooming below one', () => {
  assert.match(script, /force_original_aspect_ratio=increase/);
  assert.match(script, /object-fit:cover/);
  assert.doesNotMatch(script, /object-fit:contain|force_original_aspect_ratio=decrease|pad=|0\.97/);
});
test('every selected original is landscape 16:9, including sources used on phones', () => {
  const repo = path.resolve(__dirname, '..');
  const inventory = JSON.parse(fs.readFileSync(path.join(repo, 'output/hero-cinema-audit/sources.json')));
  const shots = JSON.parse(script.match(/const shots = (\[[\s\S]*?\n\]);/)[1]);
  const sources = new Set(shots.flatMap(shot => shot.photo
    ? [shot.photo, shot.portrait].filter(Boolean).map(name => path.join(repo, 'frontend/public/media/gallery', `fireartro-${name}.webp`))
    : [shot.index, shot.portraitIndex].filter(Boolean).map(index => inventory.find(item => item.index === index).file)));
  for (const file of sources) {
    const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-select_streams','v:0','-show_streams','-of','json',file]));
    const stream = probe.streams[0];
    const rotation = stream.side_data_list?.find(item => item.rotation !== undefined)?.rotation || 0;
    assert.equal(Math.abs(rotation) % 180, 0, `Rotated portrait source: ${file}`);
    assert.ok(Math.abs(stream.width / stream.height - 16 / 9) < .005, `Not a 16:9 landscape original: ${file}`);
    assert.ok(stream.width >= 1800, `Insufficient source resolution: ${file}`);
  }
});
test('the revised film uses separate delivery staging and does not repeat homepage photographs', () => {
  assert.match(script, /kinetic-v7/);
  for (const reserved of ['artificii-noapte-spectacol-110', 'artificii-noapte-spectacol-070', 'artificii-zi-spectacol-003', 'artificii-zi-spectacol-008', 'nunta-spectacol-019', 'mastercard-img-5103', 'baia-mare-img-5524-2']) {
    assert.ok(!script.includes(reserved), 'Repeated photograph: ' + reserved);
  }
});
test('the only still photographs in the film depict drone formations', () => {
  const shots = JSON.parse(script.match(/const shots = (\[[\s\S]*?\n\]);/)[1]);
  assert.ok(shots.filter(x => x.photo).length >= 3);
  for (const shot of shots) {
    if (shot.photo) {
      assert.ok(shot.photo.startsWith('drone-show-'));
      assert.ok(shot.portrait.startsWith('drone-show-'));
    } else {
      assert.ok(shot.index && shot.portraitIndex);
    }
  }
});
