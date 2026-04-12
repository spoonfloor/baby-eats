#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'js', 'main.js');

function loadHelpers() {
  const source = fs.readFileSync(mainPath, 'utf8');
  const startMarker = '// --- Size sort helpers (tests extract this block) ---';
  const endMarker = '// --- End size sort helpers ---';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate size sort helper block in main.js');
  }
  const snippet = source.slice(start, end + endMarker.length);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'main.size-sort-helpers.js' });
  const helpers = context.window.__sizeSortHelpers;
  if (!helpers) throw new Error('Helper export not found on window.');
  return helpers;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertArrayEqual(actual, expected, message) {
  assert(
    Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]),
    `${message}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`
  );
}

function run() {
  const helpers = loadHelpers();

  assertArrayEqual(
    helpers.sortSizeNames(['medium', 'small', 'large', 'extra-large']),
    ['small', 'medium', 'large', 'extra-large'],
    'Named sizes should sort semantically.'
  );

  assertArrayEqual(
    helpers.sortSizeNames(['16 oz', '2 lb', '8 oz']),
    ['8 oz', '16 oz', '2 lb'],
    'Numeric weight sizes should sort by normalized amount.'
  );

  assertArrayEqual(
    helpers
      .sortSizeRows([
        { name: 'medium', sortOrder: 1 },
        { name: 'small', sortOrder: 2 },
        { name: 'large', sortOrder: 3 },
      ])
      .map((row) => row.name),
    ['small', 'medium', 'large'],
    'Known named sizes should beat legacy append order.'
  );

  assertArrayEqual(
    helpers
      .sortSizeRows([
        { name: 'chef-cut', sortOrder: 2 },
        { name: 'rustic', sortOrder: 1 },
      ])
      .map((row) => row.name),
    ['rustic', 'chef-cut'],
    'Unknown text sizes should preserve existing sort_order.'
  );

  console.log('Size sort tests passed.');
}

run();
