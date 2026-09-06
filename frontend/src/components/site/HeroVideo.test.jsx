import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HeroVideo from './HeroVideo';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
const render = (element) => act(() => root.render(element));
const loadPoster = () => act(() => container.querySelector('img').dispatchEvent(new Event('load')));

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
