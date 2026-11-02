/** @jest-environment node */
jest.mock('gsap/ScrollTrigger', () => require('gsap/dist/ScrollTrigger'));
import { CMS_DEFAULTS } from '@/data/cmsDefaults';
import { renderPublicPage, publicPageForPath } from './renderPage';

const publication = { revision_id: 'test-publication', published_at: '2026-11-02T12:00:00Z', content: CMS_DEFAULTS };
const data = { publication, posts: [], post: null };

test('renders actual page headings and navigation without a DOM or JavaScript', () => {
  const page = renderPublicPage('/pachete', data);
  expect(page.html).toMatch(/<h1[^>]*>Pachete<\/h1>/);
  expect(page.html).toContain('href="/contact"');
  expect(page.html).toContain('Bronze');
  expect(page.meta.path).toBe('/pachete');
  expect(page.meta.title).toBe(CMS_DEFAULTS.packagesPage.seoTitle);
});

test('keeps package filters functional while consolidating their canonical', () => {
  const page = renderPublicPage('/pachete?categorie=Efecte%20speciale', data);
  expect(page.meta.path).toBe('/pachete');
  expect(page.html).toContain('Efecte speciale');
});

test('renders the homepage with published content and its metadata', () => {
  const changed = JSON.parse(JSON.stringify(publication));
  changed.content.siteDetails.seoTitle = 'Titlu publicat curent';
  const page = renderPublicPage('/', { ...data, publication: changed });
  expect(page.meta.title).toBe('Titlu publicat curent');
  expect(page.html).toContain('id="acasa"');
  expect(page.html).toContain('href="/pachete"');
});

test('renders archive and article content supplied by the public data reader', () => {
  const post = { id: 'public-article', slug: 'eveniment-real', title: 'Eveniment real', excerpt: 'Descriere verificată', body: 'Conținut publicat', published_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-02T12:00:00Z', category: '', cover_media_id: '', cover_alt: '' };
  const archive = renderPublicPage('/blog', { ...data, posts: [post] });
  expect(archive.html).toContain('Eveniment real');
  const article = renderPublicPage('/blog/eveniment-real', { ...data, post });
  expect(article.html).toContain('Conținut publicat');
  expect(article.meta.title).toContain('Eveniment real');
});

test('unknown pages, private routes and malformed blog slugs have no public renderer', () => {
  for (const path of ['/admin', '/api/content', '/does-not-exist', '/blog/a/b', '//evil.example', '/blog/%2fadmin']) {
    expect(publicPageForPath(path)).toBeNull();
  }
});

test('invalid published content fails closed instead of rendering fallback business claims', () => {
  expect(() => renderPublicPage('/', { ...data, publication: { ...publication, content: { siteDetails: {} } } })).toThrow();
});
