const CANONICAL_ORIGIN = 'https://fireart.ro';
const DEFAULT_IMAGE = '/media/coperta-spectacol-artificii-fireartro.webp';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function inertJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, character => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029',
  })[character]);
}

function attribute(tag, key) {
  return tag.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]?.toLowerCase();
}

function canonicalPath(path) {
  if (typeof path !== 'string' || !/^\/(?!\/)/.test(path) || /[\\\x00-\x1f\x7f]/.test(path)) {
    throw new Error('Invalid public page metadata');
  }
  return path.split(/[?#]/, 1)[0];
}

function publicImage(value) {
  const image = value || DEFAULT_IMAGE;
  if (typeof image !== 'string' || /[\x00-\x20\\]/.test(image)) throw new Error('Invalid public page image');
  const parsed = new URL(image, CANONICAL_ORIGIN);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Invalid public page image');
  }
  return parsed.href;
}

const NO_SCRIPT_STYLE = '#fireart-intro{display:none!important}'
  + '#root{visibility:visible!important}'
  + '#root [style*="opacity:0"],#root [style*="opacity: 0"]{opacity:1!important}'
  + '#root .site-navbar{transform:none!important;opacity:1!important}'
  + '#root .nr-hero__content{transform:none!important}'
  + '#root .nr-hero__accessible-title{position:static!important;width:auto!important;height:auto!important;clip:auto!important;clip-path:none!important;overflow:visible!important;white-space:normal!important}'
  + '#root .nr-hero__title-line{display:none!important}';

/** Fill the trusted CRA template with the same public React component output. */
export function publicPageDocument(template, result, { styles = [], inlineStyles = {} } = {}) {
  if (typeof template !== 'string' || typeof result?.html !== 'string' || !result.meta) {
    throw new Error('Public document unavailable');
  }
  const meta = result.meta;
  const canonical = `${CANONICAL_ORIGIN}${canonicalPath(meta.path || result.pathname || '/')}`;
  const image = publicImage(meta.image);
  let html = template.replace(/<html\b([^>]*)>/i, '<html$1 data-fireart-ssr="true">')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');
  const names = new Set(['description', 'robots', 'twitter:title', 'twitter:description', 'twitter:image']);
  const properties = new Set(['og:title', 'og:description', 'og:url', 'og:image']);
  html = html.replace(/<meta\b[^>]*>/gi, tag => (
    names.has(attribute(tag, 'name')) || properties.has(attribute(tag, 'property')) ? '' : tag
  )).replace(/<link\b[^>]*>/gi, tag => attribute(tag, 'rel') === 'canonical' ? '' : tag)
    .replace(/<script\b(?=[^>]*\bid=["'](?:page-structured-data|fireart-public-page-data)["'])[^>]*>[\s\S]*?<\/script>/gi, '');

  const tag = (key, value, property = false) => `<meta ${property ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}" />`;
  const styleTag = style => {
    const css = inlineStyles[style];
    if (typeof css !== 'string') return `<link rel="stylesheet" href="${escapeHtml(style)}" />`;
    if (/<\/style\b/i.test(css)) throw new Error('Invalid compiled stylesheet');
    // MiniCssExtractPlugin recognises data-href and avoids a duplicate fetch
    // when the same route chunk mounts. The exact compiled cascade is retained.
    return `<style data-href="${escapeHtml(style)}">${css}</style>`;
  };
  html = html.replace(/<link\b[^>]*>/gi, link => {
    const href = attribute(link, 'href');
    return attribute(link, 'rel') === 'stylesheet' && styles.includes(href)
      && typeof inlineStyles[href] === 'string' ? styleTag(href) : link;
  });
  const head = [
    `<title>${escapeHtml(meta.title)}</title>`,
    tag('description', meta.description),
    tag('robots', meta.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'),
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    tag('og:title', meta.title, true), tag('og:description', meta.description, true),
    tag('og:url', canonical, true), tag('og:image', image, true),
    tag('twitter:title', meta.title), tag('twitter:description', meta.description), tag('twitter:image', image),
    ...(meta.schema ? [`<script id="page-structured-data" type="application/ld+json">${inertJson(meta.schema)}</script>`] : []),
  ];
  for (const style of new Set(styles)) {
    if (typeof style !== 'string' || !/^\/static\/css\/[a-z0-9_./-]+\.css$/i.test(style)
        || style.includes('..') || style.includes('//')) throw new Error('Invalid public stylesheet');
    if (!html.includes(`href="${style}"`) && !html.includes(`href='${style}'`)) {
      head.push(styleTag(style));
    }
  }
  if (!/<\/head>/i.test(html)) throw new Error('Public document unavailable');
  html = html.replace(/<\/head>/i, () => `${head.join('\n')}\n</head>`);

  const emptyRoot = /<div\b(?=[^>]*\bid=["']root["'])[^>]*>\s*<\/div>/i;
  if (!emptyRoot.test(html)) throw new Error('Public document unavailable');
  const boot = `<script id="fireart-public-page-data" type="application/json">${inertJson(result.data || {})}</script>`;
  html = html.replace(emptyRoot, () => `<div id="root">${result.html}</div>${boot}`);
  // Native no-JS access can read the server markup; ordinary JS users retain
  // the existing startup film, animations and CSS without an extra content copy.
  html = html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, block => (
    /Ai nevoie de JavaScript activat/.test(block) ? '' : block
  ));
  html = html.replace(/<\/body>/i, () => `<noscript><style>${NO_SCRIPT_STYLE}</style></noscript>\n</body>`);
  return html;
}
