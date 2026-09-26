#!/usr/bin/env node
// Rebuild the six muted, browser-ready films from the owner's original video files.
// Usage: node scripts/build-hero-montage.mjs --source "C:\\path\\to\\Folder nou"
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDisplayDimensions, getPortraitFocusCrop } from './hero-media-geometry.mjs';

const frontendRoot = path.resolve(import.meta.dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'src/data/heroMontagePlan.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const sourceRoot = flag('--source');
if (!sourceRoot || !fs.existsSync(sourceRoot)) {
  throw new Error('Provide the original media directory with --source "path".');
}
const cacheRoot = process.env.FIREART_MEDIA_CACHE || path.join(os.tmpdir(), 'fireart-hero-montage-cache');
const outputRoot = path.join(frontendRoot, 'public/media');
fs.mkdirSync(cacheRoot, { recursive: true });
fs.mkdirSync(outputRoot, { recursive: true });
const formats = flag('--format') ? [flag('--format')] : ['wide', 'portrait'];
const selectedEpisode = flag('--episode') ? Number(flag('--episode')) - 1 : null;
const fps = 24;
const cacheRevision = { wide: 'v9', portrait: 'v8' };
const inventoryPath = flag('--live-inventory') || path.resolve(frontendRoot, '../output/hero-cinema-audit/sources.json');
const liveInventory = plan.sources.some(item => item.inventoryIndex !== undefined)
  ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) : [];
const bt709 = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function probe(file) {
  const result = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=width,height:stream_side_data=rotation',
    '-select_streams', 'v:0', '-of', 'json', file,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`Could not inspect ${file}: ${result.stderr}`);
  const data = JSON.parse(result.stdout);
  return { ...getDisplayDimensions(data.streams[0]), duration: Number(data.format.duration) };
}

function sourcePath(id) {
  const item = plan.sources[id];
  if (!item) throw new Error(`Unknown source ID ${id}`);
  if (item.inventoryIndex !== undefined) {
    const original = liveInventory.find(entry => entry.index === item.inventoryIndex);
    if (!original?.file || path.basename(original.file).toLowerCase() !== item.name.toLowerCase()) {
      throw new Error(`Missing or mismatched approved live original ${item.name} in ${inventoryPath}`);
    }
    return original.file;
  }
  if (!item.archive) return path.join(sourceRoot, item.name);
  const extracted = path.join(cacheRoot, item.archive, item.name);
  if (!fs.existsSync(extracted)) {
    const zip = path.join(sourceRoot, `${item.archive}.zip`);
    if (!fs.existsSync(zip)) throw new Error(`Missing archive ${zip}`);
    fs.mkdirSync(path.dirname(extracted), { recursive: true });
    run('tar', ['-xf', zip, '-C', path.dirname(extracted)]);
  }
  return extracted;
}

const sourceInfo = plan.sources.map((_, id) => {
  const file = sourcePath(id);
  if (!fs.existsSync(file)) throw new Error(`Missing video ${file}`);
  return { file, ...probe(file) };
});

// Check original display dimensions, including MOV rotation, before rendering.
// A landscape output file must never disguise portrait inputs in side-by-side panels.
for (const [format, episodes] of Object.entries(plan.episodes)) {
  const intervals = new Map();
  for (const episode of episodes) {
    if (Math.abs(episode.reduce((sum, scene) => sum + scene.duration, 0) - 30) > 0.001) {
      throw new Error(`${format} episode must last exactly 30 seconds`);
    }
    for (const scene of episode) {
      if (!['video', 'drone'].includes(scene.type) || scene.sources) throw new Error('Only one scene per frame is permitted');
      if (scene.type !== 'video') continue;
      const info = sourceInfo[scene.source];
      if (!info || plan.sources[scene.source].duplicateOf !== undefined) throw new Error('Duplicate or unknown original');
      if (format === 'wide' && (Math.abs(info.width / info.height - 16 / 9) > 0.02 || scene.focus)) {
        throw new Error(`Desktop requires a native 16:9 original: ${info.file}`);
      }
      const end = scene.start + scene.duration;
      if (scene.start < 0 || scene.duration <= 0 || end > info.duration + 0.05) throw new Error(`Invalid interval: ${info.file}`);
      const previous = intervals.get(scene.source) || [];
      if (previous.some(item => scene.start < item.end && end > item.start)) throw new Error(`Repeated scene: ${info.file}`);
      previous.push({ start: scene.start, end });
      intervals.set(scene.source, previous);
    }
  }
}

function portraitCrop(info) {
  const { baseWidth, baseHeight } = getPortraitFocusCrop(info, { zoom: 1, y: 0 });
  return `crop=${baseWidth}:${baseHeight}:(iw-${baseWidth})/2:(ih-${baseHeight})/2,`;
}

function dimensions(format) {
  return format === 'wide' ? [1920, 1080] : [1080, 1920];
}

