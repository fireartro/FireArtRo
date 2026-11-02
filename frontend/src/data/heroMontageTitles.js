import films from './heroMontageTitles.json';

// Each orientation follows its own reviewed cuts; stable objects keep the
// video-clock listener mounted when React updates unrelated player state.
const variants = Object.fromEntries(['wide', 'portrait'].map(format => [format,
  films.map(film => ({
    ...film,
    cues: film.cues.map(({ wide, ...cue }) => ({ ...cue, ...(format === 'wide' ? wide : {}) })),
  })),
]));

export const selectHeroMontageTitles = (index, format) => variants[format][index];
