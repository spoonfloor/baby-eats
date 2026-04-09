#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const mainPath = path.join(projectRoot, 'js', 'main.js');

function extractSnippet(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not extract snippet between ${startMarker} and ${endMarker}.`);
  }
  return source.slice(start, end + endMarker.length);
}

function loadHelpers() {
  const source = fs.readFileSync(mainPath, 'utf8');
  const snippet = extractSnippet(
    source,
    '// --- Shopping list checklist helpers (tests extract this block) ---',
    '// --- End shopping list checklist helpers ---',
  );
  const context = {
    window: {},
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
  };
  vm.createContext(context);
  vm.runInContext(snippet, context, {
    filename: 'main.shopping-list-checklist-helpers.js',
  });
  const helpers = context.window.__shoppingListChecklistHelpers;
  if (!helpers) throw new Error('Shopping list checklist helpers were not attached to window.');
  return helpers;
}

function assertJsonEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`);
  }
}

function run() {
  const helpers = loadHelpers();

  const doc = helpers.buildShoppingListDocFromPlanRows([
    { rowType: 'section', text: 'Store A', className: 'shopping-list-section--store' },
    { rowType: 'section', text: 'Produce', className: 'shopping-list-section--aisle' },
    { rowType: 'item', text: '3 avocados', className: 'shopping-list-group-item' },
    { rowType: 'item', text: '2 limes', className: 'shopping-list-group-item' },
    { rowType: 'section', text: 'Aisle 2', className: 'shopping-list-section--aisle' },
    { rowType: 'item', text: 'chips', className: 'shopping-list-group-item' },
    { rowType: 'section', text: 'Unlisted', className: 'shopping-list-section--unlisted' },
    { rowType: 'item', text: 'paper towels', className: 'shopping-list-group-item' },
  ]);

  assertJsonEqual(
    doc.rows.map((row) => ({
      text: row.text,
      checked: row.checked,
      storeLabel: row.storeLabel,
      bucketLabel: row.bucketLabel,
      sourceKey: row.sourceKey,
      sourceText: row.sourceText,
      userEdited: row.userEdited,
      order: row.order,
    })),
    [
      {
        text: '3 avocados',
        checked: false,
        storeLabel: 'Store A',
        bucketLabel: 'Produce',
        sourceKey: '',
        sourceText: '',
        userEdited: false,
        order: 0,
      },
      {
        text: '2 limes',
        checked: false,
        storeLabel: 'Store A',
        bucketLabel: 'Produce',
        sourceKey: '',
        sourceText: '',
        userEdited: false,
        order: 1,
      },
      {
        text: 'chips',
        checked: false,
        storeLabel: 'Store A',
        bucketLabel: 'Aisle 2',
        sourceKey: '',
        sourceText: '',
        userEdited: false,
        order: 2,
      },
      {
        text: 'paper towels',
        checked: false,
        storeLabel: '',
        bucketLabel: 'Unlisted',
        sourceKey: '',
        sourceText: '',
        userEdited: false,
        order: 3,
      },
    ],
    'plan rows should seed checklist rows with store and bucket metadata',
  );

  const sourcedDoc = helpers.buildShoppingListDocFromPlanRows([
    { rowType: 'section', text: 'Store A', className: 'shopping-list-section--store' },
    { rowType: 'section', text: 'Produce', className: 'shopping-list-section--aisle' },
    {
      rowType: 'item',
      key: 'foo',
      text: 'foo (1 cup)',
      className: 'shopping-list-group-item',
    },
  ]);

  assertJsonEqual(
    sourcedDoc.rows.map((row) => ({
      text: row.text,
      sourceKey: row.sourceKey,
      sourceText: row.sourceText,
      sourceStoreLabel: row.sourceStoreLabel,
      sourceBucketLabel: row.sourceBucketLabel,
      userEdited: row.userEdited,
    })),
    [
      {
        text: 'foo (1 cup)',
        sourceKey: 'foo',
        sourceText: 'foo (1 cup)',
        sourceStoreLabel: 'Store A',
        sourceBucketLabel: 'Produce',
        userEdited: false,
      },
    ],
    'generated rows should retain stable source metadata for future merges',
  );

  const merged = helpers.mergeShoppingListDocWithGenerated(
    {
      version: 2,
      rows: [
        {
          id: 'foo-row',
          text: 'bar baz qux',
          checked: false,
          storeLabel: 'Store A',
          bucketLabel: 'Produce',
          sourceKey: 'foo',
          sourceText: 'foo (1 cup)',
          sourceStoreLabel: 'Store A',
          sourceBucketLabel: 'Produce',
          userEdited: true,
          order: 0,
        },
        {
          id: 'lime-row',
          text: '2 limes',
          checked: true,
          storeLabel: 'Store A',
          bucketLabel: 'Produce',
          sourceKey: 'lime',
          sourceText: '2 limes',
          sourceStoreLabel: 'Store A',
          sourceBucketLabel: 'Produce',
          userEdited: false,
          order: 1,
        },
      ],
    },
    helpers.buildShoppingListDocFromPlanRows([
      { rowType: 'section', text: 'Store A', className: 'shopping-list-section--store' },
      { rowType: 'section', text: 'Produce', className: 'shopping-list-section--aisle' },
      {
        rowType: 'item',
        key: 'foo',
        text: 'foo (2 cups)',
        className: 'shopping-list-group-item',
      },
      {
        rowType: 'item',
        key: 'lime',
        text: '2 limes',
        className: 'shopping-list-group-item',
      },
    ]),
  );

  assertJsonEqual(
    merged.conflicts,
    [
      {
        kind: 'update',
        rowId: 'foo-row',
        sourceKey: 'foo',
        currentText: 'bar baz qux',
        previousGeneratedText: 'foo (1 cup)',
        nextGeneratedText: 'foo (2 cups)',
        nextStoreLabel: 'Store A',
        nextBucketLabel: 'Produce',
      },
    ],
    'manually edited generated rows should surface a per-line update conflict',
  );

  assertJsonEqual(
    merged.doc.rows.map((row) => ({
      id: row.id,
      text: row.text,
      checked: row.checked,
      sourceKey: row.sourceKey,
      sourceText: row.sourceText,
      userEdited: row.userEdited,
    })),
    [
      {
        id: 'foo-row',
        text: 'bar baz qux',
        checked: false,
        sourceKey: 'foo',
        sourceText: 'foo (1 cup)',
        userEdited: true,
      },
      {
        id: 'lime-row',
        text: '2 limes',
        checked: true,
        sourceKey: 'lime',
        sourceText: '2 limes',
        userEdited: false,
      },
    ],
    'conflicting rows should keep the user version until that specific conflict is resolved',
  );

  assertJsonEqual(
    helpers.resolveShoppingListDocConflict(merged.doc, merged.conflicts[0], 'keep').rows.map((row) => ({
      id: row.id,
      text: row.text,
      sourceKey: row.sourceKey,
      sourceText: row.sourceText,
      userEdited: row.userEdited,
    })),
    [
      {
        id: 'foo-row',
        text: 'bar baz qux',
        sourceKey: 'foo',
        sourceText: 'foo (2 cups)',
        userEdited: true,
      },
      {
        id: 'lime-row',
        text: '2 limes',
        sourceKey: 'lime',
        sourceText: '2 limes',
        userEdited: false,
      },
    ],
    'keeping a manual edit should acknowledge the latest generated source without overwriting the text',
  );

  assertJsonEqual(
    helpers.resolveShoppingListDocConflict(merged.doc, merged.conflicts[0], 'replace').rows.map((row) => ({
      id: row.id,
      text: row.text,
      sourceKey: row.sourceKey,
      sourceText: row.sourceText,
      userEdited: row.userEdited,
    })),
    [
      {
        id: 'foo-row',
        text: 'foo (2 cups)',
        sourceKey: 'foo',
        sourceText: 'foo (2 cups)',
        userEdited: false,
      },
      {
        id: 'lime-row',
        text: '2 limes',
        sourceKey: 'lime',
        sourceText: '2 limes',
        userEdited: false,
      },
    ],
    'replacing a manual edit should apply the new generated text only for that line',
  );

  const removalConflict = helpers.mergeShoppingListDocWithGenerated(
    {
      version: 2,
      rows: [
        {
          id: 'chips-row',
          text: 'party chips',
          checked: false,
          storeLabel: 'Store A',
          bucketLabel: 'Aisle 2',
          sourceKey: 'chips',
          sourceText: 'chips',
          sourceStoreLabel: 'Store A',
          sourceBucketLabel: 'Aisle 2',
          userEdited: true,
          order: 0,
        },
      ],
    },
    helpers.createEmptyShoppingListDoc(),
  );

  assertJsonEqual(
    removalConflict.conflicts,
    [
      {
        kind: 'remove',
        rowId: 'chips-row',
        sourceKey: 'chips',
        currentText: 'party chips',
        previousGeneratedText: 'chips',
        nextGeneratedText: '',
        nextStoreLabel: '',
        nextBucketLabel: '',
      },
    ],
    'manual edits should also conflict when their generated source disappears',
  );

  assertJsonEqual(
    helpers.resolveShoppingListDocConflict(removalConflict.doc, removalConflict.conflicts[0], 'keep').rows.map((row) => ({
      id: row.id,
      text: row.text,
      sourceKey: row.sourceKey,
      sourceText: row.sourceText,
    })),
    [
      {
        id: 'chips-row',
        text: 'party chips',
        sourceKey: '',
        sourceText: '',
      },
    ],
    'keeping an edited row after source removal should convert it into a manual-only item',
  );

  assertJsonEqual(
    helpers.resolveShoppingListDocConflict(removalConflict.doc, removalConflict.conflicts[0], 'replace').rows,
    [],
    'accepting a source removal should only delete the affected line',
  );

  const displayRows = helpers.getShoppingListChecklistDisplayRows([
    { id: 'a', text: '3 avocados', checked: false, storeLabel: 'Store A', bucketLabel: 'Produce', order: 0 },
    { id: 'b', text: '2 limes', checked: true, storeLabel: 'Store A', bucketLabel: 'Produce', order: 1 },
    { id: 'c', text: 'chips', checked: false, storeLabel: 'Store A', bucketLabel: 'Aisle 2', order: 2 },
    { id: 'd', text: 'paper towels', checked: true, storeLabel: '', bucketLabel: 'Unlisted', order: 3 },
  ]);

  assertJsonEqual(
    displayRows.map((row) => ({
      rowType: row.rowType,
      text: row.text,
      checked: row.checked || false,
      className: row.className,
    })),
    [
      {
        rowType: 'section',
        text: 'Store A',
        checked: false,
        className: 'shopping-list-section--store',
      },
      {
        rowType: 'section',
        text: 'Produce',
        checked: false,
        className: 'shopping-list-section--aisle',
      },
      {
        rowType: 'item',
        text: '3 avocados',
        checked: false,
        className: 'shopping-list-group-item shopping-list-doc-item',
      },
      {
        rowType: 'section',
        text: 'Aisle 2',
        checked: false,
        className: 'shopping-list-section--aisle',
      },
      {
        rowType: 'item',
        text: 'chips',
        checked: false,
        className: 'shopping-list-group-item shopping-list-doc-item',
      },
      {
        rowType: 'section',
        text: 'Completed',
        checked: false,
        className: 'shopping-list-section--completed',
      },
      {
        rowType: 'item',
        text: '2 limes',
        checked: true,
        className: 'shopping-list-group-item shopping-list-doc-item',
      },
      {
        rowType: 'section',
        text: 'Unlisted',
        checked: false,
        className:
          'shopping-list-section--unlisted shopping-list-section--pseudo-unlisted-root',
      },
      {
        rowType: 'section',
        text: 'Completed',
        checked: false,
        className: 'shopping-list-section--completed',
      },
      {
        rowType: 'item',
        text: 'paper towels',
        checked: true,
        className: 'shopping-list-group-item shopping-list-doc-item',
      },
    ],
    'checked items should move into a completed bucket within each store grouping; empty aisle/unlisted headers stay visible',
  );

  const namedAisleCompletedOnlyRows = helpers.getShoppingListChecklistDisplayRows([
    { id: 'n1', text: 'romaine', checked: true, storeLabel: 'Store A', bucketLabel: 'Produce', order: 0 },
    { id: 'n2', text: 'olive oil', checked: true, storeLabel: 'Store A', bucketLabel: 'Aisle 2', order: 1 },
  ]);

  assertJsonEqual(
    namedAisleCompletedOnlyRows.map((row) => ({
      rowType: row.rowType,
      text: row.text,
      checked: row.checked || false,
      className: row.className,
    })),
    [
      {
        rowType: 'section',
        text: 'Store A',
        checked: false,
        className: 'shopping-list-section--store',
      },
      {
        rowType: 'section',
        text: 'Produce',
        checked: false,
        className: 'shopping-list-section--aisle',
      },
      {
        rowType: 'section',
        text: 'Aisle 2',
        checked: false,
        className: 'shopping-list-section--aisle',
      },
      {
        rowType: 'section',
        text: 'Completed',
        checked: false,
        className: 'shopping-list-section--completed',
      },
      {
        rowType: 'item',
        text: 'romaine',
        checked: true,
        className: 'shopping-list-group-item shopping-list-doc-item',
      },
      {
        rowType: 'item',
        text: 'olive oil',
        checked: true,
        className: 'shopping-list-group-item shopping-list-doc-item',
      },
    ],
    'named aisle headers should remain visible even when all aisle items are completed',
  );

  const storeCollapsed = helpers.filterShoppingListChecklistRowsForCollapse(
    displayRows,
    new Set([helpers.shoppingListStoreCollapseKey('Store A')]),
  );
  assertJsonEqual(
    storeCollapsed.map((row) => ({ rowType: row.rowType, text: row.text })),
    [
      { rowType: 'section', text: 'Store A' },
      { rowType: 'section', text: 'Unlisted' },
      { rowType: 'section', text: 'Completed' },
      { rowType: 'item', text: 'paper towels' },
    ],
    'collapsing a named store should hide its aisles/items/completed but not a sibling pseudo-unlisted group',
  );

  const produceAisleCollapsed = helpers.filterShoppingListChecklistRowsForCollapse(
    displayRows,
    new Set([helpers.shoppingListAisleCollapseKey('Store A', 'Produce')]),
  );
  assertJsonEqual(
    produceAisleCollapsed.map((row) => row.text),
    [
      'Store A',
      'Produce',
      'Aisle 2',
      'chips',
      'Completed',
      '2 limes',
      'Unlisted',
      'Completed',
      'paper towels',
    ],
    'collapsing a single aisle should hide only that aisle active items',
  );

  const pseudoCompletedCollapsed = helpers.filterShoppingListChecklistRowsForCollapse(
    displayRows,
    new Set([helpers.shoppingListCompletedCollapseKey('')]),
  );
  assertJsonEqual(
    pseudoCompletedCollapsed.map((row) => row.text),
    [
      'Store A',
      'Produce',
      '3 avocados',
      'Aisle 2',
      'chips',
      'Completed',
      '2 limes',
      'Unlisted',
      'Completed',
    ],
    'collapsing pseudo-unlisted completed should hide completed items but keep the completed header',
  );

  console.log('Shopping list checklist tests passed.');
}

run();
