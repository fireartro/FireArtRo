import React, { createRef, act } from 'react';
import { createRoot } from 'react-dom/client';
import HeroKineticTitles from './HeroKineticTitles';

global.IS_REACT_ACT_ENVIRONMENT = true;

let container, root, video;
beforeEach(() => {
  container = document.createElement('section');
  container.className = 'nr-hero';
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});
function mount(enabled = true, source = 'wide') {
  const ref = createRef();
  act(() => root.render(<><video ref={ref} /><HeroKineticTitles videoRef={ref} enabled={enabled} source={source} /></>));
  video = container.querySelector('video');
}
function seek(time) {
  video.currentTime = time;
  act(() => video.dispatchEvent(new Event('seeked')));
}
test('shows only the synchronized cue and clears it between phrases and on loop', () => {
  mount();
  const overlay = container.querySelector('.hero-kinetic');
  expect(overlay.getAttribute('aria-hidden')).toBe('true');
  seek(1);
  expect(overlay.querySelector('[data-cue="lift"]').style.visibility).toBe('visible');
  seek(8);
  expect(overlay.querySelector('[data-cue="lift"]').style.visibility).toBe('hidden');
  expect([...overlay.children].filter(node => node.style.visibility === 'visible').map(node => node.dataset.cue)).toEqual(['color']);
  seek(2.7);
  expect([...overlay.children].every(node => node.style.visibility === 'hidden')).toBe(true);
  seek(0);
  expect([...overlay.children].every(node => node.style.visibility === 'hidden')).toBe(true);
});

test('replaces each word at the shot cut and resynchronizes on a backwards seek', () => {
  mount();
  const overlay = container.querySelector('.hero-kinetic');
  for (const [time, activeCue] of [[7.3, 'color'], [9.5, 'rhythm'], [11.8, 'movement'], [8, 'color']]) {
    seek(time);
    expect([...overlay.children].filter(node => node.style.visibility === 'visible').map(node => node.dataset.cue)).toEqual([activeCue]);
  }
});
test('does not add titles over a poster, reduced-motion fallback or custom CMS media', () => {
  mount(false);
  expect(container.querySelector('.hero-kinetic')).toBeNull();
});

test('does not rewrite animated styles when the video has not advanced', () => {
  mount();
  seek(1);
  const lead = container.querySelector('[data-cue="lift"] .hero-kinetic__lead');
  const transform = jest.spyOn(lead.style, 'transform', 'set');
  seek(1);
  expect(transform).not.toHaveBeenCalled();
  seek(1.1);
  expect(transform).toHaveBeenCalled();
});
test('stops the animation clock when playback pauses and removes it on unmount', () => {
  let callback;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => { callback = fn; return 71; });
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  mount();
  Object.defineProperty(video, 'paused', { configurable: true, value: false });
  act(() => video.dispatchEvent(new Event('playing')));
  expect(callback).toEqual(expect.any(Function));
  act(() => video.dispatchEvent(new Event('pause')));
  expect(cancel).toHaveBeenCalledWith(71);
});
