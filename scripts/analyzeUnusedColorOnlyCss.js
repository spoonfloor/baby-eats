#!/usr/bin/env node
/**
 * One-off analysis: count CSS rules whose declarations are only color-related
 * and whose class/id tokens appear unused in HTML/JS (heuristic).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS_FILES = [
  path.join(ROOT, 'css/overlays.css'),
  path.join(ROOT, 'css/styles.css'),
  path.join(ROOT, 'css/overrides.css'),
];

const COLOR_PROPS = new Set([
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'caret-color',
  'fill',
  'stroke',
  'text-decoration-color',
  'accent-color',
  'column-rule-color',
  '-webkit-tap-highlight-color',
]);

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function isColorOnlyBackgroundValue(v) {
  const s = v.trim().toLowerCase();
  if (!s) return false;
  if (
    /url\(|image-set\(|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient/i.test(
      s
    )
  )
    return false;
  if (/\s\/\s/.test(s)) return false;
  return true;
}

function parseDeclarations(block) {
  const decls = [];
  for (const part of block.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!prop || prop.startsWith('@')) continue;
    decls.push({ prop, value });
  }
  return decls;
}

function declsAreColorOnly(decls) {
  if (decls.length === 0) return false;
  for (const { prop, value } of decls) {
    const p = prop.trim().toLowerCase();
    if (p === 'background') {
      if (!isColorOnlyBackgroundValue(value)) return false;
      continue;
    }
    if (!COLOR_PROPS.has(p)) return false;
  }
  return true;
}

function walkStrings(css, i, visitor) {
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < n) {
        if (css[j] === '\\') {
          j += 2;
          continue;
        }
        if (css[j] === q) {
          visitor(css.slice(i + 1, j), i);
          i = j + 1;
          break;
        }
        j++;
      }
      if (j >= n) return n;
      continue;
    }
    i++;
  }
  return i;
}

/** Next top-level `{` not inside a string */
function findNextBrace(css, start) {
  let i = start;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < n) {
        if (css[i] === '\\') {
          i += 2;
          continue;
        }
        if (css[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === '{') return i;
    i++;
  }
  return -1;
}

/** Match braces from opening `{` at index openIdx; returns index after closing `}` */
function skipBalancedBlock(css, openIdx) {
  let i = openIdx + 1;
  let depth = 1;
  const n = css.length;
  while (i < n && depth > 0) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < n) {
        if (css[i] === '\\') {
          i += 2;
          continue;
        }
        if (css[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return i;
}

/**
 * Parse stylesheet chunk into flat list of { selector, declBlock }.
 * Nested @-rules: recurse into their inner blocks only (e.g. @media).
 */
function extractStyleRules(cssChunk, fileRel, out) {
  const css = stripComments(cssChunk);
  let i = 0;
  const n = css.length;

  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;

    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    if (css[i] === '@') {
      const atStart = i;
      const br = findNextBrace(css, i);
      if (br === -1) break;
      const prelude = css.slice(atStart, br).trim();
      const after = skipBalancedBlock(css, br);
      const inner = css.slice(br + 1, after - 1);
      const m = prelude.match(/^@([a-zA-Z-]+)/);
      const name = m ? m[1].toLowerCase() : '';
      if (name === 'keyframes' || name === 'font-face') {
        i = after;
        continue;
      }
      extractStyleRules(inner, fileRel, out);
      i = after;
      continue;
    }

    const selStart = i;
    const brOpen = findNextBrace(css, i);
    if (brOpen === -1) break;
    const selector = css.slice(selStart, brOpen).trim();
    const brClose = skipBalancedBlock(css, brOpen);
    const declBlock = css.slice(brOpen + 1, brClose - 1);
    if (selector) {
      out.push({ selector, declBlock, file: fileRel });
    }
    i = brClose;
  }
}

/** Drop :not( … ) so classes only used for negation do not count as required tokens. */
function stripNotCalls(selector) {
  let s = selector;
  for (;;) {
    const i = s.toLowerCase().indexOf(':not(');
    if (i === -1) break;
    let j = i + 5;
    let depth = 0;
    for (; j < s.length; j++) {
      const c = s[j];
      if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) {
          s = s.slice(0, i) + s.slice(j + 1);
          break;
        }
        depth--;
      }
    }
    if (j >= s.length) break;
  }
  return s;
}

