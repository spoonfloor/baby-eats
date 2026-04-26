#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distWebDir = path.join(projectRoot, 'dist', 'web');

function assertExists(relativePath) {
  const absolutePath = path.join(distWebDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing build artifact: dist/web/${relativePath}`);
  }
}

function main() {
  assertExists('index.html');
  assertExists('recipes.html');
  assertExists('recipeEditor.html');
  assertExists('js/main.js');
  assertExists('js/supabaseDataApi.js');
  assertExists('js/buildConfig.js');
  assertExists('css/styles.css');
  console.log('PASS runWebBuildTests');
}

try {
  main();
} catch (err) {
  console.error('FAIL runWebBuildTests');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
