import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

test('the shared tabs primitive connects each trigger to its labelled panel', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div'); document.body.appendChild(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<Tabs defaultValue="first"><TabsList aria-label="Fixture"><TabsTrigger value="first">Prima</TabsTrigger><TabsTrigger value="second">A doua</TabsTrigger></TabsList><TabsContent value="first">Conținut unu</TabsContent><TabsContent value="second">Conținut doi</TabsContent></Tabs>));
    const first = container.querySelector('[role="tab"][aria-selected="true"]');
    const panel = document.getElementById(first.getAttribute('aria-controls'));
    expect(panel.textContent).toBe('Conținut unu');
    expect(panel.getAttribute('aria-labelledby')).toBe(first.id);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