function extractClassIdTokens(selector) {
  const classes = new Set();
  const ids = new Set();
  const cleaned = stripNotCalls(selector);
  const reClass = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  const reId = /#([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  let mm;
  while ((mm = reClass.exec(cleaned))) classes.add(mm[1]);
  while ((mm = reId.exec(cleaned))) ids.add(mm[1]);
  return { classes, ids };
}

function selectorLooksUniversal(selector) {
  const s = selector.trim();
  if (s.includes('*')) return true;
  if (/(^|[\s,>+~])html\b/i.test(s)) return true;
  if (/(^|[\s,>+~])body\b/i.test(s)) return true;
  if (/(^|[\s,>+~]):root\b/i.test(s)) return true;
  return false;
}

function collectSourceCorpus() {
  const exts = new Set(['.html', '.js']);
  const files = [];

  function walk(dir) {
    const base = path.basename(dir);
    if (base === 'node_modules' || base === '.git') return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (exts.has(path.extname(ent.name))) files.push(p);
    }
  }

  walk(ROOT);
  return files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
}

function tokenReferencedInCorpus(token, corpus) {
  const t = escapeRe(token);
  const patterns = [
    new RegExp(`class\\s*=\\s*["'][^"']*\\b${t}\\b`, 'i'),
    new RegExp(`classList\\.(?:add|remove|toggle|contains|replace)\\s*\\([^)]*['"]${t}['"]`, 'i'),
    new RegExp(`\\.className\\s*=\\s*['"]${t}['"]`, 'i'),
    new RegExp(`className\\s*=\\s*['"][^'"]*\\b${t}\\b`, 'i'),
    new RegExp(`className\\s*=\\s*\`[^\`]*\\b${t}\\b`, 'i'),
    new RegExp(`querySelector(?:All)?\\s*\\(\\s*['"]\\.${t}\\b`, 'i'),
    // Template / ternary: `cond ? 'is-purple' : ''`
    new RegExp(`\\?\\s*['"]${t}['"]`, 'i'),
  ];
  for (const p of patterns) {
    if (p.test(corpus)) return true;
  }
  return false;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function idReferencedInCorpus(id, corpus) {
  if (new RegExp(`id\\s*=\\s*["']${escapeRe(id)}['"]`, 'i').test(corpus))
    return true;
  if (new RegExp(`getElementById\\s*\\(\\s*['"]${escapeRe(id)}['"]`, 'i').test(corpus))
    return true;
  if (new RegExp(`\\$\\s*\\(\\s*['"]#${escapeRe(id)}['"]`, 'i').test(corpus))
    return true;
  return false;
}

function ruleUnreferencedHeuristic(selector, corpus) {
  if (selectorLooksUniversal(selector)) return false;
  const { classes, ids } = extractClassIdTokens(selector);
  if (classes.size === 0 && ids.size === 0) {
    // Tag-only or attribute-only selectors: conservative = referenced
    return false;
  }
  for (const id of ids) {
    if (idReferencedInCorpus(id, corpus)) continue;
    return true;
  }
  for (const c of classes) {
    if (tokenReferencedInCorpus(c, corpus)) continue;
    return true;
  }
  return false;
}

function main() {
  const corpus = collectSourceCorpus();
  const allRules = [];

  for (const abs of CSS_FILES) {
    const rel = path.relative(ROOT, abs);
    const text = fs.readFileSync(abs, 'utf8');
    extractStyleRules(text, rel, allRules);
  }

  let colorOnly = 0;
  let colorOnlyUnref = 0;
  const examples = [];

  for (const r of allRules) {
    const decls = parseDeclarations(r.declBlock);
    if (!declsAreColorOnly(decls)) continue;
    colorOnly++;
    if (!ruleUnreferencedHeuristic(r.selector, corpus)) continue;
    colorOnlyUnref++;
    if (examples.length < 25) {
      examples.push({
        file: r.file,
        selector: r.selector.replace(/\s+/g, ' ').slice(0, 120),
        decls: decls.map((d) => `${d.prop}: ${d.value}`).join('; '),
      });
    }
  }

  console.log(JSON.stringify({ colorOnlyRules: colorOnly, colorOnlyAndHeuristicUnreferenced: colorOnlyUnref }, null, 2));
  if (examples.length) {
    console.log('\nSample rules (up to 25):');
    for (const e of examples) {
      console.log(`--- ${e.file}\n  ${e.selector}\n  ${e.decls}`);
    }
  }
}

main();
