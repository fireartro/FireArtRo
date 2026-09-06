// The bundled variants are H264 High Profile, up to Level 4.0. Unsupported
// browsers should show the existing poster, not download the movie first.
export function canPlayHeroVideo(video) {
  return Boolean(video.canPlayType('video/mp4; codecs="avc1.640028"'));
}
