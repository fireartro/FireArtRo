import { CMS_DEFAULTS } from '@/data/cmsDefaults';
import { prepareLegacyImport } from './AdminMigrationPanel';

const clone = value => JSON.parse(JSON.stringify(value));

test('imports only known local modules into a valid draft without publishing', () => {
  const current = clone(CMS_DEFAULTS);
  const firstLink = { ...current.navigation.links[0], label: 'Acasă' };
  const result = prepareLegacyImport(current, {
    navigation: { links: [firstLink] },
    unknownModule: { shouldNot: 'survive' },
  });

  expect(result.modules).toEqual(['navigation']);
  expect(result.errors).toEqual([]);
  expect(result.content.navigation.links).toEqual([firstLink]);
  expect(result.content.footer).toEqual(current.footer);
  expect(result.content).not.toHaveProperty('unknownModule');
});

test('keeps the current draft unchanged when old local data is invalid', () => {
  const current = clone(CMS_DEFAULTS);
  const result = prepareLegacyImport(current, { navigation: { links: [{ id: 'bad', label: '', href: 'javascript:alert(1)' }] } });

  expect(result.modules).toEqual(['navigation']);
  expect(result.content).toBeNull();
  expect(result.errors.length).toBeGreaterThan(0);
});
