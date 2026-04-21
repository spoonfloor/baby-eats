#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'dist', 'web');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readBuiltFile(relativePath) {
  return fs.readFileSync(path.join(outputRoot, relativePath), 'utf8');
}

function run() {
  childProcess.execFileSync(process.execPath, [path.join(projectRoot, 'scripts', 'buildWeb.js')], {
    cwd: projectRoot,
    stdio: 'pipe',
  });

  const builtMain = readBuiltFile(path.join('js', 'main.js'));
  assert(
    builtMain.includes("window.__FAVORITE_EATS_BUILD__ = Object.freeze({"),
    'Web build should inject the public build config into dist/web/js/main.js.',
  );
  assert(
    builtMain.includes("target: 'web'"),
    'Web build config should target the web artifact.',
  );
  assert(
    builtMain.includes('allowHiddenForceWebModeToggle: false'),
    'Web build config should disable the hidden force-web-mode toggle.',
  );

  const tagsRedirect = readBuiltFile('tags.html');
  assert(
    tagsRedirect.includes('content="0; url=recipes.html"'),
    'tags.html should redirect to recipes.html in the web build.',
  );

  const indexRedirect = readBuiltFile('index.html');
  assert(
    indexRedirect.includes('content="0; url=recipes.html"'),
    'index.html should redirect to recipes.html in the web build.',
  );
  assert(
    !indexRedirect.includes('welcome-page'),
    'index.html should not ship the Electron welcome-page markup in the web build.',
  );
  assert(
    !indexRedirect.includes('Load Recipes'),
    'index.html should not ship the Electron front door in the web build.',
  );

  const recipeEditorRedirect = readBuiltFile('recipeEditor.html');
  assert(
    recipeEditorRedirect.includes('content="0; url=recipes.html"'),
    'recipeEditor.html should redirect to recipes.html in the web build.',
  );

  const shoppingEditorRedirect = readBuiltFile('shoppingEditor.html');
  assert(
    shoppingEditorRedirect.includes('content="0; url=shopping.html"'),
    'shoppingEditor.html should redirect to shopping.html in the web build.',
  );

  assert(
    !fs.existsSync(path.join(outputRoot, 'electronMain.js')),
    'Web build should not copy the Electron entry point.',
  );

  assert(
    fs.existsSync(path.join(outputRoot, 'assets', 'favorite_eats.db')),
    'Web build should include the bundled SQLite database under assets/.',
  );

  console.log('Web build tests passed.');
}

run();
