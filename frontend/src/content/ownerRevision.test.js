import { applyOwnerRevision } from './ownerRevision';
import revision from '../data/ownerRevision.json';

const fixture = () => ({
  siteDetails: { name: 'FireArtRo', email: 'contact@example.com' }, footer: {},
  homePage: { hero: { titleLead: 'Custom title' }, gallery: {}, packages: {}, about: {}, promoSlides: [] },
  galleryPage: {}, packagesPage: {}, faqPage: {}, blogPage: {},
  legalPages: { terms: { paragraphs: ['Unchanged legal text'] } },
  faqs: [{ id: 'faq-booking', q: 'Booking?', a: 'Old' }, { id: 'custom', q: 'Custom?', a: 'Kept' }],
  mediaItems: [
    { id: 'gallery-import-drone-085', tags: ['drone'], src: '/original.webp' },
    { id: 'new-photo', tags: [], src: '/new.webp' },
    { id: 'gallery-import-110', tags: [], src: '/night.webp' },
  ],
  packages: [{ id: 'gold', category: 'Artificii de noapte', imageMediaId: '', videoUrl: 'https://youtu.be/abc12345678', moreVideoUrls: ['https://youtu.be/def12345678'] }],
});

test('revision preserves originals and unrelated owner content while hiding selected gallery assets', () => {
  const source = fixture();
  const result = applyOwnerRevision(source, revision);
  expect(result.mediaItems[0]).toEqual({ ...source.mediaItems[0], tags: ['drone', 'ascuns-din-galerie'] });
  expect(source.mediaItems[0].tags).toEqual(['drone']);
  expect(result.mediaItems[1]).toEqual(source.mediaItems[1]);
  expect(result.legalPages).toEqual(source.legalPages);
  expect(result.homePage.hero.titleLead).toBe('Custom title');
  expect(result.faqs[1]).toEqual(source.faqs[1]);
  expect(result.faqs[0].a).toMatch(/cât mai din timp/);
  expect(result.packages[0]).toEqual({ ...source.packages[0], imageMediaId: 'gallery-import-110' });
});

test('applying the revision twice is idempotent and does not duplicate visibility tags', () => {
  const once = applyOwnerRevision(fixture(), revision);
  expect(applyOwnerRevision(once, revision)).toEqual(once);
});

test('landing selection names each range and uses clean photos with category deep links', () => {
  const source = fixture();
  source.mediaItems.push(
    {id:'gallery-import-008', category:'Artificii de zi', tags:[], src:'/day.webp', alt:'Zi'},
    {id:'gallery-import-drone-021', category:'Drone show', tags:[], src:'/drone.webp', alt:'Drone'},
  );
  source.mediaItems[2].category = 'Artificii de noapte';
  source.mediaItems[2].alt = 'Noapte';
  source.homePage.promoSlides = [
    {id:'drone', type:'image', mediaId:'gallery-import-drone-021'},
    {id:'day', type:'image', mediaId:'gallery-import-008'},
    {id:'night', type:'image', mediaId:'gallery-import-110'},
  ];
  const result = applyOwnerRevision(source, revision);
  expect(result.homePage.promoSlides.map(slide => slide.title)).toEqual(['Artificii de noapte','Artificii de zi','Spectacole de drone']);
  expect(result.homePage.promoSlides[0].ctaHref).toBe('/galerie?filtru=Artificii%20de%20noapte');
  expect(applyOwnerRevision(result, revision)).toEqual(result);
});
