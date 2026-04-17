#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const recipeEditorPath = path.join(projectRoot, 'js', 'recipeEditor.js');

function loadHelpers() {
  const source = fs.readFileSync(recipeEditorPath, 'utf8');
  const startMarker = '// --- Recipe tags keyboard helpers (tests extract this block) ---';
  const endMarker = '// --- End recipe tags keyboard helpers ---';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate recipe tags keyboard helper block in recipeEditor.js');
  }

  const snippet = source.slice(start, end + endMarker.length);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'recipeEditor.tags-keyboard-helpers.js' });

  const helpers = context.window.__recipeTagsKeyboardHelpers;
  if (!helpers) throw new Error('Helper export not found on window.');
  return helpers;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run() {
  const helpers = loadHelpers();

  assert(
    helpers.shouldCommitRecipeTagsEdit({ key: 'Enter', shiftKey: false }) === true,
    'Plain Enter should commit the recipe tags edit.'
  );

  assert(
    helpers.shouldCommitRecipeTagsEdit({ key: 'Enter', shiftKey: true }) === false,
    'Shift+Enter should stay in the editor so the browser can insert a newline.'
  );

  assert(
    helpers.shouldCommitRecipeTagsEdit({ key: 'Escape', shiftKey: false }) === false,
    'Escape should not be treated as a commit key.'
  );

  console.log('Recipe tags keyboard tests passed.');
}

run();
