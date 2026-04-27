#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const recipeTitleShellPath = path.join(projectRoot, 'js', 'recipeTitleShell.js');

function loadHelpers() {
  const source = fs.readFileSync(recipeTitleShellPath, 'utf8');
  const startMarker = '// --- Recipe tags keyboard helpers (tests extract this block) ---';
  const endMarker = '// --- End recipe tags keyboard helpers ---';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate recipe tags keyboard helper block in recipeTitleShell.js');
  }

  const snippet = source.slice(start, end + endMarker.length);
  const bridge = {};
  const context = { window: bridge, global: bridge };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'recipeTitleShell.tags-keyboard-helpers.js' });

  const helpers = context.window.__recipeTagsKeyboardHelpers;
  if (!helpers) throw new Error('Helper export not found on window.');
  return helpers;
}

try {
  const helpers = loadHelpers();

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed.');
  }

  assert(
    helpers.shouldCommitRecipeTagsEdit({ key: 'Enter', shiftKey: false }),
    'Plain Enter should commit.',
  );

  assert(
    !helpers.shouldCommitRecipeTagsEdit({ key: 'Enter', shiftKey: true }),
    'Shift+Enter should not commit.',
  );

  console.log('PASS recipe-tags-keyboard-tests');
} catch (err) {
  console.error('FAIL recipe-tags-keyboard-tests');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
