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
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
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

test('explicitly starts the next film when the browser only preloaded metadata', async () => {
  activate();
  const first = container.querySelector('video');
  timeUpdate(first, 25);
  const next = container.querySelector('[data-film-index="1"]');
  Object.defineProperty(next, 'readyState', { configurable: true, value: 1 });
  HTMLMediaElement.prototype.play.mockClear();
  await act(async () => first.dispatchEvent(new Event('ended')));
  expect(HTMLMediaElement.prototype.play.mock.instances).toContain(next);
  expect(container.querySelector('video').dataset.filmIndex).toBe('1');
});

test('starts loading the next film at EOF even when no preload timeupdate was delivered', async () => {
  activate();
  const first = container.querySelector('video');
  HTMLMediaElement.prototype.play.mockClear();
  await act(async () => first.dispatchEvent(new Event('ended')));
  expect(container.querySelectorAll('video')).toHaveLength(1);
  expect(container.querySelector('video').dataset.filmIndex).toBe('1');
  expect(HTMLMediaElement.prototype.play.mock.instances).toContain(container.querySelector('video'));
});

test('recovers when the next film play promise stays pending instead of freezing on the previous frame', async () => {
  activate();
  const first = container.querySelector('video');
  timeUpdate(first, 25);
  const next = container.querySelector('[data-film-index="1"]');
  let networkRecovered = false;
  HTMLMediaElement.prototype.play.mockImplementation(function play() {
    if (this === next && !networkRecovered) return new Promise(() => {});
    return Promise.resolve();
  });

  act(() => first.dispatchEvent(new Event('ended')));
  expect(container.querySelector('[data-film-index="0"]')).toBe(first);
  networkRecovered = true;
  await act(async () => jest.advanceTimersByTime(10000));

  expect(HTMLMediaElement.prototype.load.mock.instances).toContain(next);
  expect(container.querySelector('video').dataset.filmIndex).toBe('1');
});

test('keeps the current film when a preloaded film fails and retries that media element', async () => {
  activate();
  const first = container.querySelector('video');
  timeUpdate(first, 25);
  const next = container.querySelector('[data-film-index="1"]');
  await act(async () => next.dispatchEvent(new Event('error')));
  expect(container.querySelector('[data-film-index="0"]')).toBe(first);
  expect(container.querySelectorAll('video')).toHaveLength(2);
  act(() => jest.advanceTimersByTime(1000));
  expect(HTMLMediaElement.prototype.load.mock.instances).toContain(next);
  Object.defineProperty(next, 'readyState', { configurable: true, value: 4 });
  await act(async () => first.dispatchEvent(new Event('ended')));
  expect(container.querySelector('video').dataset.filmIndex).toBe('1');
});

test('recovers an active media error at the saved position instead of replaying the scene', async () => {
  activate();
  const first = container.querySelector('video');
  first.currentTime = 12;
  await act(async () => first.dispatchEvent(new Event('error')));
  expect(container.querySelector('video')).toBe(first);
  act(() => jest.advanceTimersByTime(1000));
  expect(HTMLMediaElement.prototype.load.mock.instances).toContain(first);
  first.currentTime = 0;
  act(() => first.dispatchEvent(new Event('loadedmetadata')));
  expect(first.currentTime).toBe(12);
});

test('plays all three films in order and loops with at most two media elements', async () => {
  activate();
  for (const index of [1, 2, 0, 1]) {
    const current = container.querySelector('video');
    timeUpdate(current, 25);
    expect(container.querySelectorAll('video')).toHaveLength(2);
    const next = container.querySelector(`[data-film-index="${index}"]`);
    Object.defineProperty(next, 'readyState', { configurable: true, value: 4 });
    await act(async () => current.dispatchEvent(new Event('ended')));
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('video')).toBe(next);
  }
});

test('cancels pending media retries when the player is unmounted', async () => {
  activate();
  const first = container.querySelector('video');
  timeUpdate(first, 25);
  const next = container.querySelector('[data-film-index="1"]');
  act(() => next.dispatchEvent(new Event('error')));
  act(() => root.unmount());
  root = createRoot(container);
  act(() => jest.advanceTimersByTime(10000));
  expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
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
