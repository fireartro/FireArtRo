import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import useReducedMotion from './useReducedMotion';

jest.mock('framer-motion', () => ({ useReducedMotion: () => true }));

test('keeps server nodes while applying reduced motion after hydration', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const Probe = () => <span>{useReducedMotion() ? 'reduced' : 'animated'}</span>;
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Probe />);
  const original = container.firstChild;
  const failures = [];
  let root;
  try {
    expect(original.textContent).toBe('animated');
    await act(async () => { root = hydrateRoot(container, <Probe />, { onRecoverableError: error => failures.push(error) }); });
    expect(container.firstChild).toBe(original);
    expect(original.textContent).toBe('reduced');
    expect(failures).toEqual([]);
  } finally {
    if (root) await act(async () => root.unmount());
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
