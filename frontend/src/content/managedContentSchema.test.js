import seed from './__fixtures__/siteContent.json';
import { normalizePublishedContent } from './managedContentSchema';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';

test('the checked-in fallback satisfies the shared contract', () => {
  expect(normalizePublishedContent(CMS_DEFAULTS)).toEqual(CMS_DEFAULTS);
});

test('accepts a complete backend snapshot and preserves intentional empty collections', () => {
  expect(normalizePublishedContent({ ...seed, packages: [] }).packages).toEqual([]);
});
test('old snapshots stay unchanged and confirmed capital survives strict validation', () => {
  const old = JSON.parse(JSON.stringify(seed));
  delete old.siteDetails.shareCapital;
  expect(normalizePublishedContent(old)).toEqual(old);

  old.siteDetails.shareCapital = '';
  expect(normalizePublishedContent(old).siteDetails).not.toHaveProperty('shareCapital');

  old.siteDetails.shareCapital = '1.000 lei';
  expect(normalizePublishedContent(old).siteDetails.shareCapital).toBe('1.000 lei');
});
test.each(['<b>1.000 lei</b>', '1.000\nlei', 'x'.repeat(81), null])(
  'rejects invalid share capital %p', value => {
    const content = JSON.parse(JSON.stringify(seed));
    content.siteDetails.shareCapital = value;
    expect(() => normalizePublishedContent(content)).toThrow('Conținut public invalid');
  },
);
test.each([
  value => { delete value.homePage; },
  value => { value.mediaItems = null; },
  value => { value.navigation.links[0].href = 'javascript:alert(1)'; },
  value => { value.navigation.links[0].href = '/\\evil.example'; },
  value => { value.faqs.push(value.faqs[0]); },
  value => { value.homePage.hero.backgroundMediaId = 'missing-media'; },
  value => { value.legalPages.privacy.sections[0].paragraphs = ['<script>bad()</script>']; },
])('rejects a malformed snapshot atomically', mutate => {
  const value = JSON.parse(JSON.stringify(seed));
  mutate(value);
  expect(() => normalizePublishedContent(value)).toThrow('Conținut public invalid');
});
