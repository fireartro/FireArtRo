import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';
import AdminReviews from './AdminReviews';

const mockRequest = jest.fn();
const mockUpdate = jest.fn();
let mockDraft;
let mockPublication;

jest.mock('./AdminSessionContext', () => ({
  useAdminSession: () => ({ request: mockRequest }),
}));
jest.mock('./AdminDraftContext', () => ({
  useAdminDraft: () => ({ draft: mockDraft, publishedContent: mockPublication, update: mockUpdate, errors: [] }),
}));

let root;
let container;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockDraft = CMS_DEFAULTS;
  mockPublication = CMS_DEFAULTS;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mockUpdate.mockReset();
  mockRequest.mockReset();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const getButton = (name) => [...container.querySelectorAll('button')].find(button => button.textContent.trim() === name);

test('opens on the public settings and keeps the manual records in a separate archive', async () => {
  const openPreview = jest.fn();
  await act(async () => root.render(<AdminReviews onPreview={openPreview} />));
  expect(container.querySelector('input[name="reviewSettings.facebookEnabled"]')).not.toBeNull();
  expect(container.querySelector('input[name="testimonials.0.name"]')).toBeNull();
  expect(container.querySelector('a[href="/#recenzii"]')).not.toBeNull();
  expect(container.querySelector('[data-review-source="facebook"]').textContent).toContain('Elfsight');
  expect(mockRequest).not.toHaveBeenCalled();

  await act(async () => getButton('Previzualizează recenziile').click());
  expect(openPreview).toHaveBeenCalledTimes(1);
  await act(async () => container.querySelector('input[name="reviewSettings.facebookEnabled"]').click());
  expect(mockUpdate).toHaveBeenCalledWith('reviewSettings.facebookEnabled', !CMS_DEFAULTS.reviewSettings.facebookEnabled);

  await act(async () => getButton(`Arhivă manuală (${CMS_DEFAULTS.testimonials.length})`).click());
  expect(container.querySelector('input[name="testimonials.0.name"]').value).toBe(CMS_DEFAULTS.testimonials[0].name);
  expect(container.querySelector('input[name="reviewSettings.facebookEnabled"]')).toBeNull();
});

test('distinguishes published display, draft changes, missing setup and verified API errors', async () => {
  mockDraft = { ...CMS_DEFAULTS, reviewSettings: { ...CMS_DEFAULTS.reviewSettings, facebookEnabled: false } };
  mockPublication = { reviewSettings: { ...CMS_DEFAULTS.reviewSettings, enabled: true, facebookEnabled: true } };
  mockRequest.mockResolvedValue({
    facebook: { configured: false, healthy: null },
    google: { configured: true, healthy: false, message: 'Furnizorul nu răspunde.' },
  });
  await act(async () => root.render(<AdminReviews />));
  const facebook = container.querySelector('[data-review-source="facebook"]');
  const google = container.querySelector('[data-review-source="google"]');
  expect([...facebook.querySelectorAll('dd')].map(node => node.textContent)).toEqual(['Permisă', 'Oprită']);
  expect(facebook.textContent).toContain('Stare neverificată.');
  expect(mockRequest).not.toHaveBeenCalled();
  await act(async () => getButton('Verifică sursele API').click());
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(mockRequest).toHaveBeenCalledWith('/api/admin/integrations?refresh=1');
  expect(facebook.textContent).toContain('Necesită configurare');
  expect(google.textContent).toContain('Eroare de conectare');
});

test('reports a failed diagnostics request without changing the draft', async () => {
  mockRequest.mockRejectedValueOnce(new Error('Unavailable'));
  await act(async () => root.render(<AdminReviews />));
  await act(async () => getButton('Verifică sursele API').click());
  expect(container.querySelector('[role="alert"]').textContent).toContain('Starea surselor nu este disponibilă');
  expect(getButton('Verifică sursele API').disabled).toBe(false);
  expect(mockUpdate).not.toHaveBeenCalled();
  mockRequest.mockResolvedValueOnce({ google: { configured: true, healthy: true } });
  await act(async () => getButton('Verifică sursele API').click());
  expect(container.querySelector('[data-review-source="google"]').textContent).toContain('Conectat');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
