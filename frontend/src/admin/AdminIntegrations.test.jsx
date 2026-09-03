import { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminIntegrations from './AdminIntegrations';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockRequest = jest.fn();

jest.mock('./AdminSessionContext', () => ({
  useAdminSession: () => ({ status: 'authenticated', request: mockRequest }),
}));

let root;
let container;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  root = null;
  container = null;
  mockRequest.mockReset();
});

test('renders only safe integration states and refreshes explicitly through the Admin session', async () => {
  mockRequest.mockResolvedValue({
    database: { configured: true, healthy: true, message: '' },
    blob: { configured: false, healthy: null, message: 'Necesită configurare' },
    google: { configured: true, healthy: null, message: 'Configurat' },
    facebook: { configured: true, healthy: false, message: 'Eroare temporară' },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => root.render(<AdminIntegrations />));

  expect(container.textContent).toContain('Baza de date');
  expect(container.textContent).toContain('Funcțional');
  expect(container.textContent).toContain('Necesită configurare');
  expect(container.textContent).toContain('Eroare temporară');
  expect(container.textContent).not.toContain('google-secret');

  await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent.includes('Verifică din nou')).click());
  expect(mockRequest).toHaveBeenNthCalledWith(1, '/api/admin/integrations');
  expect(mockRequest).toHaveBeenNthCalledWith(2, '/api/admin/integrations?refresh=1');
});
