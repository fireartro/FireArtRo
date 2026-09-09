import film from '../../data/heroFilm.json';

export function getHeroFilmCue(time) {
  if (!Number.isFinite(time) || time < 0) return null;
  const clock = time % film.duration;
  return film.cues.find(cue => clock >= cue.start && clock < cue.end) || null;
}

export function getHeroCuePose(cue, time, index = 0) {
  const elapsed = time - cue.start - index * .12;
  if (!Number.isFinite(elapsed) || elapsed < 0 || time >= cue.end) {
    return { opacity: 0, x: 0, y: 100, scale: 1, echo: 0 };
  }
  const progress = Math.min(1, elapsed / (index ? .22 : .32));
  const remaining = (1 - progress) ** 4;
  const mode = cue.motion || 'rise';
  return {
    opacity: 1,
    x: mode === 'slide' ? remaining * (index ? -75 : 75) : 0,
    y: mode === 'rise' ? remaining * (index ? 70 : 100) : 0,
    scale: mode === 'punch' || mode === 'stack' ? 1 + remaining * .38 : 1,
    echo: remaining,
  };
}

export function getHeroEchoPose(cue, time, row) {
  const elapsed = time - cue.start;
  const rank = Math.abs(row);
  if (cue.motion !== 'stack' || !Number.isFinite(elapsed) || elapsed < .3 || time >= cue.end) return {opacity:0,x:0,y:0};
  const progress = Math.max(0, Math.min(1, (elapsed - .3 - (rank - 1) * .08) / .32));
  const rest = (1 - progress) ** 4;
  return {opacity:progress > 0 ? rank === 2 ? .55 : .85 : 0, x:rest * row * 65, y:row * 86 * (1 - rest)};
}
