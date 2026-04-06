#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const recipeEditorPath = path.join(projectRoot, 'js', 'recipeEditor.js');

function loadHelpers() {
  const source = fs.readFileSync(recipeEditorPath, 'utf8');
  const startMarker = '// --- Ingredient reorder helpers (tests extract this block) ---';
  const endMarker = '// --- End ingredient reorder helpers ---';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not locate ingredient reorder helper block in recipeEditor.js');
  }
  const snippet = source.slice(start, end + endMarker.length);
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'recipeEditor.reorder-helpers.js' });
  const helpers = context.window.__ingredientReorderHelpers;
  if (!helpers) throw new Error('Helper export not found on window.');
  return helpers;
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(
    actualJson === expectedJson,
    `${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`
  );
}

function namesOf(list) {
  return list.map((row) => row.name || row.text || '(blank)');
}

function applyMove(list, selectedIndex, delta, helpers) {
  const groupIndices = helpers.getIngredientOrGroupIndices(list, selectedIndex);
  const firstGroupIdx = groupIndices[0];
  const lastGroupIdx = groupIndices[groupIndices.length - 1];
  const groupSize = lastGroupIdx - firstGroupIdx + 1;
  const selectedOffset = groupIndices.indexOf(selectedIndex);
  assert(selectedOffset !== -1, 'Selected index must belong to the resolved group.');

  const next = list.slice();
  if (delta < 0) {
    const targetGroup = helpers.findIngredientAdjacentGroupBounds(next, firstGroupIdx, -1);
    assert(targetGroup, 'Expected a previous group.');
    const groupRows = next.splice(firstGroupIdx, groupSize);
    next.splice(targetGroup.start, 0, ...groupRows);
  } else {
    const targetGroup = helpers.findIngredientAdjacentGroupBounds(next, lastGroupIdx, 1);
    assert(targetGroup, 'Expected a next group.');
    const groupRows = next.splice(firstGroupIdx, groupSize);
    const adjustedTargetEnd = targetGroup.end - groupSize;
    next.splice(adjustedTargetEnd + 1, 0, ...groupRows);
  }

  const movedRow = next.find((row) => row === list[selectedIndex]);
  assert(!!movedRow, 'Moved row should still exist after reorder.');
  return namesOf(next);
}

function run() {
  const helpers = loadHelpers();

  const groupedRows = [
    { name: 'A' },
    { name: 'A or 1', isAlt: true },
    { name: 'B' },
    { name: 'B or 1', isAlt: true },
    { name: 'C' },
    { name: 'C or 1', isAlt: true },
  ];

  assertDeepEqual(
    helpers.getIngredientOrGroupIndices(groupedRows, 1),
    [0, 1],
    'Selecting an OR child should resolve to the full parent group.'
  );

  assertDeepEqual(
    helpers.findIngredientAdjacentGroupBounds(groupedRows, 4, -1),
    { start: 2, end: 3 },
    'Moving up from a later group should target the full previous group, not its OR child.'
  );

  assertDeepEqual(
    applyMove(groupedRows, 4, -1, helpers),
    ['A', 'A or 1', 'C', 'C or 1', 'B', 'B or 1'],
    'Moving a grouped ingredient up should keep the neighboring group intact.'
  );

  assertDeepEqual(
    applyMove(groupedRows, 1, 1, helpers),
    ['B', 'B or 1', 'A', 'A or 1', 'C', 'C or 1'],
    'Moving from an OR child should move the whole group down intact.'
  );

  const rowsWithHeading = [
    { rowType: 'heading', text: 'Sauce' },
    { name: 'Milk' },
    { name: 'Milk or oat milk', isAlt: true },
    { name: 'Butter' },
  ];

  assertDeepEqual(
    helpers.findIngredientAdjacentGroupBounds(rowsWithHeading, 1, -1),
    { start: 0, end: 0 },
    'Headings should remain their own move boundary.'
  );

  console.log('Ingredient reorder tests passed.');
}

run();
