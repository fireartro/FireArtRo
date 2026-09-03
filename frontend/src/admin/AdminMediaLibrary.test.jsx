import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MediaCard } from './AdminMediaLibrary';

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
