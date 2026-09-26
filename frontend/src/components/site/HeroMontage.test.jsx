import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HeroMontage from './HeroMontage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, originalWidth, originalHeight, originalVisibility;
const resize = (width, height) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  act(() => window.dispatchEvent(new Event('resize')));
};
const activate = () => {
  act(() => container.querySelector('img').dispatchEvent(new Event('load')));
  act(() => jest.advanceTimersByTime(2000));
};
const timeUpdate = (video, time) => {
  Object.defineProperty(video, 'duration', { configurable: true, value: 30 });
  video.currentTime = time;
  act(() => video.dispatchEvent(new Event('timeupdate')));
};

beforeEach(() => {
  jest.useFakeTimers();
  originalWidth = window.innerWidth;
  originalHeight = window.innerHeight;
  originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  resize(1200, 800);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  act(() => root.render(<HeroMontage />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  else delete document.visibilityState;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('loads only the first film after the poster, and preloads the next at 25 seconds', () => {
  expect(container.querySelector('video')).toBeNull();
  activate();
  const video = container.querySelector('video');
  expect(video.getAttribute('src')).toContain('wide-1.mp4');
  timeUpdate(video, 24.9);
  expect(container.querySelectorAll('video')).toHaveLength(1);
  timeUpdate(video, 25);
  expect([...container.querySelectorAll('video')].map(item => item.dataset.filmIndex)).toEqual(['0', '1']);
});

test('uses the loaded second film when the first finishes', async () => {
  activate();
  const first = container.querySelector('video');
  timeUpdate(first, 25);
  const next = container.querySelector('[data-film-index="1"]');
  Object.defineProperty(next, 'readyState', { configurable: true, value: 4 });
  await act(async () => first.dispatchEvent(new Event('ended')));
  expect(container.querySelectorAll('video')).toHaveLength(1);
  expect(container.querySelector('video').dataset.filmIndex).toBe('1');
  expect(container.querySelector('video').classList.contains('hero-montage__video--visible')).toBe(true);
});

test('switches format when a desktop window changes aspect ratio without changing width', () => {
  resize(1000, 800);
  expect(container.querySelector('img').getAttribute('src')).toContain('wide.webp');
  resize(1000, 1200);
  expect(container.querySelector('img').getAttribute('src')).toContain('portrait.webp');
});

test('does not restart a video on loadeddata after the page becomes hidden', () => {
  activate();
  const video = container.querySelector('video');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  HTMLMediaElement.prototype.play.mockClear();
  act(() => video.dispatchEvent(new Event('loadeddata')));
  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});