function coverFilter(width, height, portraitSource = false, source = null, focus = null) {
  let crop = portraitSource ? portraitCrop(source) : '';
  if (focus && source) {
    const { baseWidth, baseHeight, width: zoomWidth, height: zoomHeight } = getPortraitFocusCrop(source, focus);
    crop = `crop=${baseWidth}:${baseHeight}:(iw-${baseWidth})/2:(ih-${baseHeight})/2,`
      + `crop=${zoomWidth}:${zoomHeight}:(iw-${zoomWidth})/2:(ih-${zoomHeight})*${focus.y},`;
  }
  return `${crop}fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},setsar=1,format=yuv420p,${bt709}`;
}

function encoderArgs(frameCount) {
  return [
    '-an', '-sn', '-dn', '-frames:v', String(frameCount), '-r', String(fps),
    '-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', '24',
    '-b:v', '0', '-maxrate', '6500k', '-bufsize', '13000k',
    '-g', '48', '-bf', '0', '-pix_fmt', 'yuv420p',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-video_track_timescale', '24000',
  ];
}

function renderScene(scene, format, file) {
  const [width, height] = dimensions(format);
  const frames = Math.round(scene.duration * fps);
  const base = ['-hide_banner', '-loglevel', 'error', '-y'];
  if (scene.type === 'video') {
    const info = sourceInfo[scene.source];
    if (scene.start + scene.duration > info.duration + 0.05) throw new Error(`Scene exceeds ${info.file}`);
    run('ffmpeg', [
      ...base, '-ss', String(scene.start), '-i', info.file,
      '-map', '0:v:0', '-vf', coverFilter(width, height, format === 'portrait' && info.height > info.width, info, format === 'portrait' ? scene.focus : null),
      ...encoderArgs(frames), file,
    ]);
    return;
  }
  if (scene.type === 'drone') {
    const image = path.join(frontendRoot, 'public', scene.image.replace(/^\//, ''));
    if (!fs.existsSync(image)) throw new Error(`Missing authentic drone photo ${image}`);
    if (format === 'wide' && probe(image).height > probe(image).width) throw new Error(`Desktop rejects a portrait photo: ${image}`);
    const overscanWidth = Math.ceil(width * 1.08 / 2) * 2;
    const overscanHeight = Math.ceil(height * 1.08 / 2) * 2;
    const filter = `scale=${overscanWidth}:${overscanHeight}:force_original_aspect_ratio=increase:flags=lanczos,crop=${overscanWidth}:${overscanHeight},zoompan=z='min(zoom+0.0005,1.08)':d=1:s=${width}x${height}:fps=${fps},setsar=1,format=yuv420p,${bt709}`;
    run('ffmpeg', [...base, '-loop', '1', '-framerate', String(fps), '-i', image, '-map', '0:v:0', '-vf', filter, ...encoderArgs(frames), file]);
    return;
  }
  throw new Error(`Unsupported scene ${JSON.stringify(scene)}`);
}

for (const format of formats) {
  if (!plan.episodes[format]) throw new Error(`Unknown format ${format}`);
  for (let episodeIndex = 0; episodeIndex < 3; episodeIndex++) {
    if (selectedEpisode !== null && episodeIndex !== selectedEpisode) continue;
    const episode = plan.episodes[format][episodeIndex];
    const sceneFiles = [];
    for (let sceneIndex = 0; sceneIndex < episode.length; sceneIndex++) {
      const scene = episode[sceneIndex];
      const file = path.join(cacheRoot, `hero-${cacheRevision[format]}-${format}-${episodeIndex + 1}-${sceneIndex + 1}.mp4`);
      if (!fs.existsSync(file) || probe(file).duration < scene.duration - 0.05) {
        process.stdout.write(`Rendering ${format} film ${episodeIndex + 1}, scene ${sceneIndex + 1}/${episode.length}\n`);
        renderScene(scene, format, file);
      }
      sceneFiles.push(file);
    }
    const concatFile = path.join(cacheRoot, `hero-${format}-${episodeIndex + 1}-concat.txt`);
    fs.writeFileSync(concatFile, sceneFiles.map(file => `file '${file.replaceAll('\\', '/')}'`).join('\n') + '\n');
    const output = path.join(outputRoot, `hero-film-${format}-${episodeIndex + 1}.mp4`);
    // Final web delivery pass: smaller H264 files, frequent seek points and MP4
    // metadata at the front, while preserving the full 1080p frame.
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concatFile,
      '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-threads', '6',
      '-maxrate', '5000k', '-bufsize', '10000k', '-profile:v', 'high', '-level:v', '4.0',
      '-pix_fmt', 'yuv420p', '-g', '48', '-movflags', '+faststart', output]);
    const actual = probe(output).duration;
    if (Math.abs(actual - 30) > 0.1) throw new Error(`${output} is ${actual}s, not 30s`);
    process.stdout.write(`Finished ${output} (${actual}s, ${(fs.statSync(output).size / 1048576).toFixed(1)} MiB)\n`);
    if (episodeIndex === 0) {
      const poster = path.join(outputRoot, `hero-film-${format}.webp`);
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '1', '-i', output, '-frames:v', '1', '-q:v', '80', poster]);
    }
  }
}
