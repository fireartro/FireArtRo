import { reconcilePendingMedia } from './mediaApi';

describe('reconcilePendingMedia', () => {
  it('uses the authenticated upload endpoint and sends only the pending media id', async () => {
    const request = jest.fn().mockResolvedValue({
      id: 'media-11111111-1111-4111-8111-111111111111', state: 'ready',
    });

    await expect(reconcilePendingMedia(request, 'media-11111111-1111-4111-8111-111111111111'))
      .resolves.toEqual({ id: 'media-11111111-1111-4111-8111-111111111111', state: 'ready' });

    expect(request).toHaveBeenCalledWith('/api/admin/blob-upload', {
      method: 'POST',
      body: JSON.stringify({
        type: 'fireartro.reconcile-pending',
        payload: { mediaId: 'media-11111111-1111-4111-8111-111111111111' },
      }),
    });
  });
});
