#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'js', 'main.js');

function loadHelpers() {
  const source = fs.readFileSync(mainPath, 'utf8');
  const startMarker = '// --- Unit/size row state helpers (tests extract this block) ---';
  const endMarker = '// --- End unit/size row state helpers ---';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate unit/size state helper block in main.js');
  }
  const snippet = source.slice(start, end + endMarker.length);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'main.unit-size-helpers.js' });
  const helpers = context.window.__unitSizeRowStateHelpers;
  if (!helpers) throw new Error('Helper export not found on window.');
  return helpers;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function run() {
  const helpers = loadHelpers();

  assert(
    helpers.getUnitSizeRemovalAction(3) === 'remove',
    'Used rows must resolve to remove action.'
  );
  assert(
    helpers.getUnitSizeRemovalAction(0) === 'delete',
    'Unused rows must resolve to delete action.'
  );

  const chipsNone = new Set();
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: false }, chipsNone) === true,
    'Default list should include active rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: true, isRemoved: false }, chipsNone) === false,
    'Default list should hide hidden rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: true }, chipsNone) === false,
    'Default list should hide removed rows.'
  );

  const chipsHidden = new Set(['hidden']);
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: false }, chipsHidden) === false,
    'Hidden chip should hide active rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: true, isRemoved: false }, chipsHidden) === true,
    'Hidden chip should show hidden rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: true }, chipsHidden) === false,
    'Hidden chip should not show removed rows.'
  );

  const chipsRemoved = new Set(['removed']);
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: false }, chipsRemoved) === false,
    'Removed chip should hide active rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: true }, chipsRemoved) === true,
    'Removed chip should show removed rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: true, isRemoved: false }, chipsRemoved) === false,
    'Removed chip should not show hidden rows.'
  );

  const chipsBoth = new Set(['hidden', 'removed']);
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: true, isRemoved: false }, chipsBoth) === true,
    'Hidden+removed chips should include hidden rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: true }, chipsBoth) === true,
    'Hidden+removed chips should include removed rows.'
  );
  assert(
    helpers.shouldShowUnitSizeRow({ isHidden: false, isRemoved: false }, chipsBoth) === false,
    'Hidden+removed chips should hide active rows.'
  );

  assert(
    helpers.isUnitSizeRowSelectable({ isHidden: true, isRemoved: false }) === true,
    'Hidden rows should remain selectable.'
  );
  assert(
    helpers.isUnitSizeRowSelectable({ isHidden: false, isRemoved: true }) === false,
    'Removed rows should be unselectable.'
  );

  console.log('Unit/size state tests passed.');
}

run();
