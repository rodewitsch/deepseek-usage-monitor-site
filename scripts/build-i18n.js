#!/usr/bin/env node
/**
 * Builds translated landing pages from index.html + i18n/*.json.
 *
 *   node scripts/build-i18n.js          # write pages
 *   node scripts/build-i18n.js --check  # only verify translations
 *
 * index.html (root, `lang="ru"`) is the source template and stays hand-edited:
 * every translatable node carries data-i18n / data-i18n-html / data-i18n-alt /
 * data-i18n-content with a key from i18n/ru.json.
 *
 * Output:
 *   /en/index.html, /de/index.html, ... (asset paths re-rooted with ../)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const I18N_DIR = path.join(ROOT, 'i18n');
const TEMPLATE = path.join(ROOT, 'index.html');
const SOURCE_LOCALE = 'ru'; // the locale index.html is written in
const BASE_URL = 'https://deepseek-usage-monitor.rodevich.com/';

const LOCALES = [
  { code: 'en', folder: 'en', label: 'English', name: 'English' },
  { code: 'de', folder: 'de', label: 'Deutsch', name: 'Deutsch' },
  { code: 'es', folder: 'es', label: 'Español', name: 'Español' },
  { code: 'fr', folder: 'fr', label: 'Français', name: 'Français' },
  { code: 'hi', folder: 'hi', label: 'हिन्दी', name: 'हिन्दी' },
  { code: 'id', folder: 'id', label: 'Bahasa Indonesia', name: 'Bahasa Indonesia' },
  { code: 'ja', folder: 'ja', label: '日本語', name: '日本語' },
  { code: 'pt_BR', folder: 'pt_BR', label: 'Português (BR)', name: 'Português (Brasil)' },
  { code: 'zh_CN', folder: 'zh_CN', label: '简体中文', name: '简体中文' }
];

const ALL_LANGS = [{ code: 'ru', folder: '', label: 'Русский', name: 'Русский' }, ...LOCALES];

/* ---------- helpers ---------- */

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Flatten nested dict into { 'a.b': value }. */
function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out[full] = value;
    }
  }
  return out;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ATTRS = {
  'data-i18n': (value) => escapeHtml(value),
  'data-i18n-html': (value) => value,
  'data-i18n-alt': (value) => escapeHtml(value),
  'data-i18n-content': (value) => escapeHtml(value),
  'data-i18n-aria-label': (value) => escapeHtml(value)
};

/**
 * Replaces text of elements carrying a data-i18n* attribute.
 * Only leaf elements written on a single line are supported — which is how the
 * template is authored. Attributes are left untouched (the data-i18n* marker
 * stays in place, so re-running the build is idempotent), except for
 * data-i18n-alt / data-i18n-content which own the alt= / content= attribute.
 */
function translateElements(html, dict) {
  for (const [attr, render] of Object.entries(ATTRS)) {
    const marker = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*?\\s${attr}="([^"]+)"[^>]*?(/?)>`, 'gi');
    let match;

    while ((match = marker.exec(html)) !== null) {
      const [, tag, key, selfClosing] = match;
      const value = dict[key];
      if (typeof value !== 'string') continue;

      if (selfClosing === '/') {
        // void element: rewrite the alt= / content= attribute in place
        const out = attr === 'data-i18n-alt'
          ? match[0].replace(/\salt="[^"]*"/, ` alt="${escapeHtml(value)}"`)
          : match[0].replace(/\scontent="[^"]*"/, ` content="${escapeHtml(value)}"`);
        html = html.slice(0, match.index) + out + html.slice(match.index + match[0].length);
        marker.lastIndex = match.index + out.length;
        continue;
      }

      if (attr === 'data-i18n-aria-label') {
        // opening tag only: replace aria-label= and keep the inner markup
        const closing = `</${tag}>`;
        const closeIndex = html.indexOf(closing, match.index);
        if (closeIndex === -1) continue;
        const openTag = match[0].replace(/\saria-label="[^"]*"/, ` aria-label="${escapeHtml(value)}"`);
        const inner = html.slice(match.index + match[0].length, closeIndex);
        const newBlock = `${openTag}${inner}${closing}`;
        html = html.slice(0, match.index) + newBlock + html.slice(closeIndex + closing.length);
        marker.lastIndex = match.index + newBlock.length;
        continue;
      }
      const closing = `</${tag}>`;
      const closeIndex = html.indexOf(closing, match.index);
      if (closeIndex === -1) continue;

      const openTag = match[0];
      const newBlock = `${openTag}${render(value)}${closing}`;
      html = html.slice(0, match.index) + newBlock + html.slice(closeIndex + closing.length);
      marker.lastIndex = match.index + newBlock.length;
    }
  }

  return html;
}

function labelFor(folder) {
  const found = ALL_LANGS.find((l) => l.folder === folder);
  return found ? found.label : folder;
}

