#!/usr/bin/env node
'use strict';

const {
  buildGoogleDocsShoppingListDocumentRequests,
  buildGoogleDocsShoppingListParagraphs,
} = require('../googleDocsExport');

function assertJsonEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`);
  }
}

function run() {
  const payload = {
    title: 'Weekly Shopping',
    stores: [
      {
        label: 'SAFEWAY',
        aisles: [
          {
            label: 'Dairy',
            items: ['Greek yogurt'],
          },
          {
            label: 'Produce',
            items: ['Cilantro', 'Limes'],
          },
        ],
      },
      {
        label: 'WHOLE FOODS',
        aisles: [
          {
            label: '',
            items: ['Olive oil'],
          },
        ],
      },
    ],
  };

  assertJsonEqual(
    buildGoogleDocsShoppingListParagraphs(payload),
    [
      { kind: 'store', text: 'SAFEWAY' },
      { kind: 'aisle', text: 'Dairy' },
      { kind: 'item', text: 'Greek yogurt' },
      { kind: 'aisle', text: 'Produce' },
      { kind: 'item', text: 'Cilantro' },
      { kind: 'item', text: 'Limes' },
      { kind: 'spacer', text: '' },
      { kind: 'store', text: 'WHOLE FOODS' },
      { kind: 'item', text: 'Olive oil' },
    ],
    'paragraph builder should preserve section structure and spacer rows',
  );

  const requests = buildGoogleDocsShoppingListDocumentRequests(payload);
  const insertTextRequest = requests.find((request) => request.insertText);
  if (!insertTextRequest) {
    throw new Error('expected insertText request');
  }
  if (
    insertTextRequest.insertText.text !==
    'SAFEWAY\nDairy\nGreek yogurt\nProduce\nCilantro\nLimes\n\nWHOLE FOODS\nOlive oil\n'
  ) {
    throw new Error('insertText request should contain newline-delimited shopping list content');
  }

  const bulletRequests = requests.filter((request) => request.createParagraphBullets);
  if (bulletRequests.length !== 4) {
    throw new Error(`expected 4 checkbox bullet requests, received ${bulletRequests.length}`);
  }

  const boldRequests = requests.filter((request) => request.updateTextStyle);
  if (boldRequests.length !== 2) {
    throw new Error(`expected 2 bold heading requests, received ${boldRequests.length}`);
  }
  const boldRanges = boldRequests.map((request) => request.updateTextStyle.range);
  assertJsonEqual(
    boldRanges,
    [
      { startIndex: 1, endIndex: 8 },
      { startIndex: 52, endIndex: 63 },
    ],
    'store heading ranges should point at the store label text only',
  );

  console.log('Google Docs export tests passed.');
}

run();
