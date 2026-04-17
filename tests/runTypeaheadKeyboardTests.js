#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const typeaheadPath = path.join(projectRoot, 'js', 'typeahead.js');

function loadHelpers() {
  const source = fs.readFileSync(typeaheadPath, 'utf8');
  const startMarker = '// --- Typeahead keyboard helpers (tests extract this block) ---';
  const endMarker = '// --- End typeahead keyboard helpers ---';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate typeahead keyboard helper block in typeahead.js');
  }

  const snippet = source.slice(start, end + endMarker.length);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'typeahead.keyboard-helpers.js' });

  const helpers = context.window.__typeaheadKeyboardHelpers;
  if (!helpers) throw new Error('Helper export not found on window.');
  return helpers;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run() {
  const helpers = loadHelpers();

  assert(
    helpers.shouldPreserveTextareaShiftEnter(
      { tagName: 'TEXTAREA' },
      { key: 'Enter', shiftKey: true }
    ) === true,
    'Shift+Enter on a textarea should preserve the native newline behavior.'
  );

  assert(
    helpers.shouldPreserveTextareaShiftEnter(
      { tagName: 'TEXTAREA' },
      { key: 'Enter', shiftKey: false }
    ) === false,
    'Plain Enter on a textarea should still be handled by the typeahead.'
  );

  assert(
    helpers.shouldPreserveTextareaShiftEnter(
      { tagName: 'INPUT' },
      { key: 'Enter', shiftKey: true }
    ) === false,
    'Shift+Enter on a single-line input should not opt out of typeahead handling.'
  );

  assert(
    helpers.shouldPreserveTextareaShiftEnter(
      { tagName: 'TEXTAREA' },
      { key: 'Tab', shiftKey: true }
    ) === false,
    'Non-Enter keys should never trigger the textarea newline preservation rule.'
  );

  console.log('Typeahead keyboard tests passed.');
}

run();
