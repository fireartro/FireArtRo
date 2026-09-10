import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HeroVideo from './HeroVideo';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
const render = (element) => act(() => root.render(element));
const loadPoster = () => act(() => container.querySelector('img').dispatchEvent(new Event('load')));

test('can play verified efficient AV1 even when the H264 fallback is unsupported', async () => {
  jest.useFakeTimers();
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaCapabilities');
  Object.defineProperty(navigator, 'mediaCapabilities', { configurable: true, value: {
    decodingInfo: async () => ({ supported: true, smooth: true, powerEfficient: true }),
  } });
  try {
    await act(async () => root.render(<HeroVideo />));
    loadPoster();
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('video')?.getAttribute('src')).toContain('-av1.mp4');
  } finally {
    if (previous) Object.defineProperty(navigator, 'mediaCapabilities', previous);
    else delete navigator.mediaCapabilities;
  }
});

test('chooses a single efficient source before mounting video and can fall back on a decoder error', async () => {
  jest.useFakeTimers();
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, right: 1024, bottom: 768, width: 1024, height: 768 });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  const previous = Object.getOwnPropertyDescriptor(navigator, 'mediaCapabilities');
  let finish;
  Object.defineProperty(navigator, 'mediaCapabilities', { configurable: true, value: {
    decodingInfo: () => new Promise(resolve => { finish = resolve; }),
  } });
  try {
    render(<HeroVideo />);
    loadPoster();
    expect(container.querySelector('video')).toBeNull();
    await act(async () => finish({ supported: true, smooth: true, powerEfficient: true }));
    act(() => jest.advanceTimersByTime(2_000));
    let video = container.querySelector('video');
    expect(video.getAttribute('src')).toContain('-av1.mp4');
    act(() => video.dispatchEvent(new Event('error')));
    act(() => jest.advanceTimersByTime(2_000));
    video = container.querySelector('video');
    expect(video.getAttribute('src')).toContain('.mp4');
    expect(video.getAttribute('src')).not.toContain('-av1.mp4');
  } finally {
    if (previous) Object.defineProperty(navigator, 'mediaCapabilities', previous);
    else delete navigator.mediaCapabilities;
  }
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('shows the existing poster without mounting a video when H264 is unsupported', () => {
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
  render(<HeroVideo />);
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');
  expect(container.querySelector('img')?.style.objectFit).toBe('cover');
});

test('paints the poster before mounting a compatible desktop hero video', () => {
  jest.useFakeTimers();
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  render(<HeroVideo />);

  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')?.getAttribute('fetchpriority')).toBe('high');

  act(() => jest.advanceTimersByTime(2_000));
  expect(container.querySelector('video')).toBeNull();
  loadPoster();
  act(() => jest.advanceTimersByTime(2_000));
  expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
  expect(container.querySelector('video')?.style.objectFit).toBe('cover');
  expect(container.querySelector('img')).toBeNull();
});

test('preserves mobile autoplay after the poster loads', () => {
  jest.useFakeTimers();
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 412 });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  try {
    render(<HeroVideo />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
    loadPoster();
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  }
});

test('loads the new composition progressively after a desktop viewport becomes narrow', () => {
  jest.useFakeTimers();
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  try {
    render(<HeroVideo />);
    loadPoster();
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('video')).not.toBeNull();

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 412 });
    act(() => window.dispatchEvent(new Event('resize')));
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();

    loadPoster();
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  }
});

test('switches to the poster when reduced motion changes while the hero is open', () => {
  jest.useFakeTimers();
  const originalMatchMedia = window.matchMedia;
  let reduceMotion = false;
  let onChange;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      get matches() { return reduceMotion; },
      addEventListener: (_event, listener) => { onChange = listener; },
      removeEventListener: jest.fn(),
    })),
  });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  try {
    render(<HeroVideo />);
    loadPoster();
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('video')).not.toBeNull();

    reduceMotion = true;
    act(() => onChange(new Event('change')));
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  } finally {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  }
});

test('starts an admin supplied desktop video only after the poster has painted', () => {
  jest.useFakeTimers();
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
  render(<HeroVideo mediaOverride={{ type: 'video', src: '/custom.webm', poster: '/custom.webp' }} />);

  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')?.getAttribute('src')).toBe('/custom.webp');

  loadPoster();
  act(() => jest.advanceTimersByTime(2_000));
  expect(container.querySelector('video')?.getAttribute('src')).toBe('/custom.webm');
});

test('uses a non-autoplay custom video still when admin media has no poster', () => {
  jest.useFakeTimers();
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 412 });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  try {
    render(<HeroVideo mediaOverride={{ type: 'video', src: '/custom.webm', poster: '' }} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/custom.webm');
    expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(false);
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  }
});

test('honors data saver and updates when the connection preference changes', () => {
  jest.useFakeTimers();
  const originalConnection = Object.getOwnPropertyDescriptor(navigator, 'connection');
  const connection = new EventTarget();
  connection.saveData = true;
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  try {
    render(<HeroVideo />);
    loadPoster();
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('video')).toBeNull();
    connection.saveData = false;
    act(() => connection.dispatchEvent(new Event('change')));
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
  } finally {
    if (originalConnection) Object.defineProperty(navigator, 'connection', originalConnection);
    else delete navigator.connection;
  }
});

test('does not attach the bundled poster when a posterless admin video activates on desktop', () => {
  jest.useFakeTimers();
  const originalWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  try {
    render(<HeroVideo mediaOverride={{ type: 'video', src: '/custom.webm', poster: '' }} />);
    act(() => jest.advanceTimersByTime(2_000));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/custom.webm');
    expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
    expect(container.querySelector('video')?.getAttribute('poster')).toBeNull();
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  }
});

test('keeps the decoded mobile source when browser chrome changes only viewport height', () => {
  jest.useFakeTimers();
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 414 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 896 });
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  try {
    render(<HeroVideo />);
    loadPoster();
    act(() => jest.advanceTimersByTime(2_000));
    const video = container.querySelector('video');
    const source = video.getAttribute('src');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 780 });
    act(() => window.dispatchEvent(new Event('resize')));
    expect(container.querySelector('video')).toBe(video);
    expect(video.getAttribute('src')).toBe(source);
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
  }
});

test('does not start downloading the video until a background tab becomes visible', () => {
  jest.useFakeTimers();
  let visibility = 'hidden';
  jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  jest.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
  render(<HeroVideo />);
  loadPoster();
  act(() => jest.advanceTimersByTime(3_000));
  expect(container.querySelector('video')).toBeNull();
  visibility = 'visible';
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  act(() => jest.advanceTimersByTime(2_000));
  expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
});
