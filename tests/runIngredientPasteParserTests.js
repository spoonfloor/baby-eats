#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const parserPath = path.join(projectRoot, 'js', 'ingredientPasteParser.js');
const fixturesPath = path.join(__dirname, 'ingredientPasteParser.fixtures.json');

function loadParser() {
  const parserSource = fs.readFileSync(parserPath, 'utf8');
  const context = {
    window: {},
    console,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(parserSource, context, { filename: 'ingredientPasteParser.js' });
  if (typeof context.window.parseIngredientLine !== 'function') {
    throw new Error('parseIngredientLine was not attached to window.');
  }
  return context.window.parseIngredientLine;
}

function assertEqual(actual, expected, key, line) {
  if (actual !== expected) {
    throw new Error(
      `Expected "${key}" to be ${JSON.stringify(expected)} but got ${JSON.stringify(
        actual
      )} for line: ${JSON.stringify(line)}`
    );
  }
}

function assertContains(actual, expectedSnippet, key, line) {
  const hay = String(actual || '');
  if (!hay.toLowerCase().includes(String(expectedSnippet).toLowerCase())) {
    throw new Error(
      `Expected "${key}" to contain ${JSON.stringify(
        expectedSnippet
      )} but got ${JSON.stringify(actual)} for line: ${JSON.stringify(line)}`
    );
  }
}

function run() {
  const parseIngredientLine = loadParser();
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  let passed = 0;
  const failures = [];

  fixtures.forEach((fixture, index) => {
    const line = fixture && fixture.line;
    const expect = (fixture && fixture.expect) || {};
    try {
      const parsed = parseIngredientLine(line);
      if (!parsed) {
        throw new Error(`Parser returned null for line: ${JSON.stringify(line)}`);
      }

      Object.keys(expect).forEach((key) => {
        const expectedValue = expect[key];
        if (key === 'nameContains') {
          assertContains(parsed.name, expectedValue, key, line);
          return;
        }
        if (key === 'prepNotesContains') {
          assertContains(parsed.prepNotes, expectedValue, key, line);
          return;
        }
        if (key === 'sizeContains') {
          assertContains(parsed.size, expectedValue, key, line);
          return;
        }
        assertEqual(parsed[key], expectedValue, key, line);
      });

      passed += 1;
    } catch (err) {
      failures.push({
        index,
        line,
        error: err && err.message ? err.message : String(err),
      });
    }
  });

  if (failures.length) {
    console.error(
      `Ingredient parser tests failed: ${failures.length} failed, ${passed} passed.`
    );
    failures.forEach((f) => {
      console.error(`- [${f.index}] ${f.line}`);
      console.error(`  ${f.error}`);
    });
    process.exit(1);
  }

  console.log(`Ingredient parser tests passed: ${passed}/${fixtures.length}.`);
}

run();