/** Rewrites root-relative asset links for a page served from /<folder>/. */
function reRoot(html, folder) {
  if (!folder) return html;
  const others = LOCALES.map((l) => l.folder).join('|');
  return html
    .replace(/(src|href)="assets\//g, '$1="../assets/')
    .replace(/(src|href)="script\.js"/g, '$1="../script.js"')
    .replace(/(src|href)="styles\.css"/g, '$1="../styles.css"')
    // absolute locale links (hreflang block + offline fallback) must not stay absolute on file://
    .replace(new RegExp(`href="(${others})\\/"`, 'g'), 'href="../$1/"')
    .replace(new RegExp(`href="(${others})\\/#`, 'g'), 'href="../$1/#')
    // switch back to the Russian root page
    .replace(/href="\.\/"/g, 'href="../"')
    .replace(/href="\.\/#/g, 'href="../#');
}

/* ---------- main ---------- */

function main() {
  const checkOnly = process.argv.includes('--check');
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const source = flatten(readJson(path.join(I18N_DIR, `${SOURCE_LOCALE}.json`)));
  const sourceKeys = Object.keys(source).filter((k) => /^(meta|nav|hero|features|f\d|budgets|how|shots|privacy|faq|cta|support|footer|alt|a11y|lang)\./.test(k));

  const problems = [];
  let built = 0;

  for (const locale of ALL_LANGS) {
    const file = path.join(I18N_DIR, `${locale.code}.json`);
    if (!fs.existsSync(file)) {
      problems.push(`${locale.code}: missing i18n/${locale.code}.json`);
      continue;
    }

    const data = readJson(file);
    const dict = flatten(data);

    const missing = sourceKeys.filter((k) => !(k in dict));
    const extra = Object.keys(dict).filter((k) => !sourceKeys.includes(k) && !['locale', 'htmlLang'].includes(k));
    if (missing.length) problems.push(`${locale.code}: ${missing.length} missing keys (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''})`);
    if (extra.length) problems.push(`${locale.code}: ${extra.length} unknown keys (${extra.slice(0, 6).join(', ')}${extra.length > 6 ? ', …' : ''})`);

    if (checkOnly) continue;

    // 1. translate everything marked with data-i18n*
    let html = translateElements(template, dict);

    // head: title + html lang + og:locale
    if (dict['meta.title']) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(dict['meta.title'])}</title>`);
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${data.htmlLang || locale.code}"`);
    html = html.replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${data.locale || locale.code}">`);

    // 2. the language switcher has language names baked into the template, so the
    //    translated one must replace the whole block (up to the burger button).
    const switcher = languageSwitcher(locale.folder, dict);
    html = html.replace(
      /<div class="lang-switch" id="langSwitch">[\s\S]*?<\/div>\s*<button class="mobile-toggle"/,
      () => switcher + '<button class="mobile-toggle"'
    );

    // 3. relative asset paths
    html = reRoot(html, locale.folder);

    // 4. write
    const dir = path.join(ROOT, locale.folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    built += 1;
  }

  if (problems.length) {
    console.error('i18n problems:\n  ' + problems.join('\n  '));
    process.exitCode = 1;
  }

  if (checkOnly) {
    console.log(`i18n check passed for ${ALL_LANGS.length} locales (${sourceKeys.length} keys).`);
    return;
  }

  console.log(`Built ${built} translated pages from ${sourceKeys.length} keys.`);
  console.log('Root index.html is still the ru template — edit it by hand.');
}

function languageSwitcher(currentFolder, dict) {
  const currentIndex = ALL_LANGS.findIndex((l) => l.folder === currentFolder);
  const current = ALL_LANGS[Math.max(0, currentIndex)];
  const codeLabel = current.code === 'pt_BR' ? 'PT' : current.code.split('_')[0].toUpperCase();
  const langLabel = escapeHtml(dict['a11y.lang'] || 'Language');

  const items = ALL_LANGS.map((l, i) => {
    const href = l.folder ? l.folder + '/' : './';
    const active = i === currentIndex;
    return '<a href="' + href + '" hreflang="' + l.code + '"' + (active ? ' class="active" aria-current="true"' : '') + '>' + l.name + '</a>';
  }).join('\n            ');

  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/></svg>';

  return [
    '<div class="lang-switch" id="langSwitch">',
    '          <button type="button" class="lang-btn" aria-haspopup="true" aria-expanded="false" aria-label="' + langLabel + '" data-i18n-aria-label="a11y.lang">',
    '            ' + icon,
    '            <span class="lang-code">' + codeLabel + '</span>',
    '          </button>',
    '          <div class="lang-menu" role="menu">',
    '            ' + items,
    '          </div>',
    '        </div>',
    '        '
  ].join('\n');
}

main();
