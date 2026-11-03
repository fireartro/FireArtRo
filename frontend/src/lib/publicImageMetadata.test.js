import { localizePublicImages, romanianImageUrl } from './publicImageMetadata';

test('legacy image links become Romanian while their rendition query is retained', () => {
  expect(romanianImageUrl('/media/optimized/hero-wide-1920-20261102.webp?v=reviewed'))
    .toBe('/media/optimized/spectacol-artificii-panoramic-1920-20261102.webp?v=reviewed');
  expect(romanianImageUrl('https://fireart.ro/media/crowd-2.webp'))
    .toBe('https://fireart.ro/media/public-spectacol-artificii-2.webp');
  expect(romanianImageUrl('https://example.com/media/crowd-2.webp'))
    .toBe('https://example.com/media/crowd-2.webp');
});

test('public metadata translates legacy defaults without changing later editorial choices', () => {
  const original = {id:'gallery-import-drone-001', type:'image',
    src:'/media/gallery/fireartro-drone-show-adam-show-img-7595.webp',
    title:'Drone show FireArtRo - ADAM SHOW', alt:'Fotografie cu drone FireArtRo la ADAM SHOW'};
  const result = localizePublicImages([original]);
  expect(result[0].src).toBe('/media/gallery/spectacol-drone-adam-show-fireartro-001.webp');
  expect(result[0].title).toBe('Spectacol cu drone FireArtRo — ADAM SHOW');
  expect(result[0].alt).toBe('Spectacol cu drone luminoase FireArtRo la ADAM SHOW');
  expect(original.src).toContain('img-7595');
  const custom = {...original, title:'Titlu ales de proprietar', alt:'Un cadru descris de proprietar'};
  expect(localizePublicImages([custom])[0]).toMatchObject({title:custom.title, alt:custom.alt});
  const replacement = {...original, src:'https://images.example/replacement.webp'};
  expect(localizePublicImages([replacement])[0]).toEqual(replacement);
});

test('image presentation stays immutable and idempotent across public rerenders', () => {
  const value = [{id:'custom',type:'image',src:'/media/optimized/hero-wide-1920-20261102.webp',
    imageFrame:{desktop:{x:30,y:60,scale:1.2}},width:1920,height:1080,order:3}];
  const next = localizePublicImages(value);
  expect(next[0]).toMatchObject({imageFrame:value[0].imageFrame,width:1920,height:1080,order:3});
  expect(next[0].imageFrame).toBe(value[0].imageFrame);
  expect(localizePublicImages(next)).toBe(next);
});
