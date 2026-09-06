import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HeroVideo from './HeroVideo';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
const render = (element) => act(() => root.render(element));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });

test('shows the existing poster without mounting a video when H264 is unsupported', () => {
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
  render(<HeroVideo />);
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
});

test('preserves autoplay for compatible browsers', () => {
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  render(<HeroVideo />);
  expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
  expect(container.querySelector('img')).toBeNull();
});

test('does not apply the bundled H264 restriction to an admin supplied WebM', () => {
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
  render(<HeroVideo mediaOverride={{ type: 'video', src: '/custom.webm', poster: '/custom.webp' }} />);
  expect(container.querySelector('video')?.getAttribute('src')).toBe('/custom.webm');
});
