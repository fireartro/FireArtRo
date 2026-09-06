import { canPlayHeroVideo } from './heroPlayback';

test('uses the poster immediately when the browser cannot decode the bundled H264 hero', () => {
  const unsupported = { canPlayType: jest.fn(() => '') };
  expect(canPlayHeroVideo(unsupported)).toBe(false);
  expect(unsupported.canPlayType).toHaveBeenCalledWith('video/mp4; codecs="avc1.640028"');
});

test.each(['maybe', 'probably'])('keeps autoplay when the decoder reports %s support', (support) => {
  expect(canPlayHeroVideo({ canPlayType: () => support })).toBe(true);
});
