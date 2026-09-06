import fs from 'fs';
import path from 'path';
import postcss from 'postcss';

// Exercise the actual cookie stylesheet cascade, rather than duplicating its colors.
const sheets = ['index.css', 'editorial-refresh.css', 'styles/night-runway.css'];
function applyCookieStyles() {
  const style = document.createElement('style');
  const rules = [];
  sheets.forEach(file => postcss.parse(fs.readFileSync(path.join(process.cwd(), 'src', file), 'utf8')).walkRules(rule => {
    if (rule.parent.type === 'root' && /\.cookie-/.test(rule.selector)) rules.push(rule.toString());
  }));
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
  return style;
}

function channels(value) { return value.match(/[\d.]+/g).map(Number); }
function composite(color, background) {
  const [r, g, b, alpha = 1] = channels(color);
  return [r, g, b].map((v, i) => v * alpha + background[i] * (1 - alpha));
}
function luminance(rgb) {
  return rgb.map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

let style;
let panel;
beforeEach(() => {
  style = applyCookieStyles();
  panel = document.createElement('section');
  panel.className = 'cookie-consent-panel';
  panel.innerHTML = '<div class="cookie-consent-links"><span>Preferința este păstrată 180 zile.</span></div><div class="cookie-consent-actions"><button class="is-primary">Acceptă toate</button></div>';
  document.body.appendChild(panel);
});
afterEach(() => { panel.remove(); style.remove(); });

test('cookie retention text has at least AA contrast on the real panel surface', () => {
  const background = composite(getComputedStyle(panel).backgroundColor, [0, 0, 0]);
  const foreground = composite(getComputedStyle(panel.querySelector('.cookie-consent-links')).color, background);
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
});

test('primary cookie action has at least AA contrast with its white text', () => {
  const button = getComputedStyle(panel.querySelector('button'));
  const background = composite(button.backgroundColor, [14, 14, 14]);
  const foreground = composite(button.color, background);
  expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
});
