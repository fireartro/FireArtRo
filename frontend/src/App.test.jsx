import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

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

    mockContentStatus = 'ready';
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('Contact loaded');

    mockContentStatus = 'loading';
    await navigate('/');
    expect(mockLoadedPages).toEqual(['contact', 'home']);
    expect(container.querySelector('.route-loading').textContent).toBe('');
    expect(container.textContent).not.toContain('Homepage loaded');

    mockContentStatus = 'ready';
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('Homepage loaded');

    mockContentStatus = 'unavailable';
    await act(async () => root.render(<App />));
    expect(container.querySelector('[role="status"]').textContent).toContain('Revino în câteva momente');
    expect(container.textContent).not.toContain('Homepage loaded');
    await navigate('/admin');
    expect(container.textContent).toContain('Admin loaded');
    expect(mockLoadedPages).toEqual(['contact', 'home', 'admin']);
  } finally {
    await act(async () => root.unmount());
    window.history.replaceState({}, '', '/');
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
