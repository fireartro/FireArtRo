import { createPublicContentState, publicContentAfterFailure } from './ManagedContentProvider';

test('production begins unavailable until a published snapshot is received and never restores the seed after an API failure', () => {
  const initial = createPublicContentState({ production: true });
  expect(initial.status).toBe('loading');
  expect(initial.content).toBeNull();

  expect(publicContentAfterFailure(initial, { production: true })).toEqual(expect.objectContaining({
    status: 'unavailable',
    content: null,
  }));
});

test('a confirmed published snapshot stays visible during a later outage', () => {
  const published = { content: { siteDetails: { name: 'FireArtRo' } }, revisionId: 'published-1', status: 'ready' };
  expect(publicContentAfterFailure(published, { production: true })).toBe(published);
});
