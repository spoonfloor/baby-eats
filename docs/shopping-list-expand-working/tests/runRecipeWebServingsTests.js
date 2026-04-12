#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const utilsPath = path.join(projectRoot, 'js', 'utils.js');

function extractSnippet(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not extract snippet between ${startMarker} and ${endMarker}.`);
  }
  return source.slice(start, end + endMarker.length);
}

function createLocalStorageMock(seed = {}) {
  const store = new Map(
    Object.entries(seed).map(([key, value]) => [String(key), String(value)])
  );
  return {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

function loadHelpers(localStorageSeed = {}) {
  const source = fs.readFileSync(utilsPath, 'utf8');
  const snippet = extractSnippet(
    source,
    '// --- Recipe web servings helpers (tests extract this block) ---',
    '// --- End recipe web servings helpers ---'
  );
  const localStorage = createLocalStorageMock(localStorageSeed);
  const context = {
    console,
    localStorage,
    window: {
      favoriteEatsStorageKeys: {
        recipeWebServings: 'favoriteEats:recipe-web-servings:v1',
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: 'utils.recipe-web-servings.js' });
  const helpers = context.window.favoriteEatsRecipeWebServings;
  if (!helpers) throw new Error('Recipe web servings helpers were not attached to window.');
  return { helpers, localStorage };
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function run() {
  const staleSeed = {
    'favoriteEats:recipe-web-servings:v1': JSON.stringify({ 7: 99 }),
  };
  const { helpers: staleHelpers, localStorage: staleStorage } = loadHelpers(staleSeed);
  const recipe = {
    id: 7,
    servingsDefault: 4,
    servings: {
      default: 4,
      min: null,
      max: null,
    },
  };

  assertEqual(
    staleHelpers.getStoredValue(recipe, { scrubInvalid: false }),
    4,
    'stored servings clamp to recipe default when stale value exceeds bounds'
  );
  assertEqual(
    staleHelpers.getMultiplier(recipe, { scrubInvalid: false }),
    1,
    'clamped stale value yields neutral multiplier'
  );

  staleHelpers.getStoredValue(recipe, { scrubInvalid: true });
  assertEqual(
    staleStorage.getItem('favoriteEats:recipe-web-servings:v1'),
    '{}',
    'scrubbing invalid stale default removes persisted override'
  );

  const validSeed = {
    'favoriteEats:recipe-web-servings:v1': JSON.stringify({ 12: 6 }),
  };
  const { helpers: validHelpers, localStorage: validStorage } = loadHelpers(validSeed);
  const adjustableRecipe = {
    id: 12,
    servingsDefault: 4,
    servings: {
      default: 4,
      min: 2,
      max: 8,
    },
  };

  assertEqual(
    validHelpers.getStoredValue(adjustableRecipe, { scrubInvalid: true }),
    6,
    'valid stored override remains intact'
  );
  assertEqual(
    validHelpers.getMultiplier(adjustableRecipe, { scrubInvalid: true }),
    1.5,
    'valid stored override produces expected multiplier'
  );
  assertEqual(
    validStorage.getItem('favoriteEats:recipe-web-servings:v1'),
    JSON.stringify({ 12: 6 }),
    'valid stored override is preserved during scrubbing'
  );

  console.log('Recipe web servings tests passed.');
}

run();
