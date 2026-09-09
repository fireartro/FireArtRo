import { canPlayHeroVideo, selectHeroSource } from './heroPlayback';

test('uses the poster immediately when the browser cannot decode the bundled H264 hero', () => {
  const unsupported = { canPlayType: jest.fn(() => '') };
  expect(canPlayHeroVideo(unsupported)).toBe(false);
  expect(unsupported.canPlayType).toHaveBeenCalledWith('video/mp4; codecs="avc1.640028"');
});

const media = { src: '/fallback.mp4', av1Src: '/efficient.mp4', width: 1920, height: 1200 };
test.each([
  [true, true, true, '/efficient.mp4'],
  [true, true, false, '/fallback.mp4'],
  [true, false, true, '/fallback.mp4'],
  [false, false, false, '/fallback.mp4'],
])('selects AV1 only with supported, smooth, efficient decoding (%s/%s/%s)', async (supported, smooth, powerEfficient, expected) => {
  const navigatorLike = { mediaCapabilities: { decodingInfo: async config => {
    expect(config.video.width).toBe(1920);
    expect(config.video.height).toBe(1200);
    expect(config.video.framerate).toBe(24);
    return { supported, smooth, powerEfficient };
  } } };
  expect(await selectHeroSource(media, navigatorLike)).toBe(expected);
});

test('keeps the compatible source for old browsers, failed checks and custom videos', async () => {
  expect(await selectHeroSource(media, {})).toBe('/fallback.mp4');
  expect(await selectHeroSource(media, { mediaCapabilities: { decodingInfo: async () => { throw new Error('unsupported query'); } } })).toBe('/fallback.mp4');
  expect(await selectHeroSource({ src: '/custom.mp4' }, {})).toBe('/custom.mp4');
});

test('does not stall autoplay while waiting for a broken capability query', async () => {
  jest.useFakeTimers();
  try {
    const pending = selectHeroSource(media, { mediaCapabilities: { decodingInfo: () => new Promise(() => {}) } });
    jest.advanceTimersByTime(250);
    expect(await pending).toBe('/fallback.mp4');
  } finally { jest.useRealTimers(); }
});

test.each(['maybe', 'probably'])('keeps autoplay when the decoder reports %s support', (support) => {
  expect(canPlayHeroVideo({ canPlayType: () => support })).toBe(true);
});
