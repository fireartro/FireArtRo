const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test, expect } = require('@playwright/test');

const adminCss = readFileSync(join(__dirname, '../src/admin.css'), 'utf8');

test.beforeEach(async ({ page }) => {
  await page.setContent(`
    <main class="admin-shell cms-shell">
      <header class="admin-appbar">
        <div class="admin-appbar-brand">
          <button class="admin-mobile-menu" aria-label="Deschide secțiunile">☰</button>
          <a href="#">FIREARTRO</a>
        </div>
        <div class="admin-appbar-actions"><button class="admin-button is-primary">Publică modificările</button></div>
      </header>
      <div class="admin-workspace">
        <aside class="admin-sidebar">
          <nav><details open><summary>Conținut</summary><button>Parteneri</button></details></nav>
        </aside>
        <div class="cms-main">
          <section class="cms-panel">
            <div class="cms-panel-heading">
              <div><h1>Parteneri</h1><p>Editează partenerii afișați.</p></div>
              <button class="admin-button">Adaugă element</button>
            </div>
            <div class="cms-collection" data-view="editor">
              <div class="cms-collection-list">
                <label for="search">Caută parteneri</label><input id="search" type="search">
                <button class="cms-collection-choice"><span><strong>Partener</strong><small>Descriere partener</small></span></button>
              </div>
              <div class="cms-editor-fields">
                <div class="cms-form-grid"><div class="admin-field"><label for="name">Nume partener</label><input id="name"></div></div>
              </div>
            </div>
            <div class="admin-inbox-list"><ul><li><button><strong>Mesaj nou</strong><small>Astăzi</small></button></li></ul></div>
            <div class="cms-media-card"><strong>Imagine</strong><small>250 KB</small></div>
          </section>
          <section class="admin-blog-view">
            <div class="admin-blog-layout">
              <aside class="admin-blog-list"><button><strong>Articol</strong><span>articol-1</span><small>Ciornă</small></button></aside>
              <form class="admin-blog-form"><div class="admin-blog-fields"><label><span>Titlu articol</span><small>Obligatoriu</small><input></label></div></form>
            </div>
          </section>
        </div>
      </div>
    </main>
  `);
  await page.addStyleTag({ content: 'html, body { margin: 0; }' });
  await page.addStyleTag({ content: adminCss });
});

test('CMS drawer keeps one content column and a closed sidebar at 901–1050px', async ({ page }) => {
  for (const width of [901, 1050]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => {
      const workspace = document.querySelector('.cms-shell .admin-workspace');
      const menu = document.querySelector('.admin-mobile-menu');
      return {
        columns: getComputedStyle(workspace).gridTemplateColumns.trim().split(/\s+/),
        menuDisplay: getComputedStyle(menu).display,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(layout.columns, `${width}px workspace columns`).toHaveLength(1);
    await expect.poll(() => page.locator('.cms-shell .admin-sidebar').evaluate(el => el.getBoundingClientRect().right),
      { message: `${width}px closed sidebar is off canvas` }).toBeLessThanOrEqual(0);
    expect(layout.menuDisplay, `${width}px menu trigger`).not.toBe('none');
    expect(layout.pageWidth, `${width}px horizontal overflow`).toBeLessThanOrEqual(width + 1);
  }
});

test('CMS navigation switches from compact at 900px to docked at 1051px', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  expect(await page.locator('.cms-shell .admin-sidebar').evaluate(el => getComputedStyle(el).display)).toBe('none');
  expect(await page.locator('.admin-mobile-menu').evaluate(el => getComputedStyle(el).display)).not.toBe('none');
  expect(await page.locator('.cms-shell .cms-collection').evaluate(el => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/))).toHaveLength(1);

  await page.setViewportSize({ width: 1051, height: 900 });
  const docked = await page.evaluate(() => {
    const workspace = document.querySelector('.cms-shell .admin-workspace');
    const sidebar = workspace.querySelector('.admin-sidebar');
    return {
      columns: getComputedStyle(workspace).gridTemplateColumns.trim().split(/\s+/),
      sidebarLeft: sidebar.getBoundingClientRect().left,
      sidebarDisplay: getComputedStyle(sidebar).display,
      menuDisplay: getComputedStyle(document.querySelector('.admin-mobile-menu')).display,
    };
  });
  expect(docked.columns).toHaveLength(2);
  expect(docked.sidebarLeft).toBeGreaterThanOrEqual(0);
  expect(docked.sidebarDisplay).not.toBe('none');
  expect(docked.menuDisplay).toBe('none');
});

test('wide CMS Blog editor expands beyond its former narrow cap', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  const blogWidth = await page.locator('.admin-blog-view').evaluate(el => el.getBoundingClientRect().width);
  expect(blogWidth).toBeGreaterThanOrEqual(1700);
  expect(blogWidth).toBeLessThanOrEqual(1960);
});

test('wide CMS editor uses the canvas and legible controls at 2560px', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  const wide = await page.evaluate(() => {
    const main = document.querySelector('.cms-main');
    const panel = document.querySelector('.cms-panel');
    const mainStyle = getComputedStyle(main);
    const size = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return {
      innerWidth: main.clientWidth - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight),
      panelWidth: panel.getBoundingClientRect().width,
      listWidth: document.querySelector('.cms-collection-list').getBoundingClientRect().width,
      actionSize: size('.cms-panel-heading .admin-button'),
      navSize: size('.admin-sidebar summary'),
      fieldSize: size('.admin-field label'),
      secondarySize: size('.cms-collection-choice small'),
      inboxSize: size('.admin-inbox-list li > button small'),
      blogLabelSize: size('.admin-blog-fields > label > span:first-child'),
      blogMetaSize: size('.admin-blog-list small'),
      blogIdSize: size('.admin-blog-list span'),
      mediaMetaSize: size('.cms-media-card > small'),
      navHeight: document.querySelector('.admin-sidebar summary').getBoundingClientRect().height,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  expect(wide.panelWidth).toBeGreaterThanOrEqual(wide.innerWidth * 0.75);
  expect(wide.panelWidth).toBeGreaterThanOrEqual(1700);
  expect(wide.listWidth).toBeGreaterThanOrEqual(320);
  for (const [name, size] of Object.entries({ action: wide.actionSize, navigation: wide.navSize, field: wide.fieldSize })) {
    expect(size, `${name} label size`).toBeGreaterThanOrEqual(13);
  }
  expect(wide.secondarySize).toBeGreaterThanOrEqual(12);
  expect(wide.inboxSize).toBeGreaterThanOrEqual(12);
  expect(wide.blogLabelSize).toBeGreaterThanOrEqual(13);
  expect(wide.blogMetaSize).toBeGreaterThanOrEqual(12);
  expect(wide.blogIdSize).toBeGreaterThanOrEqual(12);
  expect(wide.mediaMetaSize).toBeGreaterThanOrEqual(12);
  expect(wide.navHeight).toBeGreaterThanOrEqual(44);
  expect(wide.pageWidth).toBeLessThanOrEqual(2561);
});
