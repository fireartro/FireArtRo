import seed from './__fixtures__/siteContent.json';
import { normalizePublishedContent } from './managedContentSchema';
import { CMS_DEFAULTS } from '@/data/cmsDefaults';

test('the checked-in fallback satisfies the shared contract', () => {
  expect(normalizePublishedContent(CMS_DEFAULTS)).toEqual(CMS_DEFAULTS);
});

test('accepts a complete backend snapshot and preserves intentional empty collections', () => {
  expect(normalizePublishedContent({ ...seed, packages: [] }).packages).toEqual([]);
});
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
