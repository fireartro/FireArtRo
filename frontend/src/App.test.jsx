import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { scrollToHash, scrollToTop } from '@/lib/scrollNavigation';

const mockLoadedPages = [];
let mockContentStatus = 'ready';
jest.mock('@/pages/Home', () => {
  mockLoadedPages.push('home');
  return () => <main>Homepage loaded</main>;
});

jest.mock('@/pages/ContactPage', () => {
  mockLoadedPages.push('contact');
  return () => <main>Contact loaded</main>;
});
jest.mock('@/pages/AdminPage', () => {
  mockLoadedPages.push('admin');
  return () => <main>Admin loaded</main>;
});
jest.mock('@/components/site/CookieConsent', () => () => null);
jest.mock('@/components/site/AnalyticsLoader', () => () => null);
jest.mock('@/components/night/RouteShutter', () => ({ children }) => children);
jest.mock('@/lib/scrollNavigation', () => ({
  scrollToHash: jest.fn(), scrollToTop: jest.fn(), syncScrollOffset: jest.fn(),
}));
jest.mock('@/content/ManagedContentProvider', () => ({
  ManagedContentProvider: ({ children }) => children,
  useManagedContentSnapshot: () => ({ status: mockContentStatus }),
}));

test('silently waits for published content while warming only the requested public route', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  const intro = { contentReady: jest.fn(), routeReady: jest.fn(), dismiss: jest.fn() };
  window.__fireartIntro = intro;
  const navigate = async path => {
    await act(async () => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  };

  try {
    window.history.replaceState({}, '', '/contact');
    mockContentStatus = 'loading';
    await act(async () => root.render(<App />));
    expect(container.querySelector('.route-loading').textContent).toBe('');
    expect(container.querySelector('.route-loading').getAttribute('aria-busy')).toBe('true');
    expect(container.textContent).not.toContain('Contact loaded');
    expect(mockLoadedPages).toEqual(['contact']);
    expect(intro.contentReady).not.toHaveBeenCalled();
    expect(intro.routeReady).not.toHaveBeenCalled();

    mockContentStatus = 'ready';
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('Contact loaded');
    expect(intro.contentReady).toHaveBeenCalled();
    expect(intro.routeReady).toHaveBeenCalledWith('/contact');

    mockContentStatus = 'loading';
    await navigate('/');
    expect(mockLoadedPages).toEqual(['contact', 'home']);
    expect(container.querySelector('.route-loading').textContent).toBe('');
    expect(container.textContent).not.toContain('Homepage loaded');

    mockContentStatus = 'ready';
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('Homepage loaded');
    expect(intro.routeReady).toHaveBeenCalledWith('/');

    mockContentStatus = 'unavailable';
    await act(async () => root.render(<App />));
    expect(container.querySelector('[role="status"]').textContent).toContain('Revino în câteva momente');
    expect(container.textContent).not.toContain('Homepage loaded');
    expect(intro.dismiss).toHaveBeenCalled();
    await navigate('/admin');
    expect(container.textContent).toContain('Admin loaded');
    expect(mockLoadedPages).toEqual(['contact', 'home', 'admin']);
  } finally {
    await act(async () => root.unmount());
    window.history.replaceState({}, '', '/');
    delete global.IS_REACT_ACT_ENVIRONMENT;
    delete window.__fireartIntro;
  }
});

test('aligns the current hash only after the startup overlay releases the document', async () => {
  jest.useFakeTimers();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement('div'));
  jest.clearAllMocks();
  mockContentStatus = 'ready';
  window.history.replaceState({}, '', '/#parteneri');
  document.documentElement.dataset.fireartIntro = 'loading';
  try {
    await act(async () => root.render(<App />));
    act(() => jest.advanceTimersByTime(90));
    expect(scrollToHash).not.toHaveBeenCalled();
    delete document.documentElement.dataset.fireartIntro;
    act(() => window.dispatchEvent(new Event('fireart:intro-dismissed')));
    expect(scrollToHash).toHaveBeenCalledWith('#parteneri', 'auto');
    expect(scrollToTop).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    scrollToHash.mockClear();
    window.dispatchEvent(new Event('fireart:intro-dismissed'));
    expect(scrollToHash).not.toHaveBeenCalled();
    delete document.documentElement.dataset.fireartIntro;
    window.history.replaceState({}, '', '/');
    delete global.IS_REACT_ACT_ENVIRONMENT;
    jest.useRealTimers();
  }
});
