import { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminMediaLibrary, { MediaCard } from './AdminMediaLibrary';
import { useAdminSession } from './AdminSessionContext';
import { useAdminDraft } from './AdminDraftContext';

jest.mock('./AdminSessionContext', () => ({ useAdminSession: jest.fn() }));
jest.mock('./AdminDraftContext', () => ({ useAdminDraft: jest.fn() }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const pending = {
  id: 'media-11111111-1111-4111-8111-111111111111',
  state: 'pending',
  content_type: 'image/webp',
  filename: 'Cadru nocturn.webp',
  alt_text: 'Lumini pe cer',
  declared_size: 1200,
  usage_count: 0,
};

let container;
let root;
const button = name => [...container.querySelectorAll('button')].find(item => item.textContent === name);

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('a pending Blob upload remains recoverable but cannot be attached or edited', async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MediaCard
    item={pending}
    request={jest.fn()}
    attached={false}
    onAttach={jest.fn()}
    onDeleted={jest.fn()}
    onUpdated={jest.fn()}
  />));

  expect(container.querySelector('[role="status"]').textContent).toContain('Confirmarea fișierului este în curs');
  expect(button('Verifică încărcarea').disabled).toBe(false);
  expect(button('Adaugă în draft').disabled).toBe(true);
  expect(button('Salvează descrierea').disabled).toBe(true);
  expect(container.querySelector('img')).toBeNull();
});

test.each([99, 100, 101, 201])('exposes every media record in a %i item library through explicit subsequent pages', async count => {
  const records = Array.from({ length: count }, (_, index) => ({ ...pending, id: `media-${index}`, filename: `photo-${index}.webp` }));
  const request = jest.fn(async url => {
    const query = new URL(url, 'https://offline.invalid').searchParams;
    expect(query.get('limit')).toBe('100');
    return records.slice(Number(query.get('offset')), Number(query.get('offset')) + 100);
  });
  useAdminSession.mockReturnValue({ request, csrfToken: 'synthetic' });
  useAdminDraft.mockReturnValue({ draft: { mediaItems: [] }, update: jest.fn(), setPendingUploads: jest.fn() });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(<AdminMediaLibrary />));
  let more = button('Încarcă mai multe');
  if (count >= 100) expect(more).toBeDefined();
  while (more) { await act(async () => more.click()); more = button('Încarcă mai multe'); }
  expect(container.querySelectorAll('.cms-media-card')).toHaveLength(count);
  expect(container.textContent).toContain(`photo-${count - 1}.webp`);
  expect(request.mock.calls.map(([url]) => url)).toEqual(count < 100
    ? ['/api/admin/media?limit=100&offset=0']
    : count <= 100 ? ['/api/admin/media?limit=100&offset=0', '/api/admin/media?limit=100&offset=100']
      : count === 101 ? ['/api/admin/media?limit=100&offset=0', '/api/admin/media?limit=100&offset=100']
        : ['/api/admin/media?limit=100&offset=0', '/api/admin/media?limit=100&offset=100', '/api/admin/media?limit=100&offset=200']);
});

test('page failure keeps existing media visible and retries the same page without duplicates', async () => {
  const records = Array.from({ length: 100 }, (_, index) => ({ ...pending, id: `media-${index}` }));
  const request = jest.fn().mockResolvedValueOnce(records).mockRejectedValueOnce(new Error('offline page')).mockResolvedValueOnce([records[99], { ...pending, id: 'media-100', filename: 'oldest.webp' }]);
  useAdminSession.mockReturnValue({ request, csrfToken: 'synthetic' });
  useAdminDraft.mockReturnValue({ draft: { mediaItems: [] }, update: jest.fn(), setPendingUploads: jest.fn() });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  await act(async () => root.render(<AdminMediaLibrary />));
  expect(button('Încarcă mai multe')).toBeDefined();
  await act(async () => button('Încarcă mai multe').click());
  expect(container.querySelectorAll('.cms-media-card')).toHaveLength(100);
  expect(container.querySelector('[role="alert"]').textContent).toContain('offline page');
  await act(async () => button('Încarcă mai multe').click());
  expect(container.querySelectorAll('.cms-media-card')).toHaveLength(101);
  expect(request.mock.calls[2][0]).toBe('/api/admin/media?limit=100&offset=100');
});
