import { createDraftMediaItem } from './mediaDraftItem';

describe('createDraftMediaItem', () => {
  it('uses stored library metadata when an existing image is reattached to a draft', () => {
    const item = {
      id: 'media-11111111-1111-4111-8111-111111111111',
      content_type: 'image/webp',
      filename: 'Noapte peste oraș.webp',
      alt_text: 'Artificii albastre deasupra orașului',
      url: 'https://store.public.blob.vercel-storage.com/cms/media/asset.webp',
      width: 1600,
      height: 900,
    };

    expect(createDraftMediaItem(item, { order: 4, date: '2026-09-03' })).toEqual(expect.objectContaining({
      id: item.id,
      type: 'image',
      title: item.filename,
      shortDescription: item.alt_text,
      alt: item.alt_text,
      src: item.url,
      thumbnail: item.url,
      category: 'Artificii de noapte',
      order: 4,
      date: '2026-09-03',
      aspectRatio: 1600 / 900,
    }));
  });
});
